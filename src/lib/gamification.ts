// Gamification helpers: XP ladder + achievement badges
export const LEVELS = [
  { xp: 0, name: "Newcomer" },
  { xp: 200, name: "Beginner" },
  { xp: 500, name: "Curious Mind" },
  { xp: 1000, name: "Active Learner" },
  { xp: 2000, name: "Sharp Student" },
  { xp: 3500, name: "Knowledge Seeker" },
  { xp: 5500, name: "Academic Warrior" },
  { xp: 8000, name: "Distinction Seeker" },
  { xp: 12000, name: "First Class Mind" },
  { xp: 18000, name: "Klausum Master" },
  { xp: 25000, name: "Klausum Legend" },
];

export function levelFor(xp: number) {
  let current = LEVELS[0];
  let next: typeof LEVELS[number] | null = LEVELS[1] ?? null;
  for (let i = 0; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i].xp) {
      current = LEVELS[i];
      next = LEVELS[i + 1] ?? null;
    }
  }
  const span = next ? next.xp - current.xp : 1;
  const pct = next ? Math.min(100, Math.round(((xp - current.xp) / span) * 100)) : 100;
  return { current, next, pct };
}

export type BadgeDef = {
  id: string;
  name: string;
  desc: string;
  emoji: string;
  /** The stat this badge counts, and how much of it is needed. */
  stat: keyof BadgeStats;
  need: number;
  test: (s: BadgeStats) => boolean;
};

export type BadgeStats = {
  materials: number;
  reviews: number;
  streak: number;
  longestStreak: number;
  attempts: number;
  bestBloom: number;
  gapsResolved: number;
  voiceNotes: number;
  formulas: number;
  roomsHosted: number;
  codeRuns: number;
  feynmanSessions: number;
  xp: number;
};

// Every badge is a threshold on one stat, so declaring the stat and the target
// rather than an opaque predicate means progress can be shown. A locked badge
// used to be a bare padlock: no way to tell whether you were one review away or
// four hundred, which turns fifteen potential goals into fifteen dead squares.
const BADGE_TABLE: Omit<BadgeDef, "test">[] = [
  { id: "first_upload", name: "First Upload", desc: "Upload your first study material", emoji: "📤", stat: "materials", need: 1 },
  { id: "five_materials", name: "Library Builder", desc: "Upload 5 materials", emoji: "📚", stat: "materials", need: 5 },
  { id: "streak_7", name: "7-Day Streak", desc: "Study 7 days in a row", emoji: "🔥", stat: "longestStreak", need: 7 },
  { id: "streak_30", name: "30-Day Streak", desc: "Study 30 days in a row", emoji: "🔥🔥", stat: "longestStreak", need: 30 },
  { id: "review_50", name: "Card Crusher", desc: "Complete 50 reviews", emoji: "🧠", stat: "reviews", need: 50 },
  { id: "review_500", name: "Memory Master", desc: "Complete 500 reviews", emoji: "🏆", stat: "reviews", need: 500 },
  { id: "quiz_10", name: "Quiz Regular", desc: "Take 10 quizzes", emoji: "📝", stat: "attempts", need: 10 },
  { id: "bloom_l6", name: "Bloom L6 Achiever", desc: "Score on a Level 6 (Create) question", emoji: "🎯", stat: "bestBloom", need: 6 },
  { id: "gap_crusher", name: "Gap Crusher", desc: "Resolve 10 knowledge gaps", emoji: "💪", stat: "gapsResolved", need: 10 },
  { id: "code_runner", name: "Code Runner", desc: "Run code in the Lab", emoji: "💻", stat: "codeRuns", need: 1 },
  { id: "formula_scholar", name: "Formula Scholar", desc: "Save 10 formulas", emoji: "∑", stat: "formulas", need: 10 },
  { id: "voice_learner", name: "Voice Learner", desc: "Record a voice note", emoji: "🎙️", stat: "voiceNotes", need: 1 },
  { id: "room_host", name: "Study Room Host", desc: "Host a study room", emoji: "👥", stat: "roomsHosted", need: 1 },
  { id: "feynman", name: "Feynman Master", desc: "10 Socratic tutor sessions", emoji: "🧙", stat: "feynmanSessions", need: 10 },
  { id: "xp_5k", name: "Academic Warrior", desc: "Earn 5,500 XP", emoji: "⚔️", stat: "xp", need: 5500 },
];

export const BADGES: BadgeDef[] = BADGE_TABLE.map((b) => ({
  ...b,
  test: (s: BadgeStats) => (s[b.stat] ?? 0) >= b.need,
}));

/** How far along a badge is: {have, need, pct} — pct capped at 100. */
export function badgeProgress(badge: BadgeDef, s: BadgeStats) {
  const have = Math.max(0, s[badge.stat] ?? 0);
  return {
    have,
    need: badge.need,
    pct: Math.min(100, Math.round((have / badge.need) * 100)),
  };
}

/**
 * The locked badge the student is closest to finishing, ignoring ones they
 * have not started at all — "3 of 5 uploads" is a nudge worth showing, "0 of
 * 500 reviews" is just noise.
 */
export function nearestBadge(s: BadgeStats) {
  return BADGES.filter((b) => !b.test(s))
    .map((b) => ({ badge: b, ...badgeProgress(b, s) }))
    .filter((x) => x.have > 0)
    .sort((a, b) => b.pct - a.pct)[0];
}
