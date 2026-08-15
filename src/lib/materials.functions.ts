import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { withGeminiRetry, DEFAULT_MODEL } from "./ai-gateway";
import { generateObjectSafe } from "./ai-safe";
import { generateObject, generateText } from "ai";
import { getUserIdFromToken } from "./server-auth";
import { createClient } from "@supabase/supabase-js";

const ProcessInput = z.object({
  accessToken: z.string().max(4096),
  title: z.string().min(1).max(500),
  subject: z.string().max(200).optional(),
  fieldCategory: z.string().max(100).optional(),
  isStem: z.boolean().optional(),
  // Learner's VARK primary style — when set, only that adaptation is generated.
  primaryStyle: z.string().max(32).optional(),
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

  // Key concepts — only keep entries that have a real, non-summary definition.
  // Do NOT inject a synthetic concept-from-title fallback (see Bug 5).
  const key_concepts = asArray(raw.key_concepts)
    .map((c, i) => {
      const o = asObject(c);
      const concept = asText(o.concept ?? o.term ?? o.name);
      const definition = asText(o.definition ?? o.explanation ?? o.description);
      return {
        id: asText(o.id) || `c${i + 1}`,
        concept,
        definition,
        example: asText(o.example) || "",
        importance: ["high", "medium", "low"].includes(asText(o.importance).toLowerCase())
          ? asText(o.importance).toLowerCase()
          : "medium",
        bloom_level: bloomLevel(o.bloom_level, Math.min(6, i + 1)),
      };
    })
    .filter((c) => c.concept && c.definition && c.definition !== summary)
    .slice(0, 15);

  const flashcards = asArray(raw.flashcards)
    .map((c, i) => {
      const o = asObject(c);
      const anchor = key_concepts[i % Math.max(1, key_concepts.length)];
      return {
        front: asText(o.front ?? o.question) || (anchor ? `What is ${anchor.concept}?` : ""),
        back: asText(o.back ?? o.answer) || (anchor?.definition ?? summary),
        hint: asText(o.hint) || null,
        bloom_level: bloomLevel(o.bloom_level, (i % 6) + 1),
        card_type: ["standard", "formula", "code"].includes(asText(o.card_type)) ? asText(o.card_type) : "standard",
        tags: asArray(o.tags).map(asText).filter(Boolean),
      };
    })
    .filter((c) => c.front && c.back)
    .slice(0, 20);

  // Only top up flashcards when we DO have real concepts to anchor them to.
  while (flashcards.length < 6 && key_concepts.length > 0) {
    const c = key_concepts[flashcards.length % key_concepts.length];
    flashcards.push({ front: `Explain: ${c.concept}`, back: c.definition, hint: c.example || null, bloom_level: bloomLevel(c.bloom_level, (flashcards.length % 6) + 1), card_type: "standard", tags: [] });
  }

  // Bloom — no generic fallbacks; empty levels stay empty.
  const bloomRaw = asObject(raw.bloom_questions);
  const bloom_questions: Record<string, { question: string; answer: string }[]> = {};
  for (const level of ["L1", "L2", "L3", "L4", "L5", "L6"]) {
    bloom_questions[level] = asArray(bloomRaw[level])
      .map((q) => {
        const o = asObject(q);
        return { question: asText(o.question ?? o.front), answer: asText(o.answer ?? o.back) };
      })
      .filter((q) => q.question && q.answer && !/what should you understand about/i.test(q.question))
      .slice(0, 3);
  }

  // Formulas — Gemini sometimes uses `formula`/`expression`/`equation` instead of `latex`.
  const formulas = asArray(raw.formulas)
    .map((f) => {
      const o = asObject(f);
      const latex = asText(o.latex ?? o.formula ?? o.expression ?? o.equation ?? o.content);
      return {
        name: asText(o.name ?? o.title) || "Formula",
        latex,
        subject: asText(o.subject) || undefined,
        variables: asArray(o.variables)
          .map((v) => {
            const vo = asObject(v);
            return {
              symbol: asText(vo.symbol),
              unit: asText(vo.unit) || undefined,
              meaning: asText(vo.meaning ?? vo.description) || "",
            };
          })
          .filter((v) => v.symbol),
      };
    })
    .filter((f) => f.latex)
    .slice(0, 30);

  const cornell = asObject(raw.cornell);
  const anchorConcept = key_concepts[0]?.concept ?? title;
  return {
    summary,
    key_concepts,
    concept_graph: asArray(raw.concept_graph).slice(0, 30),
    visual: asText(raw.visual) || `[KEY TERM: ${anchorConcept}]\n\n${summary}`,
    auditory: asText(raw.auditory) || `[SAY THIS ALOUD: ${firstSentences(summary, 1)}]\n\n[VERBAL SUMMARY: ${summary}]`,
    reading: asText(raw.reading) || `I. ${title}\n\nA. ${summary}\n\n[WRITE THIS DOWN: ${anchorConcept}]`,
    kinesthetic: asText(raw.kinesthetic) || `[TRY THIS: Teach the main idea in your own words.]\n\n[REAL WORLD: Connect ${anchorConcept} to a practical example.]`,
    cornell: {
      cue_column: asText(cornell.cue_column ?? cornell.cues) || key_concepts.map((c) => c.concept).join("\n") || anchorConcept,
      notes_column: asText(cornell.notes_column ?? cornell.notes) || summary,
      summary: asText(cornell.summary) || summary,
    },
    flashcards,
    formulas,
    bloom_questions,
    extracted_text,
    word_count: Number(raw.word_count) || words,
    estimated_read_minutes: Number(raw.estimated_read_minutes) || Math.max(1, Math.round(words / 220)),
  };
}

export const processMaterial = createServerFn({ method: "POST" })
  .inputValidator((d) => ProcessInput.parse(d))
  .handler(async ({ data }) => {
    const procUserId = await getUserIdFromToken(data.accessToken);
    const { consumeAiQuota } = await import("./rate-limit.server");
    await consumeAiQuota(procUserId, "material_process");

    const stem = data.isStem ?? false;
    let sourceText = data.text?.slice(0, 60000) ?? "";

    if (data.fileBase64 && data.mimeType) {
      const fileB64 = data.fileBase64;
      const mt = data.mimeType;
      const extraction = await withGeminiRetry(DEFAULT_MODEL, (model) =>
        generateText({
          model,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: "Extract the readable study content from this file as plain text. Keep headings, equations, lists, slide titles, bullet points and important labels. For slides, prefix each slide with '## Slide N:'. Do not summarize." },
                { type: "file", data: fileB64, mediaType: mt },
              ],
            },
          ],
          maxOutputTokens: 16000,
          maxRetries: 1,
        }),
      );
      sourceText = extraction.text.trim() || `No readable text could be extracted from ${data.title}.`;
    } else if (data.text) {
      sourceText = data.text.slice(0, 60000);
    } else {
      throw new Error("Provide text or file");
    }

    // Only generate the learner's OWN VARK adaptation instead of all four.
    // That is the single biggest cost here: it roughly halves the output
    // tokens, so uploads finish much faster and burn far less quota. The other
    // three stay available on demand via the regenerate buttons.
    const ALL_STYLES = ["visual", "auditory", "reading", "kinesthetic"] as const;
    const wanted = (data.primaryStyle ?? "").toLowerCase();
    const styleKeys = (ALL_STYLES as readonly string[]).includes(wanted)
      ? [wanted]
      : [...ALL_STYLES];

    const prompt =
      `You are Klausum, an adaptive learning engine. Return one valid JSON object only. ` +
      `Title: "${data.title}". Subject: ${data.subject ?? "General"}. Field: ${data.fieldCategory ?? "General"}. ${stem ? "STEM material — extract every mathematical formula, equation and constant. Each formula MUST have a field named exactly \"latex\" (not \"formula\", \"expression\" or \"equation\") containing the LaTeX source." : "Non-STEM — formulas array should be empty."} ` +
      `Keys required: extracted_text, summary, key_concepts, concept_graph, ${styleKeys.join(", ")}, cornell, flashcards, formulas, bloom_questions, word_count, estimated_read_minutes. ` +
      `Each key_concept MUST have a SPECIFIC, distinct definition drawn from the material — never reuse the summary text. ` +
      `Each bloom_questions[Lx] item MUST be specific to the material — never write generic placeholders like "What should you understand about ${data.title}?". ` +
      `Create 8-15 key concepts, 6-15 useful flashcards, Cornell notes, and Bloom questions for L1-L6.\n\n` +
      // The reader has rendered these markers for a long time; nothing ever
      // told the generator they existed, so every adaptation came back as
      // undifferentiated prose and the diagram feature had nothing to draw.
      `INLINE MARKERS — the reader renders these specially, so use them inside the ` +
      `${styleKeys.join(", ")} adaptation text:\n` +
      `[DIAGRAM: what the picture should show] — renders as a real drawn diagram. ` +
      `Use it wherever the shape of an idea carries meaning a paragraph would flatten: ` +
      `a process with ordered steps, how parts of a system connect, a cycle, a hierarchy, ` +
      `a comparison. Describe the CONTENT of the picture in one specific sentence ` +
      `("how current induces a magnetic field around a conductor"), never a vague label ` +
      `("a diagram of the topic"). Put 2-4 of these in a visual adaptation and at least ` +
      `one in any other adaptation of material that has structure.\n` +
      `[KEY TERM: term — its definition]\n` +
      `[FORMULA: LaTeX source] — rendered as display maths.\n` +
      `[REAL WORLD: a concrete everyday instance]\n` +
      `[TRY THIS: a small active task]\n` +
      `[WRITE THIS DOWN: the one line worth copying]\n` +
      `[SAY THIS ALOUD: a sentence to speak], [VERBAL SUMMARY: ...] — for auditory adaptations.\n` +
      `Markers go on their own line, and the text still has to read as continuous prose ` +
      `without them.\n\n--- MATERIAL ---\n${sourceText}`;

    let raw: any = {};
    try {
      const { object } = await withGeminiRetry(DEFAULT_MODEL, (model) =>
        generateObject({
          model,
          schema: ProcessedSchema,
          prompt,
          maxOutputTokens: 16000,
          maxRetries: 1,
          experimental_repairText: async ({ text }) => extractJson(text),
        }),
      );
      raw = object;
    } catch (error) {
      console.error("Structured material generation failed, retrying as text", error);
      const retry = await withGeminiRetry(DEFAULT_MODEL, (model) =>
        generateText({ model, prompt, maxOutputTokens: 16000, maxRetries: 1 }),
      );
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
    const { object } = await generateObjectSafe({
      schema: FeynmanSchema,
      prompt:
        `Evaluate this student's Feynman explanation. Be warm and encouraging.\n` +
        `Concept: ${data.concept}\nCorrect answer: ${data.correctAnswer}\n` +
        `Student explanation: ${data.studentExplanation}\n\nKeep response under 100 words total.`,
    });
    return object;
  });

// Smart follow-up questions for the page the student is reading.
const FollowupInput = z.object({
  accessToken: z.string(),
  materialTitle: z.string().max(300),
  subject: z.string().max(100).optional(),
  pageText: z.string().max(8000),
  pageNumber: z.number().int().min(1).max(10000),
});
export const suggestFollowups = createServerFn({ method: "POST" })
  .inputValidator((d) => FollowupInput.parse(d))
  .handler(async ({ data }) => {
    await getUserIdFromToken(data.accessToken);
    const { object } = await generateObjectSafe({
      schema: z.object({ questions: z.array(z.string().min(8).max(140)).min(3).max(4) }),
      prompt:
        `You are an inquisitive study buddy for "${data.materialTitle}" (${data.subject ?? "General"}). ` +
        `The student is on page ${data.pageNumber}. Suggest exactly 4 short, specific follow-up ` +
        `questions they could ask to deepen their understanding of THIS page. Mix one definitional, ` +
        `one applied, one comparison, one "why does this matter". Each question max 14 words. ` +
        `No numbering, no quotes around them.\n\n--- PAGE ---\n${data.pageText.slice(0, 6000)}`,
    });
    return object;
  });

// Document overview: 3-5 sentence summary + auto-detected TOC. Cached on study_materials.ai_overview.


const OverviewInput = z.object({
  accessToken: z.string(),
  materialId: z.string().uuid(),
});

const OverviewSchema = z.object({
  summary: z.string().min(20).max(1200),
  toc: z
    .array(z.object({ title: z.string().min(1).max(160), page: z.number().int().min(1).max(10000) }))
    .max(40),
});

export const summarizeMaterial = createServerFn({ method: "POST" })
  .inputValidator((d) => OverviewInput.parse(d))
  .handler(async ({ data }) => {
    const userId = await getUserIdFromToken(data.accessToken);
    const supabaseUrl = process.env.SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: mat, error } = await admin
      .from("study_materials")
      .select("id, user_id, title, subject, original_content, ai_overview, total_pages")
      .eq("id", data.materialId)
      .maybeSingle();
    if (error || !mat) throw new Error("Material not found");
    if (mat.user_id !== userId) throw new Error("Forbidden");

    if (mat.ai_overview && (mat.ai_overview as any).summary) {
      return mat.ai_overview as { summary: string; toc: { title: string; page: number }[] };
    }

    const source = (mat.original_content || "").slice(0, 40000);
    if (!source) {
      const empty = { summary: "No extractable text yet.", toc: [] as { title: string; page: number }[] };
      return empty;
    }

    const { object } = await generateObjectSafe({
      schema: OverviewSchema,
      prompt:
        `Document: "${mat.title}" (${mat.subject ?? "General"}). Total pages: ${mat.total_pages ?? "unknown"}.\n\n` +
        `1) Write a friendly 3-5 sentence overview starting with "This document covers..." that tells a student what they're about to read and why it matters.\n` +
        `2) Build a table of contents from the document. Detect chapter / section / slide headings. Each entry has a short title (max 14 words) and the best-guess page number it starts on (look for "## Slide N:" prefixes or numbered headings). Cap at 20 entries.\n` +
        `Return JSON: { summary: string, toc: [{title, page}] }.\n\n--- DOCUMENT ---\n${source}`,
    });

    await admin.from("study_materials").update({ ai_overview: object }).eq("id", mat.id);
    return object;
  });

// Append a highlighted snippet (or freeform note) to the material notes.
const NoteInput = z.object({
  accessToken: z.string(),
  materialId: z.string().uuid(),
  content: z.string().min(1).max(4000),
  pageNumber: z.number().int().min(1).max(10000).optional(),
});

export const appendMaterialNote = createServerFn({ method: "POST" })
  .inputValidator((d) => NoteInput.parse(d))
  .handler(async ({ data }) => {
    const userId = await getUserIdFromToken(data.accessToken);
    const supabaseUrl = process.env.SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const admin = createClient(supabaseUrl, serviceKey);
    const { error } = await admin.from("material_notes").insert({
      user_id: userId,
      material_id: data.materialId,
      content: data.content,
      page_number: data.pageNumber ?? null,
    });
    if (error) throw new Error("Failed to save note");
    return { ok: true };
  });

// ─────────────────────────────────────────────────────────────────────────────
// Regenerate helpers (key concepts, Bloom questions, formulas)
// ─────────────────────────────────────────────────────────────────────────────
const RegenInput = z.object({ accessToken: z.string(), materialId: z.string().uuid() });

async function loadMaterialForOwner(token: string, materialId: string) {
  const userId = await getUserIdFromToken(token);
  // Every regenerate-* feature funnels through here — one shared daily cap.
  const { consumeAiQuota } = await import("./rate-limit.server");
  await consumeAiQuota(userId, "regenerate");
  const sa = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: mat, error } = await sa
    .from("study_materials")
    .select("id, user_id, title, subject, original_content, ai_summary")
    .eq("id", materialId)
    .maybeSingle();
  if (error || !mat) throw new Error("Material not found");
  if (mat.user_id !== userId) throw new Error("Forbidden");
  return { sa, mat };
}

/**
 * Pull real text out of a stored Office file and save it to the material.
 *
 * Office docs render in a cross-origin viewer, so the browser can never read
 * them — they stay as "[large file: deck.pptx]" and every AI feature ends up
 * talking about the filename. This reads the file server-side instead.
 */
export const extractMaterialText = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ accessToken: z.string(), materialId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const userId = await getUserIdFromToken(data.accessToken);
    const sa = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: mat, error } = await sa
      .from("study_materials")
      .select("id, user_id, file_name, file_storage_path, original_content")
      .eq("id", data.materialId)
      .maybeSingle();
    if (error || !mat) throw new Error("Material not found");
    if (mat.user_id !== userId) throw new Error("Forbidden");
    if (!mat.file_storage_path) throw new Error("No stored file for this material");

    const dl = await sa.storage.from("materials").download(mat.file_storage_path);
    if (dl.error || !dl.data) throw new Error("Could not read the stored file");

    const bytes = new Uint8Array(await dl.data.arrayBuffer());
    const { extractOfficeText } = await import("./office-extract.server");
    const result = await extractOfficeText(bytes, mat.file_name ?? mat.file_storage_path);

    if (!result || result.text.length < 50) {
      // Legacy .ppt/.doc, or a deck of pure images — nothing readable inside.
      return { ok: false as const, reason: "unsupported" };
    }

    const text = result.text.slice(0, 500_000);
    const { error: upErr } = await sa
      .from("study_materials")
      .update({ original_content: text })
      .eq("id", mat.id);
    if (upErr) throw new Error("Could not save the extracted text");

    return { ok: true as const, kind: result.kind, parts: result.parts, chars: text.length };
  });

const KeyConceptsSchema = z.object({
  key_concepts: z.array(
    z.object({
      concept: z.string().min(2).max(200),
      definition: z.string().min(10).max(600),
      example: z.string().max(400).optional().default(""),
      importance: z.enum(["high", "medium", "low"]).optional().default("medium"),
      bloom_level: z.number().int().min(1).max(6).optional().default(2),
    }),
  ).min(4).max(15),
});

export const regenerateKeyConcepts = createServerFn({ method: "POST" })
  .inputValidator((d) => RegenInput.parse(d))
  .handler(async ({ data }) => {
    const { sa, mat } = await loadMaterialForOwner(data.accessToken, data.materialId);
    const content = (mat.original_content ?? "").slice(0, 14000);
    if (!content) throw new Error("No source content available");
    const { object } = await generateObjectSafe({
      schema: KeyConceptsSchema,
      prompt:
        `Extract 8-12 KEY CONCEPTS from this study material titled "${mat.title}" (${mat.subject ?? "General"}).\n` +
        `Each concept MUST be DIFFERENT and have a SPECIFIC 1-2 sentence definition drawn directly from the material.\n` +
        `Do NOT reuse the summary text as the definition. Do NOT repeat the same definition across concepts.\n` +
        `Provide one concrete example per concept from the material itself when possible.\n` +
        `Return JSON: { key_concepts: [{ concept, definition, example, importance, bloom_level }] }.\n\n` +
        `--- MATERIAL ---\n${content}`,
      maxOutputTokens: 2000,
    });
    const normalized = object.key_concepts.map((c, i) => ({
      id: `c${i + 1}`,
      concept: c.concept,
      definition: c.definition,
      example: c.example ?? "",
      importance: c.importance ?? "medium",
      bloom_level: c.bloom_level ?? Math.min(6, i + 1),
    }));
    await sa.from("study_materials").update({ key_concepts: normalized }).eq("id", mat.id);
    return { key_concepts: normalized };
  });

const BloomSchema = z.object({
  L1: z.array(z.object({ question: z.string().min(8).max(400), answer: z.string().min(2).max(800) })).min(1).max(3),
  L2: z.array(z.object({ question: z.string().min(8).max(400), answer: z.string().min(2).max(800) })).min(1).max(3),
  L3: z.array(z.object({ question: z.string().min(8).max(400), answer: z.string().min(2).max(800) })).min(1).max(3),
  L4: z.array(z.object({ question: z.string().min(8).max(400), answer: z.string().min(2).max(800) })).min(1).max(3),
  L5: z.array(z.object({ question: z.string().min(8).max(400), answer: z.string().min(2).max(800) })).min(1).max(3),
  L6: z.array(z.object({ question: z.string().min(8).max(400), answer: z.string().min(2).max(800) })).min(1).max(3),
});

export const regenerateBloomQuestions = createServerFn({ method: "POST" })
  .inputValidator((d) => RegenInput.parse(d))
  .handler(async ({ data }) => {
    const { sa, mat } = await loadMaterialForOwner(data.accessToken, data.materialId);
    const content = (mat.original_content ?? "").slice(0, 14000);
    if (!content) throw new Error("No source content available");
    const { object } = await generateObjectSafe({
      schema: BloomSchema,
      prompt:
        `Generate 2 questions at EACH of Bloom's 6 Taxonomy levels for "${mat.title}" (${mat.subject ?? "General"}).\n` +
        `Every question must be SPECIFIC to the actual content of the material — never a generic template.\n` +
        `Do NOT use the material title as the subject of any question.\n` +
        `Do NOT write any question of the form "What should you understand about ...".\n` +
        `L1=Remember (define/list/recall), L2=Understand (explain/summarise), L3=Apply (calculate/solve/use), ` +
        `L4=Analyse (compare/examine), L5=Evaluate (justify/assess/critique), L6=Create (design/construct/devise).\n` +
        `Return JSON: { L1:[{question,answer}], L2:[...], L3:[...], L4:[...], L5:[...], L6:[...] }.\n\n` +
        `--- MATERIAL ---\n${content}`,
      maxOutputTokens: 3000,
    });
    // Defensive: scrub any sneaky generic placeholders
    const cleaned: Record<string, { question: string; answer: string }[]> = {};
    for (const lvl of ["L1", "L2", "L3", "L4", "L5", "L6"] as const) {
      cleaned[lvl] = (object[lvl] ?? []).filter(
        (q) => !/what should you understand about/i.test(q.question),
      );
    }
    await sa.from("study_materials").update({ bloom_questions: cleaned }).eq("id", mat.id);
    return { bloom_questions: cleaned };
  });

const FormulasSchema = z.object({
  formulas: z.array(
    z.object({
      name: z.string().min(1).max(200),
      latex: z.string().min(1).max(800),
      subject: z.string().max(120).optional(),
      variables: z.array(z.object({
        symbol: z.string().min(1).max(40),
        unit: z.string().max(40).optional(),
        meaning: z.string().max(300).optional().default(""),
      })).max(20).optional().default([]),
    }),
  ).max(30),
});

export const regenerateFormulas = createServerFn({ method: "POST" })
  .inputValidator((d) => RegenInput.parse(d))
  .handler(async ({ data }) => {
    const { sa, mat } = await loadMaterialForOwner(data.accessToken, data.materialId);
    const content = (mat.original_content ?? "").slice(0, 14000);
    if (!content) throw new Error("No source content available");
    const { object } = await generateObjectSafe({
      schema: FormulasSchema,
      prompt:
        `Extract every mathematical formula, equation, and constant from this material titled "${mat.title}".\n` +
        `For each formula, the LaTeX expression MUST be in a field named exactly "latex" (not "formula", not "expression", not "equation").\n` +
        `Return JSON: { formulas: [{ name, latex, subject, variables: [{ symbol, unit, meaning }] }] }.\n` +
        `If the material contains no formulas, return { "formulas": [] }.\n\n` +
        `--- MATERIAL ---\n${content}`,
      maxOutputTokens: 2400,
    });
    await sa.from("study_materials").update({ formulas: object.formulas }).eq("id", mat.id);
    return { formulas: object.formulas };
  });


// ─── PODCAST ────────────────────────────────────────────────────────────────
// Turns a material into a two-host conversation the student can listen to.
//
// The point is not novelty: explanation-by-dialogue is genuinely easier to
// follow than prose, because one host asks the questions a confused reader
// would ask and the other answers them. It also makes a document usable while
// walking, cooking, or on a bus — the times when reading is impossible and
// most revision does not happen.
//
// The audio itself costs nothing. The browser speaks it with two different
// system voices, so there is no TTS bill and no API key.
const PodcastInput = z.object({
  accessToken: z.string(),
  materialId: z.string().uuid(),
});

const PodcastSchema = z.object({
  title: z.string(),
  lines: z
    .array(
      z.object({
        speaker: z.enum(["host", "guest"]),
        text: z.string(),
      }),
    )
    .min(6)
    .max(40),
});

export const generatePodcast = createServerFn({ method: "POST" })
  .inputValidator((d) => PodcastInput.parse(d))
  .handler(async ({ data }) => {
    const userId = await getUserIdFromToken(data.accessToken);
    const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    const { data: mat, error } = await admin
      .from("study_materials")
      .select("id, user_id, title, subject, original_content, ai_summary")
      .eq("id", data.materialId)
      .maybeSingle();
    if (error || !mat) throw new Error("Material not found");
    if (mat.user_id !== userId) throw new Error("Forbidden");

    const source = (mat.ai_summary || mat.original_content || "").slice(0, 24000);
    if (!source.trim()) throw new Error("Nothing to talk about yet");

    const { object } = await generateObjectSafe({
      schema: PodcastSchema,
      prompt:
        `Write a short two-person audio explainer about this material, for a student who is listening rather than reading.\n\n` +
        `"host" is the curious one: they ask the questions a confused student would actually ask, and they push back when something is hand-waved.\n` +
        `"guest" is the expert: warm, plain-spoken, uses concrete analogies, never lectures for more than about four sentences at a time.\n\n` +
        `Rules:\n` +
        `- 14 to 24 lines, alternating, opening with the host framing why this topic matters.\n` +
        `- This is SPOKEN. No markdown, no bullet points, no LaTeX, no "as you can see". Say numbers as words where it reads better.\n` +
        `- Cover the genuinely important ideas, not a summary of the summary. Include at least one worked example said aloud.\n` +
        `- End with the guest naming the single thing worth remembering.\n\n` +
        `Title: "${mat.title}" (${mat.subject ?? "General"}).\n\n--- MATERIAL ---\n${source}`,
    });

    return object;
  });
