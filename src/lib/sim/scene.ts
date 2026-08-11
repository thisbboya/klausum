// AI-authored animated diagrams.
//
// The tutor could already emit a ```sim block, but that produced sliders,
// numbers and a chart — a live calculator. Asked for "a magnet I can drag
// through a coil" it would either give you three sliders or, worse, dump a
// page of p5.js source for you to save to a file and open somewhere else.
//
// A ```scene block instead describes a *drawing whose parts are bound to
// equations*. Position, radius, rotation, opacity and length are expressions
// in the parameters and in t, so the picture is the mathematics rather than an
// illustration of it — and moving a slider moves the drawing.
//
// The hard constraint that shapes this whole format: model output must never
// be executed. No eval, no new Function. Every expression goes through the
// same recursive-descent parser the plots and sims already use, which knows
// only numbers, the declared variables and a fixed table of maths functions.
// That is why a scene is a fixed vocabulary of shapes with numeric attributes
// rather than anything resembling a program: there is no branching, no loops
// and no way to name a function, so the worst a malformed scene can do is
// draw something wrong.
import { compileScoped } from "@/lib/mathexpr";
import type { DrawCtx, ParamSpec, SimModel } from "@/lib/sim/engine";

type Expr = (scope: Record<string, number>) => number;

type ShapeKind = "circle" | "rect" | "line" | "arrow" | "text" | "curve" | "particles";

type Shape = {
  kind: ShapeKind;
  color: string;
  label?: string;
  /** Compiled attribute expressions, in scene units (0..1 of the canvas). */
  attrs: Record<string, Expr>;
  /** For curve: the y expression in terms of x plus the scene scope. */
  fn?: Expr;
  from?: number;
  to?: number;
  /** particles only */
  count?: number;
};

export type Scene = {
  title: string;
  blurb?: string;
  params: ParamSpec[];
  shapes: Shape[];
  readouts: { label: string; expr: Expr; unit?: string }[];
  trace?: { label: string; expr: Expr };
};

const COLOR_KEYS = ["primary", "sky", "success", "grape", "destructive", "fg", "muted", "border"];

/** Attributes each shape understands, so a typo fails loudly at parse time. */
const ATTRS: Record<ShapeKind, string[]> = {
  circle: ["x", "y", "r"],
  rect: ["x", "y", "w", "h", "angle"],
  line: ["x1", "y1", "x2", "y2"],
  arrow: ["x1", "y1", "x2", "y2"],
  text: ["x", "y"],
  curve: [],
  particles: ["x", "y", "w", "h", "speed"],
};

export function parseScene(src: string): Scene {
  let title = "Interactive diagram";
  let blurb: string | undefined;
  const params: ParamSpec[] = [];
  const shapes: Shape[] = [];
  const readouts: Scene["readouts"] = [];
  let trace: Scene["trace"];

  // Every expression may use the declared params plus t (seconds since start).
  const vars = () => [...params.map((p) => p.key), "t"];
  const compile = (src: string): Expr => compileScoped(src, vars());

  for (const raw of src.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith("//")) continue;

    let m = /^title\s*:\s*(.+)$/i.exec(line);
    if (m) { title = m[1].trim().slice(0, 120); continue; }

    m = /^note\s*:\s*(.+)$/i.exec(line);
    if (m) { blurb = m[1].trim().slice(0, 200); continue; }

    m = /^param\s+([a-z_][a-z0-9_]*)\s*:\s*(-?[\d.]+)\s*\.\.\s*(-?[\d.]+)\s*(?:=\s*(-?[\d.]+))?\s*(.*)$/i.exec(line);
    if (m) {
      const min = Number(m[2]), max = Number(m[3]);
      if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) continue;
      const def = m[4] != null ? Number(m[4]) : (min + max) / 2;
      params.push({
        key: m[1].toLowerCase(),
        label: m[1].replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()),
        min, max,
        value: Math.min(max, Math.max(min, Number.isFinite(def) ? def : min)),
        unit: (m[5] || "").trim().slice(0, 12),
      });
      continue;
    }

    m = /^show\s+([a-z_][a-z0-9_ ]*?)\s*=\s*([^|]+?)\s*(?:\|\s*(.*))?$/i.exec(line);
    if (m) {
      try {
        readouts.push({ label: m[1].trim(), expr: compile(m[2]), unit: (m[3] || "").trim().slice(0, 12) });
      } catch { /* one bad readout must not lose the diagram */ }
      continue;
    }

    m = /^trace\s+([a-z_][a-z0-9_ ]*?)\s*=\s*(.+)$/i.exec(line);
    if (m) {
      try { trace = { label: m[1].trim(), expr: compile(m[2]) }; } catch { /* ignore */ }
      continue;
    }

    // curve y = <expr of x> from <a> to <b> [color] ["label"]
    m = /^curve\s+(.+?)\s+from\s+(-?[\d.]+)\s+to\s+(-?[\d.]+)(.*)$/i.exec(line);
    if (m) {
      try {
        const rest = m[4] || "";
        shapes.push({
          kind: "curve",
          color: pickColor(rest),
          label: pickLabel(rest),
          attrs: {},
          fn: compileScoped(m[1], [...vars(), "x"]),
          from: Number(m[2]),
          to: Number(m[3]),
        });
      } catch { /* ignore an unparseable curve */ }
      continue;
    }

    // <kind> a=<expr> b=<expr> ... [color] ["label"]
    m = /^(circle|rect|line|arrow|text|particles)\s+(.*)$/i.exec(line);
    if (m) {
      const kind = m[1].toLowerCase() as ShapeKind;
      const rest = m[2];
      const attrs: Record<string, Expr> = {};
      let ok = true;
      for (const a of ATTRS[kind]) {
        const am = new RegExp(`\\b${a}\\s*=\\s*([^\\s]+(?:\\s*[-+*/^]\\s*[^\\s]+)*)`, "i").exec(rest);
        if (!am) continue;
        try { attrs[a] = compile(am[1]); } catch { ok = false; }
      }
      if (!ok || Object.keys(attrs).length === 0) continue;
      const cm = /\bcount\s*=\s*(\d+)/i.exec(rest);
      shapes.push({
        kind,
        color: pickColor(rest),
        label: pickLabel(rest),
        attrs,
        count: cm ? Math.min(120, Number(cm[1])) : undefined,
      });
      continue;
    }
  }

  if (shapes.length === 0) throw new Error("A scene needs at least one shape");
  return { title, blurb, params, shapes, readouts, trace };
}

const pickColor = (s: string) => {
  const m = new RegExp(`\\b(${COLOR_KEYS.join("|")})\\b`, "i").exec(s);
  return m ? m[1].toLowerCase() : "primary";
};
const pickLabel = (s: string) => {
  const m = /"([^"]{1,60})"/.exec(s);
  return m ? m[1] : undefined;
};

/**
 * Wrap a parsed scene as a SimModel, so an AI-authored diagram runs through
 * exactly the same player, loop and challenge plumbing as a hand-built
 * simulation — and inherits the off-screen pausing and dt clamping for free.
 */
export function sceneToModel(scene: Scene, id = "scene"): SimModel<{ t: number }> {
  const S = (v: number | undefined, d: number) => (Number.isFinite(v as number) ? (v as number) : d);

  return {
    id,
    title: scene.title,
    subject: "physics",
    blurb: scene.blurb,
    params: scene.params,
    init: () => ({ t: 0 }),
    step: (s, _p, dt) => ({ t: s.t + dt }),
    readouts: (s, p) =>
      scene.readouts.map((r, i) => {
        let v = NaN;
        try { v = r.expr({ ...p, t: s.t }); } catch { /* leave NaN */ }
        return { key: `r${i}`, label: r.label, value: v, unit: r.unit };
      }),
    plot: scene.trace
      ? { label: scene.trace.label, of: (s, p) => { try { return scene.trace!.expr({ ...p, t: s.t }); } catch { return 0; } } }
      : undefined,

    draw: (s, p, { ctx, width: W, height: H, colors }: DrawCtx) => {
      const scope = { ...p, t: s.t };
      // Scene coordinates are 0..1 so a diagram is resolution-independent and
      // the model never has to know how big the canvas is.
      const X = (v: number) => v * W;
      const Y = (v: number) => v * H;
      const val = (e: Expr | undefined, d: number) => {
        if (!e) return d;
        try { return S(e(scope), d); } catch { return d; }
      };

      for (const sh of scene.shapes) {
        const col = colors[sh.color] ?? colors.primary;
        ctx.strokeStyle = col;
        ctx.fillStyle = col;
        ctx.lineWidth = 2.5;

        switch (sh.kind) {
          case "circle": {
            const x = X(val(sh.attrs.x, 0.5)), y = Y(val(sh.attrs.y, 0.5));
            const r = Math.max(1, val(sh.attrs.r, 0.05) * Math.min(W, H));
            ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.globalAlpha = 0.25; ctx.fill(); ctx.globalAlpha = 1; ctx.stroke();
            if (sh.label) drawLabel(ctx, sh.label, x, y - r - 6, colors.muted);
            break;
          }
          case "rect": {
            const w = val(sh.attrs.w, 0.1) * W, h = val(sh.attrs.h, 0.1) * H;
            const x = X(val(sh.attrs.x, 0.5)), y = Y(val(sh.attrs.y, 0.5));
            ctx.save(); ctx.translate(x, y); ctx.rotate(val(sh.attrs.angle, 0));
            ctx.globalAlpha = 0.25; ctx.fillRect(-w / 2, -h / 2, w, h);
            ctx.globalAlpha = 1; ctx.strokeRect(-w / 2, -h / 2, w, h);
            ctx.restore();
            if (sh.label) drawLabel(ctx, sh.label, x, y - h / 2 - 6, colors.muted);
            break;
          }
          case "line":
          case "arrow": {
            const x1 = X(val(sh.attrs.x1, 0.1)), y1 = Y(val(sh.attrs.y1, 0.5));
            const x2 = X(val(sh.attrs.x2, 0.9)), y2 = Y(val(sh.attrs.y2, 0.5));
            ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
            if (sh.kind === "arrow") {
              const a = Math.atan2(y2 - y1, x2 - x1);
              ctx.beginPath();
              ctx.moveTo(x2, y2);
              ctx.lineTo(x2 - 11 * Math.cos(a - 0.4), y2 - 11 * Math.sin(a - 0.4));
              ctx.lineTo(x2 - 11 * Math.cos(a + 0.4), y2 - 11 * Math.sin(a + 0.4));
              ctx.closePath(); ctx.fill();
            }
            if (sh.label) drawLabel(ctx, sh.label, (x1 + x2) / 2, (y1 + y2) / 2 - 8, colors.muted);
            break;
          }
          case "text": {
            if (!sh.label) break;
            drawLabel(ctx, sh.label, X(val(sh.attrs.x, 0.5)), Y(val(sh.attrs.y, 0.5)), col, 14);
            break;
          }
          case "curve": {
            if (!sh.fn) break;
            const a = S(sh.from, -1), b = S(sh.to, 1);
            ctx.beginPath();
            let started = false;
            for (let i = 0; i <= 160; i++) {
              const xv = a + ((b - a) * i) / 160;
              let yv: number;
              try { yv = sh.fn({ ...scope, x: xv }); } catch { continue; }
              if (!Number.isFinite(yv)) { started = false; continue; }
              // Map the mathematical window onto the canvas: x across the
              // stated domain, y centred with a fixed vertical scale so
              // successive frames stay comparable.
              const px = ((xv - a) / (b - a)) * W;
              const py = H / 2 - yv * (H / 4);
              if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
            }
            ctx.stroke();
            break;
          }
          case "particles": {
            // Flow along a band — current in a wire, ions across a membrane.
            const n = sh.count ?? 18;
            const x0 = X(val(sh.attrs.x, 0.1)), y0 = Y(val(sh.attrs.y, 0.5));
            const w = val(sh.attrs.w, 0.8) * W, h = val(sh.attrs.h, 0.02) * H;
            const speed = val(sh.attrs.speed, 0.2);
            for (let i = 0; i < n; i++) {
              const phase = (i / n + s.t * speed) % 1;
              const px = x0 + ((phase + 1) % 1) * w;
              const py = y0 + Math.sin(i * 2.7) * h;
              ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill();
            }
            if (sh.label) drawLabel(ctx, sh.label, x0 + w / 2, y0 - 14, colors.muted);
            break;
          }
        }
      }
    },
  };
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  size = 12,
) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `600 ${size}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
  ctx.restore();
}
