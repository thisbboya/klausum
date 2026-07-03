import { useEffect, useRef, useState } from "react";

// Tiny safe expression evaluator supporting x and standard Math.* funcs.
function compile(expr: string): (x: number) => number {
  // Allow: digits, operators, parens, dot, comma, letters (for names), whitespace
  if (!/^[\sxXeEpiPI\d+\-*/^().,a-zA-Z_]+$/.test(expr)) throw new Error("Invalid characters");
  const src = expr.replace(/\^/g, "**");
  // Provide math shorthands
  const fn = new Function(
    "x",
    `with (Math) { return (${src}); }`,
  ) as (x: number) => number;
  return fn;
}

const COLORS = ["#60a5fa", "#f472b6", "#34d399", "#fbbf24", "#a78bfa"];

export function Grapher() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [exprs, setExprs] = useState<string[]>(["sin(x)", "x**2 / 5"]);
  const [xMin, setXMin] = useState(-10);
  const [xMax, setXMax] = useState(10);
  const [yMin, setYMin] = useState(-5);
  const [yMax, setYMax] = useState(5);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth, h = c.clientHeight;
    c.width = w * dpr; c.height = h * dpr;
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const px = (x: number) => ((x - xMin) / (xMax - xMin)) * w;
    const py = (y: number) => h - ((y - yMin) / (yMax - yMin)) * h;

    // grid
    ctx.strokeStyle = "rgba(148,163,184,0.15)";
    ctx.lineWidth = 1;
    for (let i = Math.ceil(xMin); i <= Math.floor(xMax); i++) {
      ctx.beginPath(); ctx.moveTo(px(i), 0); ctx.lineTo(px(i), h); ctx.stroke();
    }
    for (let i = Math.ceil(yMin); i <= Math.floor(yMax); i++) {
      ctx.beginPath(); ctx.moveTo(0, py(i)); ctx.lineTo(w, py(i)); ctx.stroke();
    }
    // axes
    ctx.strokeStyle = "rgba(148,163,184,0.6)";
    ctx.beginPath(); ctx.moveTo(0, py(0)); ctx.lineTo(w, py(0)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px(0), 0); ctx.lineTo(px(0), h); ctx.stroke();

    let err: string | null = null;
    exprs.forEach((expr, idx) => {
      if (!expr.trim()) return;
      let f: (x: number) => number;
      try { f = compile(expr); } catch (e: any) { err = `f${idx + 1}: ${e.message}`; return; }
      ctx.strokeStyle = COLORS[idx % COLORS.length];
      ctx.lineWidth = 2;
      ctx.beginPath();
      let started = false;
      const steps = 800;
      for (let i = 0; i <= steps; i++) {
        const x = xMin + (i / steps) * (xMax - xMin);
        let y: number;
        try { y = f(x); } catch { started = false; continue; }
        if (!isFinite(y)) { started = false; continue; }
        const X = px(x), Y = py(y);
        if (Y < -1e4 || Y > 1e4) { started = false; continue; }
        if (!started) { ctx.moveTo(X, Y); started = true; } else { ctx.lineTo(X, Y); }
      }
      ctx.stroke();
    });
    setError(err);
  }, [exprs, xMin, xMax, yMin, yMax]);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {exprs.map((e, i) => (
          <div key={i} className="flex gap-2 items-center">
            <span className="font-mono text-xs w-8" style={{ color: COLORS[i % COLORS.length] }}>f{i + 1}(x) =</span>
            <input
              value={e}
              onChange={(ev) => setExprs(exprs.map((v, j) => (j === i ? ev.target.value : v)))}
              className="flex-1 rounded border border-border bg-background px-2 py-1 font-mono text-sm"
              placeholder="e.g. sin(x) + cos(2*x)"
            />
            <button onClick={() => setExprs(exprs.filter((_, j) => j !== i))} className="text-xs text-muted-foreground hover:text-destructive">✕</button>
          </div>
        ))}
        <button onClick={() => setExprs([...exprs, ""])} className="text-xs text-primary hover:underline">+ Add function</button>
      </div>
      <div className="grid grid-cols-4 gap-2 text-xs">
        <label>x min <input type="number" value={xMin} onChange={(e) => setXMin(+e.target.value)} className="w-full rounded border border-border bg-background px-1 py-0.5" /></label>
        <label>x max <input type="number" value={xMax} onChange={(e) => setXMax(+e.target.value)} className="w-full rounded border border-border bg-background px-1 py-0.5" /></label>
        <label>y min <input type="number" value={yMin} onChange={(e) => setYMin(+e.target.value)} className="w-full rounded border border-border bg-background px-1 py-0.5" /></label>
        <label>y max <input type="number" value={yMax} onChange={(e) => setYMax(+e.target.value)} className="w-full rounded border border-border bg-background px-1 py-0.5" /></label>
      </div>
      <canvas ref={canvasRef} className="w-full h-80 rounded-lg border border-border bg-background" />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <p className="text-[11px] text-muted-foreground">Supports Math.* functions: sin, cos, tan, exp, log, sqrt, abs, PI, E. Use <code>**</code> or <code>^</code> for powers.</p>
    </div>
  );
}
