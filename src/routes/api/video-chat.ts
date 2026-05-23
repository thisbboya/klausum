import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { resolveModel, DEFAULT_MODEL } from "@/lib/ai-gateway";
import { getUserIdFromToken } from "@/lib/server-auth";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type TranscriptLine = { start: number; text: string };
type Chapter = { title: string; startSeconds: number; summary: string };

type Body = {
  accessToken?: string;
  videoId?: string;
  videoTitle?: string;
  channel?: string;
  currentTime?: number;
  duration?: number;
  primaryStyle?: string;
  messages?: UIMessage[];
};

function fmt(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export const Route = createFileRoute("/api/video-chat")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const body = (await request.json()) as Body;
        if (!body.accessToken) return new Response("Unauthorized", { status: 401 });
        let userId: string;
        try {
          userId = await getUserIdFromToken(body.accessToken);
        } catch {
          return new Response("Unauthorized", { status: 401 });
        }
        if (!Array.isArray(body.messages) || !body.videoId)
          return new Response("Bad request", { status: 400 });
        const videoId: string = body.videoId;
        const messagesIn: UIMessage[] = body.messages;



        const { data: cache } = await supabaseAdmin
          .from("video_chapters")
          .select("transcript, chapters, summary, title")
          .eq("youtube_video_id", body.videoId)
          .maybeSingle();

        const transcript = (cache?.transcript ?? []) as unknown as TranscriptLine[];
        const chapters = (cache?.chapters ?? []) as unknown as Chapter[];
        const currentTime = Math.max(0, body.currentTime ?? 0);
        const duration = Math.max(0, body.duration ?? 0);

        // Find current chapter
        const currentChapter =
          chapters
            .slice()
            .reverse()
            .find((c) => c.startSeconds <= currentTime)?.title ?? "Introduction";

        // Local transcript window (±45s)
        const window = transcript
          .filter((l) => l.start >= currentTime - 45 && l.start <= currentTime + 45)
          .map((l) => `[${fmt(l.start)}] ${l.text}`)
          .join("\n");

        const fullTranscriptSnippet = transcript
          .map((l) => `[${fmt(l.start)}] ${l.text}`)
          .join("\n")
          .slice(0, 12000);

        const system = `You are Klausum — a warm, knowledgeable study companion helping a student watch a YouTube video.

═══ VIDEO ═══
Title: ${body.videoTitle ?? cache?.title ?? "Untitled video"}
Channel: ${body.channel ?? "Unknown"}
Length: ${fmt(duration)}
Summary: ${cache?.summary ?? "(no summary yet)"}

═══ STUDENT POSITION ═══
Currently at: ${fmt(currentTime)} of ${fmt(duration)}
Current chapter: ${currentChapter}

═══ TRANSCRIPT AROUND CURRENT MOMENT (±45s) ═══
${window || "(no transcript near this moment)"}

═══ FULL TRANSCRIPT (truncated) ═══
${fullTranscriptSnippet}

═══ RULES ═══
- Always know the student's timestamp. Reference it: "At ${fmt(currentTime)}..."
- If asked "what did they just say?" — quote from the window above.
- If asked about another topic, say "Jump to [MM:SS] for that — I've marked it." and include the timestamp inline as **[MM:SS]** so the UI can pick it up.
- Use **bold** for key terms, $...$ for inline math, $$...$$ for block math.
- Max 4 short paragraphs. End with one Socratic follow-up question.
- Adapt to VARK style: ${body.primaryStyle ?? "Reading"}.
- When the student is right: "Ayekoo! 🎉"`;

        const model = resolveModel(DEFAULT_MODEL);
        const result = streamText({
          model,
          system,
          messages: await convertToModelMessages(body.messages),
          maxOutputTokens: 1200,
          onFinish: async ({ text }) => {
            try {
              const last = body.messages?.[body.messages.length - 1];
              const userText =
                last && last.role === "user"
                  ? last.parts
                      .filter((p) => p.type === "text")
                      .map((p) => ("text" in p ? p.text : ""))
                      .join("\n")
                  : "";
              if (userText) {
                await supabaseAdmin.from("video_chat_messages").insert([
                  {
                    user_id: userId,
                    youtube_video_id: body.videoId,
                    role: "user",
                    content: userText.slice(0, 4000),
                    timestamp_seconds: currentTime,
                  },
                  {
                    user_id: userId,
                    youtube_video_id: body.videoId,
                    role: "ai",
                    content: text.slice(0, 8000),
                    timestamp_seconds: currentTime,
                  },
                ]);
                await supabaseAdmin.rpc("increment_ai_messages", { p_user_id: userId });
              }
            } catch (e) {
              console.error("[video-chat] persist failed", e);
            }
          },
        });

        return result.toUIMessageStreamResponse({ originalMessages: body.messages });
      },
    },
  },
});
