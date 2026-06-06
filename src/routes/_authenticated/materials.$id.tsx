import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Loader2, ArrowLeft, Brain, BookOpen, Youtube, Volume2, Pause, Download, Trash2, Network, List } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { FocusTimer } from "@/components/focus-timer";
import { PDFViewer } from "@/components/reader/PDFViewer";
import { MaterialAIChat } from "@/components/reader/MaterialAIChat";
import { useIsMobile } from "@/hooks/use-mobile";
import { summarizeMaterial, appendMaterialNote, regenerateKeyConcepts, regenerateBloomQuestions, regenerateFormulas } from "@/lib/materials.functions";
import { getAccessToken } from "@/lib/auth-helper";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/materials/$id")({
  component: MaterialDetail,
});

const TABS = [
  { key: "read", label: "📖 Read", color: "text-foreground" },
  { key: "summary", label: "Summary", color: "text-foreground" },
  { key: "original", label: "📄 Original", color: "text-foreground" },
  { key: "visual", label: "👁️ Visual", color: "text-[color:var(--color-visual)]" },
  { key: "auditory", label: "🎧 Auditory", color: "text-[color:var(--color-auditory)]" },
  { key: "reading", label: "📖 Reading", color: "text-[color:var(--color-reading)]" },
  { key: "kinesthetic", label: "⚡ Kinesthetic", color: "text-[color:var(--color-kinesthetic)]" },
  { key: "cornell", label: "📓 Cornell", color: "text-foreground" },
  { key: "graph", label: "🕸️ Concept Graph", color: "text-foreground" },
  { key: "formulas", label: "🧮 Formulas", color: "text-foreground" },
  { key: "questions", label: "🎯 Bloom Q&A", color: "text-foreground" },
] as const;

function MaterialDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("summary");

  const { data: material, isLoading } = useQuery({
    queryKey: ["material", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("study_materials").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: (q) => (q.state.data?.processing_status === "processing" ? 2500 : false),
  });

  const hasPdf = !!(material as any)?.pdf_storage_path;
  const hasReadableText = !!((material as any)?.original_content || (material as any)?.ai_summary || (material as any)?.adapted_reading);

  // Default to "read" whenever we can show a reader: PDF first, extracted text fallback otherwise.
  useEffect(() => {
    if (hasPdf || hasReadableText) setTab("read");
  }, [hasPdf, hasReadableText]);

  const { data: deck } = useQuery({
    queryKey: ["deck-for-material", id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("flashcard_decks").select("*").eq("material_id", id).maybeSingle();
      return data;
    },
  });

  const visibleTabs = useMemo(() => {
    if (!material) return TABS;
    return TABS.filter((t) => {
      if (t.key === "read") return hasPdf || hasReadableText;
      if (t.key === "formulas") return Array.isArray(material.formulas) && material.formulas.length > 0;
      if (t.key === "graph") return Array.isArray(material.concept_graph) && (material.concept_graph as any[]).length > 0;
      return true;
    });
  }, [material, hasPdf, hasReadableText]);

  async function handleDelete() {
    if (!material) return;
    if (!confirm(`Delete "${material.title}"? This also removes its flashcards and notes.`)) return;
    const { error } = await supabase.from("study_materials").delete().eq("id", material.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Material deleted");
      navigate({ to: "/materials" });
    }
  }

  function handleDownload() {
    if (!material) return;
    const content = material.original_content ?? "";
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${material.title.replace(/[^a-z0-9-_]+/gi, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-muted-foreground" /></div>;
  }
  if (!material) return <p className="text-muted-foreground">Material not found.</p>;

  const isReady = material.processing_status === "ready";

  return (
    <div className="space-y-6">
      <Link to="/materials" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5 mr-1" /> All materials
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">{material.title}</h1>
          <p className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-2">
            <span className="px-2 py-0.5 rounded-full bg-muted">{material.subject}</span>
            {material.field_category && <span className="px-2 py-0.5 rounded-full bg-muted">{material.field_category}</span>}
            {material.is_stem && <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary">⚗️ STEM</span>}
            <span>{material.word_count ?? "—"} words · {material.estimated_read_minutes ?? "—"} min</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <FocusTimer materialId={material.id} />
          <Link to="/tutor" className="rounded-lg border border-border px-3 py-2 text-xs hover:bg-accent/10">🧠 Tutor</Link>
          <Link
            to="/quizzes"
            search={{ from: material.id } as any}
            className="rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-3 py-2 text-xs font-semibold hover:bg-emerald-500/25 active:scale-95 transition"
            title="Generate a quiz from this material"
          >
            🎯 Quiz this
          </Link>
          {deck && <Link to="/review" className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">⚡ Review {deck.total_cards}</Link>}
          <button onClick={handleDownload} className="rounded-lg border border-border px-3 py-2 text-xs hover:bg-accent/10 inline-flex items-center gap-1.5" title="Download original">
            <Download className="h-3.5 w-3.5" /> Download
          </button>
          <button onClick={handleDelete} className="rounded-lg border border-destructive/40 text-destructive px-3 py-2 text-xs hover:bg-destructive/10 inline-flex items-center gap-1.5" title="Delete material">
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      </header>

      <YouTubeLinks text={[material.ai_summary, material.adapted_reading].filter(Boolean).join("\n")} />

      {!isReady ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
          <p className="mt-3 text-sm">Processing with AI… auto-refreshing.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1 border-b border-border overflow-x-auto">
            {visibleTabs.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`px-3 py-2 text-sm border-b-2 -mb-px whitespace-nowrap transition ${
                  tab === t.key ? `border-primary font-medium ${t.color}` : "border-transparent text-muted-foreground hover:text-foreground"
                }`}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === "read" && user && (
            hasPdf ? <ReadPdfTab material={material} userId={user.id} /> : <TextReaderTab material={material} userId={user.id} />
          )}
          {tab === "summary" && <SummaryTab material={material} />}
          {tab === "original" && <OriginalTab material={material} />}
          {(tab === "visual" || tab === "auditory" || tab === "reading" || tab === "kinesthetic") && (
            <AdaptationTab text={(material as any)[`adapted_${tab}`] ?? ""} />
          )}
          {tab === "cornell" && <CornellTab material={material} />}
          {tab === "graph" && <ConceptGraphTab graph={material.concept_graph as any[]} concepts={material.key_concepts as any[]} />}
          {tab === "formulas" && <FormulasTab formulas={material.formulas as any[]} />}
          {tab === "questions" && <BloomTab questions={material.bloom_questions as any} />}
        </>

      )}
    </div>
  );
}

function YouTubeLinks({ text }: { text: string }) {
  const links = useMemo(() => {
    const re = /https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=[\w-]+|youtu\.be\/[\w-]+)/g;
    return Array.from(new Set(text.match(re) ?? [])).slice(0, 5);
  }, [text]);
  if (links.length === 0) return null;
  return (
    <div className="rounded-xl border border-border bg-card/50 p-3">
      <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
        <Youtube className="h-3.5 w-3.5 text-red-500" /> Related videos
      </h3>
      <ul className="space-y-1">
        {links.map((url) => (
          <li key={url}>
            <a href={url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline break-all">{url}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SummaryTab({ material }: { material: any }) {
  return (
    <div className="space-y-5">
      <article className="prose prose-invert prose-sm md:prose-base max-w-none">
        <h2>Summary</h2>
        <p>{material.ai_summary}</p>
      </article>
      {Array.isArray(material.key_concepts) && material.key_concepts.length > 0 && (
        <div className="grid gap-2 md:grid-cols-2">
          {material.key_concepts.map((c: any, i: number) => (
            <div key={i} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-2 mb-1">
                <h3 className="font-display font-semibold text-sm">{c.concept ?? c.term}</h3>
                {c.bloom_level && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">L{c.bloom_level}</span>}
              </div>
              <p className="text-xs text-muted-foreground">{c.definition}</p>
              {c.example && <p className="text-xs mt-2 italic text-muted-foreground">e.g. {c.example}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OriginalTab({ material }: { material: any }) {
  const content = material.original_content ?? "";
  if (!content) return <p className="text-muted-foreground text-sm">No original content stored.</p>;
  const words = material.word_count ?? content.split(/\s+/).filter(Boolean).length;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{words} words{material.file_name ? ` · ${material.file_name}` : ""}</span>
        <button
          onClick={() => { navigator.clipboard.writeText(content); }}
          className="rounded-md border border-border px-2 py-1 hover:bg-accent/10"
        >Copy all</button>
      </div>
      <div className="rounded-xl border border-border bg-card p-5 md:p-6 max-h-[70vh] overflow-auto">
        <article className="prose prose-invert prose-sm md:prose-base max-w-none whitespace-pre-wrap">
          {content}
        </article>
      </div>
    </div>
  );
}

// Replace [TAG: ...] with semantic blocks before markdown rendering.
function preprocessCallouts(text: string): string {
  if (!text) return "";
  return text
    .replace(/\[KEY TERM:\s*([^\]]+)\]/g, '\n\n> 🔑 **Key term:** $1\n\n')
    .replace(/\[DIAGRAM:\s*([^\]]+)\]/g, '\n\n> 📊 **Diagram:** $1\n\n')
    .replace(/\[SAY THIS ALOUD:\s*([^\]]+)\]/g, '\n\n> 🎧 **Say aloud:** $1\n\n')
    .replace(/\[VERBAL SUMMARY:\s*([^\]]+)\]/g, '\n\n> 🗣️ **Verbal summary:** $1\n\n')
    .replace(/\[TRY THIS:\s*([^\]]+)\]/g, '\n\n> ⚡ **Try this:** $1\n\n')
    .replace(/\[REAL WORLD:\s*([^\]]+)\]/g, '\n\n> 🌍 **Real world:** $1\n\n')
    .replace(/\[WRITE THIS DOWN:\s*([^\]]+)\]/g, '\n\n> ✏️ **Write down:** $1\n\n')
    .replace(/\[FORMULA:\s*([^\]]+)\]/g, '\n\n$$$1$$\n\n');
}

function CalloutMarkdown({ text }: { text: string }) {
  const processed = useMemo(() => preprocessCallouts(text), [text]);
  if (!text) return <p className="text-muted-foreground text-sm">No adaptation available.</p>;
  return (
    <article className="prose prose-invert prose-sm md:prose-base max-w-none prose-blockquote:border-l-primary prose-blockquote:bg-card prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:rounded-r-md prose-blockquote:not-italic">
      <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
        {processed}
      </ReactMarkdown>
    </article>
  );
}

function CornellTab({ material }: { material: any }) {
  if (!material.cornell_notes) return <p className="text-muted-foreground text-sm">No Cornell Notes available.</p>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-display font-semibold text-sm mb-2 flex items-center gap-2"><Brain className="h-4 w-4 text-primary" /> Cues</h3>
          <pre className="text-xs whitespace-pre-wrap font-sans text-muted-foreground">{material.cornell_cue}</pre>
        </div>
        <div className="md:col-span-2 rounded-xl border border-border bg-card p-4">
          <h3 className="font-display font-semibold text-sm mb-2 flex items-center gap-2"><BookOpen className="h-4 w-4 text-primary" /> Notes</h3>
          <article className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
              {material.cornell_notes}
            </ReactMarkdown>
          </article>
        </div>
      </div>
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
        <h3 className="font-display font-semibold text-sm mb-2">Summary</h3>
        <p className="text-sm">{material.cornell_summary}</p>
      </div>
    </div>
  );
}

function FormulasTab({ formulas }: { formulas: any[] }) {
  if (!formulas?.length) return <p className="text-muted-foreground text-sm">No formulas extracted.</p>;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {formulas.map((f, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h4 className="font-display font-semibold text-sm">{f.name}</h4>
            <button onClick={() => navigator.clipboard.writeText(f.latex)}
              className="text-[10px] text-muted-foreground hover:text-foreground">Copy LaTeX</button>
          </div>
          <div className="rounded bg-background p-3 text-center overflow-x-auto">
            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
              {`$$${f.latex}$$`}
            </ReactMarkdown>
          </div>
          {f.variables?.length > 0 && (
            <ul className="mt-3 space-y-1">
              {f.variables.map((v: any, j: number) => (
                <li key={j} className="text-xs text-muted-foreground">
                  <code className="text-primary">{v.symbol}</code> — {v.meaning}{v.unit && ` (${v.unit})`}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

function BloomTab({ questions }: { questions: Record<string, { question: string; answer: string }[]> }) {
  if (!questions || typeof questions !== "object") return <p className="text-muted-foreground text-sm">No question bank.</p>;
  const labels: Record<string, string> = {
    L1: "Remember", L2: "Understand", L3: "Apply", L4: "Analyse", L5: "Evaluate", L6: "Create",
  };
  return (
    <div className="space-y-4">
      {(["L1","L2","L3","L4","L5","L6"] as const).map((lvl) => (
        <div key={lvl} className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-display font-semibold text-sm mb-3">
            <span className="px-2 py-0.5 rounded text-xs mr-2" style={{ background: `var(--bloom-${lvl[1]})`, color: "oklch(0.2 0.04 260)" }}>{lvl}</span>
            {labels[lvl]}
          </h3>
          {questions[lvl]?.map((q, i) => (
            <details key={i} className="mb-2 group">
              <summary className="cursor-pointer text-sm hover:text-primary">{q.question}</summary>
              <p className="mt-2 ml-4 text-xs text-muted-foreground">{q.answer}</p>
            </details>
          ))}
        </div>
      ))}
    </div>
  );
}

function AdaptationTab({ text }: { text: string }) {
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => () => { try { window.speechSynthesis?.cancel(); } catch {} }, []);
  function toggleSpeak() {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      toast.error("Text-to-speech not supported in this browser");
      return;
    }
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const clean = text
      .replace(/\[[A-Z ]+:\s*([^\]]+)\]/g, "$1")
      .replace(/[#*_`>]/g, "")
      .slice(0, 32000);
    const utter = new SpeechSynthesisUtterance(clean);
    utter.rate = 0.95;
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utter);
    setSpeaking(true);
  }
  if (!text) return <p className="text-muted-foreground text-sm">No adaptation available.</p>;
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={toggleSpeak}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent/10"
        >
          {speaking ? <><Pause className="h-3.5 w-3.5" /> Stop reading</> : <><Volume2 className="h-3.5 w-3.5" /> Read aloud</>}
        </button>
      </div>
      <CalloutMarkdown text={text} />
    </div>
  );
}

function ConceptGraphTab({ graph, concepts }: { graph: any[]; concepts: any[] }) {
  if (!graph?.length) return <p className="text-muted-foreground text-sm">No concept graph generated.</p>;
  const nameOf = (id: string) => {
    const c = (concepts ?? []).find((x: any) => x.id === id);
    return c?.concept ?? c?.term ?? id;
  };
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
        <Network className="h-3.5 w-3.5" /> {graph.length} relationships between concepts
      </p>
      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {graph.map((e: any, i: number) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 text-sm">
            <span className="font-medium truncate flex-1">{nameOf(e.source_id ?? e.source)}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary whitespace-nowrap">
              {(e.relationship ?? e.type ?? "related").replace(/_/g, " ")}
            </span>
            <span className="font-medium truncate flex-1 text-right">{nameOf(e.target_id ?? e.target)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function chunkTextPages(text: string): string[] {
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (!clean) return [""];
  const paragraphs = clean.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const pages: string[] = [];
  let current = "";
  for (const paragraph of paragraphs.length ? paragraphs : [clean]) {
    if ((current + "\n\n" + paragraph).length > 1800 && current) {
      pages.push(current.trim());
      current = paragraph;
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
  }
  if (current.trim()) pages.push(current.trim());
  return pages.length ? pages : [clean];
}

function TextReaderTab({ material, userId }: { material: any; userId: string }) {
  const isMobile = useIsMobile();
  const sourceText = material.original_content || material.adapted_reading || material.ai_summary || "";
  const pages = useMemo(() => chunkTextPages(sourceText), [sourceText]);
  const [page, setPage] = useState(1);
  const [mobileTab, setMobileTab] = useState<"read" | "chat">("read");
  const [selection, setSelection] = useState<string | null>(null);
  const totalPages = pages.length;
  const currentPageText = pages[page - 1] ?? "";
  const pageIndex = useMemo(
    () => Object.fromEntries(pages.map((txt, i) => [i + 1, txt.slice(0, 900)])),
    [pages],
  );

  useEffect(() => {
    supabase
      .from("reading_progress")
      .upsert(
        { user_id: userId, material_id: material.id, last_page: page, total_pages: totalPages, updated_at: new Date().toISOString() },
        { onConflict: "user_id,material_id" },
      )
      .then(() => {});
  }, [page, totalPages, material.id, userId]);

  const captureSelection = () => {
    const text = window.getSelection()?.toString().replace(/\s+/g, " ").trim() ?? "";
    setSelection(text.length >= 3 ? text.slice(0, 1200) : null);
  };

  const reader = (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-card px-3 py-2 text-xs text-muted-foreground">
        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded-md border border-border px-3 py-1.5 disabled:opacity-40 hover:text-foreground">‹ Prev</button>
        <span className="font-medium">Page {page} / {totalPages}</span>
        <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="rounded-md border border-border px-3 py-1.5 disabled:opacity-40 hover:text-foreground">Next ›</button>
      </div>
      <div className="flex-1 overflow-auto p-5 md:p-6" onMouseUp={captureSelection} onTouchEnd={() => setTimeout(captureSelection, 50)}>
        {selection && (
          <button onClick={() => isMobile && setMobileTab("chat")} className="mb-3 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
            Ask AI about selected text
          </button>
        )}
        <article className="prose prose-invert prose-sm md:prose-base max-w-none whitespace-pre-wrap">
          {currentPageText || "No readable text was extracted for this material."}
        </article>
      </div>
    </div>
  );

  const chat = (
    <MaterialAIChat
      materialId={material.id}
      materialTitle={material.title}
      subject={material.subject ?? "General"}
      level={material.level ?? undefined}
      currentPage={page}
      totalPages={totalPages}
      currentPageText={currentPageText}
      fullDocumentText={sourceText}
      pageIndex={pageIndex}
      selection={selection}
      onClearSelection={() => setSelection(null)}
      onJumpToPage={(target) => {
        setPage(Math.max(1, Math.min(target, totalPages)));
        if (isMobile) setMobileTab("read");
      }}
      userId={userId}
    />
  );

  if (isMobile) {
    return (
      <div className="flex h-[calc(100vh-7rem)] min-h-[520px] flex-col overflow-hidden rounded-xl border border-border">
        <div className="flex shrink-0 border-b border-border bg-card">
          {(["read", "chat"] as const).map((t) => (
            <button key={t} onClick={() => setMobileTab(t)} className={`flex-1 py-2.5 text-xs font-semibold ${mobileTab === t ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}>
              {t === "read" ? `📖 Read · p.${page}/${totalPages}` : "🤖 AI Chat"}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-hidden">{mobileTab === "read" ? reader : chat}</div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-[600px] overflow-hidden rounded-xl border border-border">
      <div className="w-[60%] border-r border-border">{reader}</div>
      <div className="w-[40%]">{chat}</div>
    </div>
  );
}

function ReadPdfTab({ material, userId }: { material: any; userId: string }) {
  const isMobile = useIsMobile();
  const [signedUrl, setSignedUrl] = useState<string>("");
  const [signError, setSignError] = useState(false);
  const [page, setPage] = useState(1);
  const [pageText, setPageText] = useState("");
  const [totalPages, setTotalPages] = useState(0);
  const [mobileTab, setMobileTab] = useState<"read" | "chat">("read");
  const [initialReady, setInitialReady] = useState(false);
  const [pageIndex, setPageIndex] = useState<Record<number, string> | undefined>(undefined);
  const [selection, setSelection] = useState<string | null>(null);
  const [autoSendOnSelection, setAutoSendOnSelection] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const summarizeFn = useServerFn(summarizeMaterial);
  const addNoteFn = useServerFn(appendMaterialNote);

  // Document overview + TOC (cached server-side)
  const { data: overview } = useQuery({
    queryKey: ["material-overview", material.id],
    enabled: !!material?.id,
    staleTime: 1000 * 60 * 60,
    queryFn: async () => {
      try {
        const accessToken = await getAccessToken();
        return await summarizeFn({ data: { accessToken, materialId: material.id } });
      } catch (e) {
        console.error("Overview failed", e);
        return null;
      }
    },
  });

  const handleAddNote = async (text: string, p: number) => {
    try {
      const accessToken = await getAccessToken();
      await addNoteFn({
        data: {
          accessToken,
          materialId: material.id,
          content: `> "${text.slice(0, 1500)}" — p.${p}`,
          pageNumber: p,
        },
      });
      toast.success(`Saved to notes (p.${p})`);
    } catch (e: any) {
      toast.error("Couldn't save note");
    }
  };

  useEffect(() => {
    supabase
      .from("reading_progress")
      .select("last_page")
      .eq("user_id", userId)
      .eq("material_id", material.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.last_page && data.last_page > 1) setPage(data.last_page);
        setInitialReady(true);
      });
  }, [material.id, userId]);

  // Refresh signed URL
  useEffect(() => {
    if (!material.pdf_storage_path) return;
    let mounted = true;
    async function load() {
      const { data, error } = await supabase.storage
        .from("materials")
        .createSignedUrl(material.pdf_storage_path, 7200);
      if (mounted && error) setSignError(true);
      if (mounted && data?.signedUrl) setSignedUrl(data.signedUrl);
    }
    load();
    const t = setInterval(load, 90 * 60 * 1000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, [material.pdf_storage_path]);

  // Save reading progress
  useEffect(() => {
    if (!totalPages) return;
    supabase
      .from("reading_progress")
      .upsert(
        {
          user_id: userId,
          material_id: material.id,
          last_page: page,
          total_pages: totalPages,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,material_id" },
      )
      .then(() => {});
    if (totalPages && !material.total_pages) {
      supabase
        .from("study_materials")
        .update({ total_pages: totalPages })
        .eq("id", material.id)
        .then(() => {});
    }
  }, [page, totalPages, material.id, material.total_pages, userId]);

  if (signError) return <TextReaderTab material={material} userId={userId} />;

  if (!signedUrl || !initialReady) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handlePageChange = (p: number, txt: string) => {
    setPage(p);
    setPageText(txt);
  };

  const handleJump = (target: number) => {
    setPage(Math.max(1, Math.min(target, totalPages || target)));
    if (isMobile) setMobileTab("read");
  };

  const handleAskAboutSelection = (text: string) => {
    setAutoSendOnSelection(true);
    setSelection(text);
    if (isMobile) setMobileTab("chat");
  };

  const clearSel = () => {
    setSelection(null);
    setAutoSendOnSelection(false);
  };

  const chatProps = {
    materialId: material.id,
    materialTitle: material.title,
    subject: material.subject ?? "General",
    level: material.level ?? undefined,
    currentPage: page,
    totalPages: totalPages || 1,
    currentPageText: pageText,
    fullDocumentText: material.original_content ?? "",
    pageIndex,
    selection,
    onClearSelection: clearSel,
    onJumpToPage: handleJump,
    userId,
    userPrimaryStyle: undefined as string | undefined,
    overview: overview?.summary ?? null,
    autoSendOnSelection,
  };

  const toc = overview?.toc ?? [];
  const TocPanel = toc.length > 0 ? (
    <div className="border-b border-border bg-card/60">
      <button
        onClick={() => setTocOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold hover:bg-accent/10 transition"
      >
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <List className="h-3.5 w-3.5" /> Table of contents · {toc.length}
        </span>
        <span className="text-muted-foreground">{tocOpen ? "▾" : "▸"}</span>
      </button>
      {tocOpen && (
        <ul className="max-h-48 overflow-auto px-2 pb-2 space-y-0.5">
          {toc.map((e: any, i: number) => (
            <li key={i}>
              <button
                onClick={() => handleJump(e.page)}
                className={`w-full text-left text-xs px-2 py-1.5 rounded-md hover:bg-accent/10 transition flex items-center justify-between gap-2 ${
                  e.page === page ? "bg-primary/10 text-primary" : "text-foreground/80"
                }`}
              >
                <span className="truncate">{e.title}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">p.{e.page}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  ) : null;


  if (isMobile) {
    return (
      <div className="flex flex-col h-[calc(100vh-7rem)] min-h-[520px] rounded-xl border border-border overflow-hidden">
        <div className="flex bg-card border-b border-border shrink-0">
          {(["read", "chat"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setMobileTab(t)}
              className={`flex-1 py-2.5 text-xs font-semibold transition ${
                mobileTab === t
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground"
              }`}
            >
              {t === "read" ? `📄 Read · p.${page}/${totalPages || "…"}` : "🤖 AI Chat"}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-hidden flex flex-col">
          {mobileTab === "read" ? (
            <>
              {TocPanel}
              <div className="flex-1 overflow-hidden">
                <PDFViewer
                  pdfUrl={signedUrl}
                  page={page}
                  onPageChange={handlePageChange}
                  onTotalPages={setTotalPages}
                  onAllPagesIndexed={setPageIndex}
                  onAskAboutSelection={handleAskAboutSelection}
                  onAddNote={handleAddNote}
                />
              </div>
            </>
          ) : (
            <MaterialAIChat {...chatProps} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-[600px] rounded-xl border border-border overflow-hidden">
      <div className="w-[62%] border-r border-border flex flex-col">
        {TocPanel}
        <div className="flex-1 overflow-hidden">
          <PDFViewer
            pdfUrl={signedUrl}
            page={page}
            onPageChange={handlePageChange}
            onTotalPages={setTotalPages}
            onAllPagesIndexed={setPageIndex}
            onAskAboutSelection={handleAskAboutSelection}
            onAddNote={handleAddNote}
          />
        </div>
      </div>
      <div className="w-[38%]">
        <MaterialAIChat {...chatProps} />
      </div>
    </div>
  );
}
