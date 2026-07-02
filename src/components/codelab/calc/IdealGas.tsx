import { useState } from "react";

const R = 8.314; // J/(mol·K)

export function IdealGas() {
  const [P, setP] = useState(""); // Pa
  const [V, setV] = useState(""); // m^3
  const [n, setN] = useState(""); // mol
  const [T, setT] = useState(""); // K

  const vals = { P: parseFloat(P), V: parseFloat(V), n: parseFloat(n), T: parseFloat(T) };
  const missing = Object.entries(vals).filter(([, v]) => isNaN(v) || v <= 0);
  let solved: { key: string; value: number } | null = null;
  if (missing.length === 1) {
    const [key] = missing[0];
    if (key === "P") solved = { key, value: (vals.n * R * vals.T) / vals.V };
    else if (key === "V") solved = { key, value: (vals.n * R * vals.T) / vals.P };
    else if (key === "n") solved = { key, value: (vals.P * vals.V) / (R * vals.T) };
    else if (key === "T") solved = { key, value: (vals.P * vals.V) / (vals.n * R) };
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Leave one field blank to solve for it. PV = nRT (SI units: Pa, m³, mol, K).
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Field label="P (Pa)" v={P} setV={setP} />
        <Field label="V (m³)" v={V} setV={setV} />
        <Field label="n (mol)" v={n} setV={setN} />
        <Field label="T (K)" v={T} setV={setT} />
      </div>
      <div className="rounded-xl border-2 border-primary/40 bg-primary/10 p-3">
        {solved ? (
          <>
            <div className="text-[10px] uppercase text-muted-foreground">Solved: {solved.key}</div>
            <div className="font-mono text-lg text-primary">{solved.value.toPrecision(6)}</div>
          </>
        ) : (
          <div className="text-xs text-muted-foreground">
            {missing.length === 0
              ? "All filled — clear one field to solve for it."
              : `Fill three values (${missing.length} missing).`}
          </div>
        )}
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
