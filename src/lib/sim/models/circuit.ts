// Ohm's law, with the current made visible.
//
// V = IR is arithmetic a student can do without believing anything. Drawing
// charge as dots whose *speed and spacing* are the current makes the law
// physical: double the resistance and the dots visibly halve their pace, and
// the lamp dims in the same instant.
//
// Two resistors, switchable between series and parallel, because the moment
// parallel resistance drops below either branch is the one that reliably
// surprises people.
import type { SimModel } from "@/lib/sim/engine";

type S = { phase: number };

export const circuit: SimModel<S> = {
  id: "circuit",
  title: "Ohm's Law — series and parallel",
  subject: "circuits",
  blurb: "The dots are charge. Their speed is the current.",
  params: [
    { key: "voltage", label: "Battery", min: 1, max: 24, step: 0.5, value: 12, unit: "V" },
    { key: "r1", label: "Resistor 1", min: 1, max: 100, step: 1, value: 20, unit: "Ω" },
    { key: "r2", label: "Resistor 2", min: 1, max: 100, step: 1, value: 30, unit: "Ω" },
    { key: "parallel", label: "0 = series, 1 = parallel", min: 0, max: 1, step: 1, value: 0 },
  ],

  init: () => ({ phase: 0 }),

  step: (s, p, dt) => {
    const rt = totalR(p);
    const i = p.voltage / rt;
    // Dot speed is proportional to current, which is the point of the drawing.
    return { phase: (s.phase + dt * i * 0.55) % 1 };
  },

  readouts: (_s, p) => {
    const rt = totalR(p);
    const i = p.voltage / rt;
    return [
      { key: "rt", label: "Total resistance", value: rt, unit: "Ω", precision: 1 },
      { key: "current", label: "Current", value: i, unit: "A", precision: 3 },
      { key: "power", label: "Power", value: p.voltage * i, unit: "W", precision: 2 },
      { key: "v1", label: p.parallel > 0.5 ? "V across each" : "V across R1", value: p.parallel > 0.5 ? p.voltage : i * p.r1, unit: "V", precision: 2 },
      // Published so a mission can set conditions on the components chosen,
      // not just on the result — "get under 15Ω using two 25Ω resistors" is
      // only checkable if the resistors themselves are readable.
      { key: "r1", label: "R1", value: p.r1, unit: "Ω", precision: 0 },
      { key: "r2", label: "R2", value: p.r2, unit: "Ω", precision: 0 },
    ];
  },

  plot: { label: "Current", of: (_s, p) => p.voltage / totalR(p) },

  draw: (s, p, { ctx, width: W, height: H, colors }) => {
    const parallel = p.parallel > 0.5;
    const i = p.voltage / totalR(p);
    const L = 46, R = W - 46, T = 46, B = H - 40;

    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 3;

    // Battery on the left rail.
    const my = (T + B) / 2;
    ctx.beginPath();
    ctx.moveTo(L, my - 16); ctx.lineTo(L, T); ctx.lineTo(R, T);
    ctx.moveTo(L, my + 16); ctx.lineTo(L, B); ctx.lineTo(R, B);
    ctx.moveTo(R, T); ctx.lineTo(R, B);
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.strokeStyle = colors.fg;
    ctx.beginPath();
    ctx.moveTo(L - 13, my - 16); ctx.lineTo(L + 13, my - 16);
    ctx.moveTo(L - 8, my + 16); ctx.lineTo(L + 8, my + 16);
    ctx.stroke();
    ctx.fillStyle = colors.muted;
    ctx.font = "600 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${p.voltage.toFixed(1)} V`, L, my + 34);

    const box = (x: number, y: number, label: string, tone: string) => {
      ctx.fillStyle = colors.card;
      ctx.strokeStyle = tone;
      ctx.lineWidth = 3;
      ctx.fillRect(x - 26, y - 11, 52, 22);
      ctx.strokeRect(x - 26, y - 11, 52, 22);
      ctx.fillStyle = colors.fg;
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.fillText(label, x, y);
    };

    if (!parallel) {
      box(W * 0.42, T, `${p.r1}Ω`, colors.primary);
      box(W * 0.68, T, `${p.r2}Ω`, colors.grape);
    } else {
      // Two branches bridging the rails.
      ctx.strokeStyle = colors.border;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(W * 0.45, T); ctx.lineTo(W * 0.45, B);
      ctx.moveTo(W * 0.68, T); ctx.lineTo(W * 0.68, B);
      ctx.stroke();
      box(W * 0.45, my, `${p.r1}Ω`, colors.primary);
      box(W * 0.68, my, `${p.r2}Ω`, colors.grape);
    }

    // Charge carriers around the outer loop. Spacing is fixed; only their
    // speed changes, so "more current" reads as faster rather than denser.
    const perim = 2 * (R - L) + 2 * (B - T);
    const n = 30;
    ctx.fillStyle = colors.sky;
    for (let k = 0; k < n; k++) {
      const d = (((k / n + s.phase) % 1) + 1) % 1;
      let t = d * perim;
      let x: number, y: number;
      if (t < R - L) { x = L + t; y = T; }
      else if ((t -= R - L) < B - T) { x = R; y = T + t; }
      else if ((t -= B - T) < R - L) { x = R - t; y = B; }
      else { t -= R - L; x = L; y = B - t; }
      ctx.beginPath();
      ctx.arc(x, y, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // The lamp, brightness following current with a soft knee so a small
    // current still shows something.
    const bx = W * 0.86, by = my;
    const glow = Math.min(1, i / 1.2);
    if (glow > 0.02) {
      const g = ctx.createRadialGradient(bx, by, 2, bx, by, 30);
      g.addColorStop(0, colors.primary); g.addColorStop(1, "transparent");
      ctx.globalAlpha = glow * 0.8; ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(bx, by, 30, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.beginPath(); ctx.arc(bx, by, 12, 0, Math.PI * 2);
    ctx.fillStyle = colors.primary; ctx.globalAlpha = 0.25 + glow * 0.75; ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = colors.border; ctx.lineWidth = 2.5; ctx.stroke();

    ctx.fillStyle = colors.muted;
    ctx.font = "600 12px system-ui, sans-serif";
    ctx.fillText(
      parallel
        ? "parallel — total resistance is LESS than either resistor"
        : "series — resistances simply add",
      W / 2,
      H - 8,
    );
  },
};

function totalR(p: Record<string, number>) {
  return p.parallel > 0.5 ? 1 / (1 / p.r1 + 1 / p.r2) : p.r1 + p.r2;
}
