import { awardXp } from "@/lib/xp";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { reviewCard, isDue, type Rating, type FSRSState } from "@/lib/fsrs";
import { CheckCircle2, RotateCcw, Brain, Lightbulb, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { evaluateFeynman } from "@/lib/materials.functions";
import { useServerFn } from "@tanstack/react-start";
import { getAccessToken } from "@/lib/auth-helper";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

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
  const [hint, setHint] = useState(false);
  const [feynman, setFeynman] = useState(false);
  const [explanation, setExplanation] = useState("");
  const [feedback, setFeedback] = useState<any>(null);
  const [evaluating, setEvaluating] = useState(false);

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

  async function handleRate(rating: Rating) {
    if (!current || !user) return;
    const state = cardToState(current);
    const next = reviewCard(state, rating);

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

  if (!cards) return <div className="text-center py-20 text-sm text-muted-foreground">Loading…</div>;

  if (cards.length === 0) {
    return (
      <div className="text-center py-20">
        <CheckCircle2 className="h-12 w-12 mx-auto text-primary" />
        <h2 className="mt-4 font-display text-2xl font-semibold">Ayekoo! 🏆</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {reviewedToday > 0 ? `You reviewed ${reviewedToday} card${reviewedToday === 1 ? "" : "s"} today.` : "No cards due. Generate flashcards from a material."}
        </p>
        <Link to="/materials" className="mt-6 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Go to materials
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" /> Review
          </h1>
          <p className="text-xs text-muted-foreground mt-1">{cards.length} due · {reviewedToday} reviewed</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <button onClick={() => { setFeynman(!feynman); setShowBack(false); setFeedback(null); }}
            className={`px-3 py-1.5 rounded-md border ${feynman ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
            <Sparkles className="h-3 w-3 inline mr-1" /> Feynman
          </button>
          <button onClick={() => setShowBack((s) => !s)} className="text-muted-foreground hover:text-foreground">
            <RotateCcw className="h-3.5 w-3.5 inline mr-1" /> Flip
          </button>
        </div>
      </header>

      <AnimatePresence mode="wait">
        <motion.div
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
        <button onClick={() => setShowBack(true)}
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
