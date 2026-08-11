// The mission that sits beside a simulation.
//
// It watches the readouts the player emits and decides, live, whether the
// objectives are met — so completion happens the instant the student achieves
// it, not when they press a "submit" button. That immediacy is the feedback
// half of empowerment: you find out you did it while your hand is still on the
// slider.
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Circle, Lightbulb, Target, Trophy } from "lucide-react";
import confetti from "canvas-confetti";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { awardXp } from "@/lib/xp";
import { toast } from "@/lib/notify";
import { Sounds } from "@/lib/sounds";
import { reportError } from "@/lib/report-error";
import { evaluate, type Challenge, type ObjectiveState } from "@/lib/sim/challenges";

export function ChallengePanel({
  challenge,
  readouts,
  alreadyDone,
  onCompleted,
}: {
  challenge: Challenge;
  /** Latest readouts from the player; changes many times a second. */
  readouts: Record<string, number>;
  alreadyDone?: boolean;
  onCompleted?: () => void;
}) {
  const { user } = useAuth();
  const [states, setStates] = useState<ObjectiveState[]>([]);
  const [done, setDone] = useState(!!alreadyDone);
  const [hintsShown, setHintsShown] = useState(0);

  const heldRef = useRef<Record<string, number>>({});
  const lastRef = useRef(performance.now());
  const doneRef = useRef(done);
  doneRef.current = done;
  const startedRef = useRef(performance.now());

  // Re-evaluating inside an effect keyed on readouts means the sustain timers
  // advance on the same cadence the player publishes at, rather than needing
  // a second clock that could drift away from it.
  useEffect(() => {
    const now = performance.now();
    const dt = Math.min(0.5, (now - lastRef.current) / 1000);
    lastRef.current = now;

    const res = evaluate(challenge, readouts, heldRef.current, dt);
    heldRef.current = res.held;
    setStates(res.states);

    if (res.complete && !doneRef.current) {
      doneRef.current = true;
      setDone(true);
      void complete((now - startedRef.current) / 1000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readouts, challenge]);

  // Reset when the mission changes, so a new brief starts from zero.
  useEffect(() => {
    heldRef.current = {};
    startedRef.current = performance.now();
    setDone(!!alreadyDone);
    setHintsShown(0);
  }, [challenge.id, alreadyDone]);

  async function complete(seconds: number) {
    Sounds.levelUp();
    confetti({ particleCount: 90, spread: 70, origin: { y: 0.7 } });
    toast.success(`${challenge.title} complete — +${challenge.xp} XP`);
    if (!user) return;
    try {
      await awardXp({
        userId: user.id,
        amount: challenge.xp,
        action: "sim_challenge",
        description: challenge.title,
      });
      await supabase.from("sim_challenge_progress").upsert(
        {
          user_id: user.id,
          challenge_id: challenge.id,
          sim_id: challenge.simId,
          completed: true,
          hints_used: hintsShown,
          best_seconds: Math.round(seconds),
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,challenge_id" },
      );
    } catch (e) {
      // The student did the work; a failed write must not take the win away.
      reportError("sim-challenge", e);
    }
    onCompleted?.();
  }

  const tone =
    challenge.difficulty === "hard"
      ? "text-destructive"
      : challenge.difficulty === "medium"
        ? "text-primary"
        : "text-success";

  return (
    <div className={`card-chunky p-4 ${done ? "border-success bg-success/8" : "bg-card"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {done ? (
              <Trophy className="h-4 w-4 shrink-0 text-success" />
            ) : (
              <Target className={`h-4 w-4 shrink-0 ${tone}`} />
            )}
            <h3 className="truncate font-display text-base font-extrabold">{challenge.title}</h3>
            <span className={`shrink-0 text-[10px] font-extrabold uppercase tracking-wide ${tone}`}>
              {challenge.difficulty}
            </span>
          </div>
          <p className="mt-1 text-xs font-semibold leading-relaxed text-muted-foreground">
            {challenge.brief}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-extrabold text-primary">
          +{challenge.xp} XP
        </span>
      </div>

      <ul className="mt-3 space-y-1.5">
        {states.map((s, i) => (
          <li key={i} className="flex items-center gap-2">
            {s.met ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
            ) : (
              <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <span className={`flex-1 text-xs font-bold ${s.met ? "text-success" : ""}`}>{s.label}</span>
            {!s.met && s.progress > 0 && (
              <span className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-2">
                <span
                  className="block h-full rounded-full bg-primary transition-[width]"
                  style={{ width: `${Math.round(s.progress * 100)}%` }}
                />
              </span>
            )}
          </li>
        ))}
      </ul>

      {!done && challenge.hints && challenge.hints.length > 0 && (
        <div className="mt-3">
          {challenge.hints.slice(0, hintsShown).map((h, i) => (
            <p key={i} className="mb-1 text-xs font-semibold text-muted-foreground">
              💡 {h}
            </p>
          ))}
          {hintsShown < challenge.hints.length && (
            // Hints escalate rather than jumping to the answer, and the count
            // is recorded — a three-hint solve and a no-hint solve should not
            // read as the same achievement later.
            <button
              onClick={() => setHintsShown((n) => n + 1)}
              className="inline-flex items-center gap-1 rounded-lg border-2 border-border px-2.5 py-1 text-[11px] font-extrabold transition hover:border-primary hover:text-primary"
            >
              <Lightbulb className="h-3 w-3" />
              {hintsShown === 0 ? "Stuck? Get a hint" : "Another hint"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
