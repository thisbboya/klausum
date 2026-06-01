import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { resolveModel, DEFAULT_MODEL } from "./ai-gateway";
import { generateObjectSafe } from "./ai-safe";
import { getUserIdFromToken } from "./server-auth";

function model() {
  return resolveModel(DEFAULT_MODEL);
}

const Input = z.object({
  accessToken: z.string(),
  subject: z.string().min(1),
  topic: z.string().optional(),
  existing: z.array(z.string()).optional(),
});

const Schema = z.object({
  formulas: z
    .array(
      z.object({
        name: z.string(),
        latex: z.string(),
        description: z.string(),
        category: z.string(),
        tags: z.array(z.string()).max(6),
      }),
    )
    .min(8)
    .max(15),
});

export const generateReferenceSheet = createServerFn({ method: "POST" })
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data }) => {
    await getUserIdFromToken(data.accessToken);
    const existing = (data.existing ?? []).slice(0, 30).join("; ");
    const { object } = await generateObjectSafe({
      model: model(),
      schema: Schema,
      prompt:
        `You are a STEM tutor building a single-page reference sheet for a student.\n` +
        `Subject: ${data.subject}.${data.topic ? ` Focus topic: ${data.topic}.` : ""}\n` +
        `Produce 10-14 essential formulas. Each must have a clear name, valid KaTeX-compatible LaTeX ` +
        `(no \\begin{align}; use plain expressions like x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}), ` +
        `a 1-sentence description of when to use it, a category (e.g. "Kinematics", "Algebra"), ` +
        `and 1-3 short tags.\n` +
        (existing
          ? `Avoid duplicating these the student already has: ${existing}.\n`
          : "") +
        `Cover the breadth of the subject — don't bunch around one sub-topic.`,
    });
    return object;
  });
