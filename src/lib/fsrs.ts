// FSRS-5 spaced repetition algorithm
// Trained on 700M+ reviews; ~20-30% more efficient than SM-2.

export interface FSRSState {
  stability: number;
  difficulty: number;
  retrievability: number;
  repetitions: number;
  lapses: number;
  state: "new" | "learning" | "review" | "relearning";
  nextReviewDate: string; // YYYY-MM-DD
  lastReviewDate: string | null;
}

const W = [
  0.4072, 1.1829, 3.1262, 15.4722, 7.2102, 0.5316, 1.0651, 0.0589, 1.533,
  0.1544, 1.0071, 1.9337, 0.11, 0.29, 2.27, 0.065, 2.9898, 0.51, 0.36,
];

const RETENTION_TARGET = 0.9;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  return Math.max(
    0,
    Math.round(
      (new Date(to).getTime() - new Date(from).getTime()) / 86400000
    )
  );
}

function forgettingCurve(elapsed: number, stability: number): number {
  if (stability <= 0) return 0;
  return Math.pow(1 + elapsed / (9 * stability), -1);
}

function nextInterval(stability: number): number {
  return Math.max(
    1,
    Math.round(9 * stability * (RETENTION_TARGET / (1 - RETENTION_TARGET)))
  );
}

function initDifficulty(rating: number): number {
  return Math.min(10, Math.max(1, W[4] - Math.exp(W[5] * (rating - 1)) + 1));
}

function nextDifficulty(d: number, rating: number): number {
  const delta = W[6] * (3 - rating);
  return Math.min(10, Math.max(1, d + delta));
}

function shortTermStability(d: number, rating: number): number {
  return Math.max(0.1, W[0] + W[1] * (d - 1) + W[2] * rating);
}

function longTermStability(s: number, d: number, r: number, rating: number): number {
  const hardPenalty = rating === 2 ? W[15] : 1;
  const easyBonus = rating === 4 ? W[16] : 1;
  const factor =
    Math.exp(W[8]) *
    (11 - d) *
    Math.pow(s, -W[9]) *
    (Math.exp((1 - r) * W[10]) - 1) *
    hardPenalty *
    easyBonus;
  return s * Math.max(1.05, factor);
}

export function createNewCard(): FSRSState {
  return {
    stability: 0,
    difficulty: 0,
    retrievability: 0,
    repetitions: 0,
    lapses: 0,
    state: "new",
    nextReviewDate: todayISO(),
    lastReviewDate: null,
  };
}

export type Rating = 1 | 2 | 3 | 4; // Again, Hard, Good, Easy

export function reviewCard(card: FSRSState, rating: Rating): FSRSState {
  const today = todayISO();
  const elapsed = card.lastReviewDate
    ? daysBetween(card.lastReviewDate, today)
    : 0;

  let { stability: s, difficulty: d, lapses, repetitions, state } = card;
  const r = s > 0 ? forgettingCurve(elapsed, s) : 0;

  if (state === "new") {
    d = initDifficulty(rating);
    s = shortTermStability(d, rating);
    state = rating === 1 ? "learning" : "review";
  } else if (state === "learning" || state === "relearning") {
    if (rating === 1) {
      lapses++;
      s = W[17];
    } else {
      d = nextDifficulty(d, rating);
      s = longTermStability(s || shortTermStability(d, rating), d, r, rating);
      state = "review";
    }
  } else {
    if (rating === 1) {
      lapses++;
      state = "relearning";
      s = W[17];
    } else {
      d = nextDifficulty(d, rating);
      s = longTermStability(s, d, r, rating);
    }
  }

  s = Math.max(0.1, parseFloat(s.toFixed(4)));
  d = Math.min(10, Math.max(1, parseFloat(d.toFixed(4))));
  repetitions += 1;

  const interval =
    state === "review" ? nextInterval(s) : rating === 1 ? 0 : 1;
  const next = new Date();
  next.setDate(next.getDate() + interval);

  return {
    stability: s,
    difficulty: d,
    retrievability: r,
    repetitions,
    lapses,
    state,
    nextReviewDate: next.toISOString().slice(0, 10),
    lastReviewDate: today,
  };
}

export function isDue(nextReviewDate: string): boolean {
  return nextReviewDate <= todayISO();
}
