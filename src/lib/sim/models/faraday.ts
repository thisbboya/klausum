// Faraday's law of induction — the simulation the student asked for by name.
//
// The magnet is dragged through the coil by hand. Nothing happens while it
// sits still, however strong it is, which is the entire lesson and the one
// thing a slider-and-number panel cannot teach: you have to feel that holding
// it still gives you nothing.
//
// Model (educational, not engineering-grade):
//   flux through coil  Φ(x) = B·A·g(x),  g a smooth bell centred on the coil
//   emf                ε = -N·dΦ/dt      (Faraday–Lenz)
// dΦ/dt is taken from the magnet's actual velocity, so the numbers follow the
// hand that moved it.
import type { SimModel } from "@/lib/sim/engine";

type S = {
  /** Magnet centre, in canvas x. */
  x: number;
  vx: number;
  dragging: boolean;
  flux: number;
  emf: number;
  /** Smoothed for the bulb, so it glows rather than strobes. */
  glow: number;
  auto: number;
};

const COIL_X = 0.5; // fraction of width
const SPREAD = 0.16; // how wide the coil's reach is, as a fraction of width

/** Bell-shaped coupling: strongest at the coil, falling off either side. */
const g = (dx: number) => Math.exp(-(dx * dx) / (2 * SPREAD * SPREAD));

export const faraday: SimModel<S> = {
  id: "faraday",
  title: "Faraday's Law — drag the magnet",
  subject: "physics",
  blurb: "Move the magnet through the coil. Hold it still and watch what happens.",
  params: [
    { key: "strength", label: "Magnet strength", min: 0.2, max: 3, step: 0.1, value: 1.5, unit: "T" },
    { key: "turns", label: "Coil turns", min: 10, max: 400, step: 10, value: 120 },
    { key: "autoSpeed", label: "Auto sweep (0 = you drive)", min: 0, max: 2, step: 0.1, value: 0, unit: "×" },
  ],

  init: () => ({ x: 0.12, vx: 0, dragging: false, flux: 0, emf: 0, glow: 0, auto: 0 }),

  step: (s, p, dt) => {
    let { x, vx, glow, auto } = s;

    if (!s.dragging) {
      if (p.autoSpeed > 0) {
        // A sweep for students who want to watch rather than drive, and for
        // anyone on a device where dragging is awkward.
        auto += dt * p.autoSpeed * 0.6;
        const nx = 0.5 + 0.42 * Math.sin(auto * Math.PI);
        vx = (nx - x) / Math.max(dt, 1e-4);
        x = nx;
      } else {
        // Let go mid-throw and it coasts to a stop, so a flick still induces.
        x += vx * dt;
        vx *= Math.exp(-3 * dt);
        if (x < 0.04 || x > 0.96) {
          x = Math.max(0.04, Math.min(0.96, x));
          vx = 0;
        }
      }
    }

    const flux = p.strength * g(x - COIL_X);
    // ε = -N dΦ/dt, and dΦ/dt = dΦ/dx · dx/dt.
    const dFlux_dx = p.strength * g(x - COIL_X) * (-(x - COIL_X) / (SPREAD * SPREAD));
    const emf = -p.turns * dFlux_dx * vx * 0.05;

    const target = Math.min(1, Math.abs(emf) / 8);
    glow += (target - glow) * Math.min(1, dt * 12);

    return { ...s, x, vx, flux, emf, glow, auto };
  },

  readouts: (s, p) => [
    { key: "emf", label: "Induced EMF", value: s.emf, unit: "V", precision: 2 },
    { key: "flux", label: "Flux", value: s.flux, unit: "Wb", precision: 3 },
    { key: "speed", label: "Magnet speed", value: Math.abs(s.vx), unit: "/s", precision: 2 },
    { key: "turns", label: "Turns", value: p.turns, precision: 0 },
  ],

  plot: { label: "EMF", of: (s) => s.emf },

  onPointer: (s, _p, e) => {
    const x = e.x / e.width;
    if (e.type === "down") return { ...s, dragging: true, x, vx: 0 };
    if (e.type === "move" && s.dragging) {
      // Velocity from the pointer itself: the faster you drag, the bigger the
      // kick, which is the relationship being taught.
      const vx = (x - s.x) * 60;
      return { ...s, x, vx };
    }
    if (e.type === "up") return { ...s, dragging: false };
    return s;
  },

  draw: (s, p, { ctx, width: W, height: H, colors }) => {
    const cx = COIL_X * W;
    const midY = H / 2;

    // ── Field lines, densest near the magnet and bending toward the coil ──
    const lines = 7;
    ctx.lineWidth = 1;
    for (let i = 0; i < lines; i++) {
      const t = (i / (lines - 1)) * 2 - 1; // -1..1
      const amp = 26 + Math.abs(t) * 30;
      ctx.beginPath();
      ctx.globalAlpha = 0.16 + 0.24 * (p.strength / 3);
      ctx.strokeStyle = colors.sky;
      const mx = s.x * W;
      for (let k = 0; k <= 40; k++) {
        const u = k / 40;
        const px = mx - 90 + u * 180;
        const py = midY + Math.sin(u * Math.PI) * amp * t;
        k === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // ── Coil: rings drawn as ellipses so it reads as a solenoid ──
    const ringCount = 7;
    ctx.lineWidth = 3;
    ctx.strokeStyle = colors.primary;
    for (let i = 0; i < ringCount; i++) {
      const rx = cx + (i - (ringCount - 1) / 2) * 13;
      ctx.beginPath();
      ctx.ellipse(rx, midY, 7, 46, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // ── Leads out to the bulb ──
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 40, midY - 46);
    ctx.lineTo(cx - 40, 28);
    ctx.lineTo(W - 58, 28);
    ctx.moveTo(cx + 40, midY + 46);
    ctx.lineTo(cx + 40, H - 26);
    ctx.lineTo(W - 58, H - 26);
    ctx.lineTo(W - 58, 62);
    ctx.stroke();

    // ── Bulb: brightness is |emf|, so it is lit by the drag, not by a slider ──
    const bx = W - 58;
    const by = 45;
    if (s.glow > 0.01) {
      const grd = ctx.createRadialGradient(bx, by, 2, bx, by, 34);
      grd.addColorStop(0, colors.primary);
      grd.addColorStop(1, "transparent");
      ctx.globalAlpha = s.glow * 0.75;
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(bx, by, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.beginPath();
    ctx.arc(bx, by, 13, 0, Math.PI * 2);
    ctx.fillStyle = s.glow > 0.02 ? colors.primary : colors.surface;
    ctx.globalAlpha = s.glow > 0.02 ? 0.35 + s.glow * 0.65 : 1;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = colors.border;
    ctx.stroke();

    // ── The magnet ──
    const mx = s.x * W;
    const mw = 74;
    const mh = 30;
    ctx.fillStyle = colors.destructive;
    ctx.fillRect(mx - mw / 2, midY - mh / 2, mw / 2, mh);
    ctx.fillStyle = colors.sky;
    ctx.fillRect(mx, midY - mh / 2, mw / 2, mh);
    ctx.lineWidth = 2;
    ctx.strokeStyle = colors.fg;
    ctx.strokeRect(mx - mw / 2, midY - mh / 2, mw, mh);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("N", mx - mw / 4, midY);
    ctx.fillText("S", mx + mw / 4, midY);

    // ── Current direction, only while there is any ──
    if (Math.abs(s.emf) > 0.15) {
      ctx.fillStyle = colors.success;
      ctx.font = "bold 12px system-ui, sans-serif";
      ctx.fillText(s.emf > 0 ? "current →" : "← current", cx, H - 46);
    } else {
      ctx.fillStyle = colors.muted;
      ctx.font = "600 12px system-ui, sans-serif";
      ctx.fillText("no current — the magnet has to be moving", cx, H - 46);
    }

    // Hint, until the student picks the magnet up.
    if (!s.dragging && Math.abs(s.vx) < 0.02 && p.autoSpeed === 0) {
      ctx.fillStyle = colors.muted;
      ctx.font = "600 12px system-ui, sans-serif";
      ctx.fillText("drag the magnet", mx, midY - 34);
    }
  },
};
