// Core Drive 3 — Empowerment of Creativity & Feedback.
//
// Chou calls this the evergreen drive: the only one that keeps a system alive
// once novelty is gone, because the player is generating the interest rather
// than consuming it. It needs two halves. Meaningful choices that *combine*,
// and feedback fast enough that you can tell whether your combination worked.
//
// Klausum had neither in the review loop. You pressed Study and the app decided
// everything: which cards, in what order, with what safety net. A tactic that
// only changed a label would be worse than nothing — fake agency is the thing
// students notice fastest — so every tactic here alters how the session
// actually runs, and the multiplier is the price the app pays for the risk the
// student took.
import type { LucideIcon } from "lucide-react";
import { EyeOff, HeartCrack, Mountain, Timer, Infinity as InfinityIcon } from "lucide-react";

export type TacticId = "blind" | "sudden" | "deep" | "speed" | "marathon";

export type Tactic = {
  id: TacticId;
  name: string;
  /** What it does to the session, mechanically. */
  desc: string;
  /** What it costs you — stated plainly, because a choice with no downside
      is not a choice. */
  risk: string;
  /** XP multiplier. Multiplied together when tactics are combined. */
  mult: number;
  icon: LucideIcon;
  tone: string;
};

export const MAX_TACTICS = 2;

export const TACTICS: Tactic[] = [
  {
    id: "blind",
    name: "Blind Recall",
    desc: "No hints for the whole session.",
    risk: "The hint button is locked.",
    mult: 1.5,
    icon: EyeOff,
    tone: "text-grape",
  },
  {
    id: "sudden",
    name: "Sudden Death",
    desc: "Start on one heart instead of three.",
    risk: "One 'Again' ends the run for five minutes.",
    mult: 2,
    icon: HeartCrack,
    tone: "text-destructive",
  },
  {
    id: "deep",
    name: "Deep End",
    desc: "Hardest cards first, not the due order.",
    risk: "You meet your worst material cold, before you've warmed up.",
    mult: 1.4,
    icon: Mountain,
    tone: "text-primary",
  },
  {
    id: "speed",
    name: "Speed Run",
    desc: "Twelve seconds a card.",
    risk: "Run out of time and it counts as Again.",
    mult: 1.6,
    icon: Timer,
    tone: "text-sky",
  },
  {
    id: "marathon",
    name: "Marathon",
    desc: "Pulls cards ahead of schedule so the queue never empties.",
    risk: "Reviewing early means shorter intervals — more work later.",
    mult: 1.2,
    icon: InfinityIcon,
    tone: "text-success",
  },
];

export const tacticById = (id: TacticId) => TACTICS.find((t) => t.id === id)!;

/** Combined multiplier. Multiplicative, so two tactics are worth more than the
    sum of their parts — which is the whole point of letting them combine. */
export function loadoutMultiplier(ids: TacticId[]): number {
  return ids.reduce((m, id) => m * (tacticById(id)?.mult ?? 1), 1);
}

/** XP for one card under a loadout. Rounded up so a multiplier never quietly
    rounds away to nothing on a 1-XP card. */
export function applyMultiplier(base: number, ids: TacticId[]): number {
  return Math.ceil(base * loadoutMultiplier(ids));
}

const KEY = "klausum:loadout";

export function loadLoadout(): TacticId[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((id): id is TacticId => TACTICS.some((t) => t.id === id))
      .slice(0, MAX_TACTICS);
  } catch {
    return [];
  }
}

export function saveLoadout(ids: TacticId[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids.slice(0, MAX_TACTICS)));
  } catch {
    /* a full or blocked localStorage must not stop someone studying */
  }
}
