// The Lab: every simulation, browsable by subject.
//
// Deliberately a place you can wander into without a lesson attached. Chou's
// point about empowerment applies here too — an experiment you chose to run
// teaches more than one you were marched through.
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FlaskConical } from "lucide-react";
import { SIMULATIONS, SUBJECT_LABEL } from "@/lib/sim/registry";
import { SimulationPlayer } from "@/components/sim/SimulationPlayer";

export const Route = createFileRoute("/_authenticated/lab")({ component: Lab });

function Lab() {
  const [activeId, setActiveId] = useState(SIMULATIONS[0]?.id ?? "");
  const active = SIMULATIONS.find((s) => s.id === activeId) ?? SIMULATIONS[0];

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
        {SIMULATIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveId(s.id)}
            className={`rounded-full border-2 px-3.5 py-1.5 text-xs font-extrabold transition ${
              s.id === activeId
                ? "border-primary bg-primary/12 text-primary"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {SUBJECT_LABEL[s.subject]} · {s.title.split("—")[0].trim()}
          </button>
        ))}
      </div>

      {active && <SimulationPlayer model={active} height={340} />}
    </div>
  );
}
