// Shared safe AI helpers: structured-object generation that falls back to raw
// text + manual JSON parse, plus key-rotation retries on rate limits.
import { generateObject, generateText, type LanguageModel } from "ai";
import { z } from "zod";
import { withGeminiRetry, DEFAULT_MODEL } from "./ai-gateway";

function cleanJSON(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const first = s.search(/[\[{]/);
  if (first > 0) s = s.slice(first);
  const lastClose = Math.max(s.lastIndexOf("}"), s.lastIndexOf("]"));
  if (lastClose >= 0 && lastClose < s.length - 1) s = s.slice(0, lastClose + 1);
  return s;
}

export async function generateObjectSafe<T extends z.ZodTypeAny>(opts: {
  schema: T;
  prompt: string;
  modelId?: string;
  maxOutputTokens?: number;
}): Promise<{ object: z.infer<T> }> {
  const modelId = opts.modelId ?? DEFAULT_MODEL;
  return await withGeminiRetry(modelId, async (model: LanguageModel) => {
    try {
      const r = await generateObject({
        model,
        schema: opts.schema,
        prompt: opts.prompt,
        maxOutputTokens: opts.maxOutputTokens,
      });
      return { object: r.object };
    } catch (err) {
      const { text } = await generateText({
        model,
        prompt:
          opts.prompt +
          "\n\nReturn ONLY valid JSON matching the requested schema. No prose, no markdown.",
        maxOutputTokens: opts.maxOutputTokens,
      });
      const cleaned = cleanJSON(text);
      let parsed: unknown;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        throw err instanceof Error ? err : new Error(String(err));
      }
      const result = opts.schema.safeParse(parsed);
      if (!result.success) throw err instanceof Error ? err : new Error(String(err));
      return { object: result.data };
    }
  });
}

export async function generateTextSafe(opts: {
  prompt: string;
  modelId?: string;
  maxOutputTokens?: number;
  messages?: any;
}): Promise<{ text: string }> {
  const modelId = opts.modelId ?? DEFAULT_MODEL;
  return await withGeminiRetry(modelId, async (model: LanguageModel) => {
    if (opts.messages) {
      const r = await generateText({
        model,
        messages: opts.messages,
        maxOutputTokens: opts.maxOutputTokens,
      });
      return { text: r.text };
    }
    const r = await generateText({
      model,
      prompt: opts.prompt,
      maxOutputTokens: opts.maxOutputTokens,
    });
    return { text: r.text };
  });
}
