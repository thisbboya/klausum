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

      <div className="flex flex-wrap gap-2">
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
    </div>
  );
}
