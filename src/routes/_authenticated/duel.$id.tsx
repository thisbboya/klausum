// Playing a duel.
//
// Duels used to send you to /quizzes/$id/take, pointed at a quiz that already
// existed — so either player could open that quiz in another tab, read the
// answers, and then accept. A duel now carries its own questions, generated
// when it was created and stored on the row, and this page is the only place
// they are ever shown.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock, Swords, Trophy } from "lucide-react";
import confetti from "canvas-confetti";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { submitDuelScore } from "@/lib/duels";
import { KlausumLoading } from "@/components/loading";
import { Sounds } from "@/lib/sounds";
import { toast } from "@/lib/notify";
import { reportError } from "@/lib/report-error";
import { ShareResult } from "@/components/duel-share";

export const Route = createFileRoute("/_authenticated/duel/$id")({ component: DuelPage });

type Q = { question: string; options: string[]; correct: number };

function DuelPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: duel, isLoading } = useQuery({
    queryKey: ["duel", id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("quiz_challenges")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      return data;
    },
  });

  const questions: Q[] = useMemo(
    () => (Array.isArray(duel?.questions) ? (duel.questions as Q[]) : []),
    [duel],
  );

  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const [left, setLeft] = useState<number | null>(null);

  // The per-question clock. It is the whole tension of a duel, so running out
  // simply moves on rather than pausing to ask.
  useEffect(() => {
    if (!duel || done || picked !== null) return;
    setLeft(duel.time_limit_seconds);
    const t = setInterval(() => {
      setLeft((s) => {
        if (s === null) return s;
        if (s <= 1) {
          clearInterval(t);
          answer(-1);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, duel, done]);

  function answer(choice: number) {
    if (picked !== null) return;
    setPicked(choice);
    const right = choice === questions[idx]?.correct;
    if (right) {
      setScore((s) => s + 1);
      Sounds.correct();
    } else {
      Sounds.wrong?.();
    }
    setTimeout(() => {
      if (idx + 1 >= questions.length) void finish(right ? score + 1 : score);
      else {
        setIdx((i) => i + 1);
        setPicked(null);
      }
    }, 900);
  }

  async function finish(finalScore: number) {
    setDone(true);
    try {
      await submitDuelScore(id, finalScore, questions.length);
      confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });
    } catch (e) {
      toast.error(reportError("duel-submit", e));
    }
  }

  if (isLoading) return <KlausumLoading label="Loading the duel…" />;

  if (!duel || questions.length === 0) {
    return (
      <div className="card-chunky bg-card p-8 text-center">
        <p className="text-sm font-extrabold">This duel isn't available.</p>
        <Link to="/community" className="btn-3d mt-4 inline-flex rounded-xl bg-primary px-4 py-2 text-sm font-extrabold text-primary-foreground">
          Back to Social
        </Link>
      </div>
    );
  }

  if (done) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <div className="mx-auto max-w-md space-y-4 text-center">
        <Trophy className="mx-auto h-12 w-12 text-primary" />
        <h1 className="font-display text-3xl font-extrabold">{pct}%</h1>
        <p className="text-sm font-bold text-muted-foreground">
          {score} of {questions.length} correct
        </p>
        <ShareResult score={score} total={questions.length} />
        <button
          onClick={() => navigate({ to: "/community" })}
          className="btn-3d w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-extrabold uppercase tracking-wide text-primary-foreground"
        >
          Back to Social
        </button>
      </div>
    );
  }

  const q = questions[idx];

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <header className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-sm font-extrabold">
          <Swords className="h-4 w-4 text-primary" /> Duel · {idx + 1}/{questions.length}
        </span>
        <span
          data-tour-duel-timer
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-sm font-extrabold tabular-nums ${
            (left ?? 99) <= 5 ? "bg-destructive/15 text-destructive" : "bg-surface-2 text-muted-foreground"
          }`}
        >
          <Clock className="h-3.5 w-3.5" /> {left ?? "—"}s
        </span>
      </header>

      <div className="card-chunky bg-card p-6">
        <p className="whitespace-pre-line font-display text-lg font-extrabold leading-snug">
          {q.question}
        </p>
      </div>

      <div className="grid gap-2">
        {q.options.map((opt, i) => {
          const isRight = i === q.correct;
          const chosen = picked === i;
          return (
            <button
              key={i}
              onClick={() => answer(i)}
              disabled={picked !== null}
              className={`rounded-xl border-2 px-4 py-3 text-left text-sm font-bold transition ${
                picked === null
                  ? "border-border bg-card hover:border-primary"
                  : isRight
                    ? "border-success bg-success/12 text-success"
                    : chosen
                      ? "border-destructive bg-destructive/12 text-destructive"
                      : "border-border bg-card opacity-60"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
