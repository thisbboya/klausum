import { createFileRoute, Link } from "@tanstack/react-router";
import { reportError } from "@/lib/report-error";
import { KlausumLoading } from "@/components/loading";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/lib/notify";
import { Plus, Sparkles, Wand2, Layers, NotebookPen, ArrowLeft, Loader2, Eye, Pencil, Download } from "lucide-react";
import { generateCornellCues, generateCornellSummary, notesToFlashcards } from "@/lib/study.functions";
import { MarkdownMath } from "@/components/notes/MarkdownMath";
import { exportNodeToPdf, withPrintableContainer } from "@/lib/pdf-export";
import { createRoot } from "react-dom/client";

type Search = { id?: string };

export const Route = createFileRoute("/_authenticated/notes")({
  validateSearch: (s: Record<string, unknown>): Search => ({ id: typeof s.id === "string" ? s.id : undefined }),
  component: NotesPage,
});

function NotesPage() {
  const { id } = Route.useSearch();
  return id ? <NoteEditor id={id} /> : <NotesList />;
}

function NotesList() {
  const { user } = useAuth();
  const navigate = Route.useNavigate();
  const qc = useQueryClient();
  const [filter, setFilter] = useState("");

  const { data: notes } = useQuery({
    queryKey: ["cornell_notes", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cornell_notes")
        .select("id,title,subject,updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function createNote() {
    if (!user) return;
    const { data, error } = await supabase
      .from("cornell_notes")
      .insert({ user_id: user.id, title: "Untitled note", subject: "General" })
      .select("id")
      .single();
    if (error) return toast.error(reportError("notes", error));
    qc.invalidateQueries({ queryKey: ["cornell_notes", user.id] });
    navigate({ search: { id: data.id } });
  }

  const filtered = (notes ?? []).filter((n) =>
    !filter || n.title.toLowerCase().includes(filter.toLowerCase()) || (n.subject || "").toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-2">
            <NotebookPen className="h-7 w-7 text-primary" /> Cornell Notes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Cue, notes, summary — the proven 3-zone study layout.</p>
        </div>
        <button onClick={createNote} className="inline-flex items-center gap-2 btn-3d rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
          <Plus className="h-4 w-4" /> New note
        </button>
      </header>

      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter by title or subject…"
        className="w-full max-w-sm rounded-xl border-2 border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
      />

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <NotebookPen className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">No Cornell notes yet.</p>
          <button onClick={createNote} className="mt-4 inline-flex items-center gap-2 btn-3d rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            <Plus className="h-4 w-4" /> Create your first note
          </button>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {filtered.map((n) => (
            <li key={n.id}>
              <Link
                to="/notes"
                search={{ id: n.id }}
                className="block card-chunky bg-card p-4 hover:border-primary/40 transition"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-semibold truncate">{n.title}</h3>
                  <span className="text-xs text-muted-foreground">{new Date(n.updated_at!).toLocaleDateString()}</span>
                </div>
                <div className="mt-1 text-xs text-primary">{n.subject}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * One-time explanation of the Cornell method.
 *
 * Dismissible and remembered, because it is scaffolding: useful exactly once,
 * and clutter every time after that.
 */
function HowItWorks() {
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem("klausum:cornellHelp") === "1"; } catch { return false; }
  });
  if (hidden) return null;

  const steps = [
    { n: 1, title: "Notes", body: "Write here first, while listening or reading. Messy is fine." },
    { n: 2, title: "Cues", body: "Afterwards, turn each idea into a question. This is your self-test." },
    { n: 3, title: "Summary", body: "Cover the notes and write what it meant. This is what makes it stick." },
  ];

  return (
    <section className="rounded-2xl border-2 border-sky/40 bg-sky/8 p-3.5">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-display text-sm font-extrabold">How Cornell notes work</h2>
        <button
          onClick={() => {
            setHidden(true);
            try { localStorage.setItem("klausum:cornellHelp", "1"); } catch {}
          }}
          className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground hover:text-foreground"
        >
          Got it
        </button>
      </div>
      <ol className="mt-2 grid gap-2 sm:grid-cols-3">
        {steps.map((s) => (
          <li key={s.n} className="flex gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky text-[11px] font-extrabold text-sky-foreground">
              {s.n}
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-extrabold">{s.title}</span>
              <span className="block text-[11px] font-semibold leading-snug text-muted-foreground">
                {s.body}
              </span>
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-[11px] font-semibold text-muted-foreground">
        Write the notes, then let Klausum draft your cues and summary — you edit them.
      </p>
    </section>
  );
}

function NoteEditor({ id }: { id: string }) {
  const { user, session } = useAuth();
  const navigate = Route.useNavigate();

  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [cue, setCue] = useState("");
  const [notes, setNotes] = useState("");
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<"cues" | "summary" | "cards" | null>(null);
  const [exporting, setExporting] = useState(false);
  const [cueMode, setCueMode] = useState<"edit" | "preview">("preview");
  const [notesMode, setNotesMode] = useState<"edit" | "preview">("edit");
  const [summaryMode, setSummaryMode] = useState<"edit" | "preview">("preview");

  const cuesFn = useServerFn(generateCornellCues);
  const summaryFn = useServerFn(generateCornellSummary);
  const cardsFn = useServerFn(notesToFlashcards);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("cornell_notes").select("*").eq("id", id).maybeSingle();
      if (error) toast.error(reportError("notes", error));
      if (data) {
        setTitle(data.title);
        setSubject(data.subject ?? "General");
        setCue(data.cue_column ?? "");
        setNotes(data.notes_column ?? "");
        setSummary(data.summary ?? "");
      }
      setLoading(false);
    })();
  }, [id]);

  // Autosave debounced 30s
  const debounceRef = useRef<number | null>(null);
  useEffect(() => {
    if (loading) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      setSaving(true);
      const { error } = await supabase
        .from("cornell_notes")
        .update({ title, subject, cue_column: cue, notes_column: notes, summary, updated_at: new Date().toISOString() })
        .eq("id", id);
      setSaving(false);
      if (error) toast.error(reportError("notes", error));
    }, 1500);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
  }, [title, subject, cue, notes, summary, id, loading]);

  async function aiCues() {
    if (!session) return;
    if (notes.trim().length < 20) return toast.error("Write at least a couple of sentences in the notes column first.");
    setBusy("cues");
    try {
      const r = await cuesFn({ data: { accessToken: session.access_token, notes } });
      setCue((c) => (c ? c + "\n" : "") + r.cues.map((q) => "• " + q).join("\n"));
      toast.success("Cues generated");
    } catch (e: any) {
      toast.error(reportError("notes", e));
    } finally {
      setBusy(null);
    }
  }

  async function aiSummary() {
    if (!session) return;
    if (notes.trim().length < 20) return toast.error("Write more notes first.");
    setBusy("summary");
    try {
      const r = await summaryFn({ data: { accessToken: session.access_token, notes } });
      setSummary(r.summary);
      toast.success("Summary written");
    } catch (e: any) {
      toast.error(reportError("notes", e));
    } finally {
      setBusy(null);
    }
  }

  async function convertToFlashcards() {
    if (!session || !user) return;
    if (notes.trim().length < 20) return toast.error("Add notes first.");
    setBusy("cards");
    try {
      const r = await cardsFn({ data: { accessToken: session.access_token, notes, subject } });
      // Create deck
      const { data: deck, error: dErr } = await supabase
        .from("flashcard_decks")
        .insert({ user_id: user.id, title: title || "Note deck", subject, total_cards: r.cards.length })
        .select("id")
        .single();
      if (dErr) throw dErr;
      const rows = r.cards.map((c) => ({
        deck_id: deck.id,
        user_id: user.id,
        front: c.front,
        back: c.back,
        hint: c.hint,
        bloom_level: c.bloom_level,
      }));
      const { error: cErr } = await supabase.from("flashcards").insert(rows);
      if (cErr) throw cErr;
      toast.success(`Created ${r.cards.length} flashcards from this note.`);
    } catch (e: any) {
      toast.error(reportError("notes", e));
    } finally {
      setBusy(null);
    }
  }

  async function exportPdf() {
    setExporting(true);
    try {
      await withPrintableContainer(async (root) => {
        await new Promise<void>((resolve) => {
          const r = createRoot(root);
          r.render(<PrintableCornell title={title} subject={subject} cue={cue} notes={notes} summary={summary} />);
          setTimeout(resolve, 500);
        });
        await exportNodeToPdf(root, `${(title || "cornell-note").replace(/[^a-z0-9-]+/gi, "-").toLowerCase()}.pdf`);
      });
      toast.success("Exported");
    } catch (e: any) {
      toast.error(reportError("notes", e));
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return <KlausumLoading label="Opening your note…" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <button onClick={() => navigate({ search: {} })} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All notes
        </button>
        <span className="text-xs text-muted-foreground">{saving ? "Saving…" : "Auto-saved"}</span>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_220px]">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Note title"
          className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-lg font-display font-semibold outline-none focus:border-primary"
        />
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject"
          className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
      </div>

      {/* The three panes were labelled "Cue Column", "Notes Column" and
          "Summary" and left at that, which assumes the reader already knows
          the Cornell method. Anyone who does not sees three empty boxes and no
          reason to prefer them over a blank page. */}
      <HowItWorks />

      <div className="flex flex-wrap gap-2">
        <ToolBtn onClick={aiCues} busy={busy === "cues"} icon={Sparkles}>Write my cues</ToolBtn>
        <ToolBtn onClick={aiSummary} busy={busy === "summary"} icon={Wand2}>Write my summary</ToolBtn>
        <ToolBtn onClick={convertToFlashcards} busy={busy === "cards"} icon={Layers}>Make flashcards</ToolBtn>
        <ToolBtn onClick={exportPdf} busy={exporting} icon={Download}>Export PDF</ToolBtn>
      </div>

      <div className="grid gap-0 card-chunky overflow-hidden bg-card">
        <div className="grid md:grid-cols-[260px_1fr]">
          <ColumnPane
            label="Cue Column"
            mode={cueMode}
            setMode={setCueMode}
            value={cue}
            onChange={setCue}
            placeholder="2. Afterwards, turn each idea into a question you could be asked. These become your self-test."
            className="border-b md:border-b-0 md:border-r border-border bg-background/40"
            tone="muted"
          />
          <ColumnPane
            label="Notes Column"
            mode={notesMode}
            setMode={setNotesMode}
            value={notes}
            onChange={setNotes}
            placeholder="1. Write here first, during the lecture or while reading. Markdown and $LaTeX$ both work."
            tone="muted"
          />
        </div>
        <ColumnPane
          label="Summary (5 sentences)"
          mode={summaryMode}
          setMode={setSummaryMode}
          value={summary}
          onChange={setSummary}
          placeholder="3. Last, close the notes and write what it all meant in your own words. This is the part that makes it stick."
          className="border-t border-border bg-primary/5"
          tone="primary"
          minH="100px"
        />
      </div>
    </div>
  );
}

function ColumnPane({
  label, mode, setMode, value, onChange, placeholder, className, tone, minH,
}: {
  label: string;
  mode: "edit" | "preview";
  setMode: (m: "edit" | "preview") => void;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
  tone: "muted" | "primary";
  minH?: string;
}) {
  const minHeight = minH ?? "280px";
  return (
    <div className={className}>
      <div className="flex items-center justify-between px-3 py-2">
        <span className={`text-[11px] uppercase tracking-wider ${tone === "primary" ? "text-primary" : "text-muted-foreground"}`}>{label}</span>
        <button
          onClick={() => setMode(mode === "edit" ? "preview" : "edit")}
          className="inline-flex items-center gap-1 rounded border-2 border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground hover:text-foreground"
        >
          {mode === "edit" ? <><Eye className="h-3 w-3" /> Preview</> : <><Pencil className="h-3 w-3" /> Edit</>}
        </button>
      </div>
      {mode === "edit" ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full resize-none bg-transparent p-3 text-sm leading-relaxed outline-none"
          style={{ minHeight }}
        />
      ) : (
        <div className="p-3 text-sm" style={{ minHeight }}>
          <MarkdownMath source={value} />
        </div>
      )}
    </div>
  );
}

function ToolBtn({ onClick, busy, icon: Icon, children }: any) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-xl border-2 border-border bg-card px-3 py-2 text-xs font-medium hover:border-primary/40 disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5 text-primary" />}
      {children}
    </button>
  );
}

function PrintableCornell({ title, subject, cue, notes, summary }: { title: string; subject: string; cue: string; notes: string; summary: string }) {
  return (
    <div style={{ color: "#0f172a" }}>
      <div style={{ borderBottom: "2px solid #0f172a", paddingBottom: 8, marginBottom: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{title || "Cornell Note"}</h1>
        <p style={{ fontSize: 11, color: "#475569", margin: "4px 0 0" }}>{subject} · {new Date().toLocaleDateString()}</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", border: "1px solid #cbd5e1", borderRadius: 6, overflow: "hidden" }}>
        <div style={{ borderRight: "1px solid #cbd5e1", padding: 10, background: "#f8fafc", fontSize: 12 }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", color: "#64748b", marginBottom: 6 }}>Cue</div>
          <MarkdownMath source={cue} />
        </div>
        <div style={{ padding: 10, fontSize: 12 }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", color: "#64748b", marginBottom: 6 }}>Notes</div>
          <MarkdownMath source={notes} />
        </div>
      </div>
      <div style={{ marginTop: 10, padding: 10, border: "1px solid #cbd5e1", borderRadius: 6, background: "#eff6ff", fontSize: 12 }}>
        <div style={{ fontSize: 10, textTransform: "uppercase", color: "#1d4ed8", marginBottom: 6 }}>Summary</div>
        <MarkdownMath source={summary} />
      </div>
    </div>
  );
}
