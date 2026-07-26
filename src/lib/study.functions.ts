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
  count: z.number().int().min(1).max(50),
  context: z.string().optional(),
  bloomDistribution: z.array(z.number()).length(6).optional(),
  questionMix: z.enum(["mixed", "mcq"]).optional(), // legacy, kept for old callers
  // Any combination of the three formats — pick 1, 2 or all 3.
  questionTypes: z.array(z.enum(["mcq", "true_false", "fill_blank"])).min(1).optional(),
});
// Deliberately forgiving. A strict schema meant one stray field from the model
// threw away the whole batch ("No object generated: response did not match
// schema"). Bounds here must never be tighter than QuizInput allows.
const QTYPES = ["mcq", "true_false", "fill_blank"] as const;

/** "MCQ" / "True/False" / "fill in the blank" → canonical qtype. */
const QTypeSchema = z.preprocess((v) => {
  if (typeof v !== "string") return "mcq";
  const s = v.toLowerCase().replace(/[\s/-]+/g, "_");
  if (s.includes("true") || s.includes("false") || s === "tf") return "true_false";
  if (s.includes("blank") || s.includes("fill")) return "fill_blank";
  return QTYPES.includes(s as any) ? s : "mcq";
}, z.enum(QTYPES));

/** Accepts "a", "A", "1" → "A". */
const LetterSchema = z.preprocess((v) => {
  if (typeof v === "number") return ["A", "B", "C", "D"][v - 1] ?? undefined;
  if (typeof v !== "string") return undefined;
  const s = v.trim().toUpperCase();
  if (/^[1-4]$/.test(s)) return ["A", "B", "C", "D"][Number(s) - 1];
  return /^[A-D]$/.test(s) ? s : undefined;
}, z.enum(["A", "B", "C", "D"]).optional());

const QuizSchema = z.object({
  questions: z
    .array(
      z.object({
        // mcq: 4 options A-D · true_false: options A="True" B="False" ·
        // fill_blank: no options, `answer` holds the expected 1-3 words
        qtype: QTypeSchema.default("mcq"),
        question: z.string(),
        options: z
          .object({
            A: z.string().optional(),
            B: z.string().optional(),
            C: z.string().optional(),
            D: z.string().optional(),
          })
          .partial()
          .optional(),
        correct: LetterSchema,
        answer: z.coerce.string().optional(),
        explanation: z.coerce.string().optional().default(""),
        topic: z.coerce.string().optional().default(""),
        // Where in the material this came from ("Slide 7", "p. 42") so the
        // learner can go look at the diagram the question is about.
        source_ref: z.coerce.string().optional().default(""),
        // "expert" is a valid input difficulty, so it must be accepted here too.
        difficulty: z
          .preprocess(
            (v) => (typeof v === "string" ? v.toLowerCase().trim() : v),
            z.enum(["easy", "medium", "hard", "expert"]),
          )
          .catch("medium"),
        bloom_level: z.coerce.number().int().catch(1).transform((n) => Math.min(6, Math.max(1, n))),
      }),
    )
    // Must stay >= QuizInput's max (50); a tighter cap silently rejected
    // every valid 30-question batch.
    .min(1)
    .max(60),
});
export const generateQuiz = createServerFn({ method: "POST" })
  .inputValidator((d) => QuizInput.parse(d))
  .handler(async ({ data }) => {
    const quizUserId = await getUserIdFromToken(data.accessToken);
    const { consumeAiQuota } = await import("./rate-limit.server");
    await consumeAiQuota(quizUserId, "quiz_generate");
    const dist = data.bloomDistribution
      ? `Bloom distribution (% per level L1-L6): ${data.bloomDistribution.join(", ")}.`
      : `Spread across Bloom L1-L5 with at least 1 question per level when count>=5.`;
    // Resolve the chosen formats. `questionTypes` is authoritative; fall back to
    // the old mixed/mcq flag so existing callers keep working.
    const chosen: ("mcq" | "true_false" | "fill_blank")[] =
      data.questionTypes?.length
        ? data.questionTypes
        : data.questionMix === "mcq"
        ? ["mcq"]
        : ["mcq", "true_false", "fill_blank"];

    const SPEC: Record<string, string> = {
      mcq: `qtype "mcq" — 4 distinct plausible options A-D with exactly one correct letter`,
      true_false: `qtype "true_false" — options A="True", B="False", correct is "A" or "B"`,
      fill_blank: `qtype "fill_blank" — a sentence with one blank written as "_____", NO options, put the expected 1-3 word answer in the "answer" field (a single unambiguous term from the material)`,
    };

    const share = Math.round(100 / chosen.length);
    const typeRules =
      chosen.length === 1
        ? `EVERY question must be ${SPEC[chosen[0]]}. Use no other format. `
        : `Use ONLY these formats, split roughly evenly (~${share}% each): ` +
          chosen.map((t) => SPEC[t]).join("; ") +
          `. Do not produce any other question format. `;
    const { object } = await generateObjectSafe({

      schema: QuizSchema,
      prompt:
        `Generate exactly ${data.count} quiz questions on "${data.topic}". ` +
        `Subject: ${data.subject}. Level: ${data.level ?? "general"}. Difficulty: ${data.difficulty}. ` +
        `${dist} ` +
        typeRules +
        `Every question includes a 1-2 sentence explanation, the topic, difficulty, and Bloom level (1-6). ` +
        (data.context
          ? // Ground every question in the supplied text. Without this the model
            // drifted to generic questions that had nothing to do with the material.
            `\n\nCRITICAL GROUNDING RULES:\n` +
            `- Base EVERY question ONLY on the MATERIAL below. Do not use outside knowledge.\n` +
            `- Each question must be answerable purely from the MATERIAL, and its "topic" ` +
            `must name a concept that literally appears in it.\n` +
            `- Quote or paraphrase the MATERIAL in each explanation.\n` +
            `- If the MATERIAL is too short or unreadable to support ${data.count} questions, ` +
            `return only the questions it genuinely supports rather than inventing any.\n` +
            `\nSELF-CONTAINED RULE — THIS IS MANDATORY:\n` +
            `The learner sees ONLY your question text. They CANNOT see any figure, diagram, ` +
            `schematic, table or image from the material.\n` +
            `- NEVER write questions that depend on looking at something, e.g. ` +
            `"In the Example 1 schematic…", "in the figure above", "the circuit shown", ` +
            `"according to the diagram", "in Table 2".\n` +
            `- If a fact only makes sense with a visual, either DESCRIBE the needed detail ` +
            `inside the question itself (e.g. "In a reversing starter where the PSCR contact ` +
            `is normally open and wired in series with the pilot light, …") or skip that fact ` +
            `and ask about something textual instead.\n` +
            `- A question must be fully answerable by someone who has only read the text.\n` +
            `\nSet "source_ref" to where the answer came from — copy the nearest "## Slide N" ` +
            `heading if present (e.g. "Slide 7"), otherwise a short section name. Never invent one.\n` +
            `\n--- MATERIAL ---\n${data.context.slice(0, 30000)}`
          : ""),
    });
    return object;
  });
