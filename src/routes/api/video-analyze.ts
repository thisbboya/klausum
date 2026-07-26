import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { getUserIdFromToken } from "@/lib/server-auth";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { pickGeminiKey, blockGeminiKey, hasGeminiKeys } from "@/lib/gemini-keys.server";

type Body = {
  accessToken?: string;
  videoId?: string;
  title?: string;
  channel?: string;
  force?: boolean;
};

type Chapter = { title: string; startSeconds: number; summary: string };
type TranscriptLine = { start: number; text: string };

function safeJson<T>(raw: string): T | null {
  try {
    const m = raw.match(/```json\s*([\s\S]*?)```/) ?? raw.match(/```\s*([\s\S]*?)```/);
    const text = (m ? m[1] : raw).trim();
    const start = text.indexOf("{");
    const startA = text.indexOf("[");
    const idx = start === -1 ? startA : startA === -1 ? start : Math.min(start, startA);
    const slice = idx >= 0 ? text.slice(idx) : text;
    return JSON.parse(slice) as T;
  } catch {
    return null;
  }
}

function fallbackChapters(title: string, durationSeconds: number): Chapter[] {
  const dur = Math.max(60, durationSeconds || 0);
  const count = Math.min(8, Math.max(3, Math.floor(dur / 900) + 2));
  const step = dur / count;
  return Array.from({ length: count }, (_, i) => ({
    title:
      i === 0
        ? "Introduction"
        : i === count - 1
          ? "Conclusion"
          : `Part ${i + 1}${title ? ` — ${title.slice(0, 40)}` : ""}`,
    startSeconds: Math.round(i * step),
    summary: `Section ${i + 1} of ${count}`,
  }));
}

async function callGeminiWithRotation(
  prompt: string,
  options: {
    fileUrl?: string;
    maxOutputTokens?: number;
    model?: string;
    /** Sample the video at a low frame rate so long videos fit the 1M-token
     *  context window instead of overflowing (default ~1fps ≈ 263 tok/sec). */
    lowFps?: boolean;
  },
): Promise<{ text: string } | { error: string; tokenOverflow?: boolean }> {
  const maxAttempts = 4;
  for (let i = 0; i < maxAttempts; i++) {
    const k = pickGeminiKey();
    if (!k) return { error: "All Gemini keys at rate limit" };
    try {
      const google = createGoogleGenerativeAI({ apiKey: k.key });
      const model = google(options.model ?? "gemini-3-flash-preview");
      const content: Array<any> = [];
      if (options.fileUrl) {
        content.push({
          type: "file",
          data: options.fileUrl,
          mediaType: "video/mp4",
          ...(options.lowFps
            ? { providerOptions: { google: { videoMetadata: { fps: 0.15 } } } }
            : {}),
        });
      }
      content.push({ type: "text", text: prompt });
      const result = await generateText({
        model,
        messages: [{ role: "user", content }],
        maxOutputTokens: options.maxOutputTokens ?? 4000,
        maxRetries: 0,
        ...(options.lowFps
          ? { providerOptions: { google: { mediaResolution: "MEDIA_RESOLUTION_LOW" } } }
          : {}),
      });
      return { text: result.text };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const status = (err as { statusCode?: number; status?: number })?.statusCode ?? (err as { status?: number })?.status;
      // Token overflow — content issue, no retry helps
      if (/token count exceeds|exceeds the maximum/i.test(msg)) {
        return { error: msg, tokenOverflow: true };
      }
      // Transient Google-side outage (503 "high demand") — back off, retry
      if (status === 503 || status === 500 || /unavailable|high demand|overloaded/i.test(msg)) {
        await new Promise((r) => setTimeout(r, 700 * (i + 1)));
        continue;
      }
      // Rate limit / quota — block this key, try next
      if (status === 429 || /quota|rate limit|429/i.test(msg)) {
        blockGeminiKey(k.key, 60_000);
        continue;
      }
      // Invalid key — block long
      if (status === 403 || status === 401) {
        blockGeminiKey(k.key, 24 * 60 * 60 * 1000);
        continue;
      }
      // Other error — try next key
      if (i === maxAttempts - 1) return { error: msg };
    }
  }
  return { error: "All Gemini attempts failed" };
}

/**
 * Fetch the video's REAL caption track.
 *
 * This is the preferred source by a wide margin. Feeding the video file to
 * Gemini costs ~263 tokens per second (a 1h video ≈ 950k tokens and a long
 * lecture blows past the 1,048,576-token ceiling entirely), and it makes the
 * model *invent* the transcript from what it sees. Captions are ground truth,
 * cost ~1 token per word, and never overflow.
 *
 * Prefers English, falls back to whatever track exists (the library otherwise
 * returns the first track, which is often a random translated language).
 */
async function fetchRealTranscript(
  videoId: string,
): Promise<{ lines: TranscriptLine[]; durationSeconds: number } | null> {
  const { YoutubeTranscript } = await import("youtube-transcript");
  // Every request leaves from one server IP, so YouTube will occasionally
  // throttle. Rotate language strategies and retry with jittered backoff before
  // giving up — a transient 429/timeout shouldn't cost the user their captions.
  const strategies = [{ lang: "en" }, {}, { lang: "en" }];
  for (let i = 0; i < strategies.length; i++) {
    const opts = strategies[i];
    if (i > 0) {
      const backoff = 400 * i + Math.floor(Math.random() * 400); // jitter
      await new Promise((r) => setTimeout(r, backoff));
    }
    try {
      const raw = await YoutubeTranscript.fetchTranscript(videoId, opts as any);
      if (!raw?.length) continue;
      const lines: TranscriptLine[] = raw
        .map((r: any) => ({
          start: Math.max(0, Math.round((r.offset ?? 0) / 1000)),
          // captions arrive HTML-escaped
          text: String(r.text ?? "")
            .replace(/&amp;#39;|&#39;/g, "'")
            .replace(/&amp;quot;|&quot;/g, '"')
            .replace(/&amp;/g, "&")
            .replace(/\s+/g, " ")
            .trim(),
        }))
        .filter((l: TranscriptLine) => l.text.length > 0);
      if (!lines.length) continue;
      const last = lines[lines.length - 1];
      return { lines, durationSeconds: last.start + 5 };
    } catch {
      // no captions in this language — try the next strategy
    }
  }
  return null;
}

/** Collapse transcript lines into a timestamped script for the model. */
function transcriptToScript(lines: TranscriptLine[], maxChars = 60000): string {
  const out: string[] = [];
  let len = 0;
  for (const l of lines) {
    const m = Math.floor(l.start / 60);
    const s = String(l.start % 60).padStart(2, "0");
    const piece = `[${m}:${s}] ${l.text}`;
    if (len + piece.length > maxChars) break;
    out.push(piece);
    len += piece.length + 1;
  }
  return out.join("\n");
}

export const Route = createFileRoute("/api/video-analyze")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const body = (await request.json()) as Body;
        if (!body.accessToken) return new Response("Unauthorized", { status: 401 });
        let vaUserId: string;
        try {
          vaUserId = await getUserIdFromToken(body.accessToken);
        } catch {
          return new Response("Unauthorized", { status: 401 });
        }
        const videoId = (body.videoId ?? "").trim();
        if (!/^[a-zA-Z0-9_-]{6,20}$/.test(videoId))
          return new Response("Invalid videoId", { status: 400 });

        // Cache hit?
        if (!body.force) {
          const { data: cached } = await supabaseAdmin
            .from("video_chapters")
            .select("*")
            .eq("youtube_video_id", videoId)
            .maybeSingle();
          if (cached && Array.isArray(cached.chapters) && cached.chapters.length > 0) {
            return Response.json({
              chapters: cached.chapters as unknown as Chapter[],
              transcript: (cached.transcript ?? []) as unknown as TranscriptLine[],
              summary: cached.summary ?? "",
              durationSeconds: cached.duration_seconds ?? 0,
              cached: true,
            });
          }
        }

        // Quota is consumed only on a cache miss — replaying an already
        // analyzed video costs the user nothing.
        try {
          const { consumeAiQuota } = await import("@/lib/rate-limit.server");
          await consumeAiQuota(vaUserId, "video_analyze");
        } catch (e) {
          return new Response(e instanceof Error ? e.message : "RATE_LIMIT", { status: 429 });
        }

        if (!hasGeminiKeys())
          return new Response("Missing GEMINI_API_KEY", { status: 500 });

        const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

        // ── PREFERRED PATH: real captions ────────────────────────────────
        // Chapters are derived from the actual script (a few thousand tokens)
        // instead of uploading the video (~263 tokens/sec). No overflow, no
        // hallucinated transcript, and a fraction of the quota.
        const real = await fetchRealTranscript(videoId);
        if (real) {
          const script = transcriptToScript(real.lines);
          const chapterPrompt = `Below is the real timestamped transcript of a YouTube video titled "${body.title ?? "Untitled"}".

Return ONLY valid JSON (no prose, no markdown fences):
{
  "summary": "1-2 sentence overall summary of the whole video",
  "chapters": [ { "title": "Chapter name", "startSeconds": 0, "summary": "What this chapter covers (max 20 words)" } ]
}

Rules:
- Produce 5-10 logical chapters covering the FULL duration (the video is ~${Math.round(real.durationSeconds / 60)} minutes).
- startSeconds MUST come from the [m:ss] markers and increase monotonically, starting at 0.
- Base everything strictly on the transcript below.

--- TRANSCRIPT ---
${script}`;

          const res = await callGeminiWithRotation(chapterPrompt, { maxOutputTokens: 4000 });
          if ("text" in res) {
            const p = safeJson(res.text) as { summary?: string; chapters?: Chapter[] } | null;
            if (p && Array.isArray(p.chapters) && p.chapters.length > 0) {
              const chapters = p.chapters
                .map((c) => ({
                  title: String(c.title ?? "Section"),
                  startSeconds: Math.max(0, Math.floor(Number(c.startSeconds) || 0)),
                  summary: String(c.summary ?? ""),
                }))
                .sort((a, b) => a.startSeconds - b.startSeconds);

              await supabaseAdmin.from("video_chapters").upsert(
                {
                  youtube_video_id: videoId,
                  title: body.title ?? null,
                  chapters: chapters as any,
                  transcript: real.lines as any,
                  summary: p.summary ?? "",
                  duration_seconds: real.durationSeconds,
                },
                { onConflict: "youtube_video_id" },
              );

              return Response.json({
                chapters,
                transcript: real.lines,
                summary: p.summary ?? "",
                durationSeconds: real.durationSeconds,
                source: "captions",
              });
            }
          }

          // Model failed but the captions are still valuable on their own.
          return Response.json({
            chapters: fallbackChapters(body.title ?? "Video", real.durationSeconds),
            transcript: real.lines,
            summary: "",
            durationSeconds: real.durationSeconds,
            source: "captions-no-chapters",
          });
        }
        // ── No captions available → fall back to video analysis below ────
        const prompt = `Analyze this YouTube video and produce a structured study breakdown.

Return ONLY valid JSON in this exact shape (no prose, no markdown fences):
{
  "summary": "1-2 sentence overall summary",
  "durationSeconds": <approximate video length in seconds, integer>,
  "chapters": [
    { "title": "Chapter name", "startSeconds": 0, "summary": "What this chapter covers (max 20 words)" }
  ],
  "transcript": [
    { "start": 0, "text": "Sentence-level transcript line" }
  ]
}

Rules:
- Generate 5-8 logical chapters with accurate startSeconds.
- Transcript: 40-80 lines, each 5-15 seconds apart. Use actual spoken words.
- If the video is very long, sample lines across the full duration (don't truncate early).
- Output MUST be valid JSON only.`;

        // First attempt: full analysis with video file
        let firstAttempt = await callGeminiWithRotation(prompt, {
          fileUrl: youtubeUrl,
          maxOutputTokens: 6000,
        });

        let parsed:
          | {
              summary: string;
              durationSeconds: number;
              chapters: Chapter[];
              transcript: TranscriptLine[];
            }
          | null = null;

        if ("text" in firstAttempt) {
          parsed = safeJson(firstAttempt.text);
        }

        // Long video blew past the 1M-token window → retry the SAME full
        // analysis at a low frame rate/resolution. This keeps real chapters and
        // a real transcript for long videos instead of dropping to title-only.
        if (
          (!parsed || !Array.isArray(parsed.chapters) || parsed.chapters.length === 0) &&
          "tokenOverflow" in firstAttempt &&
          firstAttempt.tokenOverflow
        ) {
          const lowFpsAttempt = await callGeminiWithRotation(prompt, {
            fileUrl: youtubeUrl,
            maxOutputTokens: 6000,
            lowFps: true,
          });
          if ("text" in lowFpsAttempt) {
            const retryParsed = safeJson(lowFpsAttempt.text) as typeof parsed;
            if (retryParsed && Array.isArray(retryParsed.chapters) && retryParsed.chapters.length > 0) {
              parsed = retryParsed;
              firstAttempt = lowFpsAttempt;
            }
          }
        }

        // Token overflow OR parse failure → fallback: title-only chapter generation
        if (!parsed || !Array.isArray(parsed.chapters) || parsed.chapters.length === 0) {
          const overflow = "tokenOverflow" in firstAttempt && firstAttempt.tokenOverflow;
          console.warn("[video-analyze] primary failed, using fallback", {
            overflow,
            err: "error" in firstAttempt ? firstAttempt.error : "parse",
          });

          // Try a metadata-only call (no video file attached) for short summary + chapters
          const metaPrompt = `For the YouTube video titled "${body.title ?? "Untitled"}"${
            body.channel ? ` by ${body.channel}` : ""
          }, produce a study breakdown WITHOUT watching the video.

Return ONLY valid JSON:
{
  "summary": "1-2 sentence summary based on the title",
  "durationSeconds": 0,
  "chapters": [{ "title": "...", "startSeconds": 0, "summary": "..." }]
}

Generate 4-6 plausible chapters spaced evenly across an estimated duration based on the title.`;
          const metaAttempt = await callGeminiWithRotation(metaPrompt, {
            maxOutputTokens: 1500,
            model: "gemini-3-flash-preview",
          });
          if ("text" in metaAttempt) {
            const metaParsed = safeJson<{
              summary: string;
              durationSeconds: number;
              chapters: Chapter[];
            }>(metaAttempt.text);
            if (metaParsed && Array.isArray(metaParsed.chapters)) {
              parsed = {
                summary: metaParsed.summary ?? "",
                durationSeconds: metaParsed.durationSeconds || 0,
                chapters: metaParsed.chapters,
                transcript: [],
              };
            }
          }

          // Last resort: pure deterministic fallback chapters
          if (!parsed || !Array.isArray(parsed.chapters) || parsed.chapters.length === 0) {
            parsed = {
              summary: body.title ?? "",
              durationSeconds: 0,
              chapters: fallbackChapters(body.title ?? "", 0),
              transcript: [],
            };
          }
        }

        const chapters = parsed.chapters
          .filter((c) => c && typeof c.title === "string" && typeof c.startSeconds === "number")
          .slice(0, 12)
          .map((c) => ({
            title: c.title.slice(0, 120),
            startSeconds: Math.max(0, Math.floor(c.startSeconds)),
            summary: (c.summary ?? "").slice(0, 280),
          }));
        const transcript = (parsed.transcript ?? [])
          .filter((l) => l && typeof l.start === "number" && typeof l.text === "string")
          .slice(0, 200)
          .map((l) => ({ start: Math.max(0, Math.floor(l.start)), text: l.text.slice(0, 400) }));

        await supabaseAdmin.from("video_chapters").upsert({
          youtube_video_id: videoId,
          title: body.title?.slice(0, 300) ?? null,
          channel: body.channel?.slice(0, 200) ?? null,
          chapters: chapters as unknown as never,
          transcript: transcript as unknown as never,
          summary: (parsed.summary ?? "").slice(0, 1000),
          duration_seconds: Math.max(0, Math.floor(parsed.durationSeconds || 0)),
          generated_at: new Date().toISOString(),
        });

        return Response.json({
          chapters,
          transcript,
          summary: parsed.summary ?? "",
          durationSeconds: parsed.durationSeconds ?? 0,
          cached: false,
          degraded: transcript.length === 0,
        });
      },
    },
  },
});
