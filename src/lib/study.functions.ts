import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateObjectSafe } from "./ai-safe";
import { getUserIdFromToken } from "./server-auth";


// === Cornell Notes AI helpers ===
const CueInput = z.object({ accessToken: z.string(), notes: z.string().min(20) });
export const generateCornellCues = createServerFn({ method: "POST" })
  .inputValidator((d) => CueInput.parse(d))
  .handler(async ({ data }) => {
    await getUserIdFromToken(data.accessToken);
    const { object } = await generateObjectSafe({

      schema: z.object({ cues: z.array(z.string()).min(4).max(12) }),
      prompt:
        `You are a Cornell-Notes coach. Read the student's notes and produce 6-10 Socratic ` +
        `cue prompts (questions, keywords, recall triggers) — one per line, no numbering. ` +
        `Use language that forces retrieval, not recognition.\n\nNOTES:\n${data.notes.slice(0, 12000)}`,
    });
    return object;
  });

const SummaryInput = z.object({ accessToken: z.string(), notes: z.string().min(20) });
export const generateCornellSummary = createServerFn({ method: "POST" })
  .inputValidator((d) => SummaryInput.parse(d))
  .handler(async ({ data }) => {
    await getUserIdFromToken(data.accessToken);
    const { object } = await generateObjectSafe({

      schema: z.object({ summary: z.string().min(50) }),
      prompt:
        `Write a tight 5-sentence summary of these notes. Plain prose, no bullets, no fluff.\n\n${data.notes.slice(0, 12000)}`,
    });
    return object;
  });

const NotesToCardsInput = z.object({ accessToken: z.string(), notes: z.string().min(20), subject: z.string() });
export const notesToFlashcards = createServerFn({ method: "POST" })
  .inputValidator((d) => NotesToCardsInput.parse(d))
  .handler(async ({ data }) => {
    await getUserIdFromToken(data.accessToken);
    const { object } = await generateObjectSafe({

      schema: z.object({
        cards: z
          .array(
            z.object({
              front: z.string(),
              back: z.string(),
              hint: z.string().nullable(),
              bloom_level: z.number().int().min(1).max(6),
            })
          )
          .min(5)
          .max(12),
      }),
      prompt:
        `Extract 8-10 question/answer pairs from these notes. Span Bloom L1-L4. ` +
        `Subject: ${data.subject}.\n\n${data.notes.slice(0, 12000)}`,
    });
    return object;
  });

// === Mind Map AI generation ===
const MindMapInput = z.object({
  accessToken: z.string(),
  topic: z.string(),
  context: z.string().optional(),
});
const MindMapSchema = z.object({
  nodes: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        type: z.enum(["main", "sub", "example", "warning"]),
      })
    )
    .min(8)
    .max(25),
  edges: z
    .array(
      z.object({
        source: z.string(),
        target: z.string(),
        label: z.string().default(""),
        type: z
          .enum(["depends_on", "causes", "contrasts", "part_of", "precedes"])
          .default("part_of"),
      })
    )
    .max(40),
});
export const generateMindMap = createServerFn({ method: "POST" })
  .inputValidator((d) => MindMapInput.parse(d))
  .handler(async ({ data }) => {
    await getUserIdFromToken(data.accessToken);
    const { object } = await generateObjectSafe({

      schema: MindMapSchema,
      prompt:
        `Create a study mind map for the topic. 15-20 nodes total, 1 main, plenty of sub, ` +
        `add 2-3 examples (type=example) and 1-2 pitfalls (type=warning). Provide stable ids n1..nN. ` +
        `Edges should connect logically.\n\nTopic: ${data.topic}\nContext:\n${(data.context ?? "").slice(0, 8000)}`,
    });
    return object;
  });

// === Mind Map node expansion ===
const ExpandInput = z.object({
  accessToken: z.string(),
  parentLabel: z.string(),
  context: z.string().optional(),
});
export const expandMindMapNode = createServerFn({ method: "POST" })
  .inputValidator((d) => ExpandInput.parse(d))
  .handler(async ({ data }) => {
    await getUserIdFromToken(data.accessToken);
    const { object } = await generateObjectSafe({

      schema: z.object({ children: z.array(z.string()).length(3) }),
      prompt:
        `Generate exactly 3 short child concepts (max 4 words each) that branch from "${data.parentLabel}". ` +
        `${data.context ? `Context: ${data.context.slice(0, 2000)}` : ""}`,
    });
    return object;
  });

// === Quiz generation ===
const QuizInput = z.object({
  accessToken: z.string(),
  topic: z.string(),
  subject: z.string(),
  level: z.string().optional(),
  difficulty: z.enum(["easy", "medium", "hard", "expert"]),
  count: z.number().int().min(3).max(25),
  context: z.string().optional(),
  bloomDistribution: z.array(z.number()).length(6).optional(),
  questionMix: z.enum(["mixed", "mcq"]).optional(),
});
const QuizSchema = z.object({
  questions: z
    .array(
      z.object({
        // mcq: 4 options A-D · true_false: options A="True" B="False" ·
        // fill_blank: no options, `answer` holds the expected 1-3 words
        qtype: z.enum(["mcq", "true_false", "fill_blank"]).default("mcq"),
        question: z.string(),
        options: z
          .object({ A: z.string(), B: z.string(), C: z.string().optional(), D: z.string().optional() })
          .optional(),
        correct: z.enum(["A", "B", "C", "D"]).optional(),
        answer: z.string().optional(),
        explanation: z.string(),
        topic: z.string(),
        difficulty: z.enum(["easy", "medium", "hard"]),
        bloom_level: z.number().int().min(1).max(6),
      })
    )
    .min(3)
    .max(25),
});
export const generateQuiz = createServerFn({ method: "POST" })
  .inputValidator((d) => QuizInput.parse(d))
  .handler(async ({ data }) => {
    await getUserIdFromToken(data.accessToken);
    const dist = data.bloomDistribution
      ? `Bloom distribution (% per level L1-L6): ${data.bloomDistribution.join(", ")}.`
      : `Spread across Bloom L1-L5 with at least 1 question per level when count>=5.`;
    const mixed = data.questionMix !== "mcq";
    const typeRules = mixed
      ? `Mix the question types: ~60% qtype "mcq" (4 distinct plausible options A-D, one correct letter), ` +
        `~20% qtype "true_false" (options A="True", B="False", correct is "A" or "B"), ` +
        `~20% qtype "fill_blank" (a sentence with one blank written as "_____"; NO options; put the expected ` +
        `1-3 word answer in the "answer" field — a single unambiguous term from the material). `
      : `All questions are qtype "mcq" with 4 distinct plausible options and exactly one correct letter. `;
    const { object } = await generateObjectSafe({

      schema: QuizSchema,
      prompt:
        `Generate exactly ${data.count} quiz questions on "${data.topic}". ` +
        `Subject: ${data.subject}. Level: ${data.level ?? "general"}. Difficulty: ${data.difficulty}. ` +
        `${dist} ` +
        typeRules +
        `Every question includes a 1-2 sentence explanation, the topic, difficulty, and Bloom level (1-6). ` +
        `${data.context ? `\n\n--- MATERIAL ---\n${data.context.slice(0, 30000)}` : ""}`,
    });
    return object;
  });
