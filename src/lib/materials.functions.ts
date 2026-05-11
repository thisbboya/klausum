import { createServerFn } from "@tanstack/react-start";
import { generateText, generateObject } from "ai";
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
  // Either raw text OR a base64 file (PDF, image)
  text: z.string().optional(),
  fileBase64: z.string().optional(),
  mimeType: z.string().optional(),
});

const ProcessedSchema = z.object({
  summary: z.string().describe("3-5 sentence high-level summary"),
  key_concepts: z
    .array(z.object({ term: z.string(), definition: z.string() }))
    .min(3)
    .max(15),
  visual: z.string().describe("Markdown adaptation for VISUAL learners — use mermaid blocks, tables, ascii diagrams, bullet hierarchies."),
  auditory: z.string().describe("Markdown adaptation for AUDITORY learners — written as a script you'd narrate aloud, with rhythm and conversational flow."),
  reading: z.string().describe("Markdown adaptation for READING/WRITING learners — well structured prose with headings, definitions, lists."),
  kinesthetic: z.string().describe("Markdown adaptation for KINESTHETIC learners — practical exercises, real-world analogies, do-this-now activities."),
  word_count: z.number().int(),
  estimated_read_minutes: z.number().int(),
});

export const processMaterial = createServerFn({ method: "POST" })
  .inputValidator((d) => ProcessInput.parse(d))
  .handler(async ({ data }) => {
    await getUserIdFromToken(data.accessToken);

    const provider = gateway();
    const model = provider(DEFAULT_MODEL);

    const userParts: any[] = [
      {
        type: "text",
        text:
          `You are NkyinkyimIQ, an adaptive learning engine. The student has provided study material titled "${data.title}". ` +
          `Read it carefully, then produce: a concise summary, key concepts, and FOUR distinct rewrites — one per VARK learning style. ` +
          `Each rewrite must be substantively different in form, not just tone. Use markdown. Keep each adaptation under 600 words.`,
      },
    ];

    if (data.fileBase64 && data.mimeType) {
      userParts.push({
        type: "file",
        data: data.fileBase64,
        mediaType: data.mimeType,
      });
    } else if (data.text) {
      userParts.push({ type: "text", text: `\n\n--- MATERIAL ---\n${data.text.slice(0, 60000)}` });
    } else {
      throw new Error("Provide text or file");
    }

    const { object } = await generateObject({
      model,
      schema: ProcessedSchema,
      messages: [{ role: "user", content: userParts }],
    });

    return object;
  });

const FlashInput = z.object({
  accessToken: z.string(),
  materialContent: z.string(),
  title: z.string(),
  count: z.number().int().min(5).max(30).default(12),
});

const FlashSchema = z.object({
  cards: z
    .array(
      z.object({
        front: z.string(),
        back: z.string(),
        hint: z.string().nullable(),
        bloom_level: z.number().int().min(1).max(6),
        tags: z.array(z.string()).default([]),
      })
    )
    .min(5),
});

export const generateFlashcards = createServerFn({ method: "POST" })
  .inputValidator((d) => FlashInput.parse(d))
  .handler(async ({ data }) => {
    await getUserIdFromToken(data.accessToken);
    const provider = gateway();
    const model = provider(DEFAULT_MODEL);

    const { object } = await generateObject({
      model,
      schema: FlashSchema,
      prompt:
        `Generate ${data.count} high-quality flashcards from the study material below titled "${data.title}". ` +
        `Distribute Bloom's Taxonomy levels: 1=Remember, 2=Understand, 3=Apply, 4=Analyse, 5=Evaluate, 6=Create. ` +
        `Aim for at least one card per level present. Front = clear question. Back = focused, complete answer (2–4 sentences). ` +
        `Hint should be optional and short. Tags = 1–3 short topical labels.\n\n--- MATERIAL ---\n${data.materialContent.slice(0, 40000)}`,
    });

    return object;
  });

// Quick title/summary helper for raw-text uploads (used when no AI processing yet).
export const quickSummarize = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string; text: string }) => d)
  .handler(async ({ data }) => {
    await getUserIdFromToken(data.accessToken);
    const provider = gateway();
    const model = provider(DEFAULT_MODEL);
    const { text } = await generateText({
      model,
      prompt: `Summarize this study text in 3 sentences.\n\n${data.text.slice(0, 20000)}`,
    });
    return { summary: text };
  });
