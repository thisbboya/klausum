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
export type CrestSet = "elements" | "scholar" | "ghana";

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
];

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
