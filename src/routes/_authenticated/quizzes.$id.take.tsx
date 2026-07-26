import { awardXp } from "@/lib/xp";
import { reportError } from "@/lib/report-error";
import { KlausumLoading } from "@/components/loading";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Flag, ChevronRight, Loader2, Timer, Check, X, BookOpen } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Sounds } from "@/lib/sounds";
import { submitDuelScore } from "@/lib/duels";

type Q = {
  qtype?: "mcq" | "true_false" | "fill_blank";
  question: string;
  options?: { A: string; B: string; C?: string; D?: string };
  correct?: "A" | "B" | "C" | "D";
  answer?: string;
  explanation: string;
  topic: string;
  difficulty: string;
  bloom_level: number;
};

const qtypeOf = (q: Q) => q.qtype ?? "mcq";
const normalizeText = (s: string) =>
  s.toLowerCase().trim().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ");
/** One scoring rule for every question type. */
function isRightAnswer(qq: Q, got: string | undefined): boolean {
  if (!got) return false;
  if (qtypeOf(qq) === "fill_blank") return normalizeText(got) === normalizeText(qq.answer ?? "");
  return got === qq.correct;
}
/** Human-readable correct answer for the feedback banner. */
function correctDisplay(qq: Q): string {
  if (qtypeOf(qq) === "fill_blank") return qq.answer ?? "";
  const letter = qq.correct ?? "A";
  return qq.options?.[letter] ?? letter;
}

type Search = { timer?: number; challenge?: string };

export const Route = createFileRoute("/_authenticated/quizzes/$id/take")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    timer: typeof s.timer === "number" ? s.timer : 0,
    challenge: typeof s.challenge === "string" ? s.challenge : undefined,
  }),
  component: TakeQuiz,
});

function TakeQuiz() {
  const { id } = Route.useParams();
  const { timer: timerSec, challenge: challengeId } = Route.useSearch();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Q[]>([]);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [materialId, setMaterialId] = useState<string | null>(null);
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
  const [blankText, setBlankText] = useState("");
  useEffect(() => { setBlankText(""); }, [idx]);

  // Land at the top of every new question instead of keeping the previous
  // scroll offset, which dumped you into the middle of the next one.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [idx]);


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
      setMaterialId((data as any).material_id ?? null);
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
    const right = isRightAnswer(q, letter);
    setChecked({ ...checked, [idx]: true });
    if (right) {
      Sounds.correct();
      setFlash("green");
      setCombo((c) => {
        const next = c + 1;
        setBestCombo((b) => Math.max(b, next));
        return next;
      });
    } else {
      Sounds.wrong();
      setFlash("red");
      setCombo(0);
    }
    setTimeout(() => setFlash(null), 500);
  }

  // Keyboard play: A-D / 1-4 to answer, T/F for true-false, Enter or → to
  // advance, ← to go back. Keeps you off the mouse for a whole quiz.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toUpperCase();
      const type = qtypeOf(q);

      if (k === "ENTER" || k === "ARROWRIGHT") {
        e.preventDefault();
        if (idx < total - 1) setIdx(idx + 1);
        return;
      }
      if (k === "ARROWLEFT") {
        e.preventDefault();
        if (idx > 0) setIdx(idx - 1);
        return;
      }
      if (checked[idx] || type === "fill_blank") return;

      if (type === "true_false") {
        if (k === "T") { e.preventDefault(); pick("A"); }
        if (k === "F") { e.preventDefault(); pick("B"); }
        return;
      }
      const letters = ["A", "B", "C", "D"];
      const byLetter = letters.indexOf(k);
      const byNumber = "1234".indexOf(e.key);
      const i = byLetter >= 0 ? byLetter : byNumber;
      if (i >= 0 && (q.options as any)?.[letters[i]]) {
        e.preventDefault();
        pick(letters[i]);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, total, q, checked]);

  async function finish() {
    if (!user) return;
    setSubmitting(true);
    let score = 0;
    const bloom: Record<string, { right: number; total: number }> = {};
    const wrong: { topic: string; bloom: number }[] = [];
    const correctTopics: string[] = [];
    questions.forEach((qq, i) => {
      const got = answers[i];
      const right = isRightAnswer(qq, got);
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
      toast.error(reportError("quizzes.$id.take", error));
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

    // Award XP — base + combo bonus
    const baseXp = Math.round((score / total) * 75);
    const comboBonus = Math.min(50, bestCombo * 3);
    const xp = baseXp + comboBonus;
    await awardXp({ userId: user.id, amount: xp, action: "quiz_completed", description: `${score}/${total} on ${title}${bestCombo >= 3 ? ` · ${bestCombo}× combo` : ""}` });

    // Perfect-quiz chest (5+ questions, 100%)
    if (total >= 5 && score === total) {
      try {
        await supabase.rpc("open_chest", { _tier: "perfect_quiz" });
        toast.success("Perfect quiz! +25 XP, +10 gems");
      } catch {}
    }

    // Refill review hearts if user scored >= 70%
    if (total > 0 && score / total >= 0.7) {
      try { localStorage.setItem("klausum:heartsRefilledAt", String(Date.now())); } catch {}
    }

    // Duel scoring — write back to the challenge instead of the normal results screen
    if (challengeId) {
      try {
        const duel = await submitDuelScore(challengeId, score, total);
        setSubmitting(false);
        if (duel.status === "expired") {
          toast.error("This challenge expired before your score could count.");
        } else if (duel.status === "completed") {
          const iWon = duel.winner_id === user.id;
          if (iWon) {
            await awardXp({ userId: user.id, amount: 20, action: "duel_won", description: `Won duel on ${title}` });
            toast.success("You won the duel!");
          } else if (duel.winner_id === null) {
            toast("It's a tie!");
          } else {
            toast("Duel finished — better luck next time.");
          }
        } else {
          toast.success("Score submitted — waiting on your opponent.");
        }
      } catch (e: any) {
        toast.error(reportError("quizzes.$id.take", e));
        setSubmitting(false);
      }
      navigate({ to: "/community" });
      return;
    }

    setSubmitting(false);
    navigate({ to: "/quizzes/$id/results", params: { id }, search: { attempt: attempt.id } });
  }

  if (loading) return <KlausumLoading label="Setting up your quiz…" />;
  if (!q) return <div className="text-sm text-muted-foreground">No questions in this quiz.</div>;

  const answered = Object.keys(answers).length;
  const allAnswered = answered === total;

  const isChecked = !!checked[idx];
  const userAnswer = answers[idx];
  const isCorrect = isChecked && isRightAnswer(q, userAnswer);

  return (
    <div className={`mx-auto flex min-h-[calc(100dvh-8rem)] max-w-3xl flex-col gap-4 transition ${flash === "green" ? "flash-green" : flash === "red" ? "flash-red" : ""}`}>
      {/* Sticky so the counter, timer and progress never scroll out of view */}
      <header className="sticky top-0 z-20 -mx-4 bg-background/95 px-4 pb-3 pt-1 backdrop-blur supports-[backdrop-filter]:bg-background/80">
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
        <p className="mt-1.5 hidden text-[10px] font-bold text-muted-foreground md:block">
          Keyboard: <kbd className="rounded bg-surface-3 px-1">A</kbd>–<kbd className="rounded bg-surface-3 px-1">D</kbd> or{" "}
          <kbd className="rounded bg-surface-3 px-1">1</kbd>–<kbd className="rounded bg-surface-3 px-1">4</kbd> to answer ·{" "}
          <kbd className="rounded bg-surface-3 px-1">Enter</kbd> for next
        </p>
        {flags.size > 0 && (
          <div className="mt-2 flex items-center gap-2 text-[11px] text-primary">
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
          className={`card-chunky bg-card p-6 md:p-8 ${isChecked && !isCorrect ? "answer-wrong" : ""}`}
        >
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-xl md:text-2xl font-semibold leading-relaxed">{q.question}</h2>
            <button
              onClick={toggleFlag}
              className={`shrink-0 rounded-full p-2 ${flags.has(idx) ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent/10"}`}
              aria-label="Flag for review"
            >
              <Flag className="h-4 w-4" />
            </button>
          </div>
          {qtypeOf(q) === "fill_blank" ? (
            /* Fill-in-the-blank: type the answer, Enter or Check submits */
            <div className="mt-6 space-y-3">
              <input
                value={isChecked ? userAnswer ?? "" : blankText}
                onChange={(e) => setBlankText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && blankText.trim()) pick(blankText.trim()); }}
                disabled={isChecked}
                placeholder="Type your answer…"
                autoFocus
                className={`w-full rounded-xl border-2 px-5 py-4 text-base md:text-lg outline-none transition ${
                  isChecked
                    ? isCorrect
                      ? "border-success bg-success/15 text-success"
                      : "border-destructive bg-destructive/15 text-destructive"
                    : "border-border bg-background focus:border-primary"
                }`}
              />
              {!isChecked && (
                <button
                  onClick={() => blankText.trim() && pick(blankText.trim())}
                  disabled={!blankText.trim()}
                  className="btn-3d w-full rounded-xl bg-primary px-5 py-3 font-display font-extrabold uppercase tracking-wide text-primary-foreground disabled:opacity-40"
                >
                  Check
                </button>
              )}
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {(qtypeOf(q) === "true_false" ? (["A", "B"] as const) : (["A", "B", "C", "D"] as const))
                .filter((letter) => q.options?.[letter] != null)
                .map((letter) => {
                  const sel = userAnswer === letter;
                  const isRightAns = letter === q.correct;
                  let cls = "border-border bg-background hover:border-primary/40";
                  if (isChecked) {
                    if (isRightAns) cls = "border-success bg-success/15 text-success answer-correct";
                    else if (sel) cls = "border-destructive bg-destructive/15 text-destructive";
                    else cls = "border-border bg-background opacity-60";
                  } else if (sel) {
                    cls = "border-primary bg-primary/10 text-foreground";
                  }
                  return (
                    <button
                      key={letter}
                      onClick={() => pick(letter)}
                      disabled={isChecked}
                      className={`w-full text-left rounded-xl border-2 px-4 py-3 min-h-[52px] text-base transition flex items-center justify-between gap-3 focus:outline-none focus:ring-2 focus:ring-primary/40 ${cls}`}
                    >
                      <span className="flex items-center gap-3">
                        <span className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-current/30 font-mono text-sm font-bold shrink-0">
                          {qtypeOf(q) === "true_false" ? (letter === "A" ? "T" : "F") : letter}
                        </span>
                        <span>{q.options?.[letter]}</span>
                      </span>
                      {isChecked && isRightAns && <Check className="h-5 w-5 shrink-0" />}
                      {isChecked && sel && !isRightAns && <X className="h-5 w-5 shrink-0" />}
                    </button>
                  );
                })}
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>Bloom L{q.bloom_level} · {q.difficulty}</span>
            <span className="flex min-w-0 items-center gap-2">
              {/* Where this came from — lets you open the slide/page and look at
                  the diagram the question is describing. */}
              {(q as any).source_ref && materialId && (
                <Link
                  to="/materials/$id"
                  params={{ id: materialId }}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-surface-3 px-2 py-0.5 font-bold hover:text-foreground"
                  title="Open the material to view this part"
                >
                  <BookOpen className="h-3 w-3" /> {(q as any).source_ref}
                </Link>
              )}
              <span className="truncate">{q.topic}</span>
            </span>
          </div>
        </motion.div>
      </AnimatePresence>

      {combo >= 2 && !isChecked && (
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/30 px-3 py-1 text-xs font-bold">
            {combo}× streak{combo >= 5 ? " — 2× XP!" : combo >= 3 ? " — 1.5× XP" : ""}
          </span>
        </div>
      )}

      {/* Duolingo-style instant feedback banner */}
      <AnimatePresence>
        {isChecked && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className={`rounded-xl border p-4 ${isCorrect ? "border-success/40 bg-success/10" : "border-destructive/40 bg-destructive/10"}`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className={`font-display text-sm font-bold ${isCorrect ? "text-success" : "text-destructive"}`}>
                  {isCorrect ? "Correct!" : "Incorrect"}
                </div>
                {!isCorrect && (
                  <div className="text-xs text-muted-foreground mt-1">Answer: <span className="text-success font-semibold">{correctDisplay(q)}</span></div>
                )}
                {q.explanation && (
                  <p className="text-xs text-muted-foreground mt-1.5">{q.explanation}</p>
                )}
              </div>
              {isCorrect && <span className="shrink-0 text-primary font-bold text-sm">+ XP</span>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Pinned action bar — reaching Next must never require scrolling */}
      <div className="sticky bottom-0 z-20 -mx-4 mt-auto flex items-center justify-between gap-3 border-t-2 border-border bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <button
          onClick={() => setIdx(Math.max(0, idx - 1))}
          disabled={idx === 0}
          className="rounded-xl border-2 border-border px-4 py-2.5 text-sm font-bold disabled:opacity-30"
        >
          ← Back
        </button>
        <span className="text-xs font-extrabold text-muted-foreground">
          {answered}/{total} answered
        </span>
        {idx < total - 1 ? (
          <button
            onClick={() => setIdx(idx + 1)}
            className="inline-flex items-center gap-1.5 btn-3d rounded-xl bg-primary px-5 py-2.5 text-sm font-extrabold text-primary-foreground hover:opacity-90"
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={finish}
            disabled={!allAnswered || submitting}
            className="inline-flex items-center gap-1.5 btn-3d rounded-xl bg-primary px-5 py-2.5 text-sm font-extrabold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {allAnswered ? "Finish quiz" : `Answer all (${answered}/${total})`}
          </button>
        )}
      </div>
    </div>
  );
}
