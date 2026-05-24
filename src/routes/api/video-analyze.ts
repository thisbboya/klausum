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
  },
): Promise<{ text: string } | { error: string; tokenOverflow?: boolean }> {
  const maxAttempts = 4;
  for (let i = 0; i < maxAttempts; i++) {
    const k = pickGeminiKey();
    if (!k) return { error: "All Gemini keys at rate limit" };
    try {
      const google = createGoogleGenerativeAI({ apiKey: k.key });
      const model = google(options.model ?? "gemini-2.5-flash");
      const content: Array<
        { type: "text"; text: string } | { type: "file"; data: string; mediaType: string }
      > = [];
      if (options.fileUrl) {
        content.push({ type: "file", data: options.fileUrl, mediaType: "video/mp4" });
      }
      content.push({ type: "text", text: prompt });
      const result = await generateText({
        model,
        messages: [{ role: "user", content }],
        maxOutputTokens: options.maxOutputTokens ?? 4000,
        maxRetries: 0,
      });
      return { text: result.text };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const status = (err as { statusCode?: number; status?: number })?.statusCode ?? (err as { status?: number })?.status;
      // Token overflow — content issue, no retry helps
      if (/token count exceeds|exceeds the maximum/i.test(msg)) {
        return { error: msg, tokenOverflow: true };
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

export const Route = createFileRoute("/api/video-analyze")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const body = (await request.json()) as Body;
        if (!body.accessToken) return new Response("Unauthorized", { status: 401 });
        try {
          await getUserIdFromToken(body.accessToken);
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

        if (!hasGeminiKeys())
          return new Response("Missing GEMINI_API_KEY", { status: 500 });

        const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
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
            model: "gemini-2.5-flash",
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
