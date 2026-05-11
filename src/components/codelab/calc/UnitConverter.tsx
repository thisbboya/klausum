import { useState } from "react";

const CATEGORIES: Record<string, { units: Record<string, number>; toBase?: (v: number, u: string) => number; fromBase?: (v: number, u: string) => number }> = {
  Length: { units: { mm: 0.001, cm: 0.01, m: 1, km: 1000, in: 0.0254, ft: 0.3048, yd: 0.9144, mi: 1609.344 } },
  Mass: { units: { mg: 1e-6, g: 0.001, kg: 1, t: 1000, oz: 0.0283495, lb: 0.453592 } },
  Time: { units: { ms: 0.001, s: 1, min: 60, h: 3600, day: 86400, week: 604800 } },
  Volume: { units: { ml: 0.001, l: 1, "m³": 1000, gal: 3.78541, cup: 0.236588, "fl oz": 0.0295735 } },
  Pressure: { units: { Pa: 1, kPa: 1000, MPa: 1e6, bar: 1e5, atm: 101325, psi: 6894.76 } },
  Energy: { units: { J: 1, kJ: 1000, cal: 4.184, kcal: 4184, Wh: 3600, kWh: 3.6e6, eV: 1.602e-19 } },
  Data: { units: { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 } },
  Temperature: {
    units: { C: 1, F: 1, K: 1 },
    toBase: (v, u) => (u === "C" ? v : u === "F" ? ((v - 32) * 5) / 9 : v - 273.15),
    fromBase: (v, u) => (u === "C" ? v : u === "F" ? (v * 9) / 5 + 32 : v + 273.15),
  },
};

export function UnitConverter() {
  const [cat, setCat] = useState("Length");
  const [from, setFrom] = useState("m");
  const [to, setTo] = useState("ft");
  const [val, setVal] = useState("1");

  const c = CATEGORIES[cat];
  const units = Object.keys(c.units);
  const v = parseFloat(val);
  let result = "";
  if (!isNaN(v)) {
    if (c.toBase && c.fromBase) result = c.fromBase(c.toBase(v, from), to).toFixed(6).replace(/\.?0+$/, "");
    else result = ((v * c.units[from]) / c.units[to]).toPrecision(8).replace(/\.?0+$/, "");
  }

  function pickCat(name: string) {
    setCat(name);
    const u = Object.keys(CATEGORIES[name].units);
    setFrom(u[0]);
    setTo(u[1] ?? u[0]);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {Object.keys(CATEGORIES).map((k) => (
          <button key={k} onClick={() => pickCat(k)} className={`rounded-full px-3 py-1 text-xs font-medium transition ${cat === k ? "bg-primary text-primary-foreground" : "border border-border bg-background hover:bg-muted"}`}>{k}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs uppercase text-muted-foreground">From</label>
          <input value={val} onChange={(e) => setVal(e.target.value)} type="number" className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono" />
          <select value={from} onChange={(e) => setFrom(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
            {units.map((u) => <option key={u}>{u}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs uppercase text-muted-foreground">To</label>
          <div className="w-full rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 font-mono text-primary truncate">{result || "—"}</div>
          <select value={to} onChange={(e) => setTo(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
            {units.map((u) => <option key={u}>{u}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}
