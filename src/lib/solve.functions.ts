import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateObjectSafe } from "./ai-safe";
import { getUserIdFromToken } from "./server-auth";
import { PRO_MODEL } from "./ai-gateway";

const SolveInput = z.object({
  accessToken: z.string(),
  imageBase64: z.string().min(20).max(6_000_000), // ~4.5 MB base64
  mimeType: z.string().default("image/jpeg"),
});

const SolveSchema = z.object({
  problem_identified: z.string(),
  subject: z.string(),
  steps: z.array(
    z.object({
      step_number: z.number(),
      explanation: z.string(),
      work: z.string(),
    }),
  ),
  final_answer: z.string(),
  confidence: z.enum(["high", "medium", "low"]).catch("medium"),
  topic: z.string(),
});

export type SolveResult = z.infer<typeof SolveSchema>;

export const snapAndSolve = createServerFn({ method: "POST" })
  .inputValidator((d) => SolveInput.parse(d))
  .handler(async ({ data }) => {
    await getUserIdFromToken(data.accessToken);
    const prompt = `You are looking at a photographed homework problem. Identify the exact problem, then solve it with clear step-by-step working exactly as it would appear in a textbook solution.

IMPORTANT: Return ONLY raw JSON matching this shape (no markdown fences):
{
  "problem_identified": "the exact question as read from the image",
  "subject": "Math|Physics|Chemistry|Biology|Engineering|Other",
  "steps": [{"step_number": 1, "explanation": "why we do this", "work": "LaTeX expression"}],
  "final_answer": "boxed final answer (LaTeX if math)",
  "confidence": "high|medium|low",
  "topic": "short topic name for tagging"
}
[Image attached — read carefully.]`;

    // Multimodal via structured object generation
    const { object } = await generateObjectSafe({
      schema: SolveSchema,
      prompt,
      modelId: PRO_MODEL,
      maxOutputTokens: 2000,
    });
    return object;
  });

// Follow-up chat about a solved problem
const FollowupInput = z.object({
  accessToken: z.string(),
  problem: z.string().max(4000),
  finalAnswer: z.string().max(2000),
  question: z.string().min(1).max(2000),
});

const FollowupSchema = z.object({ reply: z.string() });

export const solveFollowup = createServerFn({ method: "POST" })
  .inputValidator((d) => FollowupInput.parse(d))
  .handler(async ({ data }) => {
    await getUserIdFromToken(data.accessToken);
    const { object } = await generateObjectSafe({
      schema: FollowupSchema,
      prompt: `A student just saw this solution:

Problem: ${data.problem}
Final answer: ${data.finalAnswer}

Their follow-up question: ${data.question}

Reply concisely and warmly. Use LaTeX $...$ for math. Return only JSON: {"reply": "..."}`,
      maxOutputTokens: 800,
    });
    return object;
  });
