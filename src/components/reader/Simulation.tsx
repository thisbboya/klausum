// Renders a ```sim fenced block as an interactive simulation: sliders the
// student drags, quantities that recompute live, and a chart that sweeps one
// parameter across its range.
//
// This is the difference between being shown a result and being able to ask
// "what if". A student can see that halving the supply frequency halves the
// synchronous speed, by doing it, in the same panel as the explanation.
//
// Block format:
//
//   ```sim
//   title: AC induction motor
//   param frequency: 10..60 = 50 Hz
//   param poles: 2..8 = 4
//   param load: 0..90 = 30 %
//   calc sync = 120 * frequency / poles | RPM
//   calc speed = sync * (1 - load/100) | RPM
//   calc slip = (sync - speed) / sync * 100 | %
//   chart: speed vs frequency
//   note: Slip is what creates torque — a motor at zero slip makes none.
//   ```
//
// Every expression goes through the same parser as plots: no eval, ever.
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, RotateCcw, SlidersHorizontal } from "lucide-react";
import { reportError } from "@/lib/report-error";
import { compileScoped } from "@/lib/mathexpr";

import { usePlotCanvas } from "./use-plot-canvas";

type Param = {
  name: string;
  label: string;
  min: number;
  max: number;
  value: number;
  unit: string;
};
type Calc = {
  name: string;
  label: string;
  unit: string;
  fn: (scope: Record<string, number>) => number;
};
type Spec = {
  title?: string;
  note?: string;
  params: Param[];
  calcs: Calc[];
  chart?: { of: string; vs: string };
};

const titleCase = (s: string) =>
  s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

function parseSpec(code: string): Spec {
  let title: string | undefined;
  let note: string | undefined;
  let chart: Spec["chart"];
  const params: Param[] = [];
  const calcs: Calc[] = [];

  for (const raw of code.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith("//")) continue;

    let m = /^title\s*:\s*(.+)$/i.exec(line);
    if (m) {
      title = m[1].trim().slice(0, 120);
      continue;
    }
    m = /^note\s*:\s*(.+)$/i.exec(line);
    if (m) {
      note = m[1].trim().slice(0, 400);
      continue;
    }
    // param name: min..max = default unit
    m = /^param\s+([a-z_][a-z0-9_]*)\s*:\s*(-?[\d.]+)\s*\.\.\s*(-?[\d.]+)\s*(?:=\s*(-?[\d.]+))?\s*(.*)$/i.exec(
      line,
    );
    if (m) {
      const min = Number(m[2]);
      const max = Number(m[3]);
      if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) continue;
      const def = m[4] != null ? Number(m[4]) : (min + max) / 2;
      params.push({
        name: m[1].toLowerCase(),
        label: titleCase(m[1]),
        min,
        max,
        value: Math.min(max, Math.max(min, Number.isFinite(def) ? def : min)),
        unit: (m[5] || "").trim().slice(0, 12),
      });
      continue;
    }
    // calc name = expression | unit
    m = /^calc\s+([a-z_][a-z0-9_]*)\s*=\s*([^|]+?)\s*(?:\|\s*(.*))?$/i.exec(line);
    if (m) {
      const name = m[1].toLowerCase();
      // A calc may reference the params and any calc declared before it, which
      // is what lets a spec build up (sync -> speed -> slip) without needing a
      // dependency graph or risking a cycle.
      const visible = [...params.map((p) => p.name), ...calcs.map((c) => c.name)];
      try {
        calcs.push({
          name,
          label: titleCase(m[1]),
          unit: (m[3] || "").trim().slice(0, 12),
          fn: compileScoped(m[2], visible),
        });
      } catch {
        /* a single bad line must not kill the whole simulation */
      }
      continue;
    }
    m = /^chart\s*:\s*([a-z_][a-z0-9_]*)\s+(?:vs|against)\s+([a-z_][a-z0-9_]*)$/i.exec(line);
    if (m) chart = { of: m[1].toLowerCase(), vs: m[2].toLowerCase() };
  }

  if (!params.length || !calcs.length) {
    throw new Error("A simulation needs at least one param and one calc");
  }
  return { title, note, params, calcs, chart };
}

/** Run the calc chain top to bottom, each seeing the results of the ones above. */
function runCalcs(spec: Spec, values: Record<string, number>) {
  const scope: Record<string, number> = { ...values };
  for (const c of spec.calcs) scope[c.name] = c.fn(scope);
  return scope;
}

const fmt = (n: number) => {
  if (!Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1000) return n.toFixed(0);
  if (a >= 10) return n.toFixed(1);
  if (a >= 1) return n.toFixed(2);
  return n.toFixed(3);
};

export function Simulation({ code }: { code: string }) {
  const parsed = useMemo(() => {
    try {
      return { spec: parseSpec(code), error: null as string | null };
    } catch (e) {
      return { spec: null, error: e instanceof Error ? e.message : "Bad simulation" };
    }
  }, [code]);

  // Loaded by hand rather than via Suspense: it re-renders when the chunk
  // arrives (otherwise the chart sat as a skeleton until the student moved a
  // slider) and it degrades to no chart if the chunk is missing, instead of
  // throwing and taking the whole page down with it.
  const PlotCanvas = usePlotCanvas();

  const [values, setValues] = useState<Record<string, number>>(() =>
    parsed.spec
      ? Object.fromEntries(parsed.spec.params.map((p) => [p.name, p.value]))
      : {},
  );

  const scope = useMemo(
    () => (parsed.spec ? runCalcs(parsed.spec, values) : {}),
    [parsed.spec, values],
  );

  // The chart sweeps one parameter across its full range while every other
  // slider stays where the student left it — so the curve is *their* scenario,
  // and it moves as they change the other controls.
  const chartData = useMemo(() => {
    const spec = parsed.spec;
    if (!spec?.chart) return [];
    const sweep = spec.params.find((p) => p.name === spec.chart!.vs);
    const target = spec.calcs.find((c) => c.name === spec.chart!.of);
    if (!sweep || !target) return [];
    const rows: Record<string, number | null>[] = [];
    for (let i = 0; i <= 60; i++) {
      const x = sweep.min + ((sweep.max - sweep.min) * i) / 60;
      const s = runCalcs(spec, { ...values, [sweep.name]: x });
      const y = s[target.name];
      rows.push({ x: Number(x.toFixed(3)), s0: Number.isFinite(y) ? Number(y.toFixed(4)) : null });
    }
    return rows;
  }, [parsed.spec, values]);

  // Never show a student our failure, and never dump the source that caused it.
  // The explanation around the simulation stands on its own; the detail goes to
  // the admin error log.
  useEffect(() => {
    if (parsed.error) reportError("sim-block", `${parsed.error}\n---\n${code.slice(0, 800)}`);
  }, [parsed.error, code]);

  if (parsed.error || !parsed.spec) return null;

  const spec = parsed.spec;
  const reset = () =>
    setValues(Object.fromEntries(spec.params.map((p) => [p.name, p.value])));

  return (
    <figure className="not-prose my-3 overflow-hidden rounded-xl border-2 border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b-2 border-border px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate font-display text-sm font-extrabold">
            {spec.title ?? "Try it yourself"}
          </span>
        </div>
        <button
          type="button"
          onClick={reset}
          title="Reset to starting values"
          className="shrink-0 rounded-lg border-2 border-border p-1 text-muted-foreground transition hover:bg-surface-2"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Readouts first: the numbers are the point, and on a phone they should
          be visible without scrolling past the controls. */}
      <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
        {spec.calcs.map((c) => (
          <div key={c.name} className="rounded-xl border-2 border-border bg-surface-2 px-3 py-2">
            <div className="truncate text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">
              {c.label}
            </div>
            <div className="font-display text-lg font-extrabold tabular-nums">
              {fmt(scope[c.name])}
              {c.unit ? (
                <span className="ml-1 text-xs font-bold text-muted-foreground">{c.unit}</span>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3 px-3 pb-3">
        {spec.params.map((p) => (
          <label key={p.name} className="block">
            <span className="mb-1 flex items-center justify-between text-xs font-extrabold">
              <span>{p.label}</span>
              <span className="tabular-nums text-primary">
                {fmt(values[p.name])}
                {p.unit ? <span className="ml-0.5 text-muted-foreground">{p.unit}</span> : null}
              </span>
            </span>
            <input
              type="range"
              min={p.min}
              max={p.max}
              step={(p.max - p.min) / 100}
              value={values[p.name]}
              onChange={(e) =>
                setValues((v) => ({ ...v, [p.name]: Number(e.target.value) }))
              }
              // accent-primary alone leaves the track to the browser, which is
              // why one slider could come out with a white bar in dark mode
              // while its neighbours looked right. The track is drawn here so
              // every slider matches regardless of engine.
              className="klausum-range h-2 w-full cursor-pointer appearance-none rounded-full accent-primary"
            />
          </label>
        ))}
      </div>

      {spec.chart && chartData.length > 0 && PlotCanvas && (
        <div className="border-t-2 border-border">
          <div className="px-3 pt-2 text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">
            {titleCase(spec.chart.of)} against {titleCase(spec.chart.vs)}
          </div>
          <PlotCanvas
            data={chartData}
            series={[{ label: titleCase(spec.chart.of), color: "var(--primary)" }]}
          />
        </div>
      )}

      {spec.note && (
        <figcaption className="border-t-2 border-border bg-surface-2 px-3 py-2 text-xs">
          {spec.note}
        </figcaption>
      )}
    </figure>
  );
}
