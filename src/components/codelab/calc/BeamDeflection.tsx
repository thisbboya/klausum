import { useState } from "react";

export function BeamDeflection() {
  const [w, setW] = useState("1000"); // N/m distributed load
  const [L, setL] = useState("3"); // m
  const [E, setE] = useState("200"); // GPa
  const [I, setI] = useState("8e6"); // mm^4
  const [support, setSupport] = useState<"simple" | "cantilever">("simple");

  const wVal = parseFloat(w);
  const LVal = parseFloat(L);
  const EVal = parseFloat(E) * 1e9; // Pa
  const IVal = parseFloat(I) * 1e-12; // m^4

  let delta = NaN;
  if (![wVal, LVal, EVal, IVal].some((x) => isNaN(x) || x === 0)) {
    if (support === "simple") {
      // simply supported UDL: δ = 5wL^4 / (384 EI)
      delta = (5 * wVal * LVal ** 4) / (384 * EVal * IVal);
    } else {
      // cantilever UDL: δ = wL^4 / (8 EI)
      delta = (wVal * LVal ** 4) / (8 * EVal * IVal);
    }
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Field label="Distributed load w (N/m)" v={w} setV={setW} />
      <Field label="Length L (m)" v={L} setV={setL} />
      <Field label="Young's modulus E (GPa)" v={E} setV={setE} />
      <Field label="Second moment I (mm⁴)" v={I} setV={setI} />
      <div>
        <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Support</label>
        <select
          value={support}
          onChange={(e) => setSupport(e.target.value as any)}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="simple">Simply supported (UDL)</option>
          <option value="cantilever">Cantilever (UDL)</option>
        </select>
      </div>
      <div className="sm:col-span-2 rounded-xl border-2 border-primary/40 bg-primary/10 p-3">
        <div className="text-[10px] uppercase text-muted-foreground">Max deflection δ</div>
        <div className="font-mono text-lg text-primary">
          {isNaN(delta) ? "—" : `${(delta * 1000).toPrecision(5)} mm`}
        </div>
        <div className="text-[10px] text-muted-foreground mt-1">
          {support === "simple" ? "δ = 5wL⁴ / (384·E·I)" : "δ = wL⁴ / (8·E·I)"}
        </div>
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
