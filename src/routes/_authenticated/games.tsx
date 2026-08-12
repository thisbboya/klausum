import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { awardXp } from "@/lib/xp";
import { Sounds } from "@/lib/sounds";
import { toast } from "@/lib/notify";
import confetti from "canvas-confetti";
import { Gamepad2, Shuffle, Lightbulb, Timer, RotateCcw, Trophy, ArrowLeft, BookOpen } from "lucide-react";

export const Route = createFileRoute("/_authenticated/games")({ component: GamesPage });

type Concept = { id: string; concept: string; definition: string };
type Mode = "pick" | "match" | "guess";

/** Fisher–Yates — unbiased, unlike sort(() => Math.random() - 0.5). */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Save a run and shout about it only if it beat the previous best.
 *
 * The server decides whether it was a record, because the client's idea of the
 * old best is whatever it cached when the page loaded — which is stale the
 * moment you play twice.
 */
async function recordScore(game: string, score: number) {
  try {
    const { data } = await supabase.rpc("record_game_score", { _game: game, _score: score });
    const r = data as any;
    if (r?.best && r.previous > 0) {
      Sounds.streak();
      toast.success(`New personal best — ${score}, beating ${r.previous}`);
    }
  } catch {
    /* a lost score must never interrupt the game that earned it */
  }
}

/** Pull usable concept/definition pairs out of a material's stored key_concepts. */
function toConcepts(raw: unknown): Concept[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c: any, i: number) => ({
      id: c?.id ?? `c${i}`,
      concept: String(c?.concept ?? c?.term ?? c?.name ?? "").trim(),
      definition: String(c?.definition ?? c?.description ?? "").trim(),
    }))
    .filter((c) => c.concept.length > 1 && c.definition.length > 3);
}

function GamesPage() {
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>("pick");
  const [materialId, setMaterialId] = useState<string>("");

  const { data: materials = [], isLoading } = useQuery({
    queryKey: ["game_materials", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("study_materials")
        .select("id,title,subject,key_concepts")
        .order("created_at", { ascending: false })
        .limit(50);
      return (data ?? []).filter((m) => toConcepts(m.key_concepts).length >= 4);
    },
  });

  const { data: scores = [] } = useQuery({
    queryKey: ["game-scores", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("game_scores")
        .select("game, best_score, plays")
        .eq("user_id", user!.id);
      return data ?? [];
    },
  });
  const scoreFor = (g: string) => scores.find((s: any) => s.game === g);

  const selected = materials.find((m) => m.id === materialId);
  const concepts = useMemo(() => toConcepts(selected?.key_concepts), [selected]);

  function start(next: Mode) {
    if (!materialId) return toast.error("Pick a material first");
    if (concepts.length < 4) return toast.error("This material needs at least 4 key concepts");
    Sounds.nav();
    setMode(next);
  }

  if (mode !== "pick" && selected) {
    return (
      <div className="space-y-5">
        <button
          onClick={() => { Sounds.tap(); setMode("pick"); }}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All games
        </button>
        {mode === "match" ? (
          <MatchGame concepts={concepts} title={selected.title} userId={user!.id} />
        ) : (
          <GuessGame concepts={concepts} title={selected.title} userId={user!.id} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-extrabold flex items-center gap-2">
          <Gamepad2 className="h-7 w-7 text-primary" /> Games
        </h1>
        <p className="text-sm font-semibold text-muted-foreground">
          Retrieval practice, disguised as play — built from your own materials.
        </p>
      </header>

      {isLoading ? (
        <div className="text-sm font-semibold text-muted-foreground">Loading…</div>
      ) : materials.length === 0 ? (
        <div className="card-chunky border-dashed p-8 text-center">
          <BookOpen className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-bold text-muted-foreground">
            No materials with key concepts yet.
          </p>
          <p className="mx-auto mt-1 max-w-md text-xs font-semibold text-muted-foreground">
            Open a material once — Klausum reads it and compresses it into key concepts.
            Those concepts are what the games are built from.
          </p>
          <Link
            to="/materials"
            className="btn-3d mt-4 inline-flex rounded-2xl bg-primary px-4 py-2 text-sm font-extrabold text-primary-foreground"
          >
            Go to materials
          </Link>
        </div>
      ) : (
        <>
          <section>
            <h2 className="mb-2 text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
              1 · Pick a material
            </h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {materials.map((m) => {
                const n = toConcepts(m.key_concepts).length;
                const active = m.id === materialId;
                return (
                  <button
                    key={m.id}
                    onClick={() => { Sounds.tap(); setMaterialId(m.id); }}
                    className={`card-chunky flex items-center justify-between gap-3 p-3 text-left transition ${
                      active ? "border-primary bg-primary/10" : "bg-card hover:border-primary/50"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-display text-sm font-extrabold">{m.title}</span>
                      <span className="text-[11px] font-bold text-muted-foreground">{m.subject ?? "General"}</span>
                    </span>
                    <span className="shrink-0 rounded-full bg-surface-3 px-2 py-0.5 text-[10px] font-extrabold">
                      {n} concepts
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
              2 · Choose a game
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <GameCard
                icon={Shuffle}
                tint="bg-sky/15 text-sky"
                title="Matching"
                blurb="Pair every term with its definition against the clock."
                onClick={() => start("match")}
                best={scoreFor("matching")?.best_score}
                plays={scoreFor("matching")?.plays}
              />
              <GameCard
                icon={Lightbulb}
                tint="bg-amber/20 text-amber"
                title="Guess the Term"
                blurb="Read the definition, name the concept it describes."
                onClick={() => start("guess")}
                best={scoreFor("guess")?.best_score}
                plays={scoreFor("guess")?.plays}
              />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function GameCard({
  icon: Icon, tint, title, blurb, onClick, best, plays,
}: {
  icon: any; tint: string; title: string; blurb: string; onClick: () => void;
  best?: number; plays?: number;
}) {
  return (
    <button onClick={onClick} className="card-chunky card-chunky-hover flex items-center gap-3 bg-card p-4 text-left">
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${tint}`}>
        <Icon className="h-6 w-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-base font-extrabold">{title}</span>
        <span className="text-xs font-semibold text-muted-foreground">{blurb}</span>
        {/* A game with no record of your best run has nothing to beat, which
            is most of why this section read as two buttons rather than as
            somewhere worth coming back to. */}
        <span className="mt-1.5 flex items-center gap-2 text-[11px] font-extrabold">
          {best ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-primary">
              <Trophy className="h-3 w-3" /> Best {best}
            </span>
          ) : (
            <span className="text-muted-foreground">No score yet — set one</span>
          )}
          {!!plays && (
            <span className="text-muted-foreground">
              {plays} play{plays === 1 ? "" : "s"}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

/** Shared end-of-game panel. */
function Finished({
  score, total, seconds, onAgain, xp,
}: { score: number; total: number; seconds: number; onAgain: () => void; xp: number }) {
  return (
    <div className="card-chunky bg-card p-8 text-center">
      <Trophy className="mx-auto h-10 w-10 text-amber" />
      <h2 className="mt-3 font-display text-2xl font-extrabold">
        {score === total ? "Perfect!" : "Nice work!"}
      </h2>
      <p className="mt-1 text-sm font-bold text-muted-foreground">
        {score} / {total} correct · {seconds}s
      </p>
      <p className="mt-2 inline-flex rounded-full bg-primary/12 px-3 py-1 text-xs font-extrabold text-primary">
        +{xp} XP
      </p>
      <div className="mt-5 flex justify-center gap-2">
        <button
          onClick={onAgain}
          className="btn-3d inline-flex items-center gap-1.5 rounded-2xl bg-primary px-4 py-2.5 text-sm font-extrabold uppercase tracking-wide text-primary-foreground"
        >
          <RotateCcw className="h-4 w-4" /> Play again
        </button>
      </div>
    </div>
  );
}

/** Live elapsed-seconds counter, stops when `running` goes false. */
function useTimer(running: boolean) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);
  return [seconds, setSeconds] as const;
}

// ─── MATCHING ──────────────────────────────────────────────────────────────

const MATCH_SIZE = 5;

function MatchGame({ concepts, title, userId }: { concepts: Concept[]; title: string; userId: string }) {
  const [round, setRound] = useState(0);
  const pool = useMemo(() => shuffle(concepts).slice(0, MATCH_SIZE), [concepts, round]);
  const [terms, setTerms] = useState<Concept[]>([]);
  const [defs, setDefs] = useState<Concept[]>([]);
  const [pickedTerm, setPickedTerm] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [wrongId, setWrongId] = useState<string | null>(null);
  const [misses, setMisses] = useState(0);
  const done = matched.size === pool.length && pool.length > 0;
  const [seconds, setSeconds] = useTimer(!done);

  useEffect(() => {
    setTerms(shuffle(pool));
    setDefs(shuffle(pool));
    setMatched(new Set());
    setPickedTerm(null);
    setMisses(0);
    setSeconds(0);
  }, [pool, setSeconds]);

  const xp = Math.max(5, 20 - misses * 2);

  useEffect(() => {
    if (!done) return;
    Sounds.xpEarn();
    confetti({ particleCount: 70, spread: 70, origin: { y: 0.6 } });
    void awardXp({ userId, amount: xp, action: "game_matching", description: `Matching · ${title}` });
    // The score is what makes a rerun mean anything - beating your own number
    // is the only competition available in a single-player game.
    void recordScore("matching", xp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  function chooseDef(defId: string) {
    if (!pickedTerm || matched.has(defId)) return;
    if (pickedTerm === defId) {
      Sounds.correct();
      setMatched((m) => new Set(m).add(defId));
      setPickedTerm(null);
    } else {
      Sounds.wrong();
      setMisses((n) => n + 1);
      setWrongId(defId);
      setTimeout(() => setWrongId(null), 450);
      setPickedTerm(null);
    }
  }

  if (done) {
    return (
      <Finished
        score={pool.length}
        total={pool.length}
        seconds={seconds}
        xp={xp}
        onAgain={() => setRound((r) => r + 1)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-extrabold">Matching</h2>
          <p className="text-xs font-bold text-muted-foreground">{title}</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-extrabold">
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-3 px-2.5 py-1">
            <Timer className="h-3 w-3" /> {seconds}s
          </span>
          <span className="rounded-full bg-surface-3 px-2.5 py-1">
            {matched.size}/{pool.length}
          </span>
        </div>
      </div>

      <p className="text-xs font-semibold text-muted-foreground">
        Tap a term, then the definition that matches it.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          {terms.map((t) => {
            const isMatched = matched.has(t.id);
            const isPicked = pickedTerm === t.id;
            return (
              <button
                key={t.id}
                disabled={isMatched}
                onClick={() => { Sounds.tap(); setPickedTerm(t.id); }}
                className={`card-chunky w-full p-3 text-left text-sm font-extrabold transition ${
                  isMatched
                    ? "border-success/50 bg-success/10 text-success opacity-70"
                    : isPicked
                    ? "border-primary bg-primary/12 text-primary"
                    : "bg-card hover:border-primary/50"
                }`}
              >
                {t.concept}
              </button>
            );
          })}
        </div>
        <div className="space-y-2">
          {defs.map((d) => {
            const isMatched = matched.has(d.id);
            return (
              <button
                key={d.id}
                disabled={isMatched}
                onClick={() => chooseDef(d.id)}
                className={`card-chunky w-full p-3 text-left text-xs font-semibold transition ${
                  isMatched
                    ? "border-success/50 bg-success/10 text-success opacity-70"
                    : wrongId === d.id
                    ? "border-destructive bg-destructive/10"
                    : "bg-card hover:border-primary/50"
                }`}
              >
                {d.definition}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── GUESS THE TERM ────────────────────────────────────────────────────────

const GUESS_ROUNDS = 8;

function GuessGame({ concepts, title, userId }: { concepts: Concept[]; title: string; userId: string }) {
  const [round, setRound] = useState(0);
  const questions = useMemo(() => {
    const picked = shuffle(concepts).slice(0, Math.min(GUESS_ROUNDS, concepts.length));
    return picked.map((c) => {
      const distractors = shuffle(concepts.filter((x) => x.id !== c.id)).slice(0, 3);
      return { answer: c, options: shuffle([c, ...distractors]) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concepts, round]);

  const [idx, setIdx] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const finished = idx >= questions.length;
  const [seconds, setSeconds] = useTimer(!finished);
  const xp = score * 3;

  useEffect(() => {
    setIdx(0); setChosen(null); setScore(0); setSeconds(0);
  }, [questions, setSeconds]);

  useEffect(() => {
    if (!finished || questions.length === 0) return;
    Sounds.xpEarn();
    if (score === questions.length) confetti({ particleCount: 70, spread: 70, origin: { y: 0.6 } });
    void awardXp({ userId, amount: Math.max(5, xp), action: "game_guess", description: `Guess the Term · ${title}` });
    void recordScore("guess", Math.max(5, xp));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  if (finished) {
    return (
      <Finished
        score={score}
        total={questions.length}
        seconds={seconds}
        xp={Math.max(5, xp)}
        onAgain={() => setRound((r) => r + 1)}
      />
    );
  }

  const q = questions[idx];

  function choose(id: string) {
    if (chosen) return;
    setChosen(id);
    const right = id === q.answer.id;
    if (right) { Sounds.correct(); setScore((s) => s + 1); } else Sounds.wrong();
    setTimeout(() => { setChosen(null); setIdx((i) => i + 1); }, 900);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-extrabold">Guess the Term</h2>
          <p className="text-xs font-bold text-muted-foreground">{title}</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-extrabold">
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-3 px-2.5 py-1">
            <Timer className="h-3 w-3" /> {seconds}s
          </span>
          <span className="rounded-full bg-surface-3 px-2.5 py-1">
            {idx + 1}/{questions.length}
          </span>
        </div>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-surface-3">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${(idx / questions.length) * 100}%` }}
        />
      </div>

      <div className="card-chunky bg-card p-6">
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
          Which term does this describe?
        </p>
        <p className="mt-2 text-base font-bold leading-relaxed">{q.answer.definition}</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {q.options.map((o) => {
          const isAnswer = o.id === q.answer.id;
          const state = !chosen ? "idle" : isAnswer ? "right" : o.id === chosen ? "wrong" : "idle";
          return (
            <button
              key={o.id}
              onClick={() => choose(o.id)}
              disabled={!!chosen}
              className={`card-chunky p-3 text-left text-sm font-extrabold transition ${
                state === "right"
                  ? "border-success bg-success/12 text-success"
                  : state === "wrong"
                  ? "border-destructive bg-destructive/12 text-destructive"
                  : "bg-card hover:border-primary/50"
              }`}
            >
              {o.concept}
            </button>
          );
        })}
      </div>
    </div>
  );
}
