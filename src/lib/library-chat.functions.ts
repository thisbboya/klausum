import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { withGeminiRetry, PRO_MODEL } from "./ai-gateway";

const Input = z.object({
  question: z.string().min(1).max(4000),
  history: z
    .array(z.object({ role: z.enum(["user", "ai"]), content: z.string().max(4000) }))
    .max(10)
    .optional(),
});

/**
 * Library-wide chat: searches across ALL of the user's study materials and answers
 * with citations of the form [Material: <title>].
 */
export const chatWithLibrary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: materials, error } = await supabase
      .from("study_materials")
      .select("id, title, subject, original_content")
      .eq("user_id", userId)
      .limit(50);
    if (error) throw error;

    const q = data.question.toLowerCase();
    const terms = Array.from(new Set(q.split(/\W+/).filter((t) => t.length > 3)));

    type Hit = { title: string; snippet: string; score: number };
    const hits: Hit[] = [];

    for (const m of materials ?? []) {
      const text = m.original_content ?? "";
      if (!text) continue;
      const lower = text.toLowerCase();
      const score = terms.reduce((acc, t) => acc + (lower.includes(t) ? 1 : 0), 0);
      if (score > 0) {
        const idx = terms.map((t) => lower.indexOf(t)).filter((n) => n >= 0)[0] ?? 0;
        hits.push({
          title: m.title,
          snippet: text.slice(Math.max(0, idx - 100), idx + 500),
          score,
        });
      }
    }

    hits.sort((a, b) => b.score - a.score);
    const top = hits.slice(0, 8);

    const history = (data.history ?? [])
      .map((m) => `${m.role === "user" ? "Student" : "Klausum"}: ${m.content}`)
      .join("\n\n");

    const context_block = top
      .map((h, i) => `[${i + 1}] Material: "${h.title}"\n${h.snippet}`)
      .join("\n\n---\n\n");

    const prompt = `You are Klausum, the student's study companion. You have access to their entire library. Answer using ONLY the passages below when possible. Cite claims as [Material: "<title>"]. If nothing in the library answers, say so and answer briefly from general knowledge, prefixed with "(general)".

═══ RELEVANT PASSAGES ═══
${context_block || "(no library matches — answer from general knowledge)"}

═══ CONVERSATION ═══
${history}

Student: ${data.question}

Klausum:`;

    const { text } = await withGeminiRetry(PRO_MODEL, (model) =>
      generateText({ model, prompt, maxOutputTokens: 1200 }),
    );

    return {
      reply: text,
      sources: top.map((h) => ({ title: h.title, page: null as number | null })),
    };
  });
