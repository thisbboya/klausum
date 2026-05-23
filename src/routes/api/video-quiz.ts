import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { generateText } from "ai";
import { resolveModel, DEFAULT_MODEL } from "@/lib/ai-gateway";
import { getUserIdFromToken } from "@/lib/server-auth";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type TranscriptLine = { start: number; text: string };

type Body = {
  accessToken?: string;
  videoId?: string;
  videoTitle?: string;
  subject?: string;
  level?: string;
};

type Question = {
  question: string;
  options: { A: string; B: string; C: string; D: string };
  correct: "A" | "B" | "C" | "D";
  explanation: string;
  timestamp_seconds: number;
  bloom_level: number;
};

function safeJsonArr<T>(raw: string): T[] | null {
  try {
    const m = raw.match(/```json\s*([\s\S]*?)```/) ?? raw.match(/```\s*([\s\S]*?)```/);
    const text = (m ? m[1] : raw).trim();
    const idx = text.indexOf("[");
    const slice = idx >= 0 ? text.slice(idx) : text;
    return JSON.parse(slice) as T[];
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/video-quiz")({
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
        if (!body.videoId) return new Response("Bad request", { status: 400 });

        const { data: cache } = await supabaseAdmin
          .from("video_chapters")
          .select("transcript, summary, title")
          .eq("youtube_video_id", body.videoId)
          .maybeSingle();
        if (!cache || !Array.isArray(cache.transcript) || cache.transcript.length === 0)
          return new Response("Analyze the video first", { status: 409 });

        const transcript = (cache.transcript as unknown as TranscriptLine[])
          .map((l) => `[${Math.floor(l.start)}s] ${l.text}`)
          .join("\n")
          .slice(0, 14000);

        const prompt = `Generate 8 multiple-choice questions from this YouTube video transcript.
Target: ${body.level ?? "university"} student. Subject: ${body.subject ?? "General"}.
Bloom distribution: 2 L1 (recall), 2 L2 (comprehension), 2 L3 (application), 1 L4 (analysis), 1 L5 (evaluation).

For each question include:
- "question": string
- "options": { "A": ..., "B": ..., "C": ..., "D": ... }
- "correct": "A" | "B" | "C" | "D"
- "explanation": 1-2 sentences
- "timestamp_seconds": integer — where the answer is found
- "bloom_level": 1-6

Return ONLY a JSON array of 8 objects. No prose, no fences.

TRANSCRIPT:
${transcript}`;

        const model = resolveModel(DEFAULT_MODEL);
        const result = await generateText({
          model,
          prompt,
          maxOutputTokens: 4000,
          maxRetries: 1,
        });

        const questions = safeJsonArr<Question>(result.text);
        if (!questions || questions.length === 0)
          return new Response("Could not generate quiz", { status: 502 });

        return Response.json({ questions: questions.slice(0, 12) });
      },
    },
  },
});
