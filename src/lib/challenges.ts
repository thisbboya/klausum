export type Challenge = {
  key: string;
  title: string;
  description: string;
  xp: number;
  cadence: "daily" | "weekly";
  target: number;
  unit: string;
};

export const CHALLENGES: Challenge[] = [
  { key: "daily_review_10", title: "Review 10 cards", description: "Rate 10 flashcards today", xp: 30, cadence: "daily", target: 10, unit: "cards" },
  { key: "daily_focus_25", title: "One Pomodoro", description: "Complete a 25-min focus session", xp: 25, cadence: "daily", target: 1, unit: "session" },
  { key: "daily_quiz_1", title: "Take a quiz", description: "Finish 1 quiz today", xp: 20, cadence: "daily", target: 1, unit: "quiz" },
  { key: "weekly_streak_5", title: "5-day streak", description: "Study 5 days this week", xp: 100, cadence: "weekly", target: 5, unit: "days" },
  { key: "weekly_xp_500", title: "Earn 500 XP", description: "Hit 500 XP this week", xp: 150, cadence: "weekly", target: 500, unit: "XP" },
  { key: "weekly_material_3", title: "Add 3 materials", description: "Upload 3 new materials this week", xp: 80, cadence: "weekly", target: 3, unit: "materials" },
];

export function challengeWindow(cadence: "daily" | "weekly"): { start: Date; end: Date } {
  const now = new Date();
  if (cadence === "daily") {
    const s = new Date(now); s.setHours(0, 0, 0, 0);
    const e = new Date(s); e.setDate(e.getDate() + 1);
    return { start: s, end: e };
  }
  const s = new Date(now);
  const day = s.getDay();
  s.setDate(s.getDate() - day);
  s.setHours(0, 0, 0, 0);
  const e = new Date(s); e.setDate(e.getDate() + 7);
  return { start: s, end: e };
}
