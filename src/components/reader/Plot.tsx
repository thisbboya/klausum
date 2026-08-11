// Renders a ```plot fenced block as an interactive graph.
//
// Mermaid covers "shape of an idea" diagrams. This covers the other half a
// tutor constantly needs: actual functions. "Show me a sine wave", "what does
// x squared look like", "plot velocity against time" — previously all of those
// came back as a paragraph describing a curve the student couldn't see.
//
// Block format (deliberately tiny, so the model gets it right every time):
//
//   ```plot
//   title: Comparing growth rates
//   domain: -5, 5
//   y = x^2
//   y = 2^x
//   ```
//
// Expressions are parsed by our own evaluator, never eval() — see mathexpr.ts.
import { useMemo, useState } from "react";
import { AlertTriangle, Minus, Plus, RotateCcw } from "lucide-react";
import { compileExpression, prettyExpression } from "@/lib/mathexpr";
// Recharts is heavy and most answers have no graph in them, so it only loads
// when a plot is actually on screen — the same rule Diagram.tsx follows. It is
// loaded without React.lazy so a stale chunk cannot take the page down with it.
import { usePlotCanvas } from "./use-plot-canvas";

const SERIES_COLORS = [
  "var(--primary)",
  "var(--sky)",
  "var(--success)",
  "var(--grape)",
];

export type PlotSpec = {
  title?: string;
  domain: [number, number];
  series: { label: string; fn: (x: number) => number; color: string }[];
};

/** Split the block into settings and expressions. Unknown keys are ignored. */
function parseSpec(code: string): PlotSpec {
  let title: string | undefined;
  let domain: [number, number] = [-10, 10];
  const series: PlotSpec["series"] = [];
  const errors: string[] = [];

  for (const rawLine of code.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith("//")) continue;

    const titleMatch = /^title\s*:\s*(.+)$/i.exec(line);
    if (titleMatch) {
      title = titleMatch[1].trim().slice(0, 120);
      continue;
    }

    const domainMatch = /^domain\s*:\s*(-?[\d.]+)\s*(?:,|to|\.\.)\s*(-?[\d.]+)$/i.exec(line);
    if (domainMatch) {
      const lo = Number(domainMatch[1]);
      const hi = Number(domainMatch[2]);
      if (Number.isFinite(lo) && Number.isFinite(hi) && hi > lo) domain = [lo, hi];
      continue;
    }

    // Anything else is treated as an expression. A single bad line must not
    // kill the whole graph — the other curves are still worth showing.
    try {
      series.push({
        label: prettyExpression(line),
        fn: compileExpression(line),
        color: SERIES_COLORS[series.length % SERIES_COLORS.length],
      });
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  if (!series.length) {
    throw new Error(errors[0] ?? "No expression to plot");
  }
  return { title, domain, series };
}

export function Plot({ code }: { code: string }) {
  const [zoom, setZoom] = useState(1);
  const PlotCanvas = usePlotCanvas();

  const parsed = useMemo(() => {
    try {
      return { spec: parseSpec(code), error: null as string | null };
    } catch (e) {
      return { spec: null, error: e instanceof Error ? e.message : "Could not read this plot" };
    }
  }, [code]);

  // Sampling happens here rather than in the canvas so zooming re-samples the
  // function instead of just stretching pixels — the curve stays smooth all
  // the way in, which is the whole point of an interactive graph.
  const data = useMemo(() => {
    if (!parsed.spec) return [];
    const [lo, hi] = parsed.spec.domain;
    const mid = (lo + hi) / 2;
    const half = ((hi - lo) / 2) / zoom;
    const from = mid - half;
    const to = mid + half;
    const STEPS = 240;
    const rows: Record<string, number | null>[] = [];
    for (let i = 0; i <= STEPS; i++) {
      const x = from + ((to - from) * i) / STEPS;
      const row: Record<string, number | null> = { x: Number(x.toFixed(4)) };
      parsed.spec.series.forEach((s, idx) => {
        const y = s.fn(x);
        // Asymptotes and out-of-domain points (1/x at 0, sqrt of a negative,
        // log of a negative) become gaps in the line rather than wild spikes.
        row[`s${idx}`] = Number.isFinite(y) ? Number(y.toFixed(4)) : null;
      });
      rows.push(row);
    }
    return rows;
  }, [parsed.spec, zoom]);

  if (parsed.error || !parsed.spec) {
    return (
      <div className="not-prose my-3 rounded-xl border-2 border-border bg-surface-2 p-3">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-extrabold text-muted-foreground">
          <AlertTriangle className="h-3.5 w-3.5" /> Graph couldn't be drawn
        </div>
        <pre className="overflow-x-auto text-xs leading-relaxed">{code}</pre>
      </div>
    );
  }

  const { title, series } = parsed.spec;

  return (
    <figure className="not-prose my-3 overflow-hidden rounded-xl border-2 border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b-2 border-border px-3 py-2">
        <div className="min-w-0">
          {title ? (
            <div className="truncate font-display text-sm font-extrabold">{title}</div>
          ) : null}
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            {series.map((s) => (
              <span
                key={s.label}
                className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: s.color }}
                />
                <span className="truncate">{s.label}</span>
              </span>
            ))}
          </div>
        </div>
        {/* Zoom is the one control worth having: it turns a static picture into
            something a student can actually interrogate near the origin. */}
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(20, z * 1.5))}
            title="Zoom in"
            className="rounded-lg border-2 border-border p-1 text-muted-foreground transition hover:bg-surface-2"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.2, z / 1.5))}
            title="Zoom out"
            className="rounded-lg border-2 border-border p-1 text-muted-foreground transition hover:bg-surface-2"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            title="Reset zoom"
            className="rounded-lg border-2 border-border p-1 text-muted-foreground transition hover:bg-surface-2"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {PlotCanvas ? (
        <PlotCanvas data={data} series={series} />
      ) : (
        <div className="h-56 animate-pulse bg-surface-2" />
      )}
    </figure>
  );
}
