import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { reviewCard, isDue, type Rating, type FSRSState } from "@/lib/fsrs";
import { CheckCircle2, RotateCcw, Brain } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/review")({
  component: ReviewPage,
});

const RATINGS: { rating: Rating; label: string; sub: string; cls: string }[] = [
  { rating: 1, label: "Again", sub: "Forgot it", cls: "bg-red-500/15 text-red-400 hover:bg-red-500/25 border-red-500/30" },
  { rating: 2, label: "Hard", sub: "Tough recall", cls: "bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border-amber-500/30" },
  { rating: 3, label: "Good", sub: "Recalled OK", cls: "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border-emerald-500/30" },
  { rating: 4, label: "Easy", sub: "Too easy", cls: "bg-primary/15 text-primary hover:bg-primary/25 border-primary/30" },
];

function ReviewPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showBack, setShowBack] = useState(false);
  const [reviewedToday, setReviewedToday] = useState(0);

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

  async function handleRate(rating: Rating) {
    if (!current || !user) return;
    const state: FSRSState = {
      stability: current.fsrs_stability ?? 0,
      difficulty: current.fsrs_difficulty ?? 5,
      retrievability: current.fsrs_retrievability ?? 0,
      repetitions: current.fsrs_repetitions ?? 0,
      lapses: current.fsrs_lapses ?? 0,
      state: (current.fsrs_state as any) ?? "new",
      nextReviewDate: current.next_review_date ?? new Date().toISOString().slice(0, 10),
      lastReviewDate: current.last_review_date ?? null,
    };
    const next = reviewCard(state, rating);

    const stabilityBefore = state.stability;

    const updates = supabase
      .from("flashcards")
      .update({
        fsrs_stability: next.stability,
        fsrs_difficulty: next.difficulty,
        fsrs_retrievability: next.retrievability,
        fsrs_repetitions: next.repetitions,
        fsrs_lapses: next.lapses,
        fsrs_state: next.state,
        next_review_date: next.nextReviewDate,
        last_review_date: next.lastReviewDate,
        last_rating: rating,
      })
      .eq("id", current.id);

    const review = supabase.from("flashcard_reviews").insert({
      card_id: current.id,
      user_id: user.id,
      rating,
      stability_before: stabilityBefore,
      stability_after: next.stability,
    });

    const xp = supabase.rpc("increment_xp", { _amount: rating === 1 ? 1 : 5 });

    const [u, r, _x] = await Promise.all([updates, review, xp]);
    if (u.error || r.error) toast.error((u.error || r.error)!.message);

    setReviewedToday((n) => n + 1);
    setShowBack(false);
    qc.invalidateQueries({ queryKey: ["due-cards"] });
    refetch();
  }

  if (!cards) {
    return <div className="text-center py-20 text-sm text-muted-foreground">Loading…</div>;
  }

  if (cards.length === 0) {
    return (
      <div className="text-center py-20">
        <CheckCircle2 className="h-12 w-12 mx-auto text-primary" />
        <h2 className="mt-4 font-display text-2xl font-semibold">All caught up.</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {reviewedToday > 0
            ? `You reviewed ${reviewedToday} card${reviewedToday === 1 ? "" : "s"} today. Ɛyɛ!`
            : "No cards due. Generate flashcards from a material to start studying."}
        </p>
        <Link
          to="/materials"
          className="mt-6 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Go to materials
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" /> Review
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {cards.length} due · {reviewedToday} reviewed
          </p>
        </div>
        <button onClick={() => setShowBack((s) => !s)} className="text-xs text-muted-foreground hover:text-foreground">
          <RotateCcw className="h-3.5 w-3.5 inline mr-1" /> Flip
        </button>
      </header>

      <AnimatePresence mode="wait">
        <motion.div
          key={current?.id + (showBack ? "-back" : "-front")}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.2 }}
          className="min-h-[280px] rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-card)]"
        >
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
            <span className="px-2 py-0.5 rounded-full bg-muted">Bloom L{current?.bloom_level ?? 1}</span>
            {current?.tags?.slice(0, 3).map((t) => (
              <span key={t} className="px-2 py-0.5 rounded-full border border-border">{t}</span>
            ))}
          </div>
          <div className="text-lg leading-relaxed whitespace-pre-wrap">
            {showBack ? current?.back : current?.front}
          </div>
          {!showBack && current?.hint && (
            <div className="mt-4 text-xs text-muted-foreground italic">Hint: {current.hint}</div>
          )}
        </motion.div>
      </AnimatePresence>

      {!showBack ? (
        <button
          onClick={() => setShowBack(true)}
          className="w-full rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Show answer
        </button>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {RATINGS.map((r) => (
            <button
              key={r.rating}
              onClick={() => handleRate(r.rating)}
              className={`rounded-lg border px-3 py-3 text-sm transition ${r.cls}`}
            >
              <div className="font-semibold">{r.label}</div>
              <div className="text-[10px] opacity-70">{r.sub}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
