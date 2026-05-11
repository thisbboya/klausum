import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Flag, ChevronRight, Loader2, Timer } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Q = {
  question: string;
  options: { A: string; B: string; C: string; D: string };
  correct: "A" | "B" | "C" | "D";
  explanation: string;
  topic: string;
  difficulty: string;
  bloom_level: number;
};

type Search = { timer?: number };

export const Route = createFileRoute("/_authenticated/quizzes/$id/take")({
  validateSearch: (s: Record<string, unknown>): Search => ({ timer: typeof s.timer === "number" ? s.timer : 0 }),
  component: TakeQuiz,
});

function TakeQuiz() {
  const { id } = Route.useParams();
  const { timer: timerSec } = Route.useSearch();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Q[]>([]);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [flags, setFlags] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [start] = useState(Date.now());
  const [secLeft, setSecLeft] = useState(timerSec ?? 0);
  const [reviewMode, setReviewMode] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("quizzes").select("*").eq("id", id).maybeSingle();
      if (error || !data) {
        toast.error("Quiz not found");
        navigate({ to: "/quizzes" });
        return;
      }
      setQuestions((data.questions as any) ?? []);
      setTitle(data.title);
      setSubject(data.subject ?? "General");
      setLoading(false);
    })();
  }, [id, navigate]);

  const total = questions.length;
  const q = questions[idx];

  // Per-question countdown timer
  useEffect(() => {
    if (!timerSec || loading || reviewMode) return;
    setSecLeft(timerSec);
    const t = setInterval(() => {
      setSecLeft((s: number) => {
        if (s <= 1) {
          clearInterval(t);
          if (idx < total - 1) setIdx((i: number) => i + 1);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [idx, timerSec, loading, total, reviewMode]);

  function toggleFlag() {
    const s = new Set(flags);
    s.has(idx) ? s.delete(idx) : s.add(idx);
    setFlags(s);
  }

  function pick(letter: string) {
    setAnswers({ ...answers, [idx]: letter });
  }

  async function finish() {
    if (!user) return;
    setSubmitting(true);
    let score = 0;
    const bloom: Record<string, { right: number; total: number }> = {};
    const wrong: { topic: string; bloom: number }[] = [];
    const correctTopics: string[] = [];
    questions.forEach((qq, i) => {
      const got = answers[i];
      const right = got === qq.correct;
      if (right) score++;
      const k = `L${qq.bloom_level}`;
      bloom[k] = bloom[k] ?? { right: 0, total: 0 };
      bloom[k].total += 1;
      if (right) {
        bloom[k].right += 1;
        if (qq.topic) correctTopics.push(String(qq.topic).toLowerCase());
      } else wrong.push({ topic: qq.topic, bloom: qq.bloom_level });
    });

    const duration = Math.round((Date.now() - start) / 1000);
    const { data: attempt, error } = await supabase
      .from("quiz_attempts")
      .insert({
        user_id: user.id,
        quiz_id: id,
        answers,
        score,
        total,
        bloom_breakdown: bloom,
        duration_seconds: duration,
      })
      .select("id")
      .single();
    if (error) {
      toast.error(error.message);
      setSubmitting(false);
      return;
    }

    // Insert knowledge gaps from wrong answers
    if (wrong.length) {
      const seen = new Set<string>();
      const gapsRows = wrong
        .filter((w) => {
          const k = `${w.topic}|${w.bloom}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        })
        .map((w) => ({
          user_id: user.id,
          topic: w.topic,
          subject,
          bloom_level: w.bloom,
          severity: w.bloom >= 4 ? "critical" : "moderate",
          source: "quiz",
          source_id: id,
        }));
      if (gapsRows.length) await supabase.from("knowledge_gaps").insert(gapsRows);
    }

    // Award XP
    const xp = Math.round((score / total) * 75);
    await supabase.rpc("increment_xp", { _amount: xp });
    await supabase.from("xp_events").insert({ user_id: user.id, action: "quiz_completed", xp_amount: xp, description: `${score}/${total} on ${title}` });

    setSubmitting(false);
    navigate({ to: "/quizzes/$id/results", params: { id }, search: { attempt: attempt.id } });
  }

  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!q) return <div className="text-sm text-muted-foreground">No questions in this quiz.</div>;

  const answered = Object.keys(answers).length;
  const allAnswered = answered === total;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <header>
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">{subject} · {idx + 1} / {total}</p>
          {timerSec && timerSec > 0 ? (
            <span className={`inline-flex items-center gap-1 text-xs font-mono ${secLeft <= 5 ? "text-destructive" : "text-muted-foreground"}`}>
              <Timer className="h-3 w-3" /> {secLeft}s
            </span>
          ) : null}
        </div>
        <h1 className="font-display text-xl font-semibold mt-1">{title}</h1>
        <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${((idx + 1) / total) * 100}%` }} />
        </div>
        {flags.size > 0 && (
          <div className="mt-2 flex items-center gap-2 text-[11px] text-amber-400">
            <Flag className="h-3 w-3" /> {flags.size} flagged
            {!reviewMode && idx === total - 1 && (
              <button onClick={() => { setReviewMode(true); setIdx(Array.from(flags)[0]); }} className="ml-1 underline">
                review them
              </button>
            )}
          </div>
        )}
      </header>

      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25 }}
          className="rounded-xl border border-border bg-card p-6"
        >
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-base md:text-lg leading-relaxed">{q.question}</h2>
            <button
              onClick={toggleFlag}
              className={`shrink-0 rounded-full p-2 ${flags.has(idx) ? "bg-amber-500/15 text-amber-400" : "text-muted-foreground hover:bg-accent/10"}`}
              aria-label="Flag for review"
            >
              <Flag className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-5 space-y-2">
            {(["A", "B", "C", "D"] as const).map((letter) => {
              const sel = answers[idx] === letter;
              return (
                <button
                  key={letter}
                  onClick={() => pick(letter)}
                  className={`w-full text-left rounded-lg border px-4 py-3 text-sm transition ${
                    sel ? "border-primary bg-primary/10 text-foreground" : "border-border bg-background hover:border-primary/40"
                  }`}
                >
                  <span className="font-mono text-xs text-muted-foreground mr-2">{letter}.</span>
                  {q.options[letter]}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Bloom L{q.bloom_level} · {q.difficulty}</span>
            <span>{q.topic}</span>
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => setIdx(Math.max(0, idx - 1))}
          disabled={idx === 0}
          className="rounded-lg border border-border px-4 py-2 text-sm disabled:opacity-30"
        >
          ← Back
        </button>
        {idx < total - 1 ? (
          <button
            onClick={() => setIdx(idx + 1)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={finish}
            disabled={!allAnswered || submitting}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {allAnswered ? "Finish quiz" : `Answer all (${answered}/${total})`}
          </button>
        )}
      </div>
    </div>
  );
}
