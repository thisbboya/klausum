// Runs a SimModel: the loop, the canvas, the controls, the readouts.
//
// Every simulation in the app goes through this one component, so improvements
// to the loop, the retina handling or the accessibility of the controls land
// everywhere at once rather than being reimplemented per topic.
import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { fmt, readColors, type SimModel } from "@/lib/sim/engine";

export function SimulationPlayer({
  model,
  /** Reported every frame so a challenge can watch the run. */
  onState,
  height = 320,
}: {
  model: SimModel;
  onState?: (readouts: Record<string, number>) => void;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const initialParams = useMemo(
    () => Object.fromEntries(model.params.map((p) => [p.key, p.value])),
    [model],
  );
  const [params, setParams] = useState<Record<string, number>>(initialParams);
  const [running, setRunning] = useState(model.animated !== false);
  const [readouts, setReadouts] = useState(() => model.readouts(model.init(initialParams), initialParams));

  // State lives in a ref, not in React state: it changes sixty times a second
  // and re-rendering the tree at that rate would drop frames for nothing —
  // the canvas is drawn imperatively anyway.
  const stateRef = useRef<any>(null);
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const runningRef = useRef(running);
  runningRef.current = running;
  const onStateRef = useRef(onState);
  onStateRef.current = onState;

  // Chart history, kept short — a rolling window reads better than a line that
  // compresses towards invisibility as the run goes on.
  const historyRef = useRef<number[]>([]);

  const reset = () => {
    stateRef.current = model.init(paramsRef.current);
    historyRef.current = [];
  };

  useEffect(() => {
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    if (!stateRef.current) reset();

    let raf = 0;
    let last = performance.now();
    // Only draw while on screen. A dashboard with five simulations should not
    // be running five physics loops for the four you cannot see.
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { threshold: 0.05 });
    io.observe(wrap);

    let lastReadoutPush = 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      // Real elapsed time, clamped: a tab restored after a minute must not
      // integrate sixty seconds of physics in a single step and explode.
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!visible) return;

      const p = paramsRef.current;
      if (runningRef.current && model.animated !== false) {
        stateRef.current = model.step(stateRef.current, p, dt);
      }

      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = wrap.clientWidth;
      const h = height;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);
      model.draw(stateRef.current, p, { ctx, width: w, height: h, colors: readColors(wrap) });
      ctx.restore();

      if (model.plot) {
        historyRef.current.push(model.plot.of(stateRef.current, p));
        if (historyRef.current.length > 240) historyRef.current.shift();
      }

      // Readouts are React state, so they are throttled to ~8Hz: a number
      // changing sixty times a second is unreadable anyway.
      if (now - lastReadoutPush > 120) {
        lastReadoutPush = now;
        const r = model.readouts(stateRef.current, p);
        setReadouts(r);
        onStateRef.current?.(Object.fromEntries(r.map((x) => [x.key, x.value])));
      }
    };

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [model, height]);

  // Pointer interaction — dragging the magnet, grabbing a point on a curve.
  const pointer = (type: "down" | "move" | "up") => (e: React.PointerEvent) => {
    if (!model.onPointer) return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    stateRef.current = model.onPointer(stateRef.current, paramsRef.current, {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      type,
      width: rect.width,
      height: rect.height,
    });
  };

  return (
    <figure className="not-prose my-3 overflow-hidden rounded-xl border-2 border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b-2 border-border px-3 py-2">
        <div className="min-w-0">
          <div className="truncate font-display text-sm font-extrabold">{model.title}</div>
          {model.blurb && (
            <div className="truncate text-[11px] font-semibold text-muted-foreground">{model.blurb}</div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {model.animated !== false && (
            <button
              onClick={() => setRunning((r) => !r)}
              title={running ? "Pause" : "Play"}
              className="rounded-lg border-2 border-border p-1.5 transition hover:bg-surface-2"
            >
              {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </button>
          )}
          <button
            onClick={() => {
              setParams(initialParams);
              reset();
            }}
            title="Reset"
            className="rounded-lg border-2 border-border p-1.5 transition hover:bg-surface-2"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div ref={wrapRef} className="relative w-full bg-surface-2/40">
        <canvas
          ref={canvasRef}
          className={model.onPointer ? "block touch-none cursor-grab active:cursor-grabbing" : "block"}
          onPointerDown={pointer("down")}
          onPointerMove={pointer("move")}
          onPointerUp={pointer("up")}
          onPointerLeave={pointer("up")}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
        {readouts.map((r) => (
          <div key={r.key} className="rounded-xl border-2 border-border bg-surface-2 px-2.5 py-1.5">
            <div className="truncate text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">
              {r.label}
            </div>
            <div className="font-display text-base font-extrabold tabular-nums">
              {fmt(r.value, r.precision)}
              {r.unit && <span className="ml-1 text-[11px] font-bold text-muted-foreground">{r.unit}</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2.5 px-3 pb-3">
        {model.params.map((p) => (
          <label key={p.key} className="block">
            <span className="mb-1 flex items-center justify-between text-xs font-extrabold">
              <span>{p.label}</span>
              <span className="tabular-nums text-primary">
                {fmt(params[p.key])}
                {p.unit && <span className="ml-0.5 text-muted-foreground">{p.unit}</span>}
              </span>
            </span>
            <input
              type="range"
              min={p.min}
              max={p.max}
              step={p.step ?? (p.max - p.min) / 100}
              value={params[p.key]}
              onChange={(e) => setParams((v) => ({ ...v, [p.key]: Number(e.target.value) }))}
              className="klausum-range h-2 w-full cursor-pointer appearance-none rounded-full accent-primary"
            />
          </label>
        ))}
      </div>
    </figure>
  );
}
