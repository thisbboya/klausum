// The Lab: every simulation, with the missions attached to it.
//
// Deliberately somewhere you can wander into without a lesson attached — an
// experiment you chose to run teaches more than one you were marched through —
// but never only a toy: each simulation carries missions, so curiosity has
// somewhere to go once the novelty of dragging things wears off.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FlaskConical, Trophy, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SIMULATIONS, SUBJECT_LABEL } from "@/lib/sim/registry";
import { challengesFor } from "@/lib/sim/challenges";
import { SimulationPlayer } from "@/components/sim/SimulationPlayer";
import { ChallengePanel } from "@/components/sim/ChallengePanel";
import { PhetEmbed } from "@/components/sim/PhetEmbed";
import { phetBySubject, type PhetSim } from "@/lib/sim/phet";
import { QUESTS, questState } from "@/lib/sim/quests";
import { parseScene, sceneToModel } from "@/lib/sim/scene";
import { toast } from "@/lib/notify";
import { reportError } from "@/lib/report-error";
import { CHALLENGES } from "@/lib/sim/challenges";
import { QuestTrack } from "@/components/sim/QuestTrack";
import { CircuitLab } from "@/components/sim/CircuitLab";
import { useCollection } from "@/components/collection";

export const Route = createFileRoute("/_authenticated/lab")({ component: Lab });

/** Every mission across every simulation — the denominator for the header. */
const CHALLENGE_TOTAL = CHALLENGES.length;

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
  const [view, setView] = useState<"quests" | "bench" | "mine" | "circuits" | "explore">("quests");

  // Simulations the student asked the tutor for and kept. This is how the Lab
  // covers topics nobody hand-built: the engine is already loaded, so each one
  // costs a few hundred bytes of stored text.
  const { data: mine = [] } = useQuery({
    queryKey: ["user-scenes", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_scenes")
        .select("id, title, code, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

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

  const doneTotal = CHALLENGE_TOTAL === 0 ? 0 : Math.round((doneIds.size / CHALLENGE_TOTAL) * 100);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-3xl font-extrabold">
            <FlaskConical className="h-7 w-7 text-primary" /> Lab
          </h1>
          <p className="text-sm font-semibold text-muted-foreground">
            Experiments you can actually run. Drag things, break things, see what happens.
          </p>
        </div>
        <span className="rounded-xl border-2 border-border bg-card px-3 py-1.5 text-xs font-extrabold tabular-nums">
          {doneIds.size}/{CHALLENGE_TOTAL} missions · {doneTotal}%
        </span>
      </header>

      {/* Three views instead of one column. The page used to stack five quest
          cards, a simulation, its missions and eighteen PhET tiles into a
          single scroll, so finding the thing you came for meant reading past
          everything you didn't. */}
      <div data-tour-lab-tabs className="flex gap-1 rounded-2xl border-2 border-border bg-surface-2 p-1">
        {(
          [
            ["quests", "Quests"],
            ["bench", "Bench"],
            ["mine", "Mine"],
            ["circuits", "Circuits"],
            ["explore", "Explore"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setView(k)}
            className={`flex-1 rounded-xl px-3 py-2 text-xs font-extrabold uppercase tracking-wide transition ${
              view === k ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "quests" && (
        <section>
          <div data-tour-lab-quest className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {questOrder.map((q) => (
            <QuestTrack
              key={q.id}
              quest={q}
              doneIds={doneIds}
              ownedCrests={ownedCrests}
              activeChallengeId={null}
              onSelectStep={(simId) => {
                // Picking a step takes you straight to the bench with that
                // simulation loaded, which is the whole reason to tap it.
                setActiveId(simId);
                setReadouts({});
                setView("bench");
              }}
              onAwarded={() => {
                qc.invalidateQueries({ queryKey: ["collectibles"] });
                qc.invalidateQueries({ queryKey: ["sim-progress"] });
              }}
            />
          ))}
          </div>
        </section>
      )}

      {view === "bench" && (
        <>
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
        </>
      )}

      {view === "mine" && (
        <section className="space-y-3">
          {mine.length === 0 ? (
            <div className="card-chunky border-dashed p-8 text-center">
              <p className="text-sm font-extrabold">No simulations of your own yet</p>
              <p className="mx-auto mt-1 max-w-md text-xs font-semibold text-muted-foreground">
                Ask the tutor for one — “simulate a pendulum”, “show me how a
                transformer works” — then tap <em>Save to my Lab</em> under the
                simulation it builds. It lands here.
              </p>
              <Link
                to="/tutor"
                className="btn-3d mt-4 inline-flex rounded-xl bg-primary px-4 py-2 text-sm font-extrabold text-primary-foreground"
              >
                Ask the tutor
              </Link>
            </div>
          ) : (
            mine.map((s: any) => <SavedScene key={s.id} row={s} onDeleted={() => qc.invalidateQueries({ queryKey: ["user-scenes"] })} />)
          )}
        </section>
      )}

      {/* Breadth, clearly separated from the scored tier. These cannot report
          their state to us, so they cannot be missions — and saying so here is
          better than letting someone wonder why an hour of PhET earned them
          nothing. */}
      {view === "circuits" && (
        <section className="space-y-3">
          <p className="text-sm font-semibold text-muted-foreground">
            A real circuit solver - the same Modified Nodal Analysis SPICE uses. DC
            operating points and full AC sweeps for R, L, C and sources.
          </p>
          <CircuitLab />
        </section>
      )}

      {view === "explore" && (
      <section className="space-y-3">
        <p className="text-sm font-semibold text-muted-foreground">
          Simulations from PhET. Nothing to score here — just things worth playing with.
        </p>

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
      )}
    </div>
  );
}

/**
 * One saved simulation. Parsed on render rather than stored parsed, so an
 * improvement to the scene engine reaches every scene a student already kept.
 */
function SavedScene({ row, onDeleted }: { row: any; onDeleted: () => void }) {
  const model = useMemo(() => {
    try {
      return sceneToModel(parseScene(row.code), `saved-${row.id}`);
    } catch {
      return null;
    }
  }, [row.code, row.id]);

  async function remove() {
    if (!confirm(`Remove "${row.title}" from your Lab?`)) return;
    const { error } = await supabase.from("user_scenes").delete().eq("id", row.id);
    if (error) toast.error(reportError("scene-delete", error));
    else onDeleted();
  }

  // A scene that no longer parses is our bug, not the student's; it is dropped
  // quietly rather than shown to them as a broken card.
  if (!model) return null;

  return (
    <div>
      <SimulationPlayer model={model} height={300} />
      <button
        onClick={() => void remove()}
        className="mt-1.5 inline-flex items-center gap-1.5 rounded-xl border-2 border-border px-3 py-1.5 text-xs font-extrabold text-muted-foreground transition hover:border-destructive hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" /> Remove
      </button>
    </div>
  );
}
