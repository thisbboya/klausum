// The Lab: every simulation, with the missions attached to it.
//
// Deliberately somewhere you can wander into without a lesson attached — an
// experiment you chose to run teaches more than one you were marched through —
// but never only a toy: each simulation carries missions, so curiosity has
// somewhere to go once the novelty of dragging things wears off.
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FlaskConical, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SIMULATIONS, SUBJECT_LABEL } from "@/lib/sim/registry";
import { challengesFor } from "@/lib/sim/challenges";
import { SimulationPlayer } from "@/components/sim/SimulationPlayer";
import { ChallengePanel } from "@/components/sim/ChallengePanel";
import { PhetEmbed } from "@/components/sim/PhetEmbed";
import { phetBySubject, type PhetSim } from "@/lib/sim/phet";
import { QUESTS, questState } from "@/lib/sim/quests";
import { QuestTrack } from "@/components/sim/QuestTrack";
import { useCollection } from "@/components/collection";

export const Route = createFileRoute("/_authenticated/lab")({ component: Lab });

function Lab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState(SIMULATIONS[0]?.id ?? "");
  const active = SIMULATIONS.find((s) => s.id === activeId) ?? SIMULATIONS[0];

  // Readouts arrive up to eight times a second from the player. They live in
  // state because the challenge panel is a React component, but the player
  // throttles them precisely so this doesn't thrash.
  const [readouts, setReadouts] = useState<Record<string, number>>({});
  const [phetSubject, setPhetSubject] = useState<PhetSim["subject"]>("physics");

  const { data: progress = [] } = useQuery({
    queryKey: ["sim-progress", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("sim_challenge_progress")
        .select("challenge_id, completed")
        .eq("user_id", user!.id);
      return data ?? [];
    },
  });
  const doneIds = new Set(progress.filter((p: any) => p.completed).map((p: any) => p.challenge_id));

  const missions = active ? challengesFor(active.id) : [];
  const doneHere = missions.filter((m) => doneIds.has(m.id)).length;

  const { data: crestRows = [] } = useCollection();
  const ownedCrests = new Set(crestRows.map((r) => r.item_id));

  // Quests come first and unfinished ones lead, because the whole point is to
  // give someone arriving with no plan an obvious next move.
  const questOrder = [...QUESTS].sort((a, b) => {
    const A = questState(a, doneIds), B = questState(b, doneIds);
    if (A.complete !== B.complete) return A.complete ? 1 : -1;
    return B.doneCount - A.doneCount;
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 font-display text-3xl font-extrabold">
          <FlaskConical className="h-7 w-7 text-primary" /> Lab
        </h1>
        <p className="text-sm font-semibold text-muted-foreground">
          Experiments you can actually run. Drag things, break things, see what happens.
        </p>
      </header>

      {/* Journeys, before the equipment. A rack of instruments is a menu;
          "you are two steps from being an Induction Engineer" is a reason to
          start one of them. */}
      <section>
        <h2 className="mb-3 font-display text-xl font-extrabold">Quests</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {questOrder.map((q) => (
            <QuestTrack
              key={q.id}
              quest={q}
              doneIds={doneIds}
              ownedCrests={ownedCrests}
              activeChallengeId={null}
              onSelectStep={(simId) => {
                setActiveId(simId);
                setReadouts({});
                // Jump to the bench so the chosen step is actually in view.
                document.getElementById("lab-bench")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              onAwarded={() => {
                qc.invalidateQueries({ queryKey: ["collectibles"] });
                qc.invalidateQueries({ queryKey: ["sim-progress"] });
              }}
            />
          ))}
        </div>
      </section>

      <div id="lab-bench" className="flex flex-wrap gap-2 scroll-mt-4">
        {SIMULATIONS.map((s) => {
          const total = challengesFor(s.id).length;
          const done = challengesFor(s.id).filter((c) => doneIds.has(c.id)).length;
          return (
            <button
              key={s.id}
              onClick={() => {
                setActiveId(s.id);
                setReadouts({});
              }}
              className={`inline-flex items-center gap-1.5 rounded-full border-2 px-3.5 py-1.5 text-xs font-extrabold transition ${
                s.id === activeId
                  ? "border-primary bg-primary/12 text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {SUBJECT_LABEL[s.subject]} · {s.title.split("—")[0].trim()}
              {total > 0 && (
                <span className={done === total ? "text-success" : "opacity-70"}>
                  {done}/{total}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {active && (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <SimulationPlayer model={active} height={340} onState={setReadouts} />

          <aside className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 font-display text-sm font-extrabold uppercase tracking-wide">
                <Trophy className="h-4 w-4 text-primary" /> Missions
              </h2>
              <span className="text-xs font-extrabold tabular-nums text-muted-foreground">
                {doneHere}/{missions.length}
              </span>
            </div>
            {missions.length === 0 ? (
              <p className="text-xs font-semibold text-muted-foreground">
                No missions for this one yet — explore it freely.
              </p>
            ) : (
              missions.map((c) => (
                <ChallengePanel
                  key={c.id}
                  challenge={c}
                  readouts={readouts}
                  alreadyDone={doneIds.has(c.id)}
                  onCompleted={() => qc.invalidateQueries({ queryKey: ["sim-progress"] })}
                />
              ))
            )}
          </aside>
        </div>
      )}

      {/* Breadth, clearly separated from the scored tier. These cannot report
          their state to us, so they cannot be missions — and saying so here is
          better than letting someone wonder why an hour of PhET earned them
          nothing. */}
      <section className="space-y-3 border-t-2 border-border pt-5">
        <div>
          <h2 className="font-display text-xl font-extrabold">Explore further</h2>
          <p className="text-sm font-semibold text-muted-foreground">
            Simulations from PhET. Nothing to score here — just things worth playing with.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {(["physics", "chemistry", "biology", "maths"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setPhetSubject(s)}
              className={`rounded-full border-2 px-3 py-1 text-xs font-extrabold capitalize transition ${
                phetSubject === s
                  ? "border-sky bg-sky/12 text-sky"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          {phetBySubject(phetSubject).map((p) => (
            <PhetEmbed key={p.id} sim={p} />
          ))}
        </div>
      </section>
    </div>
  );
}
