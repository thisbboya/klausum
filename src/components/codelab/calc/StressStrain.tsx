import { useState } from "react";

export function StressStrain() {
  const [F, setF] = useState("5000"); // N
  const [A, setA] = useState("100"); // mm^2
  const [dL, setDL] = useState("0.5"); // mm
  const [L0, setL0] = useState("500"); // mm

  const stress = parseFloat(F) / (parseFloat(A) * 1e-6); // Pa
  const strain = parseFloat(dL) / parseFloat(L0);
  const E = strain > 0 ? stress / strain : NaN;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">σ = F/A, ε = ΔL/L₀, E = σ/ε (Young's modulus).</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Force F (N)" v={F} setV={setF} />
        <Field label="Area A (mm²)" v={A} setV={setA} />
        <Field label="Elongation ΔL (mm)" v={dL} setV={setDL} />
        <Field label="Original length L₀ (mm)" v={L0} setV={setL0} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Metric label="Stress σ" v={isNaN(stress) ? "—" : `${(stress / 1e6).toFixed(3)} MPa`} />
        <Metric label="Strain ε" v={isNaN(strain) ? "—" : strain.toPrecision(4)} />
        <Metric label="E (Young's)" v={isNaN(E) ? "—" : `${(E / 1e9).toFixed(2)} GPa`} />
      </div>
    </div>
  );
}

function Field({ label, v, setV }: { label: string; v: string; setV: (s: string) => void }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</label>
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm"
      />
    </div>
  );
}
function Metric({ label, v }: { label: string; v: string }) {
  return (
    <div className="rounded-xl border-2 border-primary/40 bg-primary/10 p-3">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="font-mono text-primary">{v}</div>
    </div>
  );
}
