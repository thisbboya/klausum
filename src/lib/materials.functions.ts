import { createServerFn } from "@tanstack/react-start";
import { generateObject } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider, DEFAULT_MODEL } from "./ai-gateway";
import { getUserIdFromToken } from "./server-auth";

function gateway() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  return createLovableAiGatewayProvider(key);
}

const ProcessInput = z.object({
  accessToken: z.string(),
  title: z.string(),
  subject: z.string().optional(),
  fieldCategory: z.string().optional(),
  isStem: z.boolean().optional(),
  text: z.string().optional(),
  fileBase64: z.string().optional(),
  mimeType: z.string().optional(),
});

const ProcessedSchema = z.object({
  summary: z.string().describe("3-5 sentence summary"),
  key_concepts: z
    .array(
      z.object({
        id: z.string(),
        concept: z.string(),
        definition: z.string(),
        example: z.string(),
        importance: z.enum(["high", "medium", "low"]),
        bloom_level: z.number().int().min(1).max(6),
      })
    )
    .min(5)
    .max(15),
  concept_graph: z
    .array(
      z.object({
        source_id: z.string(),
        target_id: z.string(),
        relationship: z.enum(["depends_on", "causes", "contrasts", "part_of", "precedes"]),
      })
    )
    .default([]),
  visual: z.string().describe("VISUAL adaptation. Use [DIAGRAM: desc], [KEY TERM: term], comparison tables, headers, end with VISUAL SUMMARY table."),
  auditory: z.string().describe("AUDITORY adaptation. Conversational. Insert [SAY THIS ALOUD: ...] at least 4 times. End each section with [VERBAL SUMMARY: ...]."),
  reading: z.string().describe("READING/WRITING adaptation. Hierarchical I>A>1, prose, [WRITE THIS DOWN: ...] prompts."),
  kinesthetic: z.string().describe("KINESTHETIC adaptation. [TRY THIS: ...], [REAL WORLD: ...], step-by-step worked examples."),
  cornell: z.object({
    cue_column: z.string(),
    notes_column: z.string(),
    summary: z.string(),
  }),
  flashcards: z
    .array(
      z.object({
        front: z.string(),
        back: z.string(),
        hint: z.string().nullable().default(null),
        bloom_level: z.number().int().min(1).max(6),
        card_type: z.enum(["standard", "formula", "code"]).default("standard"),
        tags: z.array(z.string()).default([]),
      })
    )
    .min(6)
    .max(20)
    .describe("Aim for ~15 cards: 2x L1, 3x L2, 3x L3, 3x L4, 2x L5, 2x L6"),
  formulas: z
    .array(
      z.object({
        name: z.string(),
        latex: z.string(),
        variables: z
          .array(z.object({ symbol: z.string(), unit: z.string(), meaning: z.string() }))
          .default([]),
      })
    )
    .default([])
    .describe("Empty array if no formulas. Otherwise extract all equations in LaTeX."),
  bloom_questions: z.object({
    L1: z.array(z.object({ question: z.string(), answer: z.string() })).min(1).max(3),
    L2: z.array(z.object({ question: z.string(), answer: z.string() })).min(1).max(3),
    L3: z.array(z.object({ question: z.string(), answer: z.string() })).min(1).max(3),
    L4: z.array(z.object({ question: z.string(), answer: z.string() })).min(1).max(3),
    L5: z.array(z.object({ question: z.string(), answer: z.string() })).min(1).max(3),
    L6: z.array(z.object({ question: z.string(), answer: z.string() })).min(1).max(3),
  }),
  extracted_text: z.string().describe("Plain-text transcription of the source content (extracted from the file or echoed back from pasted text). At least 200 chars unless the source is shorter."),
  word_count: z.number().int(),
  estimated_read_minutes: z.number().int(),
});

export const processMaterial = createServerFn({ method: "POST" })
  .inputValidator((d) => ProcessInput.parse(d))
  .handler(async ({ data }) => {
    await getUserIdFromToken(data.accessToken);
    const provider = gateway();
    const model = provider(DEFAULT_MODEL);

    const stem = data.isStem ?? false;
    const userParts: any[] = [
      {
        type: "text",
        text:
          `You are Klausum, an adaptive learning engine. ` +
          `Title: "${data.title}". Subject: ${data.subject ?? "General"}. Field: ${data.fieldCategory ?? "General"}. ${stem ? "STEM material — extract formulas." : "Non-STEM — formulas array should be empty."} ` +
          `Produce: summary, 8-15 key concepts (with stable ids c1..cN), concept_graph edges between concepts, ` +
          `four VARK adaptations (each <600 words, with the special callout tags described in the schema), ` +
          `Cornell Notes (cue/notes/summary), exactly 15 flashcards distributed 2/3/3/3/2/2 across Bloom L1-L6, ` +
          `${stem ? "all formulas in LaTeX, " : ""}` +
          `and a Bloom question bank with exactly 2 questions per level L1-L6.`,
      },
    ];

    if (data.fileBase64 && data.mimeType) {
      userParts.push({ type: "file", data: data.fileBase64, mediaType: data.mimeType });
    } else if (data.text) {
      userParts.push({ type: "text", text: `\n\n--- MATERIAL ---\n${data.text.slice(0, 60000)}` });
    } else {
      throw new Error("Provide text or file");
    }

    const { object } = await generateObject({
      model,
      schema: ProcessedSchema,
      messages: [{ role: "user", content: userParts }],
      maxOutputTokens: 16000,
      maxRetries: 2,
    });

    return object;
  });

// Feynman-mode evaluator
const FeynmanInput = z.object({
  accessToken: z.string(),
  concept: z.string(),
  correctAnswer: z.string(),
  studentExplanation: z.string(),
});
const FeynmanSchema = z.object({
  got_right: z.array(z.string()),
  critical_gap: z.string(),
  follow_up_question: z.string(),
  score: z.enum(["Excellent", "Good", "Partial", "Needs Work"]),
});
export const evaluateFeynman = createServerFn({ method: "POST" })
  .inputValidator((d) => FeynmanInput.parse(d))
  .handler(async ({ data }) => {
    await getUserIdFromToken(data.accessToken);
    const provider = gateway();
    const { object } = await generateObject({
      model: provider(DEFAULT_MODEL),
      schema: FeynmanSchema,
      prompt:
        `Evaluate this student's Feynman explanation. Be warm and encouraging.\n` +
        `Concept: ${data.concept}\nCorrect answer: ${data.correctAnswer}\n` +
        `Student explanation: ${data.studentExplanation}\n\nKeep response under 100 words total.`,
    });
    return object;
  });
