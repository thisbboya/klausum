// Shared safe AI helpers: structured-object generation that falls back to raw
// text + manual JSON parse, plus key-rotation retries on rate limits.
import { generateObject, generateText, type LanguageModel } from "ai";
import { z } from "zod";
import { withGeminiRetry, DEFAULT_MODEL } from "./ai-gateway";

/** Multi-strategy JSON extractor — mirrors the v9 safeParseJSON spec.
 *  Tries fence-stripping, then greedy array/object matching, and finally
 *  a slice from the first bracket to the end. Returns fallback if all fail. */
export function safeParseJSON<T>(raw: string, fallback: T): T {
  if (!raw || typeof raw !== "string") return fallback;
  // 1) strip opening + closing markdown fences
  const s1 = raw.replace(/^[\s\S]*?```json\s*/i, "").replace(/```[\s\S]*$/i, "").trim();
  try { const r = JSON.parse(s1); if (r !== null) return r as T; } catch {}
  // 2) strip any backtick variants
  const s2 = raw.replace(/```[a-z]*\s*/gi, "").replace(/```/g, "").trim();
  try { const r = JSON.parse(s2); if (r !== null) return r as T; } catch {}
  // 3) greedy JSON array match
  const arrMatch = raw.match(/\[[\s\S]*\]/);
  if (arrMatch) { try { return JSON.parse(arrMatch[0]) as T; } catch {} }
  // 4) greedy JSON object match
  const objMatch = raw.match(/\{[\s\S]*\}/);
  if (objMatch) { try { return JSON.parse(objMatch[0]) as T; } catch {} }
  // 5) slice from the first bracket to the end
  const firstArr = raw.indexOf("[");
  const firstObj = raw.indexOf("{");
  const candidates = [firstArr, firstObj].filter((n) => n >= 0);
  if (candidates.length) {
    try { return JSON.parse(raw.slice(Math.min(...candidates))) as T; } catch {}
  }
  return fallback;
}

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
  return (await withGeminiRetry(modelId, async (model: LanguageModel) => {
    try {
      const r = await generateObject({
        model,
        schema: opts.schema,
        prompt: opts.prompt,
        maxOutputTokens: opts.maxOutputTokens,
      });
      return { object: r.object as z.infer<T> };
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
        parsed = safeParseJSON<unknown>(text, null as unknown);
        if (parsed == null) {
          throw err instanceof Error ? err : new Error(String(err));
        }
      }
      const result = opts.schema.safeParse(parsed);
      if (!result.success) {
        // Surface WHICH field/bound failed — "response did not match schema"
        // alone made these impossible to diagnose in production.
        const detail = result.error.issues
          .slice(0, 3)
          .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
          .join("; ");
        throw new Error(`AI response did not match the expected shape — ${detail}`);
      }
      return { object: result.data as z.infer<T> };
    }
  })) as { object: z.infer<T> };
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
