// A live circuit you can build by hand, with current you can see moving.
//
// Falstad's simulator is the reference for this and it earns that reputation:
// the reason it teaches so well is not the numbers, it is that charge visibly
// crawls when resistance is high and races when it is low. A table of node
// voltages never produces that intuition.
//
// Falstad's own code is GPL-2, so bundling it would force Klausum to become
// GPL, and iframing it would put the simulation behind a wall the mission
// engine cannot see through — the same objection as PhET. This is built on the
// MNA solver already verified against analytic answers, so every number a
// student reads here is one the solver got right, and every value is available
// to a challenge.
import { useEffect, useMemo, useRef, useState } from "react";
import { Battery, Lightbulb, Plus, RotateCcw, Trash2, Zap } from "lucide-react";
import { parseNetlist, solve, magnitude } from "@/lib/sim/mna";

type Part = {
  id: string;
  kind: "V" | "R" | "L" | "C";
  value: number;
  label: string;
};

/**
 * Deliberately a single series loop rather than a free-form canvas.
 *
 * A blank schematic with wire-drawing is a tool for someone who already knows
 * circuits; a loop you add parts to is a toy for someone learning them, and it
 * cannot be wired into a state that does not solve. Every arrangement here is
 * a valid circuit by construction.
 */
const START: Part[] = [
  { id: "v", kind: "V", value: 9, label: "Battery" },
  { id: "r1", kind: "R", value: 100, label: "R1" },
  { id: "lamp", kind: "R", value: 220, label: "Lamp" },
];

const KIND_LABEL: Record<Part["kind"], string> = { V: "V", R: "Ω", L: "H", C: "F" };

export function LiveCircuit() {
  const [parts, setParts] = useState<Part[]>(START);
  const [selected, setSelected] = useState<string>("r1");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const phaseRef = useRef(0);

  // Series loop: node k joins part k to part k+1, and the last returns to 0.
  const netlist = useMemo(() => {
    const lines: string[] = [];
    parts.forEach((p, i) => {
      const a = i === 0 ? "n0" : `n${i}`;
      const b = i === parts.length - 1 ? "0" : `n${i + 1}`;
      // The source is written from ground up so the loop current comes out
      // positive, which is what a student expects to read.
      if (p.kind === "V") lines.push(`V1 ${b === "0" ? "n0" : b} 0 ${p.value}`);
      else lines.push(`${p.kind}${i} ${a} ${b} ${p.value}`);
    });
    return lines.join("\n");
  }, [parts]);

  const analysis = useMemo(() => {
    const net = parseNetlist(netlist);
    const dc = solve(net, 0);
    if (!dc) return null;
    const current = Math.abs(dc.currents.V1?.re ?? 0);
    const supply = parts.find((p) => p.kind === "V")?.value ?? 0;
    const totalR = parts.filter((p) => p.kind === "R").reduce((s, p) => s + p.value, 0);
    return { current, supply, totalR, power: supply * current };
  }, [netlist, parts]);

  // The animation loop. Dot speed is proportional to current, which is the
  // entire teaching point — you SEE a bigger resistor slow the charge down.
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    let raf = 0;
    let last = performance.now();
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { threshold: 0.05 });
    io.observe(wrap);

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!visible) return;
      phaseRef.current = (phaseRef.current + dt * (analysis?.current ?? 0) * 1.4) % 1;
      draw(canvas, wrap, parts, selected, analysis, phaseRef.current);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [parts, selected, analysis]);

  const sel = parts.find((p) => p.id === selected);

  function update(v: number) {
    setParts((ps) => ps.map((p) => (p.id === selected ? { ...p, value: v } : p)));
  }

  function addPart(kind: Part["kind"]) {
    const n = parts.filter((p) => p.kind === kind).length + 1;
    const id = `${kind.toLowerCase()}${Date.now().toString(36)}`;
    const value = kind === "R" ? 100 : kind === "C" ? 1e-6 : kind === "L" ? 1e-3 : 9;
    setParts((ps) => [...ps, { id, kind, value, label: `${kind}${n}` }]);
    setSelected(id);
  }

  return (
    <div className="space-y-3">
      <div ref={wrapRef} className="overflow-hidden rounded-2xl border-2 border-border bg-surface-2">
        <canvas ref={canvasRef} className="block w-full" style={{ height: 260 }} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border-2 border-border bg-card px-3 py-2">
          <div className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">Current</div>
          <div className="font-display text-lg font-extrabold tabular-nums">
            {((analysis?.current ?? 0) * 1000).toFixed(1)}
            <span className="ml-1 text-xs text-muted-foreground">mA</span>
          </div>
        </div>
        <div className="rounded-xl border-2 border-border bg-card px-3 py-2">
          <div className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">Total resistance</div>
          <div className="font-display text-lg font-extrabold tabular-nums">
            {(analysis?.totalR ?? 0).toFixed(0)}
            <span className="ml-1 text-xs text-muted-foreground">Ω</span>
          </div>
        </div>
        <div className="rounded-xl border-2 border-border bg-card px-3 py-2">
          <div className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">Power</div>
          <div className="font-display text-lg font-extrabold tabular-nums">
            {(analysis?.power ?? 0).toFixed(2)}
            <span className="ml-1 text-xs text-muted-foreground">W</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {parts.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelected(p.id)}
            className={`inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-xs font-extrabold transition ${
              p.id === selected ? "border-primary bg-primary/12 text-primary" : "border-border bg-card"
            }`}
          >
            {p.kind === "V" ? <Battery className="h-3 w-3" /> : <Zap className="h-3 w-3" />}
            {p.label}
          </button>
        ))}
        <button
          onClick={() => addPart("R")}
          className="inline-flex items-center gap-1 rounded-full border-2 border-dashed border-border px-3 py-1.5 text-xs font-extrabold text-muted-foreground transition hover:border-primary hover:text-primary"
        >
          <Plus className="h-3 w-3" /> Resistor
        </button>
        <button
          onClick={() => setParts(START)}
          className="ml-auto inline-flex items-center gap-1 rounded-full border-2 border-border px-3 py-1.5 text-xs font-extrabold text-muted-foreground transition hover:bg-surface-2"
        >
          <RotateCcw className="h-3 w-3" /> Reset
        </button>
      </div>

      {sel && (
        <div className="rounded-xl border-2 border-border bg-card p-3">
          <div className="mb-1 flex items-center justify-between text-xs font-extrabold">
            <span>{sel.label}</span>
            <span className="tabular-nums text-primary">
              {sel.kind === "C"
                ? `${(sel.value * 1e6).toFixed(2)} µF`
                : sel.kind === "L"
                  ? `${(sel.value * 1e3).toFixed(2)} mH`
                  : `${sel.value.toFixed(sel.kind === "V" ? 1 : 0)} ${KIND_LABEL[sel.kind]}`}
            </span>
          </div>
          <input
            type="range"
            min={sel.kind === "V" ? 1 : 1}
            max={sel.kind === "V" ? 24 : 1000}
            step={sel.kind === "V" ? 0.5 : 1}
            value={sel.value}
            onChange={(e) => update(Number(e.target.value))}
            className="klausum-range h-2 w-full cursor-pointer appearance-none rounded-full accent-primary"
          />
          {parts.length > 2 && sel.kind !== "V" && (
            <button
              onClick={() => {
                setParts((ps) => ps.filter((p) => p.id !== sel.id));
                setSelected(parts[0].id);
              }}
              className="mt-2 inline-flex items-center gap-1 rounded-lg border-2 border-border px-2 py-1 text-[11px] font-extrabold text-muted-foreground transition hover:border-destructive hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" /> Remove
            </button>
          )}
        </div>
      )}

      <p className="flex items-start gap-1.5 text-[11px] font-semibold leading-snug text-muted-foreground">
        <Lightbulb className="mt-0.5 h-3 w-3 shrink-0" />
        Drag a resistor up and watch the charge slow down. That is Ohm's law happening,
        not a formula about it — the dots are moving at the current the solver computed.
      </p>
    </div>
  );
}

/** Draw the loop, its parts, and the charge moving round it. */
function draw(
  canvas: HTMLCanvasElement,
  wrap: HTMLElement,
  parts: Part[],
  selected: string,
  analysis: { current: number; supply: number } | null,
  phase: number,
) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = wrap.clientWidth;
  const H = 260;
  if (canvas.width !== Math.round(W * dpr)) {
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const cs = getComputedStyle(wrap);
  const col = (n: string, f: string) => cs.getPropertyValue(n).trim() || f;
  const fg = col("--foreground", "#111");
  const border = col("--border", "#ccc");
  const primary = col("--primary", "#F4A300");
  const sky = col("--sky", "#3B82F6");
  const muted = col("--muted-foreground", "#777");

  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  const L = 40, R = W - 40, T = 40, B = H - 40;
  const perim = 2 * (R - L) + 2 * (B - T);

  // Position along the loop -> canvas point. Charge travels clockwise.
  const at = (d: number) => {
    let t = ((d % 1) + 1) % 1 * perim;
    if (t < R - L) return { x: L + t, y: T };
    t -= R - L;
    if (t < B - T) return { x: R, y: T + t };
    t -= B - T;
    if (t < R - L) return { x: R - t, y: B };
    t -= R - L;
    return { x: L, y: B - t };
  };

  ctx.strokeStyle = border;
  ctx.lineWidth = 3;
  ctx.strokeRect(L, T, R - L, B - T);

  // Parts are spaced evenly round the loop.
  parts.forEach((p, i) => {
    const d = (i + 0.5) / parts.length;
    const { x, y } = at(d);
    const isSel = p.id === selected;
    ctx.save();
    ctx.translate(x, y);

    if (p.kind === "V") {
      ctx.strokeStyle = fg;
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(-13, -14); ctx.lineTo(-13, 14); ctx.stroke();
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(0, 8); ctx.stroke();
    } else {
      // The classic zig-zag: unmistakable as a resistor at any size.
      ctx.strokeStyle = isSel ? primary : fg;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-22, 0);
      for (let k = 0; k < 6; k++) ctx.lineTo(-18 + k * 7, k % 2 === 0 ? -9 : 9);
      ctx.lineTo(22, 0);
      ctx.stroke();
    }

    if (isSel) {
      ctx.strokeStyle = primary;
      ctx.lineWidth = 2;
      ctx.strokeRect(-28, -20, 56, 40);
    }

    ctx.fillStyle = muted;
    ctx.font = "600 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(p.label, 0, -26);
    ctx.restore();
  });

  // Charge. Spacing is fixed and only the speed changes, so more current reads
  // as faster rather than as more crowded.
  const n = 26;
  ctx.fillStyle = sky;
  for (let k = 0; k < n; k++) {
    const { x, y } = at(k / n + phase);
    ctx.beginPath();
    ctx.arc(x, y, 3.4, 0, Math.PI * 2);
    ctx.fill();
  }

  if ((analysis?.current ?? 0) < 1e-6) {
    ctx.fillStyle = muted;
    ctx.font = "600 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("no current — the loop is open", W / 2, H / 2);
  }

  ctx.restore();
}
