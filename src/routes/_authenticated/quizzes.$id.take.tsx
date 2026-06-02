import { awardXp } from "@/lib/xp";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Flag, ChevronRight, Loader2, Timer, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Sounds } from "@/lib/sounds";

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
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [flash, setFlash] = useState<"green" | "red" | null>(null);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);

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
    if (checked[idx]) return; // locked after check
    setAnswers({ ...answers, [idx]: letter });
    const right = letter === q.correct;
    setChecked({ ...checked, [idx]: true });
    if (right) {
      Sounds.correct();
      setFlash("green");
    } else {
      Sounds.wrong();
      setFlash("red");
    }
    setTimeout(() => setFlash(null), 500);
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

    // Reconcile against existing open gaps
    const { data: openGaps } = await supabase
      .from("knowledge_gaps")
      .select("id, topic, severity, hit_count, confidence")
      .eq("user_id", user.id)
      .eq("status", "open");
    const openList = (openGaps ?? []) as Array<{ id: string; topic: string; severity: string; hit_count: number | null; confidence: number | null }>;
    const matchedTopics = new Set<string>();

    // Bump hit_count + escalate severity for wrong answers matching open gaps
    for (const w of wrong) {
      const t = String(w.topic ?? "").toLowerCase();
      if (!t) continue;
      const match = openList.find((g) => {
        const gt = String(g.topic ?? "").toLowerCase();
        return gt === t || gt.includes(t) || t.includes(gt);
      });
      if (match) {
        matchedTopics.add(t);
        const newHits = (match.hit_count ?? 0) + 1;
        const nextSev = newHits >= 3 ? "critical" : newHits >= 2 ? "moderate" : match.severity;
        await supabase
          .from("knowledge_gaps")
          .update({ hit_count: newHits, severity: nextSev, confidence: Math.max(0, (match.confidence ?? 30) - 10) })
          .eq("id", match.id);
      }
    }

    // Bump confidence (and auto-resolve at >=80) for correct answers matching open gaps
    for (const t of correctTopics) {
      const match = openList.find((g) => {
        const gt = String(g.topic ?? "").toLowerCase();
        return gt === t || gt.includes(t) || t.includes(gt);
      });
      if (match) {
        const newConf = Math.min(100, (match.confidence ?? 30) + 15);
        const patch = newConf >= 80
          ? { confidence: newConf, status: "resolved", resolved_at: new Date().toISOString() }
          : { confidence: newConf };
        await supabase.from("knowledge_gaps").update(patch).eq("id", match.id);
      }
    }

    // Insert brand-new gaps for unmatched wrong answers
    if (wrong.length) {
      const seen = new Set<string>();
      const gapsRows = wrong
        .filter((w) => {
          const t = String(w.topic ?? "").toLowerCase();
          if (!t || matchedTopics.has(t)) return false;
          const k = `${t}|${w.bloom}`;
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
          hit_count: 1,
        }));
      if (gapsRows.length) await supabase.from("knowledge_gaps").insert(gapsRows);
    }

    // Award XP
    const xp = Math.round((score / total) * 75);
    await awardXp({ userId: user.id, amount: xp, action: "quiz_completed", description: `${score}/${total} on ${title}` });

    // Refill review hearts if user scored >= 70%
    if (total > 0 && score / total >= 0.7) {
      try { localStorage.setItem("klausum:heartsRefilledAt", String(Date.now())); } catch {}
    }

    setSubmitting(false);
    navigate({ to: "/quizzes/$id/results", params: { id }, search: { attempt: attempt.id } });
  }

  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!q) return <div className="text-sm text-muted-foreground">No questions in this quiz.</div>;

  const answered = Object.keys(answers).length;
  const allAnswered = answered === total;

  const isChecked = !!checked[idx];
  const userAnswer = answers[idx];
  const isCorrect = isChecked && userAnswer === q.correct;

  return (
    <div className={`space-y-6 max-w-2xl mx-auto transition ${flash === "green" ? "flash-green" : flash === "red" ? "flash-red" : ""}`}>
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
          <div className="h-full bg-primary xp-bar-fill" style={{ width: `${((idx + 1) / total) * 100}%` }} />
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
          className={`rounded-xl border border-border bg-card p-6 ${isChecked && !isCorrect ? "answer-wrong" : ""}`}
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
              const sel = userAnswer === letter;
              const isRightAns = letter === q.correct;
              let cls = "border-border bg-background hover:border-primary/40";
              if (isChecked) {
                if (isRightAns) cls = "border-emerald-500 bg-emerald-500/15 text-emerald-400 answer-correct";
                else if (sel) cls = "border-red-500 bg-red-500/15 text-red-400";
                else cls = "border-border bg-background opacity-60";
              } else if (sel) {
                cls = "border-primary bg-primary/10 text-foreground";
              }
              return (
                <button
                  key={letter}
                  onClick={() => pick(letter)}
                  disabled={isChecked}
                  className={`w-full text-left rounded-lg border px-4 py-3 text-sm transition flex items-center justify-between ${cls}`}
                >
                  <span>
                    <span className="font-mono text-xs text-muted-foreground mr-2">{letter}.</span>
                    {q.options[letter]}
                  </span>
                  {isChecked && isRightAns && <Check className="h-4 w-4" />}
                  {isChecked && sel && !isRightAns && <X className="h-4 w-4" />}
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

      {/* Duolingo-style instant feedback banner */}
      <AnimatePresence>
        {isChecked && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className={`rounded-xl border p-4 ${isCorrect ? "border-emerald-500/40 bg-emerald-500/10" : "border-red-500/40 bg-red-500/10"}`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className={`font-display text-sm font-bold ${isCorrect ? "text-emerald-400" : "text-red-400"}`}>
                  {isCorrect ? "✅ Correct!" : "❌ Incorrect"}
                </div>
                {!isCorrect && (
                  <div className="text-xs text-muted-foreground mt-1">Answer: <span className="text-emerald-400 font-semibold">{q.correct}</span></div>
                )}
                {q.explanation && (
                  <p className="text-xs text-muted-foreground mt-1.5">{q.explanation}</p>
                )}
              </div>
              {isCorrect && <span className="shrink-0 text-primary font-bold text-sm">+ XP ⚡</span>}
            </div>
          </motion.div>
        )}
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
