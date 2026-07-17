import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { ListChecks, Sparkles, Loader2, Play, RotateCcw } from "lucide-react";
import { generateQuiz } from "@/lib/study.functions";

type QuizSearch = { from?: string };
export const Route = createFileRoute("/_authenticated/quizzes/")({
  validateSearch: (s: Record<string, unknown>): QuizSearch => ({
    from: typeof s.from === "string" ? s.from : undefined,
  }),
  component: QuizzesPage,
});

const PRESETS: Record<string, number[]> = {
  Balanced: [20, 20, 20, 15, 15, 10],
  "Recall-heavy (L1-L2)": [40, 35, 15, 5, 5, 0],
  "Application (L3-L4)": [10, 15, 35, 30, 5, 5],
  "Higher-order (L5-L6)": [5, 10, 15, 20, 25, 25],
};

export function QuizzesPage() {
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const genFn = useServerFn(generateQuiz);
  const { from } = Route.useSearch();

  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("General");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard" | "expert">("medium");
  const [count, setCount] = useState(5);
  const [materialId, setMaterialId] = useState<string>(from ?? "");
  const [busy, setBusy] = useState(false);
  const [bloom, setBloom] = useState<number[]>([20, 20, 20, 15, 15, 10]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [timer, setTimer] = useState(false);
  const [scope, setScope] = useState<"all" | "range" | "concepts">("all");
  const [pageFrom, setPageFrom] = useState(1);
  const [pageTo, setPageTo] = useState(10);
  const [selectedConcepts, setSelectedConcepts] = useState<string[]>([]);

  const bloomTotal = bloom.reduce((a, b) => a + b, 0);

  function setBloomLevel(idx: number, val: number) {
    const next = [...bloom];
    next[idx] = val;
    setBloom(next);
  }
  function applyPreset(name: string) {
    setBloom(PRESETS[name]);
  }
  function normalize() {
    const sum = bloom.reduce((a, b) => a + b, 0) || 1;
    const scaled = bloom.map((v) => Math.round((v / sum) * 100));
    // Make sure the values total exactly 100 — push the remainder into the largest bucket.
    const diff = 100 - scaled.reduce((a, b) => a + b, 0);
    if (diff !== 0) {
      const maxIdx = scaled.indexOf(Math.max(...scaled));
      scaled[maxIdx] = Math.max(0, scaled[maxIdx] + diff);
    }
    setBloom(scaled);
  }

  const { data: quizzes } = useQuery({
    queryKey: ["quizzes", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quizzes")
        .select("id,title,subject,difficulty,question_count,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: materials } = useQuery({
    queryKey: ["materials_for_quiz", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("study_materials")
        .select("id,title,subject,original_content,ai_summary,key_concepts,total_pages")
        .eq("processing_status", "ready")
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const selectedMaterial = (materials ?? []).find((x) => x.id === materialId);
  const materialConcepts: { id: string; concept: string }[] = Array.isArray(selectedMaterial?.key_concepts)
    ? (selectedMaterial!.key_concepts as any[]).map((c: any, i: number) => ({
        id: c.id ?? `c${i}`,
        concept: c.concept ?? c.term ?? c.name ?? `Concept ${i + 1}`,
      }))
    : [];

  // Slice the material text by scope: all / page range / chosen concepts.
  function buildContextFromMaterial(): string | undefined {
    if (!selectedMaterial) return undefined;
    const fullText: string = selectedMaterial.original_content || selectedMaterial.ai_summary || "";
    if (!fullText) return undefined;
    if (scope === "all") return fullText.slice(0, 30000);

    if (scope === "range") {
      // Chunk by ~1800-char pages, similar to the text reader, and pick the range.
      const paragraphs = fullText.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
      const pages: string[] = [];
      let current = "";
      for (const p of paragraphs.length ? paragraphs : [fullText]) {
        if ((current + "\n\n" + p).length > 1800 && current) {
          pages.push(current.trim());
          current = p;
        } else current = current ? `${current}\n\n${p}` : p;
      }
      if (current.trim()) pages.push(current.trim());
      const total = pages.length;
      const lo = Math.max(1, Math.min(pageFrom, total));
      const hi = Math.max(lo, Math.min(pageTo, total));
      return pages.slice(lo - 1, hi).join("\n\n").slice(0, 30000);
    }

    if (scope === "concepts" && selectedConcepts.length) {
      const lower = fullText.toLowerCase();
      const slices: string[] = [];
      for (const c of selectedConcepts) {
        const needle = c.toLowerCase();
        let from = 0;
        while (slices.join("\n\n").length < 25000) {
          const idx = lower.indexOf(needle, from);
          if (idx < 0) break;
          const start = Math.max(0, idx - 400);
          const end = Math.min(fullText.length, idx + 600);
          slices.push(fullText.slice(start, end));
          from = end;
        }
      }
      return slices.join("\n\n---\n\n").slice(0, 30000) || fullText.slice(0, 15000);
    }

    return fullText.slice(0, 30000);
  }

  async function generate() {
    if (!session || !user) return;
    if (showAdvanced && Math.abs(bloomTotal - 100) > 3) {
      return toast.error(`Bloom distribution must total ~100% (currently ${bloomTotal}%). Click Normalize.`);
    }
    let context: string | undefined;
    let useTopic = topic.trim();
    let useSubject = subject;
    if (materialId && selectedMaterial) {
      useTopic = useTopic || selectedMaterial.title;
      useSubject = selectedMaterial.subject ?? subject;
      context = buildContextFromMaterial();
      if (!context) {
        toast.error("This material has no extracted text yet. Open it once so AI can read it, then try again.");
        return;
      }
    }
    if (!useTopic) return toast.error("Pick a material or type a topic");

    setBusy(true);
    try {
      const r = await genFn({
        data: {
          accessToken: session.access_token,
          topic: useTopic,
          subject: useSubject,
          difficulty,
          count,
          context,
          bloomDistribution: showAdvanced ? bloom : undefined,
        },
      });
      if (!r?.questions || r.questions.length === 0) {
        toast.error("AI returned no questions. Try a different topic or fewer questions.");
        return;
      }
      const { data: quiz, error } = await supabase
        .from("quizzes")
        .insert({
          user_id: user.id,
          material_id: materialId || null,
          title: useTopic,
          subject: useSubject,
          difficulty,
          quiz_type: "mcq",
          questions: r.questions,
          question_count: r.questions.length,
        })
        .select("id")
        .single();
      if (error) throw error;
      toast.success("Quiz ready — let's go.");
      qc.invalidateQueries({ queryKey: ["quizzes", user.id] });
      navigate({ to: "/quizzes/$id/take", params: { id: quiz.id }, search: { timer: timer ? 30 : 0 } });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to generate quiz");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <ListChecks className="h-7 w-7 text-primary" /> Quizzes
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Generate Bloom-tagged MCQs from any material or topic.</p>
      </header>

      <section className="card-chunky bg-card p-5 space-y-4">
        <h2 className="font-display text-base font-semibold">New quiz</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="From a material (optional)">
            <select value={materialId} onChange={(e) => setMaterialId(e.target.value)} className="input">
              <option value="">— None —</option>
              {(materials ?? []).map((m) => (
                <option key={m.id} value={m.id}>{m.title} · {m.subject}</option>
              ))}
            </select>
          </Field>
          <Field label="Or topic">
            <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Newton's laws of motion" className="input" />
          </Field>
          <Field label="Subject">
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className="input" />
          </Field>
          <Field label="Difficulty">
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as any)} className="input">
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
              <option value="expert">Expert</option>
            </select>
          </Field>
          <Field label="Question count">
            <select value={count} onChange={(e) => setCount(Number(e.target.value))} className="input">
              {[3, 5, 10, 15, 20, 25].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
          <label className="flex items-end gap-2 pb-1">
            <input type="checkbox" checked={timer} onChange={(e) => setTimer(e.target.checked)} className="h-4 w-4" />
            <span className="text-xs">30-second timer per question</span>
          </label>
        </div>

        {selectedMaterial && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-primary">
              Pick which part of <span className="truncate">"{selectedMaterial.title}"</span> to quiz
            </div>
            <div className="flex flex-wrap gap-2">
              {([
                ["all", "Whole material"],
                ["range", "Page range"],
                ["concepts", "Specific concepts"],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setScope(key)}
                  className={`text-xs rounded-full px-3 py-1.5 border transition ${
                    scope === key
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {scope === "range" && (
              <div className="flex items-end gap-2 text-xs">
                <label className="flex flex-col">
                  <span className="text-muted-foreground mb-1">From page</span>
                  <input
                    type="number" min={1}
                    value={pageFrom}
                    onChange={(e) => setPageFrom(Math.max(1, parseInt(e.target.value || "1", 10)))}
                    className="input w-24"
                  />
                </label>
                <label className="flex flex-col">
                  <span className="text-muted-foreground mb-1">To page</span>
                  <input
                    type="number" min={pageFrom}
                    value={pageTo}
                    onChange={(e) => setPageTo(Math.max(pageFrom, parseInt(e.target.value || String(pageFrom), 10)))}
                    className="input w-24"
                  />
                </label>
                {selectedMaterial.total_pages ? (
                  <span className="text-muted-foreground self-center pb-2">of {selectedMaterial.total_pages}</span>
                ) : null}
              </div>
            )}

            {scope === "concepts" && (
              materialConcepts.length === 0 ? (
                <p className="text-xs text-muted-foreground">No concepts extracted yet — try "Whole material".</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {materialConcepts.map((c) => {
                    const on = selectedConcepts.includes(c.concept);
                    return (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => setSelectedConcepts((cur) => on ? cur.filter((x) => x !== c.concept) : [...cur, c.concept])}
                        className={`text-[11px] rounded-full px-2.5 py-1 border ${
                          on ? "bg-primary/15 border-primary/40 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {c.concept}
                      </button>
                    );
                  })}
                </div>
              )
            )}
          </div>
        )}

        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced((s) => !s)}
            className="text-xs text-primary hover:underline"
          >
            {showAdvanced ? "Hide" : "Show"} Bloom distribution
          </button>
        </div>

        {showAdvanced && (
          <div className="rounded-xl border-2 border-border/60 bg-background/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold">Bloom level distribution</div>
                <div className="text-[11px] text-muted-foreground">Total: <span className={Math.abs(bloomTotal - 100) > 2 ? "text-destructive font-semibold" : "text-primary font-semibold"}>{bloomTotal}%</span></div>
              </div>
              <div className="flex gap-1">
                {Object.keys(PRESETS).map((p) => (
                  <button key={p} onClick={() => applyPreset(p)} className="text-[10px] rounded-md border border-border px-2 py-1 hover:border-primary/40">
                    {p}
                  </button>
                ))}
                <button onClick={normalize} className="inline-flex items-center gap-1 text-[10px] rounded-md border border-border px-2 py-1 hover:border-primary/40">
                  <RotateCcw className="h-3 w-3" /> Normalize
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {["L1 Remember", "L2 Understand", "L3 Apply", "L4 Analyze", "L5 Evaluate", "L6 Create"].map((label, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-28 text-[11px] text-muted-foreground">{label}</span>
                  <input type="range" min={0} max={60} value={bloom[i]} onChange={(e) => setBloomLevel(i, parseInt(e.target.value))} className="flex-1 accent-[hsl(var(--primary))]" />
                  <span className="w-10 text-right text-[11px] font-mono">{bloom[i]}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={generate}
          disabled={busy}
          className="inline-flex items-center gap-2 btn-3d rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {busy ? "Generating…" : "Generate quiz"}
        </button>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold mb-3">Your quizzes</h2>
        {(quizzes ?? []).length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            No quizzes yet. Generate one above.
          </div>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {(quizzes ?? []).map((q) => (
              <li key={q.id} className="card-chunky bg-card p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-display font-semibold truncate">{q.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {q.subject} · {q.difficulty} · {q.question_count} Qs
                  </div>
                </div>
                <Link
                  to="/quizzes/$id/take"
                  params={{ id: q.id }}
                  search={{ timer: 0 }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 text-primary px-3 py-1.5 text-xs font-semibold hover:bg-primary/20"
                >
                  <Play className="h-3.5 w-3.5" /> Take
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <style>{`.input{width:100%;border:1px solid hsl(var(--border));background:hsl(var(--background));border-radius:0.5rem;padding:0.5rem 0.75rem;font-size:0.875rem;outline:none}.input:focus{border-color:hsl(var(--primary))}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
