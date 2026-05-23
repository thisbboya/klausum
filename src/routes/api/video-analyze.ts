import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { getUserIdFromToken } from "@/lib/server-auth";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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

        const gemKey = process.env.GEMINI_API_KEY;
        if (!gemKey) return new Response("Missing GEMINI_API_KEY", { status: 500 });

        const google = createGoogleGenerativeAI({ apiKey: gemKey });
        const model = google("gemini-2.5-flash");

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
- Generate 5-10 logical chapters with accurate startSeconds.
- Transcript: 40-120 lines, each 3-15 seconds apart. Use the actual spoken words.
- If you cannot access the audio, infer from visible captions/title; do your best.
- Output MUST be valid JSON only.`;

        let raw = "";
        try {
          const result = await generateText({
            model,
            messages: [
              {
                role: "user",
                content: [
                  { type: "file", data: youtubeUrl, mediaType: "video/mp4" },
                  { type: "text", text: prompt },
                ],
              },
            ],
            maxOutputTokens: 8000,
            maxRetries: 1,
          });
          raw = result.text;
        } catch (err) {
          console.error("[video-analyze] Gemini error:", err);
          return new Response(
            `Video analysis failed: ${err instanceof Error ? err.message : "unknown"}`,
            { status: 502 },
          );
        }

        const parsed = safeJson<{
          summary: string;
          durationSeconds: number;
          chapters: Chapter[];
          transcript: TranscriptLine[];
        }>(raw);
        if (!parsed || !Array.isArray(parsed.chapters)) {
          return new Response("Could not parse video analysis", { status: 502 });
        }

        // Sanity-clean
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
        });
      },
    },
  },
});
