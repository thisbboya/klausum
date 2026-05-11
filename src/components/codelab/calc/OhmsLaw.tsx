import { useState } from "react";

export function OhmsLaw() {
  const [V, setV] = useState("");
  const [I, setI] = useState("");
  const [R, setR] = useState("");
  const [P, setP] = useState("");

  function compute() {
    const v = parseFloat(V);
    const i = parseFloat(I);
    const r = parseFloat(R);
    const p = parseFloat(P);
    let nv = NaN, ni = NaN, nr = NaN, np = NaN;
    if (!isNaN(v) && !isNaN(i)) { nv = v; ni = i; nr = v / i; np = v * i; }
    else if (!isNaN(v) && !isNaN(r)) { nv = v; nr = r; ni = v / r; np = (v * v) / r; }
    else if (!isNaN(v) && !isNaN(p)) { nv = v; np = p; ni = p / v; nr = (v * v) / p; }
    else if (!isNaN(i) && !isNaN(r)) { ni = i; nr = r; nv = i * r; np = i * i * r; }
    else if (!isNaN(i) && !isNaN(p)) { ni = i; np = p; nv = p / i; nr = p / (i * i); }
    else if (!isNaN(r) && !isNaN(p)) { nr = r; np = p; ni = Math.sqrt(p / r); nv = Math.sqrt(p * r); }
    return { nv, ni, nr, np };
  }
  const { nv, ni, nr, np } = compute();
  const fmt = (x: number) => isNaN(x) ? "—" : Number(x.toPrecision(6)).toString();
  const filled = [V, I, R, P].filter(Boolean).length;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Enter any 2 of V, I, R, P. The other two solve from V=IR and P=VI.</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Field label="Voltage (V)" value={V} onChange={setV} computed={fmt(nv)} unit="V" />
        <Field label="Current (I)" value={I} onChange={setI} computed={fmt(ni)} unit="A" />
        <Field label="Resistance (R)" value={R} onChange={setR} computed={fmt(nr)} unit="Ω" />
        <Field label="Power (P)" value={P} onChange={setP} computed={fmt(np)} unit="W" />
      </div>
      {filled >= 2 && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs font-mono text-primary">
          V = {fmt(nv)} V · I = {fmt(ni)} A · R = {fmt(nr)} Ω · P = {fmt(np)} W
        </div>
      )}
      <button onClick={() => { setV(""); setI(""); setR(""); setP(""); }} className="text-xs text-muted-foreground underline">Reset</button>
    </div>
  );
}

function Field({ label, value, onChange, computed, unit }: { label: string; value: string; onChange: (v: string) => void; computed: string; unit: string }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} type="number" placeholder={computed} className="w-full rounded-lg border border-border bg-background px-2 py-1.5 font-mono text-sm" />
      <div className="text-[10px] text-muted-foreground font-mono">= {computed} {unit}</div>
    </div>
  );
}
