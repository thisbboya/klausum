import { awardXp } from "@/lib/xp";
import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Upload, FileText, Loader2, CheckCircle2, Trash2 } from "lucide-react";
import { processMaterial } from "@/lib/materials.functions";
import { useServerFn } from "@tanstack/react-start";
import { getAccessToken } from "@/lib/auth-helper";
import { createNewCard } from "@/lib/fsrs";

export const Route = createFileRoute("/_authenticated/materials")({
  component: MaterialsRoute,
});

const SUBJECTS = [
  "Mathematics","Physics","Chemistry","Biology","English","French","Economics",
  "History","Geography","Computer Science","Electronics","Mechanical Engineering",
  "Civil Engineering","Electrical Engineering","Medicine","Law","Business",
  "Accounting","Agriculture","General","Other",
];
const FIELDS = ["Sciences","Engineering","Humanities","Medicine","Law","Business","Other"];
const STEM_FIELDS = new Set(["Sciences","Engineering","Medicine"]);

const STEPS = [
  "Content received",
  "Extracting key concepts & graph",
  "Creating visual version",
  "Creating auditory version",
  "Creating reading version",
  "Creating kinesthetic version",
  "Generating Cornell Notes",
  "Building 15 flashcards (Bloom L1–L6)",
  "Extracting formulas",
  "Building Bloom question bank",
];

function MaterialsRoute() {
  return <Outlet />;
}

export function MaterialsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const processFn = useServerFn(processMaterial);
  const [uploading, setUploading] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [tab, setTab] = useState<"text" | "file">("text");
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("General");
  const [field, setField] = useState("Sciences");
  const [pasteText, setPasteText] = useState("");

  const { data: materials } = useQuery({
    queryKey: ["materials", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("study_materials")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function runProcess(opts: {
    title: string;
    subject: string;
    fieldCategory: string;
    isStem: boolean;
    text?: string;
    fileBase64?: string;
    mimeType?: string;
    rawContent: string;
    fileName?: string;
    fileType?: string;
    pdfStoragePath?: string;
  }) {
    if (!user) return;
    setUploading(true);
    setStepIdx(0);
    let rowId: string | null = null;
    try {
      // 1. Get token FIRST so we never create an orphan row
      const accessToken = await getAccessToken();

      // 2. Insert row
      const isBinary = !!opts.fileBase64;
      const { data: row, error: insertErr } = await supabase
        .from("study_materials")
        .insert({
          user_id: user.id,
          title: opts.title,
          subject: opts.subject,
          field_category: opts.fieldCategory,
          is_stem: opts.isStem,
          original_content: isBinary ? "" : opts.rawContent,
          file_name: opts.fileName,
          file_type: opts.fileType,
          pdf_storage_path: opts.pdfStoragePath ?? null,
          processing_status: "processing",
        })
        .select()
        .single();
      if (insertErr) throw insertErr;
      rowId = row.id;
      qc.invalidateQueries({ queryKey: ["materials"] });

      const stepTimer = setInterval(() => {
        setStepIdx((i) => Math.min(STEPS.length - 1, i + 1));
      }, 2200);

      const result = await processFn({
        data: {
          accessToken,
          title: opts.title,
          subject: opts.subject,
          fieldCategory: opts.fieldCategory,
          isStem: opts.isStem,
          text: opts.text,
          fileBase64: opts.fileBase64,
          mimeType: opts.mimeType,
        },
      });
      clearInterval(stepTimer);
      setStepIdx(STEPS.length - 1);

      const { error: updateErr } = await supabase
        .from("study_materials")
        .update({
          original_content: result.extracted_text || opts.rawContent,
          ai_summary: result.summary,
          key_concepts: result.key_concepts,
          concept_graph: result.concept_graph,
          adapted_visual: result.visual,
          adapted_auditory: result.auditory,
          adapted_reading: result.reading,
          adapted_kinesthetic: result.kinesthetic,
          cornell_cue: result.cornell.cue_column,
          cornell_notes: result.cornell.notes_column,
          cornell_summary: result.cornell.summary,
          formulas: result.formulas,
          bloom_questions: result.bloom_questions,
          word_count: result.word_count,
          estimated_read_minutes: result.estimated_read_minutes,
          processing_status: "ready",
        })
        .eq("id", row.id);
      if (updateErr) throw updateErr;

      // Create deck + flashcards
      const { data: deck, error: deckErr } = await supabase
        .from("flashcard_decks")
        .insert({
          user_id: user.id,
          material_id: row.id,
          title: opts.title,
          subject: opts.subject,
          total_cards: result.flashcards.length,
        })
        .select()
        .single();
      if (deckErr) throw deckErr;

      const init = createNewCard();
      const cardRows = result.flashcards.map((c) => ({
        user_id: user.id,
        deck_id: deck.id,
        front: c.front,
        back: c.back,
        hint: c.hint,
        bloom_level: c.bloom_level,
        tags: c.tags,
        fsrs_state: init.state,
        fsrs_stability: init.stability,
        fsrs_difficulty: init.difficulty,
        fsrs_retrievability: init.retrievability,
        fsrs_repetitions: init.repetitions,
        fsrs_lapses: init.lapses,
        next_review_date: init.nextReviewDate,
      }));
      const { error: cardsErr } = await supabase.from("flashcards").insert(cardRows);
      if (cardsErr) throw cardsErr;

      await awardXp({ userId: user!.id, amount: 30, action: "material_uploaded", description: title });
      toast.success("Material ready · 15 flashcards generated");
      qc.invalidateQueries({ queryKey: ["materials"] });
      navigate({ to: "/materials/$id", params: { id: row.id } });
    } catch (e: any) {
      console.error(e);
      const msg = e?.message ?? "Upload failed";
      toast.error(msg);
      if (rowId) {
        await supabase
          .from("study_materials")
          .update({ processing_status: "failed", processing_error: msg })
          .eq("id", rowId);
        qc.invalidateQueries({ queryKey: ["materials"] });
      }
    } finally {
      setUploading(false);
      setStepIdx(0);
    }
  }

  async function handleFile(file: File) {
    if (file.size > 20 * 1024 * 1024) return toast.error("Max 20MB");
    const isText = file.type.startsWith("text/") || /\.(txt|md)$/i.test(file.name);
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    const t = file.name.replace(/\.[^.]+$/, "");
    if (isText) {
      const text = await file.text();
      await runProcess({
        title: t, subject, fieldCategory: field, isStem: STEM_FIELDS.has(field),
        text, rawContent: text, fileName: file.name, fileType: file.type,
      });
    } else {
      const fileBase64 = await fileToBase64(file);
      // For PDFs, stash the raw file in storage so the in-app reader can render it.
      let pdfStoragePath: string | undefined;
      if (isPdf && user) {
        const path = `${user.id}/${crypto.randomUUID()}.pdf`;
        const { error: upErr } = await supabase.storage
          .from("materials")
          .upload(path, file, { contentType: "application/pdf", upsert: false, cacheControl: "3600" });
        if (upErr) console.warn("Raw PDF upload failed (non-fatal):", upErr.message);
        else pdfStoragePath = path;
      }
      await runProcess({
        title: t, subject, fieldCategory: field, isStem: STEM_FIELDS.has(field),
        fileBase64, mimeType: file.type || "application/pdf",
        rawContent: `[binary file: ${file.name}]`,
        fileName: file.name, fileType: isPdf ? "pdf" : file.type,
        pdfStoragePath,
      });
    }
  }

  async function handlePaste() {
    if (!title.trim() || !pasteText.trim()) return toast.error("Title and content required");
    await runProcess({
      title: title.trim(),
      subject,
      fieldCategory: field,
      isStem: STEM_FIELDS.has(field),
      text: pasteText,
      rawContent: pasteText,
    });
  }

  const wordCount = pasteText.trim().split(/\s+/).filter(Boolean).length;
  const readMins = Math.max(1, Math.round(wordCount / 220));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Materials</h1>
        <p className="text-sm text-muted-foreground mt-1">Upload anything — AI rewrites it for your style.</p>
      </header>

      {!uploading && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex gap-2 border-b border-border pb-2">
            <TabBtn active={tab === "text"} onClick={() => setTab("text")}>✏️ Text / Paste</TabBtn>
            <TabBtn active={tab === "file"} onClick={() => setTab("file")}>📎 File Upload</TabBtn>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {tab === "text" && (
              <input
                value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="Title"
                className="md:col-span-3 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            )}
            <select value={subject} onChange={(e) => setSubject(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
              {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
            </select>
            <select value={field} onChange={(e) => setField(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
              {FIELDS.map((f) => <option key={f}>{f}</option>)}
            </select>
            <div className="text-xs text-muted-foreground self-center">
              {STEM_FIELDS.has(field) ? "⚗️ STEM — formulas extracted" : "📚 General"}
            </div>
          </div>

          {tab === "text" ? (
            <>
              <textarea
                value={pasteText} onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste notes, textbook excerpts, lecture notes, or any study material..."
                rows={8}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  {wordCount} words · ~{readMins} min read · ~25s processing
                </div>
                <button
                  onClick={handlePaste}
                  disabled={!pasteText.trim() || !title.trim()}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  Process material
                </button>
              </div>
            </>
          ) : (
            <label className="block rounded-xl border-2 border-dashed border-border p-8 text-center cursor-pointer hover:border-primary/40 hover:bg-accent/5 transition">
              <input
                type="file" className="hidden"
                accept=".pdf,.txt,.md,.doc,.docx,image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = "";
                }}
              />
              <Upload className="h-7 w-7 mx-auto text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">Drop or click to upload</p>
              <p className="text-xs text-muted-foreground">PDF, DOCX, TXT, MD, or images. Max 20MB.</p>
            </label>
          )}
        </div>
      )}

      {uploading && (
        <div className="rounded-xl border border-primary/40 bg-primary/5 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div>
              <div className="font-display font-semibold">Processing with AI…</div>
              <div className="text-xs text-muted-foreground">Ye di adwuma! Working hard for you. Do not close this page.</div>
            </div>
          </div>
          <ul className="space-y-1.5 text-sm">
            {STEPS.map((s, i) => (
              <li key={s} className="flex items-center gap-2">
                {i < stepIdx ? (
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                ) : i === stepIdx ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : (
                  <span className="h-4 w-4 rounded-full border border-border inline-block" />
                )}
                <span className={i <= stepIdx ? "" : "text-muted-foreground"}>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {materials && materials.length > 0 ? (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {materials.map((m) => {
            const hasPdf = !!(m as any).pdf_storage_path;
            const isReady = m.processing_status === "ready";
            const isFailed = m.processing_status === "failed";
            return (
              <li key={m.id} className="flex items-center gap-2 px-3 py-2.5">
                <Link
                  to="/materials/$id" params={{ id: m.id }}
                  className="flex items-center gap-3 flex-1 min-w-0 py-1"
                >
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{m.title}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                      <span>{m.subject}</span>
                      <span>·</span>
                      <span>{new Date(m.created_at!).toLocaleDateString()}</span>
                      {hasPdf && <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-semibold">PDF</span>}
                      <span className={`px-1.5 py-0.5 rounded text-[10px] capitalize ${
                        isReady ? "bg-emerald-500/15 text-emerald-400" :
                        isFailed ? "bg-destructive/15 text-destructive" :
                        "bg-muted text-muted-foreground"
                      }`}>{m.processing_status}</span>
                    </div>
                  </div>
                </Link>
                {isReady && (
                  <Link
                    to="/materials/$id" params={{ id: m.id }}
                    className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 active:scale-95 transition"
                  >
                    {hasPdf ? "📖 Read" : "Open"}
                  </Link>
                )}
                <button
                  onClick={async () => {
                    if (!confirm(`Delete "${m.title}"?`)) return;
                    const { error } = await supabase.from("study_materials").delete().eq("id", m.id);
                    if (error) toast.error(error.message);
                    else {
                      toast.success("Material deleted");
                      qc.invalidateQueries({ queryKey: ["materials"] });
                    }
                  }}
                  className="shrink-0 p-2 text-muted-foreground hover:text-destructive active:scale-95 transition"
                  aria-label="Delete material"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        !uploading && <p className="text-center text-sm text-muted-foreground py-8">No materials yet.</p>
      )}
    </div>
  );
}

function TabBtn({ active, children, onClick }: any) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 text-sm rounded-md ${active ? "bg-primary/15 text-primary font-medium" : "text-muted-foreground hover:text-foreground"}`}>
      {children}
    </button>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
