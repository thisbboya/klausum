import { awardXp } from "@/lib/xp";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { reviewCard, isDue, type Rating, type FSRSState } from "@/lib/fsrs";
import { CheckCircle2, RotateCcw, Brain, Lightbulb, Sparkles, Flame } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { evaluateFeynman } from "@/lib/materials.functions";
import { useServerFn } from "@tanstack/react-start";
import { getAccessToken } from "@/lib/auth-helper";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import confetti from "canvas-confetti";
import { Sounds } from "@/lib/sounds";
import { XPBurst, type XPBurstState } from "@/components/xp-burst";
import { Hearts } from "@/components/hearts";

export const Route = createFileRoute("/_authenticated/review")({
  component: ReviewPage,
});

const RATINGS: { rating: Rating; label: string; emoji: string; cls: string }[] = [
  { rating: 1, label: "Again", emoji: "🔁", cls: "bg-red-500/15 text-red-400 hover:bg-red-500/25 border-red-500/30" },
  { rating: 2, label: "Hard", emoji: "😬", cls: "bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border-amber-500/30" },
  { rating: 3, label: "Good", emoji: "✅", cls: "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border-emerald-500/30" },
  { rating: 4, label: "Easy", emoji: "⚡", cls: "bg-primary/15 text-primary hover:bg-primary/25 border-primary/30" },
];

const BLOOM_LABEL: Record<number, string> = {
  1: "Remember", 2: "Understand", 3: "Apply", 4: "Analyse", 5: "Evaluate", 6: "Create",
};

function cardToState(c: any): FSRSState {
  return {
    stability: c.fsrs_stability ?? 0,
    difficulty: c.fsrs_difficulty ?? 5,
    retrievability: c.fsrs_retrievability ?? 0,
    repetitions: c.fsrs_repetitions ?? 0,
    lapses: c.fsrs_lapses ?? 0,
    state: (c.fsrs_state as any) ?? "new",
    nextReviewDate: c.next_review_date ?? new Date().toISOString().slice(0, 10),
    lastReviewDate: c.last_review_date ?? null,
  };
}

function ReviewPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const feynmanFn = useServerFn(evaluateFeynman);
  const [showBack, setShowBack] = useState(false);
  const [reviewedToday, setReviewedToday] = useState(0);
  const [firstTryRight, setFirstTryRight] = useState(0);
  const [hint, setHint] = useState(false);
  const [feynman, setFeynman] = useState(false);
  const [explanation, setExplanation] = useState("");
  const [feedback, setFeedback] = useState<any>(null);
  const [evaluating, setEvaluating] = useState(false);

  // Duolingo state
  const [hearts, setHearts] = useState(3);
  const [hotStreak, setHotStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [totalXp, setTotalXp] = useState(0);
  const [flash, setFlash] = useState<"green" | "red" | null>(null);
  const [xpBurst, setXpBurst] = useState<XPBurstState>({ show: false, amount: 0 });
  const [pausedUntil, setPausedUntil] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pausedUntil) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [pausedUntil]);

  // Consume quiz-based hearts refill (set when user passes a quiz with >=70%)
  useEffect(() => {
    try {
      const v = localStorage.getItem("klausum:heartsRefilledAt");
      if (v && Date.now() - Number(v) < 1000 * 60 * 60) {
        setHearts(3);
        setPausedUntil(null);
        localStorage.removeItem("klausum:heartsRefilledAt");
        toast.success("Hearts refilled from your quiz!", { icon: "❤️" });
      }
    } catch {}
  }, []);

  const { data: cards, refetch } = useQuery({
    queryKey: ["due-cards", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flashcards")
        .select("*")
        .eq("user_id", user!.id)
        .order("next_review_date", { ascending: true })
        .limit(50);
      if (error) throw error;
      return (data ?? []).filter((c) => c.next_review_date && isDue(c.next_review_date));
    },
  });

  const current = cards?.[0];

  const projections = useMemo(() => {
    if (!current) return null;
    const state = cardToState(current);
    return ([1, 2, 3, 4] as Rating[]).map((r) => {
      const next = reviewCard(state, r);
      const days = Math.max(0, Math.round(
        (new Date(next.nextReviewDate).getTime() - new Date().getTime()) / 86400000
      ));
      return { rating: r, days };
    });
  }, [current]);

  function triggerXpBurst(amount: number) {
    const rect = cardRef.current?.getBoundingClientRect();
    setXpBurst({
      show: true,
      amount,
      x: (rect ? rect.left + rect.width / 2 : window.innerWidth / 2) - 30,
      y: rect ? rect.top + 40 : 200,
      key: Date.now(),
    });
    setTimeout(() => setXpBurst((s) => ({ ...s, show: false })), 1200);
  }

  async function handleRate(rating: Rating) {
    if (!current || !user) return;
    if (pausedUntil && Date.now() < pausedUntil) return;

    const state = cardToState(current);
    const next = reviewCard(state, rating);

    // Hearts + hot streak
    if (rating === 1) {
      Sounds.heartBreak();
      setFlash("red");
      setHotStreak(0);
      const newHearts = Math.max(0, hearts - 1);
      setHearts(newHearts);
      if (newHearts === 0) {
        const until = Date.now() + 5 * 60 * 1000;
        setPausedUntil(until);
        toast("Take a short break! Hearts refill in 5 minutes.", { icon: "💔" });
      }
    } else {
      if (rating === 4) Sounds.correct();
      else Sounds.xpEarn();
      setFlash("green");
      setHearts((h) => Math.min(3, h + (rating === 4 ? 1 : 0)));
      const newStreak = hotStreak + 1;
      setHotStreak(newStreak);
      setBestStreak((b) => Math.max(b, newStreak));
      setFirstTryRight((n) => (showBack ? n : n + 1));
      if (newStreak === 5 || newStreak === 10) {
        Sounds.streak();
        toast.success(newStreak === 10 ? "🔥🔥 On FIRE! +10 bonus XP!" : "Hot streak! 🔥 +5 bonus XP!");
        await awardXp({ userId: user.id, amount: newStreak === 10 ? 10 : 5, action: "hot_streak", description: `${newStreak} in a row` });
      }
    }
    setTimeout(() => setFlash(null), 500);

    const updates = supabase.from("flashcards").update({
      fsrs_stability: next.stability,
      fsrs_difficulty: next.difficulty,
      fsrs_retrievability: next.retrievability,
      fsrs_repetitions: next.repetitions,
      fsrs_lapses: next.lapses,
      fsrs_state: next.state,
      next_review_date: next.nextReviewDate,
      last_review_date: next.lastReviewDate,
      last_rating: rating,
    }).eq("id", current.id);

    const review = supabase.from("flashcard_reviews").insert({
      card_id: current.id, user_id: user.id, rating,
      stability_before: state.stability, stability_after: next.stability,
    });

    const xpAmount = rating === 1 ? 1 : rating === 4 ? 5 : 2;
    triggerXpBurst(xpAmount);
    setTotalXp((x) => x + xpAmount);
    const xp = awardXp({ userId: user.id, amount: xpAmount, action: "card_reviewed", description: `Rated ${rating}` });

    const [u, r] = await Promise.all([updates, review, xp]);
    if (u.error || r.error) toast.error((u.error || r.error)!.message);

    setReviewedToday((n) => n + 1);
    setShowBack(false); setHint(false); setExplanation(""); setFeedback(null);
    qc.invalidateQueries({ queryKey: ["due-cards"] });
    refetch();
  }

  async function submitFeynman() {
    if (!current || !explanation.trim()) return;
    setEvaluating(true);
    try {
      const accessToken = await getAccessToken();
      const result = await feynmanFn({
        data: {
          accessToken,
          concept: current.front,
          correctAnswer: current.back,
          studentExplanation: explanation,
        },
      });
      setFeedback(result);
      if (user) await awardXp({ userId: user.id, amount: 15, action: "feynman_session", description: current.front });
    } catch (e: any) {
      toast.error(e?.message ?? "Evaluation failed");
    } finally {
      setEvaluating(false);
    }
  }

  // Trigger confetti once when session ends
  const sessionEnded = cards && cards.length === 0 && reviewedToday > 0;
  useEffect(() => {
    if (!sessionEnded) return;
    confetti({ particleCount: 120, spread: 75, origin: { y: 0.6 }, colors: ["#F4A300", "#22C55E", "#3B82F6", "#F59E0B"] });
    Sounds.levelUp();
  }, [sessionEnded]);

  if (!cards) return <div className="text-center py-20 text-sm text-muted-foreground">Loading…</div>;

  if (cards.length === 0) {
    const pct = reviewedToday > 0 ? Math.round((firstTryRight / reviewedToday) * 100) : 0;
    const motivation =
      pct >= 90 ? "Incredible session. You're unstoppable! 💪"
      : pct >= 70 ? "Strong work. Consistency beats intensity every time."
      : pct >= 50 ? "Good effort. Tomorrow will be even better. 🌱"
      : reviewedToday > 0 ? "These cards are tough — that's why FSRS keeps showing them. You've got this!"
      : "No cards due. Generate flashcards from a material.";

    return (
      <div className="text-center py-16 card-entrance">
        <CheckCircle2 className="h-14 w-14 mx-auto text-primary" />
        <h2 className="mt-4 font-display text-3xl font-bold">Ayekoo! 🏆</h2>
        {reviewedToday > 0 && (
          <div className="mt-6 mx-auto max-w-md grid grid-cols-2 gap-3 text-left">
            <Stat label="Cards reviewed" value={reviewedToday.toString()} />
            <Stat label="First-try right" value={`${pct}%`} />
            <Stat label="Hot streak" value={`${bestStreak} 🔥`} />
            <Stat label="XP earned" value={`+${totalXp} ⚡`} accent />
          </div>
        )}
        <p className="mt-6 text-sm text-muted-foreground max-w-md mx-auto">{motivation}</p>
        <Link to="/materials" className="mt-6 inline-block rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
          Back to materials
        </Link>
      </div>
    );
  }

  // Paused (0 hearts) screen
  if (pausedUntil && Date.now() < pausedUntil) {
    void tick;
    const remaining = Math.max(0, Math.ceil((pausedUntil - Date.now()) / 1000));
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    return (
      <div className="text-center py-16 card-entrance">
        <div className="text-6xl mb-4">💔</div>
        <h2 className="font-display text-2xl font-bold">Out of hearts</h2>
        <p className="mt-2 text-sm text-muted-foreground">Take a short break. They refill in:</p>
        <div className="mt-4 font-mono text-3xl text-primary">{m}:{s.toString().padStart(2, "0")}</div>
        <button
          onClick={() => { setHearts(3); setPausedUntil(null); }}
          className="mt-6 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Refill now (skip break)
        </button>
      </div>
    );
  }

  return (
    <div className={`space-y-5 transition ${flash === "green" ? "flash-green" : flash === "red" ? "flash-red" : ""}`}>
      <XPBurst state={xpBurst} />

      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" /> Review
          </h1>
          <p className="text-xs text-muted-foreground mt-1">{cards.length} due · {reviewedToday} reviewed</p>
        </div>
        <div className="flex items-center gap-3">
          <Hearts count={hearts} />
          {hotStreak >= 2 && (
            <div className="flex items-center gap-1 text-xs font-semibold text-amber-500 bg-amber-500/10 px-2 py-1 rounded-full streak-bounce" key={hotStreak}>
              <Flame className="h-3 w-3" /> {hotStreak} in a row
            </div>
          )}
          <button onClick={() => { setFeynman(!feynman); setShowBack(false); setFeedback(null); }}
            className={`px-3 py-1.5 rounded-md border text-xs ${feynman ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
            <Sparkles className="h-3 w-3 inline mr-1" /> Feynman
          </button>
          <button onClick={() => { Sounds.flip(); setShowBack((s) => !s); }} className="text-muted-foreground hover:text-foreground text-xs">
            <RotateCcw className="h-3.5 w-3.5 inline mr-1" /> Flip
          </button>
        </div>
      </header>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-primary xp-bar-fill" style={{ width: `${(reviewedToday / (reviewedToday + cards.length)) * 100}%` }} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          ref={cardRef}
          key={current?.id + (showBack ? "-back" : "-front")}
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.2 }}
          className="min-h-[280px] rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-card)]"
        >
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
            <span className="px-2 py-0.5 rounded-full" style={{ background: `var(--bloom-${current?.bloom_level ?? 1})`, color: "oklch(0.2 0.04 260)" }}>
              L{current?.bloom_level ?? 1} · {BLOOM_LABEL[current?.bloom_level ?? 1]}
            </span>
            {current?.tags?.slice(0, 3).map((t) => (
              <span key={t} className="px-2 py-0.5 rounded-full border border-border">{t}</span>
            ))}
          </div>
          <article className="prose prose-invert prose-sm md:prose-base max-w-none">
            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
              {showBack ? (current?.back ?? "") : (current?.front ?? "")}
            </ReactMarkdown>
          </article>
          {!showBack && current?.hint && (
            <div className="mt-4">
              {hint ? (
                <p className="text-xs italic text-muted-foreground">💡 {current.hint}</p>
              ) : (
                <button onClick={() => setHint(true)} className="text-xs text-primary hover:underline">
                  <Lightbulb className="h-3 w-3 inline mr-1" /> Show hint
                </button>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {feynman ? (
        <div className="space-y-3">
          {!feedback ? (
            <>
              <textarea value={explanation} onChange={(e) => setExplanation(e.target.value)}
                rows={4} placeholder="Explain this concept as if teaching a 12-year-old..."
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <button onClick={submitFeynman} disabled={evaluating || !explanation.trim()}
                className="w-full rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
                {evaluating ? "Evaluating…" : "Submit explanation"}
              </button>
            </>
          ) : (
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-display font-semibold">Score: {feedback.score}</span>
                <span className="text-xs text-muted-foreground">+15 XP</span>
              </div>
              {feedback.got_right?.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-emerald-400 mb-1">✅ Got right</div>
                  <ul className="text-sm space-y-0.5 ml-4 list-disc text-muted-foreground">
                    {feedback.got_right.map((g: string, i: number) => <li key={i}>{g}</li>)}
                  </ul>
                </div>
              )}
              <div>
                <div className="text-xs font-medium text-amber-400 mb-1">⚠️ Critical gap</div>
                <p className="text-sm text-muted-foreground">{feedback.critical_gap}</p>
              </div>
              <div>
                <div className="text-xs font-medium text-primary mb-1">❓ Follow-up</div>
                <p className="text-sm">{feedback.follow_up_question}</p>
              </div>
              <div className="grid grid-cols-4 gap-2 pt-2">
                {RATINGS.map((r) => (
                  <button key={r.rating} onClick={() => handleRate(r.rating)}
                    className={`rounded-lg border px-2 py-2 text-xs ${r.cls}`}>
                    {r.emoji} {r.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : !showBack ? (
        <button onClick={() => { Sounds.flip(); setShowBack(true); }}
          className="w-full rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground hover:opacity-90">
          Show answer
        </button>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {RATINGS.map((r, i) => (
            <button key={r.rating} onClick={() => handleRate(r.rating)}
              className={`rounded-lg border px-3 py-3 text-sm transition ${r.cls}`}>
              <div className="font-semibold">{r.emoji} {r.label}</div>
              <div className="text-[10px] opacity-70 mt-0.5">
                → {projections?.[i].days === 0 ? "now" : `${projections?.[i].days}d`}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${accent ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}
