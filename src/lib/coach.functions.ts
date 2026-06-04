import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { DEFAULT_MODEL, resolveModel } from "./ai-gateway";
import { generateObjectSafe } from "./ai-safe";
import { getUserIdFromToken } from "./server-auth";

function model() {
  return resolveModel(DEFAULT_MODEL);
}

// Explain a knowledge gap and suggest 3 micro-actions
const ExplainInput = z.object({ accessToken: z.string(), topic: z.string(), subject: z.string() });
export const explainGap = createServerFn({ method: "POST" })
  .inputValidator((d) => ExplainInput.parse(d))
  .handler(async ({ data }) => {
    await getUserIdFromToken(data.accessToken);
    const { text } = await generateText({
      model: model(),
      prompt:
        `Student has a knowledge gap on "${data.topic}" in ${data.subject}. ` +
        `In 4-6 short sentences: 1) explain the core idea simply with a concrete example, ` +
        `2) the single most common misconception, 3) one tiny exercise they can do in 60 seconds. ` +
        `Use plain prose, no headings.`,
    });
    return { explanation: text };
  });

// AI Smart Planner — return blocks for the next 7 days
const PlanInput = z.object({
  accessToken: z.string(),
  goalMinutesPerDay: z.number().int().min(15).max(480),
  subjects: z.array(z.string()).min(1),
  startDate: z.string(),
  daysAhead: z.number().int().min(1).max(14).default(7),
});
const PlanSchema = z.object({
  blocks: z
    .array(
      z.object({
        title: z.string(),
        subject: z.string(),
        block_type: z.enum(["study", "review", "quiz", "break"]),
        offset_day: z.number().int().min(0).max(14),
        start_hour: z.number().int().min(5).max(22),
        duration_minutes: z.number().int().min(15).max(180),
      })
    )
    .min(3)
    .max(40),
});
// Mini flashcard deck (6 cards) for a knowledge-gap topic
const GapCardsInput = z.object({ accessToken: z.string(), topic: z.string(), subject: z.string() });
const GapCardsSchema = z.object({
  cards: z
    .array(
      z.object({
        front: z.string(),
        back: z.string(),
        bloom_level: z.number().int().min(1).max(6),
      })
    )
    .min(4)
    .max(8),
});
export const generateGapCards = createServerFn({ method: "POST" })
  .inputValidator((d) => GapCardsInput.parse(d))
  .handler(async ({ data }) => {
    await getUserIdFromToken(data.accessToken);
    const { object } = await generateObject({
      model: model(),
      schema: GapCardsSchema,
      prompt:
        `Create exactly 6 spaced-repetition flashcards to remediate a weak spot on "${data.topic}" in ${data.subject}. ` +
        `Each card: front = a precise question or sub-concept, back = a tight 1-3 sentence answer with a concrete example. ` +
        `Spread Bloom levels across L1-L4. Avoid yes/no questions.`,
    });
    return object;
  });

export const generatePlan = createServerFn({ method: "POST" })
  .inputValidator((d) => PlanInput.parse(d))
  .handler(async ({ data }) => {
    await getUserIdFromToken(data.accessToken);
    const { object } = await generateObject({
      model: model(),
      schema: PlanSchema,
      prompt:
        `Build a study plan for the next ${data.daysAhead} days starting ${data.startDate}. ` +
        `Daily goal: ~${data.goalMinutesPerDay} minutes split into 25-50 min Pomodoro-friendly blocks. ` +
        `Subjects to cover: ${data.subjects.join(", ")}. ` +
        `Distribute across days. Include 1 review block every other day and 1 quiz block twice in the period. ` +
        `Use start_hour between 9-20. offset_day=0 means today.`,
    });
    return object;
  });
