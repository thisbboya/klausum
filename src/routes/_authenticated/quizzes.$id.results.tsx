import { createFileRoute, Link } from "@tanstack/react-router";
import { KlausumLoading } from "@/components/loading";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/lib/notify";
import { Trophy, RefreshCcw, MessagesSquare, Layers, Loader2, Zap, Target, Timer } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { motion } from "framer-motion";

type Search = { attempt?: string };

// Question-type-aware scoring (mirrors take page): fill_blank compares
// normalized text against `answer`; mcq/true_false compare the letter.
const normText = (s: string) =>
  s.toLowerCase().trim().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ");
function isRightAns(qq: any, got: string | undefined): boolean {
  if (!got) return false;
  if ((qq.qtype ?? "mcq") === "fill_blank") return normText(got) === normText(qq.answer ?? "");
  return got === qq.correct;
}
function answerText(qq: any): string {
  if ((qq.qtype ?? "mcq") === "fill_blank") return qq.answer ?? "";
  return `${qq.correct}. ${qq.options?.[qq.correct] ?? ""}`;
}

export const Route = createFileRoute("/_authenticated/quizzes/$id/results")({
  validateSearch: (s: Record<string, unknown>): Search => ({ attempt: typeof s.attempt === "string" ? s.attempt : undefined }),
  component: Results,
});

function Results() {
  const { id } = Route.useParams();
  const { attempt } = Route.useSearch();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState<any>(null);
  const [att, setAtt] = useState<any>(null);
  const [makingDeck, setMakingDeck] = useState(false);
  const [deckMade, setDeckMade] = useState(false);
  const [xpEarned, setXpEarned] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: q }, { data: a }] = await Promise.all([
        supabase.from("quizzes").select("*").eq("id", id).maybeSingle(),
        attempt
          ? supabase.from("quiz_attempts").select("*").eq("id", attempt).maybeSingle()
          : supabase.from("quiz_attempts").select("*").eq("quiz_id", id).order("completed_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (!q || !a) {
        toast.error("Results not found");
      }
      setQuiz(q);
      setAtt(a);
      setLoading(false);
      // The XP was already banked when the quiz was submitted, so read the
      // actual ledger entry rather than re-deriving it — the combo bonus isn't
      // stored on the attempt, and a made-up number here would not match the
      // student's real balance.
      if (a?.user_id) {
        const { data: ev } = await supabase
          .from("xp_events")
          .select("xp_amount, created_at")
          .eq("user_id", a.user_id)
          .eq("action", "quiz_completed")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (ev) setXpEarned((ev as any).xp_amount ?? null);
      }
    })();
  }, [id, attempt]);

  if (loading) return <KlausumLoading />;
  if (!quiz || !att) return <div className="text-sm text-muted-foreground">No results.</div>;

  const pct = Math.round((att.score / att.total) * 100);

  // Duolingo's trick: the headline reacts to the result, so the screen feels
  // like it watched you play rather than printing a number.
  const { headline, subline, gradeWord } =
    pct === 100
      ? {
          headline: "Flawless!",
          subline: "Every single one. That topic is yours now.",
          gradeWord: "Perfect",
        }
      : pct >= 90
        ? {
            headline: "Learning legend!",
            subline: "Near-perfect run — this is exam-ready territory.",
            gradeWord: "Amazing",
          }
        : pct >= 75
          ? {
              headline: "Strong work!",
              subline: "Solid grasp. We've flagged the few misses as gaps to close.",
              gradeWord: "Great",
            }
          : pct >= 60
            ? {
                headline: "Nice progress!",
                subline: "You're over the line. Drill the misses and this jumps fast.",
                gradeWord: "Good",
              }
            : {
                headline: "Now you know where to look.",
                subline: "Every wrong answer just became a gap Klausum will help you close.",
                gradeWord: "Score",
              };

  const secs = Number(att.duration_seconds ?? 0);
  const timeLabel = secs > 0 ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}` : "—";

  const bloomData = Object.entries((att.bloom_breakdown ?? {}) as Record<string, { right: number; total: number }>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([level, v]) => ({ level, score: Math.round((v.right / v.total) * 100) }));

  const questions = (quiz.questions ?? []) as any[];
  const userAnswers = (att.answers ?? {}) as Record<string, string>;

  return (
    <div className="space-y-8">
      {/* Duolingo's end-of-lesson celebration: a headline that reacts to how it
          went, three stat tiles, then one obvious way forward. */}
      <motion.header
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 140, damping: 18 }}
        className="pt-2 text-center"
      >
        <Trophy className="mx-auto h-12 w-12 text-primary" />
        <h1 className="mt-3 font-display text-3xl font-extrabold text-primary md:text-4xl">
          {headline}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm font-semibold text-muted-foreground">
          {subline}
        </p>
      </motion.header>

      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        {[
          {
            label: "Total XP",
            value: xpEarned != null ? `${xpEarned}` : "—",
            icon: Zap,
            shell: "bg-primary border-primary",
            ink: "text-primary",
          },
          {
            label: gradeWord,
            value: `${pct}%`,
            icon: Target,
            shell: "bg-success border-success",
            ink: "text-success",
          },
          {
            label: "Time",
            value: timeLabel,
            icon: Timer,
            shell: "bg-sky border-sky",
            ink: "text-sky",
          },
        ].map(({ label, value, icon: Icon, shell, ink }) => (
          <div key={label} className={`overflow-hidden rounded-2xl border-2 ${shell}`}>
            <div className="px-1 py-1 text-center text-[10px] font-extrabold uppercase tracking-wide text-white">
              {label}
            </div>
            <div className="m-[3px] flex items-center justify-center gap-1.5 rounded-xl bg-card px-1 py-3">
              <Icon className={`h-4 w-4 shrink-0 ${ink}`} />
              <span className={`text-lg font-extrabold tabular-nums ${ink}`}>{value}</span>
            </div>
          </div>
        ))}
      </div>

      <Link
        to="/quizzes"
        className="btn-3d btn-3d-success block w-full rounded-2xl bg-success py-3.5 text-center text-sm font-extrabold uppercase tracking-wide text-success-foreground"
      >
        Continue
      </Link>

      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="card-chunky bg-card p-5"
      >
        <div className="text-sm font-extrabold text-foreground">{quiz.title}</div>
        <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
          {quiz.subject} · {quiz.difficulty} · {att.score} / {att.total} correct
        </p>
        <div className="mt-4">
          <div className="flex flex-wrap gap-2">
            <Link to="/quizzes/$id/take" params={{ id }} search={{ timer: 0 }} className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 text-primary px-3 py-1.5 text-xs font-semibold hover:bg-primary/20">
              <RefreshCcw className="h-3.5 w-3.5" /> Retake
            </Link>
            <button
              onClick={async () => {
                if (!user) return;
                const wrong = questions.map((qq: any, i: number) => ({ qq, i })).filter(({ qq, i }) => !isRightAns(qq, userAnswers[i]));
                if (wrong.length === 0) return toast.info("No wrong answers — nothing to drill.");
                setMakingDeck(true);
                try {
                  const { data: deck, error: dErr } = await supabase.from("flashcard_decks").insert({
                    user_id: user.id,
                    title: `Wrong answers · ${quiz.title}`,
                    subject: quiz.subject,
                    description: `Auto-generated from quiz attempt`,
                    total_cards: wrong.length,
                  }).select("id").single();
                  if (dErr || !deck) throw dErr;
                  const cards = wrong.map(({ qq }: any) => ({
                    deck_id: deck.id,
                    user_id: user.id,
                    front: qq.question,
                    back: `${answerText(qq)}\n\n${qq.explanation}`,
                    bloom_level: qq.bloom_level,
                    tags: [qq.topic],
                  }));
                  const { error: cErr } = await supabase.from("flashcards").insert(cards);
                  if (cErr) throw cErr;
                  toast.success(`Created deck of ${wrong.length} cards`);
                  setDeckMade(true);
                } catch (e: any) {
                  toast.error(e.message ?? "Failed");
                } finally {
                  setMakingDeck(false);
                }
              }}
              disabled={makingDeck || deckMade}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 text-primary px-3 py-1.5 text-xs font-semibold hover:bg-primary/20 disabled:opacity-50"
            >
              {makingDeck ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Layers className="h-3.5 w-3.5" />}
              {deckMade ? "Deck created" : "Flashcards from wrong answers"}
            </button>
            <Link to="/tutor" className="inline-flex items-center gap-1.5 rounded-xl border-2 border-border px-3 py-1.5 text-xs font-semibold hover:border-primary/40">
              <MessagesSquare className="h-3.5 w-3.5" /> Ask the tutor
            </Link>
          </div>
        </div>
      </motion.div>

      {bloomData.length > 0 && (
        <section data-tour-results-bloom>
          <h2 className="font-display text-base font-semibold mb-3">Bloom level breakdown</h2>
          <div className="card-chunky bg-card p-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bloomData}>
                {/* Themed off the CSS variables so this tracks light/dark and
                    the CEG palette instead of hard-coded navy from before. */}
                <XAxis dataKey="level" stroke="var(--muted-foreground)" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} stroke="var(--muted-foreground)" tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    color: "var(--popover-foreground)",
                    border: "2px solid var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                />
                <Bar dataKey="score" fill="var(--primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <section>
        <h2 className="font-display text-base font-semibold mb-3">Review every question</h2>
        <ul className="space-y-3">
          {questions.map((q, i) => {
            const got = userAnswers[i];
            const right = isRightAns(q, got);
            return (
              <li key={i} className={`rounded-xl border p-4 ${right ? "border-success/30 bg-success/5" : "border-destructive/40 bg-destructive/5"}`}>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium leading-relaxed">{i + 1}. {q.question}</p>
                  <span className="shrink-0 text-[11px] uppercase tracking-wider text-muted-foreground">L{q.bloom_level}</span>
                </div>
                {(q.qtype ?? "mcq") === "fill_blank" ? (
                  <div className="mt-2 grid gap-1 text-xs">
                    <div className="flex gap-2 rounded px-2 py-1 text-success">
                      <span>Answer: {q.answer}</span>
                      <span className="ml-auto">✓ correct</span>
                    </div>
                    {!right && (
                      <div className="flex gap-2 rounded px-2 py-1 text-destructive">
                        <span>You wrote: {got || "—"}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-2 grid gap-1 text-xs">
                    {(["A","B","C","D"] as const)
                      .filter((l) => q.options?.[l] != null)
                      .map((l) => {
                        const isCorrect = l === q.correct;
                        const isPicked = l === got;
                        return (
                          <div key={l} className={`flex gap-2 px-2 py-1 rounded ${isCorrect ? "text-success" : isPicked ? "text-destructive" : "text-muted-foreground"}`}>
                            <span className="font-mono">{l}.</span>
                            <span>{q.options?.[l]}</span>
                            {isCorrect && <span className="ml-auto">✓ correct</span>}
                            {isPicked && !isCorrect && <span className="ml-auto">your pick</span>}
                          </div>
                        );
                      })}
                  </div>
                )}
                <p className="mt-2 text-xs text-muted-foreground italic">{q.explanation}</p>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
