import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { reportError } from "@/lib/report-error";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { explainGap, generateGapCards } from "@/lib/coach.functions";
import { generateQuiz } from "@/lib/study.functions";
import { getAccessToken } from "@/lib/auth-helper";
import { toast } from "@/lib/notify";
import { Sparkles, CheckCircle2, AlertTriangle, MessagesSquare, Layers, ListChecks, CalendarPlus, PartyPopper } from "lucide-react";

export const Route = createFileRoute("/_authenticated/gaps")({ component: GapsPage });

type Severity = "critical" | "moderate" | "low";
type Filter = "all" | Severity | "closed";

function GapsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const nav = useNavigate();
  const explain = useServerFn(explainGap);
  const makeCards = useServerFn(generateGapCards);
  const makeQuiz = useServerFn(generateQuiz);
  const [busy, setBusy] = useState<{ id: string; kind: string } | null>(null);
  const [explanation, setExplanation] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<Filter>("all");

  const { data: gaps = [] } = useQuery({
    queryKey: ["gaps", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("knowledge_gaps")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const open = useMemo(() => gaps.filter((g: any) => g.status === "open"), [gaps]);
  const resolved = useMemo(() => gaps.filter((g: any) => g.status === "resolved"), [gaps]);

  const sevWeight = { critical: 3, moderate: 2, low: 1 } as const;
  const visible = useMemo(() => {
    let list = open;
    if (filter === "closed") list = resolved;
    else if (filter !== "all") list = open.filter((g: any) => g.severity === filter);
    return [...list].sort((a: any, b: any) => {
      const sa = sevWeight[a.severity as Severity] ?? 0;
      const sb = sevWeight[b.severity as Severity] ?? 0;
      if (sb !== sa) return sb - sa;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, [open, resolved, filter]);

  const counts = {
    all: open.length,
    critical: open.filter((g: any) => g.severity === "critical").length,
    moderate: open.filter((g: any) => g.severity === "moderate").length,
    low: open.filter((g: any) => g.severity === "low").length,
    closed: resolved.length,
  };

  const sevColor = (s: string) =>
    s === "critical" ? "text-destructive border-destructive/40 bg-destructive/10"
    : s === "moderate" ? "text-primary border-primary/40 bg-primary/10"
    : "text-success border-success/40 bg-success/10";

  const daysOpen = (iso: string) =>
    Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));

  async function ask(g: any) {
    setBusy({ id: g.id, kind: "explain" });
    try {
      const accessToken = await getAccessToken();
      const r = await explain({ data: { accessToken, topic: g.topic, subject: g.subject } });
      setExplanation((m) => ({ ...m, [g.id]: r.explanation }));
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function resolve(g: any) {
    await supabase
      .from("knowledge_gaps")
      .update({ status: "resolved", resolved_at: new Date().toISOString(), confidence: 80 })
      .eq("id", g.id);
    toast.success("Gap closed");
    qc.invalidateQueries({ queryKey: ["gaps", user?.id] });
  }

  async function spawnDeck(g: any) {
    if (!user) return;
    setBusy({ id: g.id, kind: "deck" });
    try {
      const accessToken = await getAccessToken();
      const r = await makeCards({ data: { accessToken, topic: g.topic, subject: g.subject } });
      const { data: deck, error } = await supabase
        .from("flashcard_decks")
        .insert({
          user_id: user.id,
          title: `Gap drill · ${g.topic}`,
          subject: g.subject,
          description: "Auto-generated from a knowledge gap",
          total_cards: r.cards.length,
        })
        .select("id")
        .single();
      if (error || !deck) throw error;
      const rows = r.cards.map((c: any) => ({
        deck_id: deck.id,
        user_id: user.id,
        front: c.front,
        back: c.back,
        bloom_level: c.bloom_level,
        tags: [g.topic],
      }));
      const { error: cErr } = await supabase.from("flashcards").insert(rows);
      if (cErr) throw cErr;
      toast.success(`${r.cards.length} cards ready`);
      nav({ to: "/review" });
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function spawnQuiz(g: any) {
    if (!user) return;
    setBusy({ id: g.id, kind: "quiz" });
    try {
      const accessToken = await getAccessToken();
      const r = await makeQuiz({
        data: {
          accessToken,
          topic: g.topic,
          subject: g.subject,
          difficulty: "medium",
          count: 5,
        },
      });
      const { data: quiz, error } = await supabase
        .from("quizzes")
        .insert({
          user_id: user.id,
          title: `Gap drill · ${g.topic}`,
          subject: g.subject,
          difficulty: "medium",
          quiz_type: "mcq",
          questions: r.questions,
          question_count: r.questions.length,
        })
        .select("id")
        .single();
      if (error || !quiz) throw error;
      toast.success("Mini-quiz ready");
      nav({ to: "/quizzes/$id/take", params: { id: quiz.id }, search: { timer: 0 } });
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function scheduleReview(g: any) {
    if (!user) return;
    const start = new Date();
    start.setDate(start.getDate() + 1);
    start.setHours(9, 0, 0, 0);
    const end = new Date(start.getTime() + 25 * 60_000);
    const { error } = await supabase.from("schedule_blocks").insert({
      user_id: user.id,
      title: `Review: ${g.topic}`,
      subject: g.subject,
      block_type: "review",
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      notes: `Auto-scheduled from knowledge gap (${g.severity}).`,
    });
    if (error) toast.error(reportError("gaps", error));
    else toast.success("Added to tomorrow 9:00 AM");
  }

  const FilterChip = ({ id, label, n }: { id: Filter; label: string; n: number }) => (
    <button
      onClick={() => setFilter(id)}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
        filter === id
          ? "border-primary bg-primary/15 text-primary"
          : "border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
      }`}
    >
      {label} <span className="opacity-70">· {n}</span>
    </button>
  );

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Knowledge Gaps</h1>
          <p className="text-sm text-muted-foreground">Topics your quizzes flagged as weak. Close them one by one.</p>
        </div>
        {/* Inline chips on phones — a right-aligned stack wasted a whole column */}
        <div className="flex shrink-0 gap-2 text-xs text-muted-foreground sm:block sm:text-right">
          <div className="rounded-full bg-surface-3 px-2.5 py-1 sm:bg-transparent sm:px-0 sm:py-0">
            <span className="text-foreground font-semibold">{open.length}</span> open
          </div>
          <div className="rounded-full bg-surface-3 px-2.5 py-1 sm:bg-transparent sm:px-0 sm:py-0">
            <span className="text-foreground font-semibold">{resolved.length}</span> closed
          </div>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        <FilterChip id="all" label="All open" n={counts.all} />
        <FilterChip id="critical" label="Critical" n={counts.critical} />
        <FilterChip id="moderate" label="Moderate" n={counts.moderate} />
        <FilterChip id="low" label="Low" n={counts.low} />
        <FilterChip id="closed" label="Closed" n={counts.closed} />
      </div>

      {counts.critical === 0 && filter === "all" && open.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">
          <PartyPopper className="h-4 w-4" /> No critical gaps right now — keep chipping at the moderates.
        </div>
      )}

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
          {filter === "closed"
            ? "Nothing closed yet. Resolve a gap to see it here."
            : <>Nothing here. Take a quiz to surface weak spots. <Link to="/quizzes" className="text-primary underline">Quizzes →</Link></>}
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((g: any) => {
            const isClosed = g.status === "resolved";
            return (
              <li key={g.id} className={`rounded-xl border p-4 ${isClosed ? "border-border/40 bg-card/40 opacity-80" : sevColor(g.severity)}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide opacity-80">
                      {isClosed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                      {isClosed ? "closed" : g.severity} · {g.subject}
                      {!isClosed && g.hit_count > 0 && (
                        <span className="rounded-full border border-current/40 px-1.5 py-0.5 text-[10px]">×{g.hit_count} missed</span>
                      )}
                    </div>
                    <div className="mt-1 font-medium text-foreground">{g.topic}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      Confidence: {g.confidence ?? 30}% · {daysOpen(g.created_at)}d {isClosed ? "to close" : "open"}
                    </div>
                  </div>
                  {!isClosed && (
                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => resolve(g)}
                        className="inline-flex items-center gap-1 rounded-lg border border-success/40 px-3 py-1.5 text-xs font-semibold text-success hover:bg-success/10"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Close
                      </button>
                    </div>
                  )}
                </div>

                {!isClosed && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => ask(g)}
                      disabled={busy?.id === g.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 disabled:opacity-50"
                    >
                      <Sparkles className="h-3.5 w-3.5" /> {busy?.id === g.id && busy?.kind === "explain" ? "Explaining…" : "Explain"}
                    </button>
                    <button
                      onClick={() => spawnQuiz(g)}
                      disabled={busy?.id === g.id}
                      className="inline-flex items-center gap-1 rounded-xl border-2 border-border/60 px-3 py-1.5 text-xs font-semibold hover:border-primary/40 disabled:opacity-50"
                    >
                      <ListChecks className="h-3.5 w-3.5" /> {busy?.id === g.id && busy?.kind === "quiz" ? "Building…" : "5-Q drill"}
                    </button>
                    <button
                      onClick={() => spawnDeck(g)}
                      disabled={busy?.id === g.id}
                      className="inline-flex items-center gap-1 rounded-xl border-2 border-border/60 px-3 py-1.5 text-xs font-semibold hover:border-primary/40 disabled:opacity-50"
                    >
                      <Layers className="h-3.5 w-3.5" /> {busy?.id === g.id && busy?.kind === "deck" ? "Building…" : "Flashcards"}
                    </button>
                    <Link
                      to="/tutor"
                      className="inline-flex items-center gap-1 rounded-xl border-2 border-border/60 px-3 py-1.5 text-xs font-semibold hover:border-primary/40"
                    >
                      <MessagesSquare className="h-3.5 w-3.5" /> Tutor
                    </Link>
                    <button
                      onClick={() => scheduleReview(g)}
                      className="inline-flex items-center gap-1 rounded-xl border-2 border-border/60 px-3 py-1.5 text-xs font-semibold hover:border-primary/40"
                    >
                      <CalendarPlus className="h-3.5 w-3.5" /> +25m tomorrow
                    </button>
                  </div>
                )}

                {explanation[g.id] && (
                  <div className="mt-3 rounded-xl border-2 border-border/40 bg-background/40 p-3 text-sm text-foreground/90 whitespace-pre-wrap">
                    {explanation[g.id]}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
