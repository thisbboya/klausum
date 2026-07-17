import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Trophy, RefreshCcw, MessagesSquare, Layers, Loader2 } from "lucide-react";
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { motion } from "framer-motion";

type Search = { attempt?: string };

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
    })();
  }, [id, attempt]);

  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!quiz || !att) return <div className="text-sm text-muted-foreground">No results.</div>;

  const pct = Math.round((att.score / att.total) * 100);
  const grade =
    pct >= 90 ? { label: "Distinction", color: "oklch(0.78 0.16 78)" } :
    pct >= 75 ? { label: "Credit", color: "oklch(0.7 0.18 145)" } :
    pct >= 60 ? { label: "Pass", color: "oklch(0.7 0.15 220)" } :
    { label: "Try Again", color: "oklch(0.65 0.22 25)" };

  const ringData = [{ name: "score", value: pct, fill: grade.color }];
  const bloomData = Object.entries((att.bloom_breakdown ?? {}) as Record<string, { right: number; total: number }>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([level, v]) => ({ level, score: Math.round((v.right / v.total) * 100) }));

  const questions = (quiz.questions ?? []) as any[];
  const userAnswers = (att.answers ?? {}) as Record<string, string>;

  return (
    <div className="space-y-8">
      <header className="text-center">
        <Trophy className="mx-auto h-10 w-10 text-primary" />
        <h1 className="font-display text-2xl font-bold mt-2">{quiz.title}</h1>
        <p className="text-sm text-muted-foreground">{quiz.subject} · {quiz.difficulty}</p>
      </header>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="grid gap-6 md:grid-cols-2 items-center card-chunky bg-card p-6"
      >
        <div className="relative h-56">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart cx="50%" cy="50%" innerRadius="65%" outerRadius="100%" data={ringData} startAngle={90} endAngle={-270}>
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <RadialBar background={{ fill: "oklch(0.25 0.02 260)" }} dataKey="value" cornerRadius={20} />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className="font-display text-5xl font-bold" style={{ color: grade.color }}>{pct}%</div>
            <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">{att.score} / {att.total}</div>
          </div>
        </div>
        <div>
          <div className="font-display text-3xl font-bold" style={{ color: grade.color }}>{grade.label}</div>
          <p className="mt-2 text-sm text-muted-foreground">
            {pct >= 75 ? "Strong work — keep this rhythm. We've still flagged any wrong answers as gaps." : "Mistakes are gold. Each wrong answer is now a knowledge gap to close."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/quizzes/$id/take" params={{ id }} search={{ timer: 0 }} className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 text-primary px-3 py-1.5 text-xs font-semibold hover:bg-primary/20">
              <RefreshCcw className="h-3.5 w-3.5" /> Retake
            </Link>
            <button
              onClick={async () => {
                if (!user) return;
                const wrong = questions.map((qq: any, i: number) => ({ qq, i })).filter(({ qq, i }) => userAnswers[i] !== qq.correct);
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
                    back: `${qq.correct}. ${qq.options[qq.correct]}\n\n${qq.explanation}`,
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
        <section>
          <h2 className="font-display text-base font-semibold mb-3">Bloom level breakdown</h2>
          <div className="card-chunky bg-card p-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bloomData}>
                <XAxis dataKey="level" stroke="oklch(0.6 0.02 260)" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} stroke="oklch(0.6 0.02 260)" tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ background: "oklch(0.18 0.02 260)", border: "1px solid oklch(0.3 0.02 260)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="score" fill="oklch(0.78 0.16 78)" radius={[6, 6, 0, 0]} />
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
            const right = got === q.correct;
            return (
              <li key={i} className={`rounded-xl border p-4 ${right ? "border-success/30 bg-success/5" : "border-destructive/40 bg-destructive/5"}`}>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium leading-relaxed">{i + 1}. {q.question}</p>
                  <span className="shrink-0 text-[11px] uppercase tracking-wider text-muted-foreground">L{q.bloom_level}</span>
                </div>
                <div className="mt-2 grid gap-1 text-xs">
                  {(["A","B","C","D"] as const).map((l) => {
                    const isCorrect = l === q.correct;
                    const isPicked = l === got;
                    return (
                      <div key={l} className={`flex gap-2 px-2 py-1 rounded ${isCorrect ? "text-success" : isPicked ? "text-destructive" : "text-muted-foreground"}`}>
                        <span className="font-mono">{l}.</span>
                        <span>{q.options[l]}</span>
                        {isCorrect && <span className="ml-auto">✓ correct</span>}
                        {isPicked && !isCorrect && <span className="ml-auto">your pick</span>}
                      </div>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-muted-foreground italic">{q.explanation}</p>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
