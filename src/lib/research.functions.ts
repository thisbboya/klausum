// Server functions for the Anara-style Research Workspace.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { withGeminiRetry, DEFAULT_MODEL, PRO_MODEL } from "./ai-gateway";
import { generateObjectSafe, generateTextSafe } from "./ai-safe";
import { getUserIdFromToken } from "./server-auth";

// ─────────────────────────────────────────────────────────────────────────────
// Admin client helper
// ─────────────────────────────────────────────────────────────────────────────
function admin() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function assertOwnsProject(userId: string, projectId: string) {
  const { data, error } = await admin()
    .from("research_projects")
    .select("id,user_id")
    .eq("id", projectId)
    .maybeSingle();
  if (error || !data) throw new Error("Project not found");
  if (data.user_id !== userId) throw new Error("Forbidden");
}

async function assertOwnsSource(userId: string, sourceId: string) {
  const { data, error } = await admin()
    .from("research_sources")
    .select("id,user_id,project_id")
    .eq("id", sourceId)
    .maybeSingle();
  if (error || !data) throw new Error("Source not found");
  if (data.user_id !== userId) throw new Error("Forbidden");
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// Projects
// ─────────────────────────────────────────────────────────────────────────────
const ListProjectsInput = z.object({ accessToken: z.string() });
export const listResearchProjects = createServerFn({ method: "POST" })
  .inputValidator((d) => ListProjectsInput.parse(d))
  .handler(async ({ data }) => {
    const userId = await getUserIdFromToken(data.accessToken);
    const { data: rows, error } = await admin()
      .from("research_projects")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const CreateProjectInput = z.object({
  accessToken: z.string(),
  title: z.string().min(1).max(200),
  subject: z.string().max(80).optional(),
  description: z.string().max(2000).optional(),
  color: z.string().max(20).optional(),
});
export const createResearchProject = createServerFn({ method: "POST" })
  .inputValidator((d) => CreateProjectInput.parse(d))
  .handler(async ({ data }) => {
    const userId = await getUserIdFromToken(data.accessToken);
    const { data: row, error } = await admin()
      .from("research_projects")
      .insert({
        user_id: userId,
        title: data.title,
        subject: data.subject ?? null,
        description: data.description ?? null,
        color: data.color ?? "#F4A300",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

const UpdateProjectInput = z.object({
  accessToken: z.string(),
  id: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  subject: z.string().max(80).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  color: z.string().max(20).optional(),
});
export const updateResearchProject = createServerFn({ method: "POST" })
  .inputValidator((d) => UpdateProjectInput.parse(d))
  .handler(async ({ data }) => {
    const userId = await getUserIdFromToken(data.accessToken);
    await assertOwnsProject(userId, data.id);
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.title !== undefined) patch.title = data.title;
    if (data.subject !== undefined) patch.subject = data.subject;
    if (data.description !== undefined) patch.description = data.description;
    if (data.color !== undefined) patch.color = data.color;
    const { error } = await admin().from("research_projects").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const DeleteProjectInput = z.object({ accessToken: z.string(), id: z.string().uuid() });
export const deleteResearchProject = createServerFn({ method: "POST" })
  .inputValidator((d) => DeleteProjectInput.parse(d))
  .handler(async ({ data }) => {
    const userId = await getUserIdFromToken(data.accessToken);
    await assertOwnsProject(userId, data.id);
    const { error } = await admin().from("research_projects").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const GetProjectInput = z.object({ accessToken: z.string(), id: z.string().uuid() });
export const getResearchProject = createServerFn({ method: "POST" })
  .inputValidator((d) => GetProjectInput.parse(d))
  .handler(async ({ data }) => {
    const userId = await getUserIdFromToken(data.accessToken);
    const { data: row, error } = await admin()
      .from("research_projects")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !row) throw new Error("Project not found");
    if (row.user_id !== userId) throw new Error("Forbidden");
    return row;
  });

// ─────────────────────────────────────────────────────────────────────────────
// Sources
// ─────────────────────────────────────────────────────────────────────────────
const ListSourcesInput = z.object({ accessToken: z.string(), projectId: z.string().uuid() });
export const listResearchSources = createServerFn({ method: "POST" })
  .inputValidator((d) => ListSourcesInput.parse(d))
  .handler(async ({ data }) => {
    const userId = await getUserIdFromToken(data.accessToken);
    await assertOwnsProject(userId, data.projectId);
    const { data: rows, error } = await admin()
      .from("research_sources")
      .select("id,project_id,title,source_type,file_url,file_path,raw_url,page_count,word_count,summary,key_claims,processing_done,processing_error,created_at")
      .eq("project_id", data.projectId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const GetSourceInput = z.object({ accessToken: z.string(), id: z.string().uuid() });
export const getResearchSource = createServerFn({ method: "POST" })
  .inputValidator((d) => GetSourceInput.parse(d))
  .handler(async ({ data }) => {
    const userId = await getUserIdFromToken(data.accessToken);
    const src = await assertOwnsSource(userId, data.id);
    const { data: row, error } = await admin()
      .from("research_sources")
      .select("*")
      .eq("id", src.id)
      .single();
    if (error) throw new Error(error.message);
    let signedPdfUrl: string | null = null;
    if (row.file_path) {
      const { data: sig } = await admin().storage
        .from("materials")
        .createSignedUrl(row.file_path, 7200);
      signedPdfUrl = sig?.signedUrl ?? null;
    }
    return { ...row, signedPdfUrl };
  });

const DeleteSourceInput = z.object({ accessToken: z.string(), id: z.string().uuid() });
export const deleteResearchSource = createServerFn({ method: "POST" })
  .inputValidator((d) => DeleteSourceInput.parse(d))
  .handler(async ({ data }) => {
    const userId = await getUserIdFromToken(data.accessToken);
    const src = await assertOwnsSource(userId, data.id);
    if (src) {
      const { data: row } = await admin()
        .from("research_sources")
        .select("file_path")
        .eq("id", data.id)
        .maybeSingle();
      if (row?.file_path) {
        await admin().storage.from("materials").remove([row.file_path]);
      }
    }
    const { error } = await admin().from("research_sources").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─────────────────────────────────────────────────────────────────────────────
// Source ingestion helpers
// ─────────────────────────────────────────────────────────────────────────────

// Strip HTML to plain text (very simple Readability-style).
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

const SummarySchema = z.object({
  summary: z.string().min(20).max(3000),
  key_claims: z
    .array(
      z.object({
        claim: z.string().min(4).max(400),
        page: z.number().int().min(1).max(10000).optional().nullable(),
        confidence: z.enum(["high", "medium", "low"]).optional(),
      }),
    )
    .max(20)
    .default([]),
});

async function runSummaryPipeline(text: string, title: string) {
  if (!text || text.length < 60) {
    return { summary: "No extractable text yet.", key_claims: [] };
  }
  const trimmed = text.slice(0, 30000);
  const { object } = await generateObjectSafe({
    schema: SummarySchema,
    prompt:
      `Source: "${title}"\n\n` +
      `1) Write a clear 200-300 word summary capturing the source's main thesis, methods (if any) and conclusions.\n` +
      `2) Extract up to 8 key claims as { claim, page (best-guess integer or null), confidence (high/medium/low) }.\n` +
      `Return JSON: { summary, key_claims }.\n\n--- SOURCE ---\n${trimmed}`,
    maxOutputTokens: 1800,
  });
  return object;
}

async function extractPdfText(fileBase64: string, mimeType: string): Promise<string> {
  const extraction = await withGeminiRetry(DEFAULT_MODEL, (model) =>
    generateText({
      model,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Extract the readable study content from this file as plain text. Keep headings, equations, lists, slide titles, bullet points and important labels. For each page, prefix with '## Page N:'. Do not summarize.",
            },
            { type: "file", data: fileBase64, mediaType: mimeType },
          ],
        },
      ],
      maxOutputTokens: 16000,
      maxRetries: 1,
    }),
  );
  return extraction.text.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Add source: PDF (base64 upload)
// ─────────────────────────────────────────────────────────────────────────────
const AddPdfInput = z.object({
  accessToken: z.string(),
  projectId: z.string().uuid(),
  title: z.string().min(1).max(300),
  fileBase64: z.string().max(28_000_000),
  mimeType: z.enum(["application/pdf"]),
  pageCount: z.number().int().min(1).max(10000).optional(),
});
export const addPdfSource = createServerFn({ method: "POST" })
  .inputValidator((d) => AddPdfInput.parse(d))
  .handler(async ({ data }) => {
    const userId = await getUserIdFromToken(data.accessToken);
    await assertOwnsProject(userId, data.projectId);

    // 1. Upload PDF to materials bucket
    const path = `${userId}/research/${crypto.randomUUID()}.pdf`;
    const bytes = Buffer.from(data.fileBase64, "base64");
    const { error: upErr } = await admin().storage
      .from("materials")
      .upload(path, bytes, { contentType: "application/pdf", upsert: false, cacheControl: "3600" });
    if (upErr) throw new Error("Upload failed: " + upErr.message);

    // 2. Insert pending row
    const { data: row, error: insErr } = await admin()
      .from("research_sources")
      .insert({
        project_id: data.projectId,
        user_id: userId,
        title: data.title,
        source_type: "pdf",
        file_path: path,
        page_count: data.pageCount ?? null,
        processing_done: false,
      })
      .select()
      .single();
    if (insErr) throw new Error(insErr.message);

    // 3. Extract + summarise (best-effort; failure leaves row marked w/ error)
    try {
      const extracted = await extractPdfText(data.fileBase64, data.mimeType);
      const word_count = extracted.trim().split(/\s+/).filter(Boolean).length;
      const sum = await runSummaryPipeline(extracted, data.title);
      await admin()
        .from("research_sources")
        .update({
          extracted_text: extracted,
          word_count,
          summary: sum.summary,
          key_claims: sum.key_claims,
          processing_done: true,
        })
        .eq("id", row.id);
    } catch (e: any) {
      await admin()
        .from("research_sources")
        .update({ processing_error: String(e?.message ?? e), processing_done: true })
        .eq("id", row.id);
    }
    return { id: row.id };
  });

// ─────────────────────────────────────────────────────────────────────────────
// Add source: URL
// ─────────────────────────────────────────────────────────────────────────────
const AddUrlInput = z.object({
  accessToken: z.string(),
  projectId: z.string().uuid(),
  title: z.string().min(1).max(300).optional(),
  url: z.string().url().max(2000),
});
export const addUrlSource = createServerFn({ method: "POST" })
  .inputValidator((d) => AddUrlInput.parse(d))
  .handler(async ({ data }) => {
    const userId = await getUserIdFromToken(data.accessToken);
    await assertOwnsProject(userId, data.projectId);

    let text = "";
    let finalTitle = data.title ?? data.url;
    try {
      const res = await fetch(data.url, {
        headers: { "User-Agent": "KlausumResearch/1.0" },
        signal: AbortSignal.timeout(15000),
      });
      const html = await res.text();
      text = htmlToText(html);
      const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      if (!data.title && m?.[1]) finalTitle = m[1].trim().slice(0, 300);
    } catch (e: any) {
      throw new Error("Could not fetch URL: " + (e?.message ?? "unknown"));
    }

    const { data: row, error: insErr } = await admin()
      .from("research_sources")
      .insert({
        project_id: data.projectId,
        user_id: userId,
        title: finalTitle,
        source_type: "url",
        raw_url: data.url,
        extracted_text: text,
        word_count: text.trim().split(/\s+/).filter(Boolean).length,
        processing_done: false,
      })
      .select()
      .single();
    if (insErr) throw new Error(insErr.message);

    try {
      const sum = await runSummaryPipeline(text, finalTitle);
      await admin()
        .from("research_sources")
        .update({ summary: sum.summary, key_claims: sum.key_claims, processing_done: true })
        .eq("id", row.id);
    } catch (e: any) {
      await admin()
        .from("research_sources")
        .update({ processing_error: String(e?.message ?? e), processing_done: true })
        .eq("id", row.id);
    }
    return { id: row.id };
  });

// ─────────────────────────────────────────────────────────────────────────────
// Add source: plain text / note
// ─────────────────────────────────────────────────────────────────────────────
const AddTextInput = z.object({
  accessToken: z.string(),
  projectId: z.string().uuid(),
  title: z.string().min(1).max(300),
  text: z.string().min(10).max(200000),
  kind: z.enum(["text", "note"]).default("text"),
});
export const addTextSource = createServerFn({ method: "POST" })
  .inputValidator((d) => AddTextInput.parse(d))
  .handler(async ({ data }) => {
    const userId = await getUserIdFromToken(data.accessToken);
    await assertOwnsProject(userId, data.projectId);

    const { data: row, error } = await admin()
      .from("research_sources")
      .insert({
        project_id: data.projectId,
        user_id: userId,
        title: data.title,
        source_type: data.kind,
        extracted_text: data.text,
        word_count: data.text.trim().split(/\s+/).filter(Boolean).length,
        processing_done: false,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    try {
      const sum = await runSummaryPipeline(data.text, data.title);
      await admin()
        .from("research_sources")
        .update({ summary: sum.summary, key_claims: sum.key_claims, processing_done: true })
        .eq("id", row.id);
    } catch (e: any) {
      await admin()
        .from("research_sources")
        .update({ processing_error: String(e?.message ?? e), processing_done: true })
        .eq("id", row.id);
    }
    return { id: row.id };
  });

// ─────────────────────────────────────────────────────────────────────────────
// Add source: YouTube (transcript fetched via youtube oembed + open transcript)
// ─────────────────────────────────────────────────────────────────────────────
const AddYoutubeInput = z.object({
  accessToken: z.string(),
  projectId: z.string().uuid(),
  url: z.string().url().max(500),
});
function extractYouTubeId(url: string): string | null {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{6,})/);
  return m?.[1] ?? null;
}
export const addYoutubeSource = createServerFn({ method: "POST" })
  .inputValidator((d) => AddYoutubeInput.parse(d))
  .handler(async ({ data }) => {
    const userId = await getUserIdFromToken(data.accessToken);
    await assertOwnsProject(userId, data.projectId);
    const videoId = extractYouTubeId(data.url);
    if (!videoId) throw new Error("Could not parse YouTube URL");

    // Get title via oembed
    let title = "YouTube video";
    try {
      const oe = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
        { signal: AbortSignal.timeout(8000) },
      );
      if (oe.ok) {
        const j = (await oe.json()) as { title?: string };
        if (j.title) title = j.title;
      }
    } catch {
      // ignore
    }

    // Best-effort transcript: try the public timedtext endpoint
    let transcript = "";
    try {
      const tt = await fetch(
        `https://video.google.com/timedtext?lang=en&v=${videoId}`,
        { signal: AbortSignal.timeout(8000) },
      );
      if (tt.ok) {
        const xml = await tt.text();
        transcript = htmlToText(xml);
      }
    } catch {
      // ignore
    }
    if (!transcript) {
      transcript = `(Transcript not available automatically. Title: ${title}. URL: ${data.url})`;
    }

    const { data: row, error } = await admin()
      .from("research_sources")
      .insert({
        project_id: data.projectId,
        user_id: userId,
        title,
        source_type: "youtube",
        raw_url: data.url,
        extracted_text: transcript,
        word_count: transcript.trim().split(/\s+/).filter(Boolean).length,
        processing_done: false,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    try {
      const sum = await runSummaryPipeline(transcript, title);
      await admin()
        .from("research_sources")
        .update({ summary: sum.summary, key_claims: sum.key_claims, processing_done: true })
        .eq("id", row.id);
    } catch (e: any) {
      await admin()
        .from("research_sources")
        .update({ processing_error: String(e?.message ?? e), processing_done: true })
        .eq("id", row.id);
    }
    return { id: row.id };
  });

// ─────────────────────────────────────────────────────────────────────────────
// Annotations
// ─────────────────────────────────────────────────────────────────────────────
const ListAnnInput = z.object({ accessToken: z.string(), sourceId: z.string().uuid() });
export const listAnnotations = createServerFn({ method: "POST" })
  .inputValidator((d) => ListAnnInput.parse(d))
  .handler(async ({ data }) => {
    const userId = await getUserIdFromToken(data.accessToken);
    await assertOwnsSource(userId, data.sourceId);
    const { data: rows, error } = await admin()
      .from("research_annotations")
      .select("*")
      .eq("source_id", data.sourceId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const CreateAnnInput = z.object({
  accessToken: z.string(),
  sourceId: z.string().uuid(),
  pageNumber: z.number().int().min(1).max(10000).optional(),
  selectedText: z.string().min(1).max(4000),
  note: z.string().max(2000).optional(),
  color: z.string().max(20).optional(),
  tag: z.string().max(60).optional(),
  position: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .optional(),
});
export const createAnnotation = createServerFn({ method: "POST" })
  .inputValidator((d) => CreateAnnInput.parse(d))
  .handler(async ({ data }) => {
    const userId = await getUserIdFromToken(data.accessToken);
    await assertOwnsSource(userId, data.sourceId);
    const { data: row, error } = await admin()
      .from("research_annotations")
      .insert({
        source_id: data.sourceId,
        user_id: userId,
        page_number: data.pageNumber ?? null,
        selected_text: data.selectedText,
        note: data.note ?? null,
        color: data.color ?? "#F4A300",
        tag: data.tag ?? null,
        position: data.position ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

const DeleteAnnInput = z.object({ accessToken: z.string(), id: z.string().uuid() });
export const deleteAnnotation = createServerFn({ method: "POST" })
  .inputValidator((d) => DeleteAnnInput.parse(d))
  .handler(async ({ data }) => {
    const userId = await getUserIdFromToken(data.accessToken);
    const { data: row, error } = await admin()
      .from("research_annotations")
      .select("user_id")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !row) throw new Error("Annotation not found");
    if (row.user_id !== userId) throw new Error("Forbidden");
    await admin().from("research_annotations").delete().eq("id", data.id);
    return { ok: true };
  });

// ─────────────────────────────────────────────────────────────────────────────
// Research chat
// ─────────────────────────────────────────────────────────────────────────────
const HistoryMsg = z.object({
  role: z.enum(["user", "ai"]),
  content: z.string().max(8000),
});

const ChatInput = z.object({
  accessToken: z.string(),
  projectId: z.string().uuid(),
  scope: z.enum(["source", "project"]),
  sourceId: z.string().uuid().optional(),
  currentPage: z.number().int().min(1).max(10000).optional(),
  question: z.string().min(1).max(4000),
  history: z.array(HistoryMsg).max(12).optional(),
  level: z.string().max(80).optional(),
  subject: z.string().max(80).optional(),
});

export const chatResearch = createServerFn({ method: "POST" })
  .inputValidator((d) => ChatInput.parse(d))
  .handler(async ({ data }) => {
    const userId = await getUserIdFromToken(data.accessToken);
    await assertOwnsProject(userId, data.projectId);

    let system = "";
    if (data.scope === "source") {
      if (!data.sourceId) throw new Error("sourceId required for single-source scope");
      const { data: src, error } = await admin()
        .from("research_sources")
        .select("title,extracted_text,page_count")
        .eq("id", data.sourceId)
        .single();
      if (error || !src) throw new Error("Source not found");
      const body = (src.extracted_text || "").slice(0, 24000);
      system = `You are a research assistant with access to this document ONLY.
Source title: ${src.title}
Source text${src.page_count ? ` (pages 1-${src.page_count})` : ""}:
"""
${body}
"""

RULES — STRICT:
1. Every factual claim MUST cite a specific page as [p.N]. If you cannot tie a claim to a page, do not state it as fact.
2. If the answer is not in this document, reply: "This document does not address that." Do NOT answer from general knowledge.
3. When summarising, surface 3 main arguments, 3 key evidence points, and 1 gap.
4. Format citations inline as [p.N] — never as footnotes.
5. End with a single line "Sources: [p.N] [p.N]" listing every page you cited.
Student level: ${data.level ?? "student"} | Subject: ${data.subject ?? "General"}.${
        data.currentPage ? ` The student is currently viewing page ${data.currentPage}.` : ""
      }`;
    } else {
      const { data: sources, error } = await admin()
        .from("research_sources")
        .select("id,title,summary")
        .eq("project_id", data.projectId)
        .order("created_at", { ascending: true })
        .limit(8);
      if (error) throw new Error(error.message);
      const list = (sources ?? [])
        .map(
          (s, i) =>
            `Source ${i + 1}: "${s.title}"\n   Summary: ${(s.summary || "(no summary yet)").slice(0, 800)}`,
        )
        .join("\n\n");
      system = `You are a synthesis research assistant with access to ${sources?.length ?? 0} sources on ${data.subject ?? "this topic"}.

Sources available:
${list || "(no sources yet)"}

RULES — STRICT:
1. When you use information from a source, cite it inline as [Source N, p.X] (use page when known, otherwise [Source N]).
2. When sources agree, state the consensus and cite each: "Both [Source 1] and [Source 3] argue..."
3. When sources DISAGREE, surface the disagreement explicitly. Example: "Source 1 argues X [Source 1] while Source 2 contradicts this with Y [Source 2]."
4. If asked something no source covers, say so plainly. Do not hallucinate or fall back to general knowledge.
5. Target Bloom L4 (Analyse) or higher — synthesise, don't just list.
6. End with "Sources: [Source 1] [Source 3]" listing every source you cited.
Student level: ${data.level ?? "student"}.`;
    }

    const history = (data.history ?? [])
      .map((m) => `${m.role === "user" ? "Student" : "Assistant"}: ${m.content}`)
      .join("\n\n");

    const prompt = `${system}

═══ CONVERSATION HISTORY ═══
${history || "(first message)"}

═══ NEW QUESTION ═══
Student: ${data.question}
Assistant:`;

    const result = await withGeminiRetry(PRO_MODEL, (model) =>
      generateText({ model, prompt, maxOutputTokens: 1400, maxRetries: 1 }),
    );
    const reply = result.text.trim();

    // Append to chat session (one session per project)
    const { data: existing } = await admin()
      .from("research_chat_sessions")
      .select("id,messages")
      .eq("project_id", data.projectId)
      .eq("user_id", userId)
      .maybeSingle();

    const newMessages = [
      ...(((existing?.messages as any[]) ?? []).slice(-40)),
      { role: "user", content: data.question, at: new Date().toISOString(), scope: data.scope, sourceId: data.sourceId ?? null },
      { role: "ai", content: reply, at: new Date().toISOString(), scope: data.scope, sourceId: data.sourceId ?? null },
    ];
    if (existing) {
      await admin()
        .from("research_chat_sessions")
        .update({ messages: newMessages, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      await admin().from("research_chat_sessions").insert({
        project_id: data.projectId,
        user_id: userId,
        messages: newMessages,
      });
    }

    return { reply };
  });

const GetChatInput = z.object({ accessToken: z.string(), projectId: z.string().uuid() });
export const getResearchChat = createServerFn({ method: "POST" })
  .inputValidator((d) => GetChatInput.parse(d))
  .handler(async ({ data }) => {
    const userId = await getUserIdFromToken(data.accessToken);
    await assertOwnsProject(userId, data.projectId);
    const { data: row } = await admin()
      .from("research_chat_sessions")
      .select("messages")
      .eq("project_id", data.projectId)
      .eq("user_id", userId)
      .maybeSingle();
    return { messages: ((row?.messages as any[]) ?? []) };
  });

// ─────────────────────────────────────────────────────────────────────────────
// Citation generator
// ─────────────────────────────────────────────────────────────────────────────
const GenRefInput = z.object({
  accessToken: z.string(),
  sourceId: z.string().uuid(),
  style: z.enum(["APA", "MLA", "Chicago", "Harvard", "Vancouver", "IEEE"]),
});
export const generateReference = createServerFn({ method: "POST" })
  .inputValidator((d) => GenRefInput.parse(d))
  .handler(async ({ data }) => {
    const userId = await getUserIdFromToken(data.accessToken);
    const src = await assertOwnsSource(userId, data.sourceId);
    const { data: row } = await admin()
      .from("research_sources")
      .select("title,raw_url,source_type,summary")
      .eq("id", src.id)
      .single();

    const { text } = await generateTextSafe({
      prompt:
        `Generate a correctly formatted ${data.style} reference for this source. ` +
        `Title: ${row?.title}\nURL: ${row?.raw_url ?? "N/A"}\nType: ${row?.source_type}\n` +
        `Context: ${(row?.summary ?? "").slice(0, 400)}\n\n` +
        `Use today's accessed-on date when relevant. Return ONLY the formatted reference string, nothing else.`,
      maxOutputTokens: 400,
    });
    return { reference: text.trim() };
  });

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────
const ExportInput = z.object({ accessToken: z.string(), projectId: z.string().uuid() });
export const exportProjectMarkdown = createServerFn({ method: "POST" })
  .inputValidator((d) => ExportInput.parse(d))
  .handler(async ({ data }) => {
    const userId = await getUserIdFromToken(data.accessToken);
    await assertOwnsProject(userId, data.projectId);

    const { data: project } = await admin()
      .from("research_projects")
      .select("title,description,subject,created_at")
      .eq("id", data.projectId)
      .single();
    const { data: sources } = await admin()
      .from("research_sources")
      .select("id,title,source_type,raw_url,summary,key_claims,page_count")
      .eq("project_id", data.projectId)
      .order("created_at", { ascending: true });
    const sourceIds = (sources ?? []).map((s) => s.id);
    const { data: anns } = sourceIds.length
      ? await admin()
          .from("research_annotations")
          .select("source_id,page_number,selected_text,note,color,tag,created_at")
          .in("source_id", sourceIds)
          .order("source_id", { ascending: true })
      : { data: [] as any[] };
    const { data: chat } = await admin()
      .from("research_chat_sessions")
      .select("messages")
      .eq("project_id", data.projectId)
      .eq("user_id", userId)
      .maybeSingle();

    const lines: string[] = [];
    lines.push(`# ${project?.title ?? "Research Project"}\n`);
    if (project?.subject) lines.push(`**Subject:** ${project.subject}`);
    if (project?.description) lines.push(`\n${project.description}\n`);
    lines.push(`\n*Exported ${new Date().toISOString().slice(0, 10)}*\n`);

    lines.push(`\n## Sources (${sources?.length ?? 0})\n`);
    for (let i = 0; i < (sources ?? []).length; i++) {
      const s = sources![i];
      lines.push(`### ${i + 1}. ${s.title}`);
      lines.push(`*Type:* ${s.source_type}${s.raw_url ? ` · ${s.raw_url}` : ""}${s.page_count ? ` · ${s.page_count} pages` : ""}`);
      if (s.summary) lines.push(`\n${s.summary}\n`);
      const claims = (s.key_claims as any[]) ?? [];
      if (claims.length) {
        lines.push(`\n**Key claims:**`);
        for (const c of claims) lines.push(`- ${c.claim}${c.page ? ` *(p.${c.page})*` : ""}`);
      }
      const sourceAnns = (anns ?? []).filter((a: any) => a.source_id === s.id);
      if (sourceAnns.length) {
        lines.push(`\n**Annotations:**`);
        for (const a of sourceAnns) {
          lines.push(`- ${a.page_number ? `p.${a.page_number} — ` : ""}"${a.selected_text}"${a.note ? ` — *${a.note}*` : ""}`);
        }
      }
      lines.push("");
    }

    const messages = ((chat?.messages as any[]) ?? []);
    if (messages.length) {
      lines.push(`\n## Chat history\n`);
      for (const m of messages) {
        lines.push(`**${m.role === "user" ? "You" : "Assistant"}:** ${m.content}\n`);
      }
    }

    return { markdown: lines.join("\n") };
  });
