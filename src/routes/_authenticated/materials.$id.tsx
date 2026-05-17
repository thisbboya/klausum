import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Loader2, ArrowLeft, Brain, BookOpen, Youtube } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { FocusTimer } from "@/components/focus-timer";

export const Route = createFileRoute("/_authenticated/materials/$id")({
  component: MaterialDetail,
});

const TABS = [
  { key: "summary", label: "Summary", color: "text-foreground" },
  { key: "visual", label: "👁️ Visual", color: "text-[color:var(--color-visual)]" },
  { key: "auditory", label: "🎧 Auditory", color: "text-[color:var(--color-auditory)]" },
  { key: "reading", label: "📖 Reading", color: "text-[color:var(--color-reading)]" },
  { key: "kinesthetic", label: "⚡ Kinesthetic", color: "text-[color:var(--color-kinesthetic)]" },
  { key: "cornell", label: "📓 Cornell", color: "text-foreground" },
  { key: "formulas", label: "🧮 Formulas", color: "text-foreground" },
  { key: "questions", label: "🎯 Bloom Q&A", color: "text-foreground" },
] as const;

function MaterialDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
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
      if (t.key === "formulas") return Array.isArray(material.formulas) && material.formulas.length > 0;
      return true;
    });
  }, [material]);

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
          {deck && <Link to="/review" className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">⚡ Review {deck.total_cards}</Link>}
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

          {tab === "summary" && <SummaryTab material={material} />}
          {(tab === "visual" || tab === "auditory" || tab === "reading" || tab === "kinesthetic") && (
            <CalloutMarkdown text={(material as any)[`adapted_${tab}`] ?? ""} />
          )}
          {tab === "cornell" && <CornellTab material={material} />}
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
