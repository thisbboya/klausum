// Quests: missions arranged into a journey.
//
// The Lab currently shows a flat list of missions per simulation, which is a
// menu. A menu has no shape — nothing tells you where to start, nothing is
// waiting for you, and finishing one thing doesn't make the next thing exist.
//
// A quest is the same missions in an order, where each step opens the next.
// That does three things a list cannot: it gives a beginner one obvious first
// move, it turns "I did a mission" into "I am three steps into becoming an
// electrical engineer", and it lets the final step be worth something —
// completing a quest awards a crest, which is the one reward in this app that
// is permanent and visible to other people.
//
// Deliberately short. A seven-step quest that takes a fortnight is a chore; a
// three- or four-step arc can be finished in a sitting, which is what makes
// someone start the next one.
import { challengeById, type Challenge } from "@/lib/sim/challenges";

export type Quest = {
  id: string;
  title: string;
  /** The fantasy — who you are by the end, not what you clicked. */
  tagline: string;
  subject: "physics" | "chemistry" | "biology" | "maths" | "circuits";
  emoji: string;
  /** Challenge ids, in order. Each unlocks the next. */
  steps: string[];
  /** Crest id awarded on completion; must exist in the collectibles catalogue. */
  reward: string;
  /** Bonus XP on top of the individual missions. */
  bonusXp: number;
};

export const QUESTS: Quest[] = [
  {
    id: "quest-induction",
    title: "Induction Engineer",
    tagline: "Understand how movement becomes electricity.",
    subject: "physics",
    emoji: "🧲",
    steps: ["faraday-first-current", "faraday-steady-hand"],
    reward: "coil",
    bonusXp: 100,
  },
  {
    id: "quest-analyst",
    title: "Analytical Chemist",
    tagline: "Find out exactly what is in an unknown solution.",
    subject: "chemistry",
    emoji: "⚗️",
    steps: ["titration-find-endpoint", "titration-dilute"],
    reward: "flask",
    bonusXp: 150,
  },
  {
    id: "quest-calculus",
    title: "Limit Breaker",
    tagline: "Watch a definition become a tool you can use.",
    subject: "maths",
    emoji: "📐",
    steps: ["derivative-close-the-gap", "derivative-stationary"],
    reward: "tangent",
    bonusXp: 120,
  },
  {
    id: "quest-circuits",
    title: "Circuit Builder",
    tagline: "Make current do what you tell it to.",
    subject: "circuits",
    emoji: "⚡",
    steps: ["circuit-ohm", "circuit-parallel-insight"],
    reward: "resistor",
    bonusXp: 150,
  },
  {
    id: "quest-membrane",
    title: "Cell Biologist",
    tagline: "Learn why water moves when nothing is pushing it.",
    subject: "biology",
    emoji: "🧬",
    steps: ["osmosis-equilibrium"],
    reward: "membrane",
    bonusXp: 100,
  },
];

export const questById = (id: string) => QUESTS.find((q) => q.id === id);

export type QuestStep = {
  challenge: Challenge;
  done: boolean;
  /** Reachable now: the first unfinished step, or any already finished. */
  unlocked: boolean;
};

export type QuestState = {
  quest: Quest;
  steps: QuestStep[];
  doneCount: number;
  complete: boolean;
  /** The step to point at — the first one not yet done. */
  next: Challenge | null;
};

/**
 * Resolve a quest against what the student has completed.
 *
 * Steps unlock strictly in order. Missing challenge ids are dropped rather than
 * rendered as broken rows, so a typo in the catalogue shortens a quest instead
 * of wedging it.
 */
export function questState(quest: Quest, doneIds: Set<string>): QuestState {
  const resolved = quest.steps
    .map((id) => challengeById(id))
    .filter((c): c is Challenge => !!c);

  let unlockedSoFar = true;
  const steps: QuestStep[] = resolved.map((challenge) => {
    const done = doneIds.has(challenge.id);
    const unlocked = unlockedSoFar;
    // The next locked step is the first one after an unfinished step.
    if (!done) unlockedSoFar = false;
    return { challenge, done, unlocked };
  });

  const doneCount = steps.filter((s) => s.done).length;
  return {
    quest,
    steps,
    doneCount,
    complete: steps.length > 0 && doneCount === steps.length,
    next: steps.find((s) => !s.done)?.challenge ?? null,
  };
}

export const questsForSim = (simId: string) =>
  QUESTS.filter((q) => q.steps.some((s) => challengeById(s)?.simId === simId));
