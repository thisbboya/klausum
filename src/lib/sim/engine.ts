// The simulation engine.
//
// Klausum already had "simulations": a ```sim block gave you sliders, some
// numbers that recomputed, and a chart. That is a live calculator. It never
// showed the *thing* — no magnet moving through a coil, no burette dripping,
// no rotor turning — so a student could watch a number change without ever
// forming a picture of why.
//
// This engine draws the thing. The one architectural rule it enforces is that
// physics never touches pixels:
//
//     parameters -> step(dt) -> state -> draw(state) -> canvas
//
// The model knows nothing about canvas size, colours or the DOM; the renderer
// knows nothing about why torque is falling. That separation is what makes the
// same engine serve a titration, a derivative and an induction motor, and it
// is what lets the challenge engine read a state it can actually evaluate.

/** Numbers a student can move. */
export type ParamSpec = {
  key: string;
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  unit?: string;
};

/** A number the simulation reports back. Displayed, and checked by challenges. */
export type Readout = {
  key: string;
  label: string;
  value: number;
  unit?: string;
  /** Decimal places; defaults to something sensible for the magnitude. */
  precision?: number;
};

export type DrawCtx = {
  ctx: CanvasRenderingContext2D;
  /** CSS pixels, already corrected for device pixel ratio. */
  width: number;
  height: number;
  /** Theme colours resolved from CSS custom properties, so a simulation
      never hardcodes a hex and never fights dark mode. */
  colors: Record<string, string>;
};

/**
 * One simulation. Deliberately a plain object rather than a class hierarchy:
 * every model is a closure over its own state, which keeps a new simulation to
 * a single file with no base class to learn.
 */
export type SimModel<S = any> = {
  id: string;
  title: string;
  subject: "physics" | "chemistry" | "biology" | "maths" | "circuits";
  /** One line under the title — what the student is looking at. */
  blurb?: string;
  params: ParamSpec[];
  /** Fresh state. Called on mount and on reset. */
  init: (p: Record<string, number>) => S;
  /** Advance by dt seconds. Pure with respect to rendering. */
  step: (state: S, p: Record<string, number>, dt: number) => S;
  /** Numbers worth showing, derived from state. */
  readouts: (state: S, p: Record<string, number>) => Readout[];
  /** Draw the state. Must not mutate it. */
  draw: (state: S, p: Record<string, number>, c: DrawCtx) => void;
  /** Optional series for the live chart, sampled each frame. */
  plot?: { label: string; of: (state: S, p: Record<string, number>) => number };
  /** Optional pointer interaction — dragging a magnet, clicking a component. */
  onPointer?: (
    state: S,
    p: Record<string, number>,
    e: { x: number; y: number; type: "down" | "move" | "up"; width: number; height: number },
  ) => S;
  /** Some simulations are inherently static (a derivative at a point). */
  animated?: boolean;
};

/** Resolve the theme tokens once per render pass rather than per shape. */
export function readColors(el: HTMLElement): Record<string, string> {
  const cs = getComputedStyle(el);
  const get = (n: string, fallback: string) => cs.getPropertyValue(n).trim() || fallback;
  return {
    fg: get("--foreground", "#111"),
    muted: get("--muted-foreground", "#777"),
    primary: get("--primary", "#F4A300"),
    success: get("--success", "#22C55E"),
    sky: get("--sky", "#3B82F6"),
    grape: get("--grape", "#8B5CF6"),
    destructive: get("--destructive", "#EF4444"),
    border: get("--border", "#ccc"),
    surface: get("--surface-2", "#f5f5f5"),
    card: get("--card", "#fff"),
  };
}

/** Formatting shared by every readout, so units line up across simulations. */
export function fmt(n: number, precision?: number): string {
  if (!Number.isFinite(n)) return "—";
  if (precision !== undefined) return n.toFixed(precision);
  const a = Math.abs(n);
  if (a >= 1000) return n.toFixed(0);
  if (a >= 10) return n.toFixed(1);
  if (a >= 1) return n.toFixed(2);
  return n.toFixed(3);
}
