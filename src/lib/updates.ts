export type UpdateEntry = {
  id: string;
  title: string;
  body: string;
  date: string; // ISO
};

// Newest first. Add an entry here whenever you ship something worth telling
// students about — this is the only place the Updates page reads from.
export const UPDATES: UpdateEntry[] = [
  {
    id: "2026-07-16-duels",
    title: "Challenge a friend to a quiz duel",
    body: "Pick any quiz, set a time limit and an expiry window, and see who scores higher. Find it under Community → Duels.",
    date: "2026-07-16",
  },
  {
    id: "2026-07-16-leaderboard",
    title: "Global and school leaderboards",
    body: "The weekly leaderboard now has Friends, School, and Global scopes, with a podium for the top 3.",
    date: "2026-07-16",
  },
  {
    id: "2026-07-15-redesign",
    title: "A brand new look",
    body: "Klausum got a full visual refresh — chunkier buttons, a lighter default theme, and a companion that reflects its own color everywhere in the app.",
    date: "2026-07-15",
  },
];

const SEEN_KEY = "klausum:updatesSeenAt";

export function latestUpdateDate(): string {
  return UPDATES[0]?.date ?? "";
}

export function hasUnseenUpdates(): boolean {
  try {
    const seen = localStorage.getItem(SEEN_KEY);
    if (!seen) return UPDATES.length > 0;
    return latestUpdateDate() > seen;
  } catch {
    return false;
  }
}

export function markUpdatesSeen() {
  try {
    localStorage.setItem(SEEN_KEY, latestUpdateDate());
  } catch {}
}
