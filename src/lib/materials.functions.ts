import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { withGeminiRetry, DEFAULT_MODEL } from "./ai-gateway";
import { generateObjectSafe } from "./ai-safe";
import { generateObject, generateText } from "ai";
import { getUserIdFromToken } from "./server-auth";

const ProcessInput = z.object({
  accessToken: z.string().max(4096),
  title: z.string().min(1).max(500),
  subject: z.string().max(200).optional(),
  fieldCategory: z.string().max(100).optional(),
  isStem: z.boolean().optional(),
  text: z.string().max(2_000_000).optional(),
  // base64 of ~20 MB ≈ 27 MB; cap at 28 MB to block payload abuse
  fileBase64: z.string().max(28_000_000).optional(),
  mimeType: z
    .enum([
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
      "image/gif",
      "text/plain",
      "text/markdown",
      // PowerPoint
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.ms-powerpoint",
      // Word
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      // Excel
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ])
    .optional(),
});

const ProcessedSchema = z
  .object({
    summary: z.any().optional(),
    key_concepts: z.any().optional(),
    concept_graph: z.any().optional(),
    visual: z.any().optional(),
    auditory: z.any().optional(),
    reading: z.any().optional(),
    kinesthetic: z.any().optional(),
    cornell: z.any().optional(),
    flashcards: z.any().optional(),
    formulas: z.any().optional(),
    bloom_questions: z.any().optional(),
    extracted_text: z.any().optional(),
    word_count: z.any().optional(),
    estimated_read_minutes: z.any().optional(),
  })
  .passthrough();

type ProcessedResult = {
  summary: string;
  key_concepts: { id: string; concept: string; definition: string; example: string; importance: string; bloom_level: number }[];
  concept_graph: any[];
  visual: string;
  auditory: string;
  reading: string;
  kinesthetic: string;
  cornell: { cue_column: string; notes_column: string; summary: string };
  flashcards: { front: string; back: string; hint: string | null; bloom_level: number; card_type: string; tags: string[] }[];
  formulas: any[];
  bloom_questions: Record<string, { question: string; answer: string }[]>;
  extracted_text: string;
  word_count: number;
  estimated_read_minutes: number;
};

function asText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value == null) return "";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function asArray(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Object.values(value as Record<string, unknown>);
  return [];
}

function asObject(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

function bloomLevel(value: unknown, fallback = 1) {
  const n = Number(asText(value).replace(/[^0-9]/g, "")) || fallback;
  return Math.min(6, Math.max(1, Math.round(n)));
}

function firstSentences(text: string, count = 4) {
  const sentences = text.replace(/\s+/g, " ").match(/[^.!?]+[.!?]+/g) ?? [text.slice(0, 700)];
  return sentences.slice(0, count).join(" ").trim() || "Study material processed successfully.";
}

function extractJson(text: string) {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  return first >= 0 && last > first ? text.slice(first, last + 1) : null;
}

function parseObjectText(text: string) {
  const json = extractJson(text);
  if (!json) return {};
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

function normalizeProcessed(raw: any, sourceText: string, title: string): ProcessedResult {
  const extracted_text = asText(raw.extracted_text) || sourceText;
  const summary = asText(raw.summary) || firstSentences(extracted_text);
  const words = extracted_text.trim().split(/\s+/).filter(Boolean).length;
  const key_concepts = asArray(raw.key_concepts)
    .map((c, i) => {
      const o = asObject(c);
      return {
        id: asText(o.id) || `c${i + 1}`,
        concept: asText(o.concept ?? o.term ?? o.name) || `Key idea ${i + 1}`,
        definition: asText(o.definition ?? o.explanation ?? o.description) || firstSentences(summary, 1),
        example: asText(o.example) || "Review the source material for an example.",
        importance: ["high", "medium", "low"].includes(asText(o.importance).toLowerCase()) ? asText(o.importance).toLowerCase() : "medium",
        bloom_level: bloomLevel(o.bloom_level, Math.min(6, i + 1)),
      };
    })
    .filter((c) => c.concept)
    .slice(0, 15);

  if (key_concepts.length === 0) {
    key_concepts.push({ id: "c1", concept: title, definition: summary, example: "Use this as the anchor topic for review.", importance: "high", bloom_level: 2 });
  }

  const flashcards = asArray(raw.flashcards)
    .map((c, i) => {
      const o = asObject(c);
      return {
        front: asText(o.front ?? o.question) || `What is ${key_concepts[i % key_concepts.length]?.concept}?`,
        back: asText(o.back ?? o.answer) || key_concepts[i % key_concepts.length]?.definition || summary,
        hint: asText(o.hint) || null,
        bloom_level: bloomLevel(o.bloom_level, (i % 6) + 1),
        card_type: ["standard", "formula", "code"].includes(asText(o.card_type)) ? asText(o.card_type) : "standard",
        tags: asArray(o.tags).map(asText).filter(Boolean),
      };
    })
    .filter((c) => c.front && c.back)
    .slice(0, 20);

  while (flashcards.length < 6) {
    const c = key_concepts[flashcards.length % key_concepts.length];
    flashcards.push({ front: `Explain: ${c.concept}`, back: c.definition, hint: c.example, bloom_level: bloomLevel(c.bloom_level, (flashcards.length % 6) + 1), card_type: "standard", tags: [] });
  }

  const bloomRaw = asObject(raw.bloom_questions);
  const bloom_questions: Record<string, { question: string; answer: string }[]> = {};
  for (const level of ["L1", "L2", "L3", "L4", "L5", "L6"]) {
    bloom_questions[level] = asArray(bloomRaw[level])
      .map((q) => {
        const o = asObject(q);
        return { question: asText(o.question ?? o.front), answer: asText(o.answer ?? o.back) };
      })
      .filter((q) => q.question && q.answer)
      .slice(0, 3);
    if (bloom_questions[level].length === 0) bloom_questions[level].push({ question: `${level}: What should you understand about ${title}?`, answer: summary });
  }

  const cornell = asObject(raw.cornell);
  return {
    summary,
    key_concepts,
    concept_graph: asArray(raw.concept_graph).slice(0, 30),
    visual: asText(raw.visual) || `[KEY TERM: ${key_concepts[0].concept}]\n\n${summary}`,
    auditory: asText(raw.auditory) || `[SAY THIS ALOUD: ${firstSentences(summary, 1)}]\n\n[VERBAL SUMMARY: ${summary}]`,
    reading: asText(raw.reading) || `I. ${title}\n\nA. ${summary}\n\n[WRITE THIS DOWN: ${key_concepts[0].concept}]`,
    kinesthetic: asText(raw.kinesthetic) || `[TRY THIS: Teach the main idea in your own words.]\n\n[REAL WORLD: Connect ${key_concepts[0].concept} to a practical example.]`,
    cornell: {
      cue_column: asText(cornell.cue_column ?? cornell.cues) || key_concepts.map((c) => c.concept).join("\n"),
      notes_column: asText(cornell.notes_column ?? cornell.notes) || summary,
      summary: asText(cornell.summary) || summary,
    },
    flashcards,
    formulas: asArray(raw.formulas).slice(0, 30),
    bloom_questions,
    extracted_text,
    word_count: Number(raw.word_count) || words,
    estimated_read_minutes: Number(raw.estimated_read_minutes) || Math.max(1, Math.round(words / 220)),
  };
}

export const processMaterial = createServerFn({ method: "POST" })
  .inputValidator((d) => ProcessInput.parse(d))
  .handler(async ({ data }) => {
    await getUserIdFromToken(data.accessToken);
    const provider = gateway();
    const model = provider(DEFAULT_MODEL);

    const stem = data.isStem ?? false;
    let sourceText = data.text?.slice(0, 60000) ?? "";

    if (data.fileBase64 && data.mimeType) {
      const extraction = await generateText({
        model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Extract the readable study content from this file as plain text. Keep headings, equations, lists, and important labels. Do not summarize." },
              { type: "file", data: data.fileBase64, mediaType: data.mimeType },
            ],
          },
        ],
        maxOutputTokens: 12000,
        maxRetries: 2,
      });
      sourceText = extraction.text.trim() || `No readable text could be extracted from ${data.title}.`;
    } else if (data.text) {
      sourceText = data.text.slice(0, 60000);
    } else {
      throw new Error("Provide text or file");
    }

    const prompt =
      `You are Klausum, an adaptive learning engine. Return one valid JSON object only. ` +
      `Title: "${data.title}". Subject: ${data.subject ?? "General"}. Field: ${data.fieldCategory ?? "General"}. ${stem ? "STEM material — extract formulas." : "Non-STEM — formulas array should be empty."} ` +
      `Keys required: extracted_text, summary, key_concepts, concept_graph, visual, auditory, reading, kinesthetic, cornell, flashcards, formulas, bloom_questions, word_count, estimated_read_minutes. ` +
      `Create 8-15 key concepts, 6-15 useful flashcards, Cornell notes, and Bloom questions for L1-L6.\n\n--- MATERIAL ---\n${sourceText}`;

    let raw: any = {};
    try {
      const { object } = await generateObject({
        model,
        schema: ProcessedSchema,
        prompt,
        maxOutputTokens: 16000,
        maxRetries: 2,
        experimental_repairText: async ({ text }) => extractJson(text),
      });
      raw = object;
    } catch (error) {
      console.error("Structured material generation failed, retrying as text", error);
      const retry = await generateText({ model, prompt, maxOutputTokens: 16000, maxRetries: 1 });
      raw = parseObjectText(retry.text);
    }

    return normalizeProcessed(raw, sourceText, data.title);
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
