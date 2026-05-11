import { useState } from "react";

const COLORS = [
  { name: "Black", hex: "#000", digit: 0, mult: 1, tol: null },
  { name: "Brown", hex: "#7b3f00", digit: 1, mult: 10, tol: 1 },
  { name: "Red", hex: "#d22", digit: 2, mult: 100, tol: 2 },
  { name: "Orange", hex: "#f80", digit: 3, mult: 1e3, tol: null },
  { name: "Yellow", hex: "#fd0", digit: 4, mult: 1e4, tol: null },
  { name: "Green", hex: "#0a4", digit: 5, mult: 1e5, tol: 0.5 },
  { name: "Blue", hex: "#06c", digit: 6, mult: 1e6, tol: 0.25 },
  { name: "Violet", hex: "#80c", digit: 7, mult: 1e7, tol: 0.1 },
  { name: "Grey", hex: "#888", digit: 8, mult: 1e8, tol: 0.05 },
  { name: "White", hex: "#fff", digit: 9, mult: 1e9, tol: null },
  { name: "Gold", hex: "#d4af37", digit: null, mult: 0.1, tol: 5 },
  { name: "Silver", hex: "#c0c0c0", digit: null, mult: 0.01, tol: 10 },
];

export function ResistorDecoder() {
  const [bands, setBands] = useState(4);
  const [b1, setB1] = useState(1); // brown
  const [b2, setB2] = useState(0); // black
  const [b3, setB3] = useState(0); // (5b: digit) (4b: mult)
  const [b4, setB4] = useState(2); // (5b: mult) (4b: tol)
  const [b5, setB5] = useState(10); // tol gold

  const digits = bands === 4
    ? [COLORS[b1].digit, COLORS[b2].digit].filter((d) => d !== null) as number[]
    : [COLORS[b1].digit, COLORS[b2].digit, COLORS[b3].digit].filter((d) => d !== null) as number[];
  const multBand = bands === 4 ? b3 : b4;
  const tolBand = bands === 4 ? b4 : b5;
  const value = digits.reduce((a, d) => a * 10 + d, 0) * COLORS[multBand].mult;
  const tol = COLORS[tolBand].tol;

  const formatted = value >= 1e6 ? `${(value / 1e6).toFixed(2)} MΩ` : value >= 1e3 ? `${(value / 1e3).toFixed(2)} kΩ` : `${value.toFixed(2)} Ω`;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button onClick={() => setBands(4)} className={`rounded-full px-3 py-1 text-xs font-medium ${bands === 4 ? "bg-primary text-primary-foreground" : "border border-border"}`}>4 bands</button>
        <button onClick={() => setBands(5)} className={`rounded-full px-3 py-1 text-xs font-medium ${bands === 5 ? "bg-primary text-primary-foreground" : "border border-border"}`}>5 bands</button>
      </div>

      {/* Visual resistor */}
      <div className="relative mx-auto h-16 w-full max-w-md rounded-lg bg-amber-200/80">
        <div className="absolute left-0 top-1/2 h-1 w-8 -translate-y-1/2 bg-zinc-400" />
        <div className="absolute right-0 top-1/2 h-1 w-8 -translate-y-1/2 bg-zinc-400" />
        <div className="absolute inset-y-2 left-12 right-12 flex items-center justify-around">
          {[b1, b2, ...(bands === 5 ? [b3] : []), multBand, tolBand].map((c, i) => (
            <div key={i} className="h-full w-3 rounded-sm border border-black/30" style={{ background: COLORS[c].hex }} />
          ))}
        </div>
      </div>

      <div className={`grid gap-2 ${bands === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-5"}`}>
        <BandPicker label="Band 1" value={b1} onChange={setB1} filter="digit" />
        <BandPicker label="Band 2" value={b2} onChange={setB2} filter="digit" />
        {bands === 5 && <BandPicker label="Band 3" value={b3} onChange={setB3} filter="digit" />}
        <BandPicker label="Multiplier" value={multBand} onChange={bands === 4 ? setB3 : setB4} filter="mult" />
        <BandPicker label="Tolerance" value={tolBand} onChange={bands === 4 ? setB4 : setB5} filter="tol" />
      </div>

      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-center">
        <div className="text-xs uppercase text-muted-foreground tracking-wide">Resistance</div>
        <div className="font-mono text-2xl font-bold text-primary">{formatted}</div>
        {tol !== null && <div className="text-xs text-muted-foreground mt-1">±{tol}%</div>}
      </div>
    </div>
  );
}

function BandPicker({ label, value, onChange, filter }: { label: string; value: number; onChange: (v: number) => void; filter: "digit" | "mult" | "tol" }) {
  const opts = COLORS.map((c, i) => ({ ...c, i })).filter((c) => filter === "digit" ? c.digit !== null : filter === "tol" ? c.tol !== null : true);
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</label>
      <select value={value} onChange={(e) => onChange(parseInt(e.target.value))} className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs">
        {opts.map((o) => <option key={o.i} value={o.i}>{o.name}</option>)}
      </select>
    </div>
  );
}
