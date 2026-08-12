// A quest, drawn as a path rather than a list.
//
// The steps are numbered and connected, and the locked ones stay visible with
// their titles readable — a padlock over a blank row tells you nothing, while
// a visible next step tells you what the work is for. Only the reward at the
// end is deliberately withheld from being reachable early.
import { useEffect, useRef } from "react";
import { Check, Lock, Trophy } from "lucide-react";
import confetti from "canvas-confetti";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { awardXp } from "@/lib/xp";
import { toast } from "@/lib/notify";
import { Sounds } from "@/lib/sounds";
import { reportError } from "@/lib/report-error";
import { questState, type Quest } from "@/lib/sim/quests";
import { crestById } from "@/lib/collectibles";

export function QuestTrack({
  quest,
  doneIds,
  ownedCrests,
  onSelectStep,
  activeChallengeId,
  onAwarded,
}: {
  quest: Quest;
  doneIds: Set<string>;
  ownedCrests: Set<string>;
  onSelectStep?: (simId: string) => void;
  activeChallengeId?: string | null;
  onAwarded?: () => void;
}) {
  const { user } = useAuth();
  const state = questState(quest, doneIds);
  const crest = crestById(quest.reward);

  // Granting happens here, once, the moment the last step is done and the
  // crest is not already owned. A ref guards against the double-invoke that a
  // re-render (or React strict mode) would otherwise cause.
  const grantingRef = useRef(false);
  useEffect(() => {
    if (!user || !state.complete || ownedCrests.has(quest.reward)) return;
    if (grantingRef.current) return;
    grantingRef.current = true;

    (async () => {
      try {
        const { error } = await supabase
          .from("user_collectibles")
          .insert({ user_id: user.id, item_id: quest.reward });
        // A duplicate simply means another tab got there first — not a failure.
        if (error && !`${error.message}`.toLowerCase().includes("duplicate")) throw error;

        await awardXp({
          userId: user.id,
          amount: quest.bonusXp,
          action: "quest_complete",
          description: quest.title,
        });

        Sounds.levelUp();
        confetti({ particleCount: 160, spread: 90, origin: { y: 0.6 } });
        toast.success(
          `${quest.emoji} ${quest.title} complete — ${crest?.name ?? "crest"} earned, +${quest.bonusXp} XP`,
        );
        onAwarded?.();
      } catch (e) {
        // The student finished the quest; a failed write must not pretend
        // otherwise, but it also must not be shown to them as an error.
        reportError("quest-award", e);
        grantingRef.current = false;
      }
    })();
  }, [user, state.complete, ownedCrests, quest, crest, onAwarded]);

  return (
    <div
      className={`card-chunky p-4 ${
        state.complete ? "border-success bg-success/8" : "bg-card"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none">{quest.emoji}</span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-base font-extrabold">{quest.title}</h3>
          <p className="text-xs font-semibold text-muted-foreground">{quest.tagline}</p>
        </div>
        <span className="shrink-0 text-xs font-extrabold tabular-nums text-muted-foreground">
          {state.doneCount}/{state.steps.length}
        </span>
      </div>

      <ol className="mt-3 space-y-1">
        {state.steps.map((s, i) => {
          const isActive = activeChallengeId === s.challenge.id;
          return (
            <li key={s.challenge.id}>
              <button
                onClick={() => s.unlocked && onSelectStep?.(s.challenge.simId)}
                disabled={!s.unlocked}
                className={`flex w-full items-center gap-2.5 rounded-xl border-2 px-2.5 py-2 text-left transition ${
                  s.done
                    ? "border-success/40 bg-success/10"
                    : isActive
                      ? "border-primary bg-primary/10"
                      : s.unlocked
                        ? "border-border hover:border-primary"
                        : "border-dashed border-border opacity-55"
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold ${
                    s.done
                      ? "bg-success text-success-foreground"
                      : s.unlocked
                        ? "bg-primary/20 text-primary"
                        : "bg-surface-2 text-muted-foreground"
                  }`}
                >
                  {s.done ? <Check className="h-3.5 w-3.5" /> : s.unlocked ? i + 1 : <Lock className="h-3 w-3" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-extrabold">
                    {s.challenge.title}
                  </span>
                  {!s.done && s.unlocked && (
                    <span className="block truncate text-[11px] font-semibold text-muted-foreground">
                      {s.challenge.brief}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-[10px] font-extrabold text-muted-foreground">
                  +{s.challenge.xp}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div
        className={`mt-3 flex items-center gap-2 rounded-xl border-2 px-3 py-2 ${
          state.complete
            ? "border-success/50 bg-success/12"
            : "border-dashed border-border"
        }`}
      >
        {state.complete ? (
          <Trophy className="h-4 w-4 shrink-0 text-success" />
        ) : (
          <span className="text-base leading-none opacity-40">{crest?.emoji ?? "🏅"}</span>
        )}
        <span className="min-w-0 flex-1 text-[11px] font-extrabold">
          {state.complete
            ? `${crest?.name ?? "Crest"} earned — wear it from your Collection`
            : `Finish for ${crest?.name ?? "a crest"} + ${quest.bonusXp} XP`}
        </span>
      </div>
    </div>
  );
}
