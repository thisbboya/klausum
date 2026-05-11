import { createServerFn } from "@tanstack/react-start";
import { generateObject, generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider, DEFAULT_MODEL } from "./ai-gateway";
import { getUserIdFromToken } from "./server-auth";

function model() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  return createLovableAiGatewayProvider(key)(DEFAULT_MODEL);
}

// Debug code: explain errors and suggest a fix
const DebugInput = z.object({
  accessToken: z.string(),
  language: z.string(),
  code: z.string().min(1).max(20000),
  output: z.string().max(10000).optional(),
  question: z.string().optional(),
});
export const debugCode = createServerFn({ method: "POST" })
  .inputValidator((d) => DebugInput.parse(d))
  .handler(async ({ data }) => {
    await getUserIdFromToken(data.accessToken);
    const { text } = await generateText({
      model: model(),
      prompt:
        `You are a Socratic coding tutor. The student asks: "${data.question ?? "Help me understand this output."}"\n` +
        `Language: ${data.language}\n--- CODE ---\n${data.code}\n--- OUTPUT/ERROR ---\n${data.output ?? "(no output)"}\n\n` +
        `Respond in 4-7 short sentences:\n1) What the program is trying to do\n2) The most likely issue (point to a specific line if relevant)\n3) ONE leading question to guide the fix\n4) A small hint, not the full corrected code.`,
    });
    return { reply: text };
  });

// Transcribe + summarize a voice note (text only — student types/dictates summary)
const TranscriptInput = z.object({
  accessToken: z.string(),
  transcript: z.string().min(20),
  subject: z.string().default("General"),
});
const TranscriptSchema = z.object({
  summary: z.string(),
  key_points: z.array(z.string()).min(3).max(8),
  flashcards: z
    .array(z.object({ front: z.string(), back: z.string(), bloom_level: z.number().int().min(1).max(6) }))
    .min(3)
    .max(8),
});
export const summarizeVoiceNote = createServerFn({ method: "POST" })
  .inputValidator((d) => TranscriptInput.parse(d))
  .handler(async ({ data }) => {
    await getUserIdFromToken(data.accessToken);
    const { object } = await generateObject({
      model: model(),
      schema: TranscriptSchema,
      prompt:
        `Subject: ${data.subject}. Below is a voice-note transcript from a student. ` +
        `Produce: a 3-sentence summary, 4-6 key points (one line each), and 4-6 study flashcards (front/back, Bloom 1-4).\n\n` +
        `TRANSCRIPT:\n${data.transcript.slice(0, 16000)}`,
    });
    return object;
  });
