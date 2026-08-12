// Core Drive 4 — Ownership & Possession.
//
// Klausum had a currency with nowhere to go. Gems bought a streak freeze, a
// hint pack, a half-hour boost — all consumables, all gone by tomorrow. You
// could earn thousands and own nothing, which quietly teaches that earning
// them doesn't matter.
//
// Crests are the opposite: bought or earned once, kept forever, and worn where
// other people can see them. They also come in sets, because an incomplete set
// is one of the few goals a person will pursue without being asked to.
export type CrestSet = "elements" | "scholar" | "ghana" | "labs" | "curios";

export type Crest = {
  id: string;
  name: string;
  emoji: string;
  set: CrestSet;
  /** Gem price, or null if this one can only be earned. */
  gems: number | null;
  /** Earned crests state their condition; it is checked against BadgeStats. */
  earn?: { stat: string; need: number; label: string };
};

export const SETS: Record<CrestSet, { name: string; blurb: string }> = {
  elements: {
    name: "The Elements",
    blurb: "Four crests, bought with gems. The cheapest way to own something.",
  },
  scholar: {
    name: "Scholar's Marks",
    blurb: "Cannot be bought at any price. Only done.",
  },
  ghana: {
    name: "Adinkra",
    blurb: "Symbols that meant something long before this app existed.",
  },
  labs: {
    name: "Lab Quests",
    blurb: "One for each journey finished in the Lab. Not for sale at any price.",
  },
  curios: {
    name: "Curios",
    blurb: "Rare finds from chests. The odds are printed on the chest — no secrets.",
  },
};

export const CRESTS: Crest[] = [
  // Bought — a floor of ownership that does not depend on being good yet.
  { id: "flame", name: "Flame", emoji: "🔥", set: "elements", gems: 40 },
  { id: "tide", name: "Tide", emoji: "🌊", set: "elements", gems: 40 },
  { id: "stone", name: "Stone", emoji: "🪨", set: "elements", gems: 40 },
  { id: "gale", name: "Gale", emoji: "🌪️", set: "elements", gems: 40 },

  // Earned — the ones worth having. Priced at nothing and costing everything.
  {
    id: "owl", name: "The Owl", emoji: "🦉", set: "scholar", gems: null,
    earn: { stat: "reviews", need: 250, label: "250 cards reviewed" },
  },
  {
    id: "anvil", name: "The Anvil", emoji: "⚒️", set: "scholar", gems: null,
    earn: { stat: "longestStreak", need: 21, label: "a 21-day streak" },
  },
  {
    id: "compass", name: "The Compass", emoji: "🧭", set: "scholar", gems: null,
    earn: { stat: "gapsResolved", need: 25, label: "25 knowledge gaps closed" },
  },
  {
    id: "crown", name: "The Crown", emoji: "👑", set: "scholar", gems: null,
    earn: { stat: "xp", need: 12000, label: "12,000 XP" },
  },

  // Adinkra — mixed, so the set is completable but not purchasable outright.
  {
    id: "sankofa", name: "Sankofa", emoji: "🕊️", set: "ghana", gems: null,
    earn: { stat: "reviews", need: 50, label: "50 cards reviewed" },
  },
  { id: "gyenyame", name: "Gye Nyame", emoji: "✴️", set: "ghana", gems: 75 },
  { id: "dwennimmen", name: "Dwennimmen", emoji: "🐏", set: "ghana", gems: 75 },
  {
    id: "nyansapo", name: "Nyansapo", emoji: "🪢", set: "ghana", gems: null,
    earn: { stat: "attempts", need: 20, label: "20 quizzes taken" },
  },

  // Quest rewards. These are granted by the Lab when a journey finishes, not
  // claimed from a stat, so `earn.stat` names nothing real on purpose — it
  // keeps the locked card explaining what earns it while making the progress
  // bar sit at zero, which is honest: you either finished the quest or you
  // didn't. Never buyable; that is the entire point of them.
  {
    id: "coil", name: "The Coil", emoji: "🧲", set: "labs", gems: null,
    earn: { stat: "quest", need: 1, label: "Finish the Induction Engineer quest" },
  },
  {
    id: "flask", name: "The Flask", emoji: "⚗️", set: "labs", gems: null,
    earn: { stat: "quest", need: 1, label: "Finish the Analytical Chemist quest" },
  },
  {
    id: "tangent", name: "The Tangent", emoji: "📐", set: "labs", gems: null,
    earn: { stat: "quest", need: 1, label: "Finish the Limit Breaker quest" },
  },
  {
    id: "resistor", name: "The Resistor", emoji: "⚡", set: "labs", gems: null,
    earn: { stat: "quest", need: 1, label: "Finish the Circuit Builder quest" },
  },
  {
    id: "membrane", name: "The Membrane", emoji: "🧬", set: "labs", gems: null,
    earn: { stat: "quest", need: 1, label: "Finish the Cell Biologist quest" },
  },

  // Curios drop from chests, rolled on the server. Unbuyable, and never
  // duplicated — the roll only ever picks from crests you don't own, because
  // winning something you already have is the fastest way to make published
  // odds feel like a lie.
  {
    id: "comet", name: "Comet", emoji: "☄️", set: "curios", gems: null,
    earn: { stat: "chest", need: 1, label: "Rare find from a chest" },
  },
  {
    id: "geode", name: "Geode", emoji: "🪨", set: "curios", gems: null,
    earn: { stat: "chest", need: 1, label: "Rare find from a chest" },
  },
  {
    id: "aurora", name: "Aurora", emoji: "🌌", set: "curios", gems: null,
    earn: { stat: "chest", need: 1, label: "Rare find from a chest" },
  },
  {
    id: "fossil", name: "Fossil", emoji: "🦴", set: "curios", gems: null,
    earn: { stat: "chest", need: 1, label: "Rare find from a chest" },
  },
];

/** Published chest odds, so the UI and the server agree on the same numbers. */
export const CHEST_ODDS: Record<string, { xp: [number, number]; gems: [number, number]; crest: number }> = {
  bronze: { xp: [10, 25], gems: [5, 15], crest: 0.02 },
  silver: { xp: [25, 60], gems: [15, 35], crest: 0.05 },
  gold: { xp: [60, 150], gems: [35, 80], crest: 0.1 },
};

export const crestById = (id: string) => CRESTS.find((c) => c.id === id);

/** Whether an earned crest's condition is met. Bought crests always return
    false here — they are acquired by paying, not by qualifying. */
export function crestEarned(crest: Crest, stats: Record<string, number>): boolean {
  if (!crest.earn) return false;
  return (stats[crest.earn.stat] ?? 0) >= crest.earn.need;
}

export function setProgress(set: CrestSet, owned: Set<string>) {
  const inSet = CRESTS.filter((c) => c.set === set);
  const have = inSet.filter((c) => owned.has(c.id)).length;
  return { have, total: inSet.length, complete: have === inSet.length };
}
