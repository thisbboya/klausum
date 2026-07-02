import { useState } from "react";
import { UnitConverter } from "./calc/UnitConverter";
import { OhmsLaw } from "./calc/OhmsLaw";
import { ResistorDecoder } from "./calc/ResistorDecoder";
import { LogicGates } from "./calc/LogicGates";
import { StatsCalc } from "./calc/StatsCalc";
import { MatrixCalc } from "./calc/MatrixCalc";
import { BeamDeflection } from "./calc/BeamDeflection";
import { IdealGas } from "./calc/IdealGas";
import { Bernoulli } from "./calc/Bernoulli";
import { TimeConstant } from "./calc/TimeConstant";
import { SnrCalc } from "./calc/SnrCalc";
import { StressStrain } from "./calc/StressStrain";

const TABS = [
  { id: "units", label: "Units", C: UnitConverter },
  { id: "ohm", label: "Ohm's law", C: OhmsLaw },
  { id: "resistor", label: "Resistor", C: ResistorDecoder },
  { id: "logic", label: "Logic gates", C: LogicGates },
  { id: "stats", label: "Statistics", C: StatsCalc },
  { id: "matrix", label: "Matrix", C: MatrixCalc },
  { id: "beam", label: "Beam deflection", C: BeamDeflection },
  { id: "gas", label: "Ideal gas", C: IdealGas },
  { id: "bern", label: "Bernoulli", C: Bernoulli },
  { id: "tau", label: "RC / RL / RLC", C: TimeConstant },
  { id: "snr", label: "SNR", C: SnrCalc },
  { id: "ss", label: "Stress-Strain", C: StressStrain },
];

export function EngineeringCalculators() {
  const [tab, setTab] = useState("units");
  const Active = TABS.find((t) => t.id === tab)!.C;
  return (
    <section className="rounded-xl border border-border/60 bg-card/60 p-4 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-sm font-semibold">Engineering calculators</h2>
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${tab === t.id ? "bg-primary text-primary-foreground" : "border border-border bg-background hover:bg-muted"}`}>{t.label}</button>
          ))}
        </div>
      </div>
      <div><Active /></div>
    </section>
  );
}
