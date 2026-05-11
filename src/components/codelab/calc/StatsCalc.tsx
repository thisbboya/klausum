import { useState } from "react";

export function StatsCalc() {
  const [raw, setRaw] = useState("12, 15, 18, 22, 25, 27, 30, 31, 33, 40");
  const nums = raw.split(/[\s,]+/).map(Number).filter((n) => !isNaN(n));

  const stats = (() => {
    if (!nums.length) return null;
    const sorted = [...nums].sort((a, b) => a - b);
    const n = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);
    const mean = sum / n;
    const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
    const counts: Record<number, number> = {};
    sorted.forEach((v) => { counts[v] = (counts[v] ?? 0) + 1; });
    const maxC = Math.max(...Object.values(counts));
    const mode = maxC > 1 ? Object.entries(counts).filter(([, c]) => c === maxC).map(([v]) => v).join(", ") : "—";
    const variance = sorted.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
    const stdev = Math.sqrt(variance);
    const q1 = sorted[Math.floor(n * 0.25)];
    const q3 = sorted[Math.floor(n * 0.75)];
    return { n, sum, mean, median, mode, variance, stdev, q1, q3, min: sorted[0], max: sorted[n - 1], range: sorted[n - 1] - sorted[0] };
  })();

  const fmt = (x: number) => Number(x.toPrecision(6)).toString();

  return (
    <div className="space-y-3">
      <label className="text-xs uppercase text-muted-foreground">Numbers (comma or whitespace separated)</label>
      <textarea value={raw} onChange={(e) => setRaw(e.target.value)} className="w-full min-h-24 rounded-lg border border-border bg-background p-3 font-mono text-sm" />
      {stats ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <Metric label="Count" v={String(stats.n)} />
          <Metric label="Sum" v={fmt(stats.sum)} />
          <Metric label="Mean" v={fmt(stats.mean)} />
          <Metric label="Median" v={fmt(stats.median)} />
          <Metric label="Mode" v={stats.mode} />
          <Metric label="Range" v={fmt(stats.range)} />
          <Metric label="Variance" v={fmt(stats.variance)} />
          <Metric label="Std dev" v={fmt(stats.stdev)} />
          <Metric label="Min" v={fmt(stats.min)} />
          <Metric label="Q1" v={fmt(stats.q1)} />
          <Metric label="Q3" v={fmt(stats.q3)} />
          <Metric label="Max" v={fmt(stats.max)} />
        </div>
      ) : <p className="text-xs text-muted-foreground">Enter at least one number.</p>}
    </div>
  );
}

function Metric({ label, v }: { label: string; v: string }) {
  return (
    <div className="rounded-lg border border-border bg-card/40 p-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono font-semibold text-primary truncate" title={v}>{v}</div>
    </div>
  );
}
