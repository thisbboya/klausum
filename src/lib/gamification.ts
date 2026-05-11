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
  { xp: 18000, name: "NkyinkyimIQ Master" },
  { xp: 25000, name: "NkyinkyimIQ Legend" },
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

export const BADGES: BadgeDef[] = [
  { id: "first_upload", name: "First Upload", desc: "Upload your first study material", emoji: "📤", test: (s) => s.materials >= 1 },
  { id: "five_materials", name: "Library Builder", desc: "Upload 5 materials", emoji: "📚", test: (s) => s.materials >= 5 },
  { id: "streak_7", name: "7-Day Streak", desc: "Study 7 days in a row", emoji: "🔥", test: (s) => s.longestStreak >= 7 },
  { id: "streak_30", name: "30-Day Streak", desc: "Study 30 days in a row", emoji: "🔥🔥", test: (s) => s.longestStreak >= 30 },
  { id: "review_50", name: "Card Crusher", desc: "Complete 50 reviews", emoji: "🧠", test: (s) => s.reviews >= 50 },
  { id: "review_500", name: "Memory Master", desc: "Complete 500 reviews", emoji: "🏆", test: (s) => s.reviews >= 500 },
  { id: "quiz_10", name: "Quiz Regular", desc: "Take 10 quizzes", emoji: "📝", test: (s) => s.attempts >= 10 },
  { id: "bloom_l6", name: "Bloom L6 Achiever", desc: "Score on a Level 6 (Create) question", emoji: "🎯", test: (s) => s.bestBloom >= 6 },
  { id: "gap_crusher", name: "Gap Crusher", desc: "Resolve 10 knowledge gaps", emoji: "💪", test: (s) => s.gapsResolved >= 10 },
  { id: "code_runner", name: "Code Runner", desc: "Run code in the Lab", emoji: "💻", test: (s) => s.codeRuns >= 1 },
  { id: "formula_scholar", name: "Formula Scholar", desc: "Save 10 formulas", emoji: "∑", test: (s) => s.formulas >= 10 },
  { id: "voice_learner", name: "Voice Learner", desc: "Record a voice note", emoji: "🎙️", test: (s) => s.voiceNotes >= 1 },
  { id: "room_host", name: "Study Room Host", desc: "Host a study room", emoji: "👥", test: (s) => s.roomsHosted >= 1 },
  { id: "feynman", name: "Feynman Master", desc: "10 Socratic tutor sessions", emoji: "🧙", test: (s) => s.feynmanSessions >= 10 },
  { id: "xp_5k", name: "Academic Warrior", desc: "Earn 5,500 XP", emoji: "⚔️", test: (s) => s.xp >= 5500 },
];
