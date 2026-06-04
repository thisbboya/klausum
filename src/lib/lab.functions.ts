import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { DEFAULT_MODEL, resolveModel } from "./ai-gateway";
import { generateObjectSafe } from "./ai-safe";
import { getUserIdFromToken } from "./server-auth";

function model() {
  return resolveModel(DEFAULT_MODEL);
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

// Generate unit tests for the code in an idiomatic framework
const TestsInput = z.object({
  accessToken: z.string(),
  language: z.string(),
  code: z.string().min(1).max(20000),
});
const TestsSchema = z.object({
  framework: z.string().default("generic").describe("e.g. pytest, vitest, jest, JUnit, Catch2, go test, rust #[test]"),
  tests: z.string().default("").describe("Complete runnable test file content for the chosen framework."),
  notes: z.string().default("").describe("1-3 short sentences on what is covered and any edge cases skipped."),
});
export const generateTests = createServerFn({ method: "POST" })
  .inputValidator((d) => TestsInput.parse(d))
  .handler(async ({ data }) => {
    await getUserIdFromToken(data.accessToken);
    try {
      const { object } = await generateObjectSafe({
        
        schema: TestsSchema,
        prompt:
          `Write thorough unit tests for the following ${data.language} code. ` +
          `Pick the most idiomatic test framework for that language. Cover happy paths, edge cases, and error cases. ` +
          `Return a single complete file the student can paste alongside their code.\n\n--- CODE ---\n${data.code}`,
      });
      return object;
    } catch {
      const { text } = await generateText({
        
      model: model(),
        prompt: `Write a complete, idiomatic unit-test file for this ${data.language} code. Output ONLY the code, no commentary.\n\n${data.code}`,
      });
      return { framework: "auto", tests: text, notes: "Generated as plain text — pick the right framework for your project." };
    }
  });

// Explain code: structured walkthrough
const ExplainInput = z.object({
  accessToken: z.string(),
  language: z.string(),
  code: z.string().min(1).max(20000),
});
const ExplainSchema = z.object({
  summary: z.string().default("").describe("2-3 sentence plain-English summary of what the code does."),
  line_by_line: z.array(z.object({ lines: z.string().default(""), explanation: z.string().default("") })).default([]),
  complexity: z.string().default("unknown").describe("Time and space complexity, e.g. 'O(n log n) time, O(n) space'."),
  suggestions: z.array(z.string()).max(5).default([]).describe("Optional refactor or correctness suggestions."),
});
export const explainCode = createServerFn({ method: "POST" })
  .inputValidator((d) => ExplainInput.parse(d))
  .handler(async ({ data }) => {
    await getUserIdFromToken(data.accessToken);
    try {
      const { object } = await generateObjectSafe({
        
        schema: ExplainSchema,
        prompt:
          `Explain this ${data.language} code to an undergraduate. ` +
          `Group consecutive lines that form one logical step. Be precise but accessible.\n\n--- CODE ---\n${data.code}`,
      });
      return object;
    } catch {
      const { text } = await generateText({
        
      model: model(),
        prompt: `Explain this ${data.language} code to an undergraduate in plain English, then list 3 short suggestions.\n\n${data.code}`,
      });
      return { summary: text, line_by_line: [], complexity: "unknown", suggestions: [] };
    }
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
    const { object } = await generateObjectSafe({
      
      schema: TranscriptSchema,
      prompt:
        `Subject: ${data.subject}. Below is a voice-note transcript from a student. ` +
        `Produce: a 3-sentence summary, 4-6 key points (one line each), and 4-6 study flashcards (front/back, Bloom 1-4).\n\n` +
        `TRANSCRIPT:\n${data.transcript.slice(0, 16000)}`,
    });
    return object;
  });
