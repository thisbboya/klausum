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
        {/* Two bare counts told you how much was wrong and nothing about how
            far you'd come. Closing gaps is the entire point of the page, so
            the header is the scoreboard for it. */}
        <div className="shrink-0 sm:w-56">
          <div className="flex items-center justify-between text-xs font-extrabold">
            <span className="text-muted-foreground">Closed</span>
            <span className="tabular-nums">
              {resolved.length} / {open.length + resolved.length}
            </span>
          </div>
          <div className="mt-1.5 h-2.5 overflow-hidden rounded-full border-2 border-border bg-surface-2">
            <div
              className="h-full rounded-full bg-success transition-[width] duration-500"
              style={{
                width: `${
                  open.length + resolved.length === 0
                    ? 0
                    : Math.round((resolved.length / (open.length + resolved.length)) * 100)
                }%`,
              }}
            />
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
              // A severity spine instead of flooding the whole card. Twenty-five
              // gaps all rendered in full red read as one undifferentiated
              // alarm — nothing stood out, so nothing felt actionable. The
              // stripe still says "critical" at a glance while the card itself
              // stays a normal card you can actually read.
              <li
                key={g.id}
                className={`relative overflow-hidden rounded-2xl border-2 pl-5 pr-4 py-4 transition ${
                  isClosed
                    ? "border-border bg-card/40 opacity-75"
                    : "border-border bg-card hover:border-primary/50"
                }`}
              >
                <span
                  aria-hidden
                  className={`absolute inset-y-0 left-0 w-1.5 ${
                    isClosed
                      ? "bg-success"
                      : g.severity === "critical"
                        ? "bg-destructive"
                        : g.severity === "moderate"
                          ? "bg-primary"
                          : "bg-sky"
                  }`}
                />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">
                      {isClosed ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5" />
                      )}
                      {isClosed ? "closed" : g.severity} · {g.subject}
                      {!isClosed && g.hit_count > 0 && (
                        <span className="rounded-full border-2 border-border px-1.5 py-0.5">
                          ×{g.hit_count} missed
                        </span>
                      )}
                    </div>
                    <div className="mt-1 font-display text-base font-extrabold text-foreground">
                      {g.topic}
                    </div>

                    {/* Confidence was a bare percentage in a line of grey text,
                        which is a number you skim past. As a bar it is the one
                        thing on the card that visibly moves as you work, which
                        is the whole reason to come back to this page. */}
                    {!isClosed && (
                      <div className="mt-2 max-w-xs">
                        <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">
                          <span>Confidence</span>
                          <span className="tabular-nums text-foreground">{g.confidence ?? 30}%</span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full border-2 border-border bg-surface-2">
                          <div
                            className="h-full rounded-full bg-primary transition-[width] duration-500"
                            style={{ width: `${Math.min(100, Math.max(0, g.confidence ?? 30))}%` }}
                          />
                        </div>
                      </div>
                    )}
                    <div className="mt-1.5 text-[11px] font-bold text-muted-foreground">
                      {daysOpen(g.created_at)}d {isClosed ? "to close" : "open"}
                    </div>
                  </div>
                  {!isClosed && (
                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => resolve(g)}
                        className="inline-flex items-center gap-1 rounded-xl border-2 border-success px-3 py-1.5 text-xs font-extrabold text-success transition hover:bg-success/10"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Close
                      </button>
                    </div>
                  )}
                </div>

                {/* Five buttons of identical weight is five decisions, and the
                    page had that on every one of twenty-five rows. "Explain"
                    is what you almost always want first, so it leads as a
                    solid button and the rest follow as quiet outlines. */}
                {!isClosed && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => ask(g)}
                      disabled={busy?.id === g.id}
                      className="btn-3d inline-flex items-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-extrabold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                    >
                      <Sparkles className="h-3.5 w-3.5" />{" "}
                      {busy?.id === g.id && busy?.kind === "explain" ? "Explaining…" : "Explain this"}
                    </button>
                    <button
                      onClick={() => spawnQuiz(g)}
                      disabled={busy?.id === g.id}
                      className="inline-flex items-center gap-1 rounded-xl border-2 border-border px-3 py-1.5 text-xs font-extrabold transition hover:border-primary hover:text-primary disabled:opacity-50"
                    >
                      <ListChecks className="h-3.5 w-3.5" /> {busy?.id === g.id && busy?.kind === "quiz" ? "Building…" : "5-Q drill"}
                    </button>
                    <button
                      onClick={() => spawnDeck(g)}
                      disabled={busy?.id === g.id}
                      className="inline-flex items-center gap-1 rounded-xl border-2 border-border px-3 py-1.5 text-xs font-extrabold transition hover:border-primary hover:text-primary disabled:opacity-50"
                    >
                      <Layers className="h-3.5 w-3.5" /> {busy?.id === g.id && busy?.kind === "deck" ? "Building…" : "Flashcards"}
                    </button>
                    <Link
                      to="/tutor"
                      className="inline-flex items-center gap-1 rounded-xl border-2 border-border px-3 py-1.5 text-xs font-extrabold transition hover:border-primary hover:text-primary"
                    >
                      <MessagesSquare className="h-3.5 w-3.5" /> Tutor
                    </Link>
                    <button
                      onClick={() => scheduleReview(g)}
                      className="inline-flex items-center gap-1 rounded-xl border-2 border-border px-3 py-1.5 text-xs font-extrabold transition hover:border-primary hover:text-primary"
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
