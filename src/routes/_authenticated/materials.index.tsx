import { awardXp } from "@/lib/xp";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
import { CompanionSVG, getCompanion } from "@/components/companion-svg";
import { AiProgress } from "@/components/ai-progress";

export const Route = createFileRoute("/_authenticated/materials/")({
  component: MaterialsPage,
});

const SUBJECTS = [
  "Mathematics","Physics","Chemistry","Biology","English","French","Economics",
  "History","Geography","Computer Science","Electronics","Mechanical Engineering",
  "Civil Engineering","Electrical Engineering","Medicine","Law","Business",
  "Accounting","Agriculture","General","Other",
];
const FIELDS = ["Sciences","Engineering","Humanities","Medicine","Law","Business","Other"];
const STEM_FIELDS = new Set(["Sciences","Engineering","Medicine"]);

// Course-card tints, hashed from the subject name (CourieX-style folders)
const COURSE_COLORS = ["#1CB0F6", "#58CC02", "#FFC800", "#A570FF", "#FF4B4B", "#F97316", "#0D9488", "#8B5CF6"];

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

export function MaterialsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const processFn = useServerFn(processMaterial);
  const [uploading, setUploading] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("General");
  const [field, setField] = useState("Sciences");
  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [uploadingFile, setUploadingFile] = useState<string | null>(null);

  // Custom courses (folders with icon + color); tolerate a missing table
  const { data: courses = [] } = useQuery({
    queryKey: ["courses", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("courses").select("*").order("created_at");
      if (error) return [];
      return data as { id: string; user_id: string; name: string; description: string | null; icon: string; color: string; share_code: string | null }[];
    },
  });
  const courseByName = Object.fromEntries(courses.map((c) => [c.name, c]));

  // Same key as the layout's profile query — served from cache, no extra request
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("user_profiles").select("*").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

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
    fileStoragePath?: string;
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
          file_storage_path: opts.fileStoragePath ?? null,
          processing_status: "processing",
        } as any)
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
      setTitle("");
    }
  }

  // Gemini's inline-data ceiling; larger files are stored + viewable but
  // skip the AI rewrite instead of failing the whole upload.
  const AI_INLINE_LIMIT = 18 * 1024 * 1024;

  /** Shrink images hard before they touch storage or the AI: max 1600px,
   *  JPEG q0.72 — a 8MB phone photo becomes ~300KB and still reads crisply. */
  async function compressImage(file: File): Promise<File> {
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bmp.width * scale);
      canvas.height = Math.round(bmp.height * scale);
      canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.72));
      if (blob && blob.size < file.size) {
        return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
      }
    } catch { /* fall through with original */ }
    return file;
  }

  async function handleFile(original: File) {
    let file = original;
    if (file.type.startsWith("image/")) {
      file = await compressImage(file);
      if (file.size < original.size) {
        toast.success(`Compressed ${(original.size / 1048576).toFixed(1)}MB → ${(file.size / 1048576).toFixed(1)}MB`);
      }
    }
    if (file.size > 120 * 1024 * 1024) return toast.error("Max 120MB");
    const lower = file.name.toLowerCase();
    const isText = file.type.startsWith("text/") || /\.(txt|md)$/i.test(file.name);
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    // Office types — browsers sometimes omit the MIME on these.
    const officeMime: Record<string, string> = {
      ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ".ppt": "application/vnd.ms-powerpoint",
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".doc": "application/msword",
      ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ".xls": "application/vnd.ms-excel",
    };
    const ext = "." + lower.split(".").pop()!;
    const t = title.trim() || file.name.replace(/\.[^.]+$/, "");
    if (isText) {
      const text = await file.text();
      await runProcess({
        title: t, subject, fieldCategory: field, isStem: STEM_FIELDS.has(field),
        text, rawContent: text, fileName: file.name, fileType: file.type,
      });
    } else {
      // Gemini inline-data accepts only PDF/images/text — office docs always
      // take the store-and-register path (Office viewer + AI chat still work).
      const isOffice = !!officeMime[ext] || Object.values(officeMime).includes(file.type);
      const tooBigForAI = file.size > AI_INLINE_LIMIT || isOffice;
      const fileBase64 = tooBigForAI ? undefined : await fileToBase64(file);
      const resolvedMime = file.type || officeMime[ext] || "application/octet-stream";
      // Stash EVERY original in storage so the viewer can render it
      // (PDF natively, images inline, office docs via embedded viewer).
      setUploadingFile(file.name);
      let fileStoragePath: string | undefined;
      if (user) {
        const path = `${user.id}/${crypto.randomUUID()}${ext}`;
        const { error: upErr } = await supabase.storage
          .from("materials")
          .upload(path, file, { contentType: resolvedMime, upsert: false, cacheControl: "3600" });
        if (upErr) console.warn("Raw file upload failed (non-fatal):", upErr.message);
        else fileStoragePath = path;
      }
      setUploadingFile(null);

      if (tooBigForAI) {
        // Too large for the AI pipeline: store + register it so the viewer
        // (and PDF chat, which reads pages client-side) still work fully.
        if (!fileStoragePath) return toast.error("Upload failed — file could not be stored");
        const { data: row, error } = await supabase
          .from("study_materials")
          .insert({
            user_id: user!.id,
            title: t,
            subject,
            field_category: field,
            is_stem: STEM_FIELDS.has(field),
            original_content: `[large file: ${file.name}]`,
            file_name: file.name,
            file_type: isPdf ? "pdf" : (officeMime[ext] ? ext.slice(1) : file.type),
            pdf_storage_path: isPdf ? fileStoragePath : null,
            file_storage_path: fileStoragePath,
            processing_status: "ready",
          } as any)
          .select("id")
          .single();
        if (error) return toast.error(error.message);
        toast.success(
          isOffice
            ? "Uploaded — opens in the document viewer with AI chat"
            : "Big file stored — reader and AI chat work; study-tool generation needs files under 18MB",
        );
        qc.invalidateQueries({ queryKey: ["materials"] });
        navigate({ to: "/materials/$id", params: { id: row.id } });
        return;
      }

      await runProcess({
        title: t, subject, fieldCategory: field, isStem: STEM_FIELDS.has(field),
        fileBase64, mimeType: resolvedMime,
        rawContent: `[binary file: ${file.name}]`,
        fileName: file.name, fileType: isPdf ? "pdf" : (officeMime[ext] ? ext.slice(1) : file.type),
        pdfStoragePath: isPdf ? fileStoragePath : undefined,
        fileStoragePath,
      });
    }
  }

  async function joinCourse() {
    const code = window.prompt("Enter the course share code (e.g. AB12CD):");
    if (!code?.trim()) return;
    const { data, error } = await (supabase as any).rpc("join_course_by_code", { p_code: code.trim() });
    if (error) return toast.error(error.message);
    toast.success(`Joined "${data.name}" — its materials are now in your library`);
    qc.invalidateQueries({ queryKey: ["courses"] });
    qc.invalidateQueries({ queryKey: ["materials"] });
  }

  async function shareCourse(subjectName: string) {
    if (!user) return;
    let course = courseByName[subjectName];
    // Sharing a plain subject folder promotes it to a real course first
    if (!course) {
      const { data, error } = await (supabase as any)
        .from("courses")
        .insert({ user_id: user.id, name: subjectName })
        .select("*")
        .single();
      if (error) return toast.error(error.message);
      course = data;
    }
    let code = course.share_code;
    if (!code) {
      code = Array.from({ length: 6 }, () => "ABCDEFGHJKMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 31)]).join("");
      const { error } = await (supabase as any).from("courses").update({ share_code: code }).eq("id", course.id);
      if (error) return toast.error(error.message);
    }
    qc.invalidateQueries({ queryKey: ["courses"] });
    try {
      await navigator.clipboard.writeText(code);
      toast.success(`Share code ${code} copied — friends enter it under "Join course"`);
    } catch {
      window.prompt("Share this code with friends:", code);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Materials</h1>
          <p className="text-sm text-muted-foreground mt-1">Upload anything — AI rewrites it for your style.</p>
        </div>
        {!activeSubject && (
          <div className="flex shrink-0 gap-2">
            <button
              onClick={joinCourse}
              className="rounded-xl border-2 border-border bg-card px-4 py-2 text-sm font-bold text-muted-foreground hover:text-foreground"
            >
              Join course
            </button>
            <button
              onClick={() => setShowCourseModal(true)}
              className="rounded-xl border-2 border-border bg-card px-4 py-2 text-sm font-bold text-muted-foreground hover:text-foreground"
            >
              + New course
            </button>
            <button
              onClick={() => setShowUploadForm(!showUploadForm)}
              className="btn-3d rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              {showUploadForm ? "Cancel" : "+ Upload Material"}
            </button>
          </div>
        )}
      </header>

      {showCourseModal && (
        <CourseModal
          userId={user?.id}
          onClose={() => setShowCourseModal(false)}
          onCreated={() => { setShowCourseModal(false); qc.invalidateQueries({ queryKey: ["courses"] }); }}
        />
      )}

      {showUploadForm && !activeSubject && !uploading && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowUploadForm(false)}
        >
        <div
          className="card-chunky max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto bg-card p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-extrabold">Upload material</h2>
            <button
              onClick={() => setShowUploadForm(false)}
              className="rounded-full p-1.5 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          {uploadingFile && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm font-extrabold">
                <span>Uploading {uploadingFile}…</span>
              </div>
              <AiProgress messages={[`Sending ${uploadingFile} to your vault…`, "Keeping the original safe for the viewer…"]} />
            </div>
          )}

          {/* CourieX-simple: title + course. Field/STEM stays automatic. */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <input
              value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Material title (e.g. Week 3 Lecture Notes)"
              className="rounded-xl border-2 border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <select value={subject} onChange={(e) => setSubject(e.target.value)}
              className="rounded-xl border-2 border-border bg-background px-3 py-2 text-sm">
              {courses.length > 0 && (
                <optgroup label="Your courses">
                  {courses.map((c) => <option key={c.id}>{c.name}</option>)}
                </optgroup>
              )}
              {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>

          <>
              <label
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) setPendingFile(f);
                }}
                className={`block cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition ${
                  pendingFile
                    ? "border-success bg-success/8"
                    : dragOver
                      ? "border-sky bg-sky/10"
                      : "border-sky/40 bg-sky/5 hover:border-sky hover:bg-sky/10"
                }`}
              >
                <input
                  type="file" className="hidden"
                  accept=".pdf,.txt,.md,.doc,.docx,.ppt,.pptx,.xls,.xlsx,image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setPendingFile(f);
                    e.target.value = "";
                  }}
                />
                {pendingFile ? (
                  <>
                    <FileText className="h-8 w-8 mx-auto text-success" />
                    <p className="mt-3 text-sm font-extrabold">{pendingFile.name}</p>
                    <p className="text-xs font-semibold text-muted-foreground">
                      {(pendingFile.size / 1024).toFixed(2)} KB — ready to process
                    </p>
                  </>
                ) : (
                  <>
                    <Upload className="h-7 w-7 mx-auto text-sky" />
                    <p className="mt-3 text-sm font-bold text-sky">Drop your file here or click to browse</p>
                    <p className="text-xs font-semibold text-muted-foreground">PDF, PowerPoint, Word, Excel, TXT, MD, or images · Max 120MB</p>
                  </>
                )}
              </label>
              {pendingFile && (
                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    onClick={() => setPendingFile(null)}
                    className="rounded-xl border-2 border-border px-4 py-2 text-sm font-bold text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => { const f = pendingFile; setPendingFile(null); handleFile(f); }}
                    className="btn-3d rounded-xl bg-primary px-5 py-2 text-sm font-extrabold text-primary-foreground"
                  >
                    Upload
                  </button>
                </div>
              )}
            </>
        </div>
        </div>
      )}

      {uploading && (() => {
        const c = getCompanion(profile?.companion_id);
        const pilotName = profile?.companion_name ?? c.name;
        // Determinate, never-stalling: each step advances the bar; capped at 94%
        // so the final jump to done feels like a reward (goal-gradient effect).
        const pct = Math.min(94, Math.round(((stepIdx + 1) / STEPS.length) * 94));
        const phase =
          stepIdx < 3 ? `${pilotName} is reading every word you gave it…`
          : stepIdx < 7 ? `Rewriting it for the way YOU learn…`
          : `Almost there — final polish on your flashcards…`;
        return (
        <div className="rounded-xl border border-primary/40 bg-primary/5 p-6">
          <div className="flex items-center gap-4 mb-3">
            <div className="shrink-0">
              <CompanionSVG id={c.id} size={64} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-display font-extrabold">{pilotName} is on it</div>
              <div className="text-xs font-semibold text-muted-foreground">{phase}</div>
            </div>
            <div className="font-display text-2xl font-extrabold text-primary tabular-nums">{pct}%</div>
          </div>
          <div className="mb-4 h-3 overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out"
              style={{ width: `${pct}%` }}
            />
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
        );
      })()}

      {materials && materials.length > 0 && !activeSubject ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Object.entries(
            materials.reduce<Record<string, typeof materials>>(
              (acc, m) => {
                const key = m.subject || "General";
                (acc[key] ??= [] as any).push(m);
                return acc;
              },
              // Custom courses show as folders even before their first upload
              Object.fromEntries(courses.map((c) => [c.name, [] as any])),
            ),
          ).map(([subjectName, items]) => {
            const course = courseByName[subjectName];
            const color = course?.color ?? COURSE_COLORS[
              subjectName.split("").reduce((a, ch) => a + ch.charCodeAt(0), 0) % COURSE_COLORS.length
            ];
            const ready = items.filter((m) => m.processing_status === "ready").length;
            return (
              <button
                key={subjectName}
                onClick={() => setActiveSubject(subjectName)}
                className="card-chunky card-chunky-hover overflow-hidden bg-card text-left"
              >
                <div
                  className="flex h-20 items-center justify-center"
                  style={{ backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)` }}
                >
                  <span
                    className="flex h-12 w-12 items-center justify-center rounded-2xl"
                    style={{ backgroundColor: `color-mix(in srgb, ${color} 22%, transparent)` }}
                  >
                    {course?.icon ? (
                      <span className="text-2xl leading-none">{course.icon}</span>
                    ) : (
                      <FileText className="h-6 w-6" style={{ color }} />
                    )}
                  </span>
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-2">
                    <div className="truncate font-display text-base font-extrabold">{subjectName}</div>
                    {course && course.user_id !== user?.id && (
                      <span className="shrink-0 rounded-full bg-sky/15 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-sky">
                        Shared
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs font-bold text-muted-foreground">
                    <span>
                      {items.length} {items.length === 1 ? "material" : "materials"}
                    </span>
                    <span className="text-success">{ready} ready</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : materials && materials.length > 0 && activeSubject ? (
        <>
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => setActiveSubject(null)}
              className="inline-flex items-center gap-1 text-xs font-extrabold uppercase tracking-wide text-sky hover:underline"
            >
              ← All subjects
            </button>
            {(!courseByName[activeSubject] || courseByName[activeSubject].user_id === user?.id) && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => shareCourse(activeSubject)}
                  className="rounded-xl border-2 border-border bg-card px-3.5 py-1.5 text-xs font-extrabold text-muted-foreground hover:text-foreground"
                >
                  {courseByName[activeSubject]?.share_code
                    ? `Share code: ${courseByName[activeSubject].share_code}`
                    : "⤴ Share course"}
                </button>
                {courseByName[activeSubject] && (
                  <button
                    onClick={async () => {
                      if (!confirm(`Delete the course "${activeSubject}"? Materials inside stay in your library.`)) return;
                      const { error } = await (supabase as any).from("courses").delete().eq("id", courseByName[activeSubject].id);
                      if (error) return toast.error(error.message);
                      toast.success("Course deleted");
                      setActiveSubject(null);
                      qc.invalidateQueries({ queryKey: ["courses"] });
                    }}
                    className="rounded-xl border-2 border-destructive/40 px-3 py-1.5 text-xs font-extrabold text-destructive hover:bg-destructive/10"
                  >
                    Delete course
                  </button>
                )}
              </div>
            )}
          </div>
          <ul className="divide-y-2 divide-border card-chunky bg-card">
          {materials.filter((m) => (m.subject || "General") === activeSubject).map((m) => {
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
                        isReady ? "bg-success/15 text-success" :
                        isFailed ? "bg-destructive/15 text-destructive" :
                        "bg-muted text-muted-foreground"
                      }`}>{m.processing_status}</span>
                    </div>
                  </div>
                </Link>
                {isReady && (
                  <Link
                    to="/materials/$id" params={{ id: m.id }}
                    className="shrink-0 inline-flex items-center gap-1 btn-3d rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 active:scale-95 transition"
                  >
                    {hasPdf ? "Read" : "Open"}
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
        </>
      ) : (
        !uploading && <p className="text-center text-sm text-muted-foreground py-8">No materials yet.</p>
      )}
    </div>
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

const COURSE_ICONS = ["📚", "🧪", "🧮", "💻", "🌍", "⚡", "🏛️", "🩺", "⚖️", "📈", "🎨", "🔬"];
const COURSE_SWATCHES = ["#1CB0F6", "#A570FF", "#FFC800", "#FF4B4B", "#58CC02", "#F97316", "#0D9488", "#8B5CF6"];

function CourseModal({ userId, onClose, onCreated }: { userId?: string; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState(COURSE_ICONS[0]);
  const [color, setColor] = useState(COURSE_SWATCHES[0]);
  const [saving, setSaving] = useState(false);

  async function create() {
    if (!userId || !name.trim()) return;
    setSaving(true);
    const { error } = await (supabase as any).from("courses").insert({
      user_id: userId, name: name.trim(), description: description.trim() || null, icon, color,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`Course "${name.trim()}" created`);
    onCreated();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="card-chunky w-full max-w-md bg-card p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-xl font-extrabold">Create a course</h2>
        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">Course name</label>
            <input
              value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. EE 172 Circuits"
              className="mt-1 w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">Description (optional)</label>
            <textarea
              value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's this course about?" rows={2}
              className="mt-1 w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">Icon</label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {COURSE_ICONS.map((i) => (
                <button
                  key={i} onClick={() => setIcon(i)}
                  className={`flex h-10 w-10 items-center justify-center rounded-xl border-2 text-xl transition ${
                    icon === i ? "border-primary bg-primary/10" : "border-border bg-background hover:border-primary/40"
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">Pick a color</label>
            <div className="mt-1 flex flex-wrap gap-2">
              {COURSE_SWATCHES.map((s) => (
                <button
                  key={s} onClick={() => setColor(s)} aria-label={`Color ${s}`}
                  className={`h-9 w-9 rounded-full transition ${color === s ? "ring-2 ring-foreground ring-offset-2 ring-offset-card" : ""}`}
                  style={{ backgroundColor: s }}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border-2 border-border px-4 py-2 text-sm font-bold text-muted-foreground hover:text-foreground">
            Cancel
          </button>
          <button
            onClick={create} disabled={!name.trim() || saving}
            className="btn-3d rounded-xl px-5 py-2 text-sm font-extrabold text-white disabled:opacity-40"
            style={{ backgroundColor: color }}
          >
            {saving ? "Creating…" : "Create course"}
          </button>
        </div>
      </div>
    </div>
  );
}
