import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateObjectSafe } from "./ai-safe";
import { getUserIdFromToken } from "./server-auth";

const InsightInput = z.object({
  accessToken: z.string(),
  stats: z.object({
    review_count: z.number(),
    avg_quiz_score: z.number(),
    streak_days: z.number(),
    xp_week: z.number(),
    open_gaps: z.number(),
    weakest_bloom: z.string().optional(),
    strongest_subject: z.string().optional(),
  }),
});
const Schema = z.object({
  insights: z
    .array(
      z.object({
        type: z.enum(["strength", "warning", "action"]),
        insight: z.string().max(180),
        cta: z.string().max(60),
        science_basis: z.string().max(120),
      }),
    )
    .min(3)
    .max(3),
});

export const generateWeeklyInsight = createServerFn({ method: "POST" })
  .inputValidator((d) => InsightInput.parse(d))
  .handler(async ({ data }) => {
    await getUserIdFromToken(data.accessToken);
    const { object } = await generateObject({
      model: model(),
      schema: Schema,
      prompt:
        `Analyse this student's weekly study data and produce EXACTLY 3 insights: one "strength", one "warning", one "action". ` +
        `Each insight ≤25 words. Include a short, real learning-science principle (interleaving, retrieval practice, spaced repetition, desirable difficulty, dual coding, metacognition, etc.) as science_basis. ` +
        `Stats: ${JSON.stringify(data.stats)}`,
    });
    return object;
  });
