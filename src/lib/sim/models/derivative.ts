// The derivative, as a limit you can watch close.
//
// The formula f'(x) = lim(h→0) [f(x+h) − f(x)]/h is a sentence most students
// can recite and few can see. Here h is a slider: drag it towards zero and the
// secant visibly rotates onto the tangent, with both slopes on screen so the
// gap closing is a number as well as a picture.
import type { SimModel } from "@/lib/sim/engine";

type S = { t: number };

// A small fixed family, so the student compares behaviours rather than typing
// expressions — and so the analytic derivative below is always exact.
const CURVES = [
  { f: (x: number) => x * x, d: (x: number) => 2 * x, name: "x²" },
  { f: (x: number) => x * x * x / 3, d: (x: number) => x * x, name: "x³/3" },
  { f: (x: number) => Math.sin(x), d: (x: number) => Math.cos(x), name: "sin x" },
  { f: (x: number) => Math.exp(x / 2), d: (x: number) => Math.exp(x / 2) / 2, name: "e^(x/2)" },
];

export const derivative: SimModel<S> = {
  id: "derivative",
  title: "The derivative — watch h go to zero",
  subject: "maths",
  blurb: "Shrink h and the secant becomes the tangent. That is the whole definition.",
  animated: false, // Nothing moves on its own; the student drives every change.
  params: [
    { key: "curve", label: "Function (0=x², 1=x³/3, 2=sin x, 3=eˣ⁄²)", min: 0, max: 3, step: 1, value: 0 },
    { key: "x", label: "Point x", min: -2.6, max: 2.6, step: 0.05, value: 1 },
    { key: "h", label: "h — drag me towards zero", min: 0.001, max: 2, step: 0.001, value: 1.2 },
  ],

  init: () => ({ t: 0 }),
  step: (s) => s,

  readouts: (_s, p) => {
    const c = CURVES[Math.round(p.curve)] ?? CURVES[0];
    const secant = (c.f(p.x + p.h) - c.f(p.x)) / p.h;
    const tangent = c.d(p.x);
    return [
      { key: "secant", label: "Secant slope", value: secant, precision: 4 },
      { key: "tangent", label: "True f′(x)", value: tangent, precision: 4 },
      { key: "error", label: "Difference", value: Math.abs(secant - tangent), precision: 4 },
      { key: "h", label: "h", value: p.h, precision: 3 },
    ];
  },

  draw: (_s, p, { ctx, width: W, height: H, colors }) => {
    const c = CURVES[Math.round(p.curve)] ?? CURVES[0];
    const X0 = -3, X1 = 3, Y0 = -3, Y1 = 3;
    const px = (x: number) => ((x - X0) / (X1 - X0)) * W;
    const py = (y: number) => H - ((y - Y0) / (Y1 - Y0)) * H;

    // Axes
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, py(0)); ctx.lineTo(W, py(0));
    ctx.moveTo(px(0), 0); ctx.lineTo(px(0), H);
    ctx.stroke();

    // The curve
    ctx.strokeStyle = colors.fg;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    let started = false;
    for (let i = 0; i <= 300; i++) {
      const x = X0 + ((X1 - X0) * i) / 300;
      const y = c.f(x);
      if (!Number.isFinite(y) || y < Y0 - 5 || y > Y1 + 5) { started = false; continue; }
      started ? ctx.lineTo(px(x), py(y)) : (ctx.moveTo(px(x), py(y)), (started = true));
    }
    ctx.stroke();

    const x1 = p.x, y1 = c.f(x1);
    const x2 = p.x + p.h, y2 = c.f(x2);
    const secant = (y2 - y1) / p.h;
    const tangent = c.d(x1);

    // Tangent, drawn faintly underneath as the thing being approached.
    ctx.strokeStyle = colors.success;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(px(X0), py(y1 + tangent * (X0 - x1)));
    ctx.lineTo(px(X1), py(y1 + tangent * (X1 - x1)));
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Secant through the two points — the line that rotates as h shrinks.
    ctx.strokeStyle = colors.primary;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(px(X0), py(y1 + secant * (X0 - x1)));
    ctx.lineTo(px(X1), py(y1 + secant * (X1 - x1)));
    ctx.stroke();

    // The rise-over-run triangle, so h and Δf are visible quantities.
    ctx.strokeStyle = colors.sky;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(px(x1), py(y1)); ctx.lineTo(px(x2), py(y1)); ctx.lineTo(px(x2), py(y2));
    ctx.stroke();
    ctx.setLineDash([]);

    for (const [x, y] of [[x1, y1], [x2, y2]] as const) {
      ctx.beginPath();
      ctx.arc(px(x), py(y), 5, 0, Math.PI * 2);
      ctx.fillStyle = colors.primary;
      ctx.fill();
    }

    ctx.fillStyle = colors.muted;
    ctx.font = "600 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("h", (px(x1) + px(x2)) / 2, py(y1) + 14);
    ctx.textAlign = "left";
    ctx.fillStyle = colors.fg;
    ctx.fillText(`f(x) = ${c.name}`, 10, 16);
    ctx.fillStyle = colors.success;
    ctx.fillText("tangent", 10, 32);
    ctx.fillStyle = colors.primary;
    ctx.fillText("secant", 10, 48);
  },
};
