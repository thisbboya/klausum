// Osmosis across a semi-permeable membrane.
//
// Diffusion is usually taught with an arrow drawn on a diagram, which quietly
// implies water is being pushed. Here individual water particles wander at
// random on both sides and only the *net* flow follows the gradient — so the
// student sees that nothing is pushing anything, and that equilibrium is
// movement in both directions rather than stillness.
import type { SimModel } from "@/lib/sim/engine";

type P = { x: number; y: number; vx: number; vy: number; solute: boolean };
type S = { parts: P[]; level: number; netFlow: number };

const N_WATER = 90;
const N_SOLUTE = 26;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export const osmosis: SimModel<S> = {
  id: "osmosis",
  title: "Osmosis — water follows the gradient",
  subject: "biology",
  blurb: "Nothing pushes the water. Watch why it still ends up on one side.",
  params: [
    { key: "outside", label: "Solute outside the cell", min: 0, max: 1, step: 0.01, value: 0.15 },
    { key: "inside", label: "Solute inside the cell", min: 0, max: 1, step: 0.01, value: 0.6 },
    { key: "permeability", label: "Membrane permeability", min: 0, max: 1, step: 0.01, value: 0.6 },
  ],

  init: (p) => ({
    parts: [
      ...Array.from({ length: N_WATER }, () => ({
        x: rnd(0.03, 0.97), y: rnd(0.1, 0.9),
        vx: rnd(-0.14, 0.14), vy: rnd(-0.14, 0.14), solute: false,
      })),
      // Solute is split by the two concentrations and can never cross — that
      // impermeability is the entire reason water has to move instead.
      ...Array.from({ length: N_SOLUTE }, (_, i) => {
        const left = i / N_SOLUTE < (p.outside ?? 0.2) / ((p.outside ?? 0.2) + (p.inside ?? 0.5) || 1);
        return {
          x: left ? rnd(0.03, 0.45) : rnd(0.55, 0.97), y: rnd(0.1, 0.9),
          vx: rnd(-0.08, 0.08), vy: rnd(-0.08, 0.08), solute: true,
        };
      }),
    ],
    level: 0.5,
    netFlow: 0,
  }),

  step: (s, p, dt) => {
    const gradient = p.inside - p.outside;
    // Bias is the probability difference of crossing each way, not a force:
    // particles still move randomly, they are just slightly likelier to end up
    // where solute is concentrated.
    const bias = gradient * p.permeability;
    let crossings = 0;

    const parts = s.parts.map((q) => {
      let { x, y, vx, vy } = q;
      // Brownian jitter — the random walk that makes this diffusion rather
      // than a conveyor belt.
      vx += rnd(-0.5, 0.5) * dt;
      vy += rnd(-0.5, 0.5) * dt;
      vx = Math.max(-0.35, Math.min(0.35, vx));
      vy = Math.max(-0.35, Math.min(0.35, vy));
      x += vx * dt; y += vy * dt;

      if (y < 0.08) { y = 0.08; vy = Math.abs(vy); }
      if (y > 0.92) { y = 0.92; vy = -Math.abs(vy); }
      if (x < 0.03) { x = 0.03; vx = Math.abs(vx); }
      if (x > 0.97) { x = 0.97; vx = -Math.abs(vx); }

      // The membrane sits at x = 0.5.
      const crossing = (q.x - 0.5) * (x - 0.5) < 0;
      if (crossing) {
        if (q.solute) {
          x = q.x; vx = -vx; // solute never crosses
        } else {
          const goingRight = x > 0.5;
          const allow = p.permeability * (goingRight ? 0.5 + bias : 0.5 - bias);
          if (Math.random() > Math.max(0, Math.min(1, allow))) {
            x = q.x; vx = -vx;
          } else {
            crossings += goingRight ? 1 : -1;
          }
        }
      }
      return { ...q, x, y, vx, vy };
    });

    const inside = parts.filter((q) => !q.solute && q.x > 0.5).length;
    const level = inside / Math.max(1, parts.filter((q) => !q.solute).length);
    return { parts, level, netFlow: s.netFlow * 0.9 + crossings };
  },

  readouts: (s, p) => {
    const water = s.parts.filter((q) => !q.solute);
    const inside = water.filter((q) => q.x > 0.5).length;
    return [
      { key: "inside", label: "Water inside", value: inside, precision: 0 },
      { key: "outside", label: "Water outside", value: water.length - inside, precision: 0 },
      { key: "gradient", label: "Solute gradient", value: p.inside - p.outside, precision: 2 },
      { key: "cellVolume", label: "Cell volume", value: s.level * 100, unit: "%", precision: 0 },
      // So a mission can require equilibrium reached through a working
      // membrane rather than by sealing it, which is the cheap way out.
      { key: "permeability", label: "Permeability", value: p.permeability, precision: 2 },
    ];
  },

  plot: { label: "Cell volume", of: (s) => s.level * 100 },

  draw: (s, p, { ctx, width: W, height: H, colors }) => {
    const mid = W / 2;

    ctx.fillStyle = colors.surface;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(0, H * 0.08, W, H * 0.84);
    ctx.globalAlpha = 1;

    // Membrane, drawn with gaps to show it is porous rather than a wall.
    ctx.strokeStyle = colors.fg;
    ctx.lineWidth = 3;
    ctx.setLineDash([7, 5]);
    ctx.beginPath(); ctx.moveTo(mid, H * 0.08); ctx.lineTo(mid, H * 0.92); ctx.stroke();
    ctx.setLineDash([]);

    for (const q of s.parts) {
      ctx.beginPath();
      ctx.arc(q.x * W, q.y * H, q.solute ? 5 : 3, 0, Math.PI * 2);
      ctx.fillStyle = q.solute ? colors.grape : colors.sky;
      ctx.globalAlpha = q.solute ? 0.9 : 0.65;
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Net flow arrow — only when there actually is a net flow.
    if (Math.abs(s.netFlow) > 0.8) {
      const right = s.netFlow > 0;
      const y = H * 0.5;
      ctx.strokeStyle = colors.success;
      ctx.fillStyle = colors.success;
      ctx.lineWidth = 3;
      const x1 = right ? mid - 46 : mid + 46;
      const x2 = right ? mid + 46 : mid - 46;
      ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
      const a = right ? 0 : Math.PI;
      ctx.beginPath();
      ctx.moveTo(x2, y);
      ctx.lineTo(x2 - 12 * Math.cos(a - 0.4), y - 12 * Math.sin(a - 0.4));
      ctx.lineTo(x2 - 12 * Math.cos(a + 0.4), y - 12 * Math.sin(a + 0.4));
      ctx.closePath(); ctx.fill();
    }

    ctx.font = "600 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = colors.muted;
    ctx.fillText("outside", mid / 2, H * 0.05);
    ctx.fillText("inside the cell", mid + mid / 2, H * 0.05);
    ctx.fillText(
      Math.abs(p.inside - p.outside) < 0.03
        ? "balanced — particles still move, but neither side gains"
        : p.permeability < 0.05
          ? "membrane sealed — nothing can cross"
          : "water crosses both ways; more goes towards the higher solute",
      mid,
      H - 6,
    );
  },
};
