import { useState } from "react";

const g = 9.81;

export function Bernoulli() {
  const [rho, setRho] = useState("1000"); // water
  const [P1, setP1] = useState("101325");
  const [v1, setV1] = useState("2");
  const [h1, setH1] = useState("0");
  const [v2, setV2] = useState("6");
  const [h2, setH2] = useState("5");

  const nums = [rho, P1, v1, h1, v2, h2].map(parseFloat);
  const P2 = nums.some(isNaN)
    ? NaN
    : nums[1] + 0.5 * nums[0] * (nums[2] ** 2 - nums[4] ** 2) + nums[0] * g * (nums[3] - nums[5]);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Bernoulli: P + ½ρv² + ρgh = constant. Solve for P₂ given P₁, v₁, h₁, v₂, h₂.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Field label="ρ (kg/m³)" v={rho} setV={setRho} />
        <Field label="P₁ (Pa)" v={P1} setV={setP1} />
        <Field label="v₁ (m/s)" v={v1} setV={setV1} />
        <Field label="h₁ (m)" v={h1} setV={setH1} />
        <Field label="v₂ (m/s)" v={v2} setV={setV2} />
        <Field label="h₂ (m)" v={h2} setV={setH2} />
      </div>
      <div className="rounded-xl border-2 border-primary/40 bg-primary/10 p-3">
        <div className="text-[10px] uppercase text-muted-foreground">P₂</div>
        <div className="font-mono text-lg text-primary">
          {isNaN(P2) ? "—" : `${P2.toPrecision(6)} Pa`}
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
