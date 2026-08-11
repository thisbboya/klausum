// Missions layered on top of simulations.
//
// A simulation on its own is a toy: powerful for the curious, ignorable for
// everyone else. A mission turns it into a question with a right answer that
// the student has to *produce* rather than pick — "get the bulb lit without
// touching the strength slider" cannot be guessed at, only done.
//
// Objectives are evaluated against the readouts the model already publishes,
// which is why the engine forces readouts to be plain numbers: the challenge
// layer never needs to know what a simulation is, only what it reported.
import type { SimModel } from "@/lib/sim/engine";

export type Objective =
  | { kind: "min"; key: string; value: number; label: string }
  | { kind: "max"; key: string; value: number; label: string }
  | { kind: "range"; key: string; min: number; max: number; label: string }
  /** Must hold for `seconds` — stops a value that flickers past the target
      from counting, which is the difference between hitting a number and
      controlling a system. */
  | { kind: "sustain"; key: string; min?: number; max?: number; seconds: number; label: string };

export type Challenge = {
  id: string;
  simId: string;
  title: string;
  brief: string;
  xp: number;
  difficulty: "easy" | "medium" | "hard";
  objectives: Objective[];
  /** Shown only after a few failed attempts, and never the answer itself. */
  hints?: string[];
};

export const CHALLENGES: Challenge[] = [
  {
    id: "faraday-first-current",
    simId: "faraday",
    title: "First Current",
    brief: "Light the bulb. Any current at all will do — but the magnet has to earn it.",
    xp: 50,
    difficulty: "easy",
    objectives: [{ kind: "min", key: "emf", value: 3, label: "Induce at least 3 V" }],
    hints: [
      "A stationary magnet induces nothing, however strong it is.",
      "It is the change in flux that matters, not the flux.",
      "Try dragging it quickly through the middle of the coil.",
    ],
  },
  {
    id: "faraday-steady-hand",
    simId: "faraday",
    title: "Steady Hand",
    brief: "Hold an induced voltage above 8 V for a full second. A flick won't do it.",
    xp: 150,
    difficulty: "medium",
    objectives: [
      { kind: "sustain", key: "emf", min: 8, seconds: 1, label: "Keep EMF above 8 V for 1s" },
    ],
    hints: [
      "Turns multiply the effect — you are allowed to change them.",
      "Sweeping back and forth keeps the flux changing continuously.",
      "The auto sweep gives you a constant velocity you cannot match by hand.",
    ],
  },
  {
    id: "titration-find-endpoint",
    simId: "titration",
    title: "Find the Endpoint",
    brief: "Stop the tap within 0.2 mL of the equivalence point. Overshoot and you have ruined the run.",
    xp: 200,
    difficulty: "hard",
    objectives: [
      { kind: "range", key: "toGo", min: -0.2, max: 0.2, label: "Land within 0.2 mL of equivalence" },
      { kind: "max", key: "ph", value: 10, label: "Without overshooting past pH 10" },
    ],
    hints: [
      "Work out where the equivalence point should be before you open the tap.",
      "moles of acid = concentration × volume. The base must match it.",
      "Close to the endpoint, slow the tap right down.",
    ],
  },
  {
    id: "titration-dilute",
    simId: "titration",
    title: "The Weak Sample",
    brief: "Titrate a 0.04 M acid accurately. The jump is smaller and easier to miss.",
    xp: 250,
    difficulty: "hard",
    objectives: [
      { kind: "range", key: "toGo", min: -0.2, max: 0.2, label: "Land within 0.2 mL of equivalence" },
    ],
    hints: ["Set the acid concentration to 0.04 M first.", "A weaker acid needs less titrant, so equivalence arrives sooner."],
  },
];

export const challengesFor = (sim: SimModel | string) =>
  CHALLENGES.filter((c) => c.simId === (typeof sim === "string" ? sim : sim.id));

export const challengeById = (id: string) => CHALLENGES.find((c) => c.id === id);

/** Per-objective progress, so the panel can show what is and isn't met yet. */
export type ObjectiveState = { met: boolean; label: string; progress: number };

/**
 * Evaluate one frame. `held` carries how long each sustain objective has been
 * satisfied; it is owned by the caller so this stays a pure function.
 */
export function evaluate(
  challenge: Challenge,
  readouts: Record<string, number>,
  held: Record<string, number>,
  dt: number,
): { states: ObjectiveState[]; complete: boolean; held: Record<string, number> } {
  const nextHeld = { ...held };

  const states = challenge.objectives.map((o, i): ObjectiveState => {
    const raw = readouts[o.key];
    // A readout the model never published must not silently count as met.
    if (raw === undefined || !Number.isFinite(raw)) {
      return { met: false, label: o.label, progress: 0 };
    }
    // Objectives on signed quantities are judged on magnitude: the direction
    // you swept the magnet is not what is being asked about.
    const v = o.kind === "sustain" || o.kind === "min" || o.kind === "max" ? raw : raw;

    switch (o.kind) {
      case "min":
        return { met: Math.abs(v) >= o.value, label: o.label, progress: Math.min(1, Math.abs(v) / o.value) };
      case "max":
        return { met: v <= o.value, label: o.label, progress: v <= o.value ? 1 : 0 };
      case "range":
        return { met: v >= o.min && v <= o.max, label: o.label, progress: v >= o.min && v <= o.max ? 1 : 0 };
      case "sustain": {
        const ok =
          (o.min === undefined || Math.abs(v) >= o.min) &&
          (o.max === undefined || Math.abs(v) <= o.max);
        const key = `${challenge.id}:${i}`;
        // Resets to zero the moment the condition lapses — "sustain" has to
        // mean sustained, not accumulated across attempts.
        nextHeld[key] = ok ? (nextHeld[key] ?? 0) + dt : 0;
        return {
          met: nextHeld[key] >= o.seconds,
          label: o.label,
          progress: Math.min(1, (nextHeld[key] ?? 0) / o.seconds),
        };
      }
    }
  });

  return { states, complete: states.every((s) => s.met), held: nextHeld };
}
