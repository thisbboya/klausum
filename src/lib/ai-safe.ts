// Shared helper: robust structured-output generation for Gemini.
// Tries generateObject first; on failure, retries with generateText + manual
// JSON cleanup + Zod validation. Fixes "No object generated: response did
// not match schema" errors caused by Gemini wrapping JSON in code fences.
import { generateObject, generateText, type LanguageModel } from "ai";
import { z } from "zod";

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
  model: LanguageModel;
  schema: T;
  prompt: string;
}): Promise<{ object: z.infer<T> }> {
  try {
    return await generateObject({ model: opts.model, schema: opts.schema, prompt: opts.prompt });
  } catch (err) {
    const { text } = await generateText({
      model: opts.model,
      prompt:
        opts.prompt +
        `\n\nCRITICAL: Return ONLY raw JSON matching the schema. ` +
        `No prose. No markdown fences. Start your response with { or [.`,
    });
    let parsed: unknown;
    try { parsed = JSON.parse(cleanJSON(text)); } catch {
      throw err instanceof Error ? err : new Error(String(err));
    }
    const result = opts.schema.safeParse(parsed);
    if (!result.success) throw err instanceof Error ? err : new Error(String(err));
    return { object: result.data };
  }
}
