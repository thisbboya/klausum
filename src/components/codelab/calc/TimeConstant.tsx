import { useState } from "react";

export function TimeConstant() {
  const [mode, setMode] = useState<"rc" | "rl" | "rlc">("rc");
  const [R, setR] = useState("1000");
  const [C, setC] = useState("1e-6");
  const [L, setL] = useState("0.01");

  const Rn = parseFloat(R);
  const Cn = parseFloat(C);
  const Ln = parseFloat(L);
  let tau = NaN;
  let f0 = NaN;
  let extra = "";
  if (mode === "rc" && !isNaN(Rn) && !isNaN(Cn)) {
    tau = Rn * Cn;
    f0 = 1 / (2 * Math.PI * tau);
    extra = "Cut-off f = 1/(2πRC)";
  } else if (mode === "rl" && !isNaN(Rn) && !isNaN(Ln)) {
    tau = Ln / Rn;
    f0 = 1 / (2 * Math.PI * tau);
    extra = "Cut-off f = R/(2πL)";
  } else if (mode === "rlc" && !isNaN(Rn) && !isNaN(Ln) && !isNaN(Cn)) {
    f0 = 1 / (2 * Math.PI * Math.sqrt(Ln * Cn));
    tau = (2 * Ln) / Rn;
    extra = "Resonance f = 1/(2π√LC), damping τ = 2L/R";
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {(["rc", "rl", "rlc"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              mode === m
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-background hover:bg-muted"
            }`}
          >
            {m.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Field label="R (Ω)" v={R} setV={setR} />
        {mode !== "rl" && <Field label="C (F)" v={C} setV={setC} />}
        {mode !== "rc" && <Field label="L (H)" v={L} setV={setL} />}
      </div>
      <div className="rounded-xl border-2 border-primary/40 bg-primary/10 p-3 space-y-1">
        <div>
          <span className="text-[10px] uppercase text-muted-foreground">τ (time constant): </span>
          <span className="font-mono text-primary">
            {isNaN(tau) ? "—" : `${tau.toPrecision(5)} s`}
          </span>
        </div>
        <div>
          <span className="text-[10px] uppercase text-muted-foreground">
            {mode === "rlc" ? "Resonant f₀" : "Cut-off f₀"}:{" "}
          </span>
          <span className="font-mono text-primary">
            {isNaN(f0) ? "—" : `${f0.toPrecision(5)} Hz`}
          </span>
        </div>
        <div className="text-[10px] text-muted-foreground">{extra}</div>
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
