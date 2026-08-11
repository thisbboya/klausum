// Acid–base titration.
//
// The point of a titration is that almost nothing happens for a long time and
// then everything happens at once. A table of pH values hides that; watching
// the colour hold, hold, hold and then flash pink in the space of one drop is
// the lesson.
//
// Model: strong acid titrated with strong base.
//   moles H+  = Ca·Va,  moles OH- = Cb·Vb
//   excess decides pH; at the equivalence point pH -> 7 through a steep,
//   well-behaved curve rather than a division by zero.
import type { SimModel } from "@/lib/sim/engine";

type S = {
  /** Titrant delivered, mL. */
  vb: number;
  flowing: boolean;
  /** Drop animation positions, 0..1 down the neck. */
  drops: number[];
  ph: number;
  /** Smoothed indicator colour strength. */
  pink: number;
};

function phOf(vb: number, ca: number, va: number, cb: number): number {
  const nH = (ca * va) / 1000;
  const nOH = (cb * vb) / 1000;
  const total = (va + vb) / 1000;
  const diff = nH - nOH;
  if (Math.abs(diff) < 1e-9) return 7;
  if (diff > 0) return Math.max(0, -Math.log10(Math.max(1e-14, diff / total)));
  return Math.min(14, 14 + Math.log10(Math.max(1e-14, -diff / total)));
}

export const titration: SimModel<S> = {
  id: "titration",
  title: "Acid–base titration",
  subject: "chemistry",
  blurb: "Open the tap. Watch how long nothing happens — then how fast it does.",
  params: [
    { key: "ca", label: "Acid concentration", min: 0.02, max: 0.5, step: 0.01, value: 0.1, unit: "M" },
    { key: "va", label: "Acid volume", min: 10, max: 50, step: 1, value: 25, unit: "mL" },
    { key: "cb", label: "Base concentration", min: 0.02, max: 0.5, step: 0.01, value: 0.1, unit: "M" },
    { key: "rate", label: "Tap", min: 0, max: 3, step: 0.1, value: 0, unit: "mL/s" },
  ],

  init: () => ({ vb: 0, flowing: false, drops: [], ph: 1, pink: 0 }),

  step: (s, p, dt) => {
    let vb = s.vb;
    let drops = s.drops.map((d) => d + dt * 1.9).filter((d) => d < 1);
    if (p.rate > 0 && vb < 100) {
      vb = Math.min(100, vb + p.rate * dt);
      // One visible drop per 0.35 mL, so the animation tracks the burette.
      if (Math.floor(vb / 0.35) !== Math.floor(s.vb / 0.35)) drops = [...drops, 0].slice(-14);
    }
    const ph = phOf(vb, p.ca, p.va, p.cb);
    // Phenolphthalein turns around pH 8.2–10.
    const target = Math.max(0, Math.min(1, (ph - 8.2) / 1.8));
    const pink = s.pink + (target - s.pink) * Math.min(1, dt * 6);
    return { ...s, vb, drops, ph, pink, flowing: p.rate > 0 };
  },

  readouts: (s, p) => {
    const equivalence = (p.ca * p.va) / p.cb;
    return [
      { key: "ph", label: "pH", value: s.ph, precision: 2 },
      { key: "added", label: "Titrant added", value: s.vb, unit: "mL", precision: 2 },
      { key: "equivalence", label: "Equivalence at", value: equivalence, unit: "mL", precision: 2 },
      { key: "toGo", label: "To equivalence", value: equivalence - s.vb, unit: "mL", precision: 2 },
    ];
  },

  plot: { label: "pH", of: (s) => s.ph },

  draw: (s, _p, { ctx, width: W, height: H, colors }) => {
    const cx = W / 2;

    // ── Burette ──
    const bTop = 10;
    const bH = H * 0.42;
    const bw = 16;
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(cx - bw / 2, bTop, bw, bH);
    // Titrant remaining, drawn as a falling column.
    const fill = Math.max(0, 1 - s.vb / 100);
    ctx.fillStyle = colors.sky;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(cx - bw / 2 + 2, bTop + bH * (1 - fill), bw - 4, bH * fill - 2);
    ctx.globalAlpha = 1;
    // Tap
    ctx.fillStyle = colors.border;
    ctx.fillRect(cx - 9, bTop + bH, 18, 7);
    ctx.fillStyle = s.flowing ? colors.success : colors.muted;
    ctx.fillRect(cx - 3, bTop + bH + 7, 6, 9);

    // ── Drops in flight ──
    const neckTop = bTop + bH + 18;
    const flaskTop = H * 0.56;
    ctx.fillStyle = colors.sky;
    for (const d of s.drops) {
      ctx.beginPath();
      ctx.arc(cx, neckTop + d * (flaskTop - neckTop), 3.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Conical flask ──
    const fW = 108;
    const fBot = H - 14;
    ctx.beginPath();
    ctx.moveTo(cx - 13, flaskTop);
    ctx.lineTo(cx - fW / 2, fBot);
    ctx.lineTo(cx + fW / 2, fBot);
    ctx.lineTo(cx + 13, flaskTop);
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Solution, coloured by the indicator. This is the whole experiment.
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - 13, flaskTop);
    ctx.lineTo(cx - fW / 2, fBot);
    ctx.lineTo(cx + fW / 2, fBot);
    ctx.lineTo(cx + 13, flaskTop);
    ctx.closePath();
    ctx.clip();
    const level = fBot - (fBot - flaskTop) * 0.62;
    ctx.fillStyle = s.pink > 0.02 ? colors.grape : colors.surface;
    ctx.globalAlpha = s.pink > 0.02 ? 0.25 + s.pink * 0.6 : 0.85;
    ctx.fillRect(cx - fW / 2, level, fW, fBot - level);
    ctx.globalAlpha = 1;
    ctx.restore();

    // ── pH scale down the left, with the current value marked ──
    const sx = 26;
    const sTop = 20;
    const sH = H - 44;
    const grd = ctx.createLinearGradient(0, sTop, 0, sTop + sH);
    grd.addColorStop(0, colors.grape);
    grd.addColorStop(0.5, colors.success);
    grd.addColorStop(1, colors.destructive);
    ctx.fillStyle = grd;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(sx - 6, sTop, 12, sH);
    ctx.globalAlpha = 1;
    const y = sTop + sH * (1 - s.ph / 14);
    ctx.fillStyle = colors.fg;
    ctx.beginPath();
    ctx.moveTo(sx + 10, y);
    ctx.lineTo(sx + 20, y - 5);
    ctx.lineTo(sx + 20, y + 5);
    ctx.closePath();
    ctx.fill();
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`pH ${s.ph.toFixed(1)}`, sx + 24, y);

    // A word about what is happening, since the interesting part is brief.
    ctx.textAlign = "center";
    ctx.font = "600 12px system-ui, sans-serif";
    ctx.fillStyle = colors.muted;
    const msg =
      s.pink > 0.5
        ? "past the endpoint — you have overshot"
        : s.pink > 0.05
          ? "endpoint — stop the tap"
          : s.flowing
            ? "adding titrant…"
            : "open the tap to begin";
    ctx.fillText(msg, cx, H - 4);
  },
};
