import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { resolveModel, DEFAULT_MODEL } from "@/lib/ai-gateway";
import { getUserIdFromToken } from "@/lib/server-auth";

type ChatBody = {
  messages?: unknown;
  mode?: "standard" | "socratic";
  materialContext?: string;
  accessToken?: string;
};

const SOCRATIC = `You are a Socratic tutor. NEVER give direct answers. Instead respond with thoughtful, scaffolded questions that lead the student to discover the answer themselves. If the student is fully stuck after 3 attempts, give the smallest possible hint, then ask another question. Be warm, patient, and rigorous. Format with markdown when helpful. Use $...$ for inline math and $$...$$ for block math.`;

const STANDARD = `You are Klausum, an expert AI tutor. Explain clearly with examples. Be concise but rigorous. Use markdown, including code blocks and math ($...$ inline, $$...$$ block) when relevant. If the student is wrong, correct them gently and explain why.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const body = (await request.json()) as ChatBody;
        if (!Array.isArray(body.messages))
          return new Response("Messages required", { status: 400 });

        if (!body.accessToken) return new Response("Unauthorized", { status: 401 });
        try {
          await getUserIdFromToken(body.accessToken);
        } catch {
          return new Response("Unauthorized", { status: 401 });
        }

        let model;
        try {
          model = resolveModel(DEFAULT_MODEL);
        } catch (e) {
          return new Response(e instanceof Error ? e.message : "No AI provider configured", {
            status: 500,
          });
        }

        const sys = body.mode === "socratic" ? SOCRATIC : STANDARD;
        const ctx = body.materialContext
          ? `\n\nThe student is studying:\n---\n${body.materialContext.slice(0, 10000)}\n---`
          : "";

        const result = streamText({
          model,
          system: sys + ctx,
          messages: await convertToModelMessages(body.messages as UIMessage[]),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: body.messages as UIMessage[],
        });
      },
    },
  },
});
