import { supabase } from "@/integrations/supabase/client";

export type Duel = {
  id: string;
  challenger_id: string;
  opponent_id: string;
  quiz_id: string;
  time_limit_seconds: number;
  expires_at: string;
  status: "pending" | "active" | "completed" | "expired";
  challenger_score: number | null;
  opponent_score: number | null;
  winner_id: string | null;
  created_at: string;
};

export const TIME_LIMIT_OPTIONS = [
  { label: "30s", seconds: 30 },
  { label: "1m", seconds: 60 },
  { label: "1.5m", seconds: 90 },
  { label: "2m", seconds: 120 },
  { label: "3m", seconds: 180 },
  { label: "5m", seconds: 300 },
];

export const EXPIRY_OPTIONS = [
  { label: "1h", hours: 1 },
  { label: "2h", hours: 2 },
  { label: "4h", hours: 4 },
  { label: "6h", hours: 6 },
  { label: "12h", hours: 12 },
];

/**
 * Build the question set for a duel out of a material's key concepts.
 *
 * A duel used to point at an existing quiz, which either player could open
 * beforehand and read the answers from — so the winner was whoever thought to
 * cheat. Generating from the material means the questions do not exist until
 * the duel is created, and both players meet the same unseen set.
 *
 * Built locally from stored concepts rather than by calling the model: a duel
 * has to be instant, and this costs nothing and cannot fail halfway.
 */
export function buildDuelQuestions(
  concepts: { concept: string; definition: string }[],
  count = 6,
) {
  const pool = [...concepts]
    .filter((c) => c.concept?.trim() && c.definition?.trim())
    // Fisher–Yates, so the same material gives a different duel each time.
    .map((c) => ({ c, k: Math.random() }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.c);

  return pool.slice(0, count).map((answer) => {
    const distractors = pool
      .filter((c) => c.concept !== answer.concept)
      .slice(0, 3)
      .map((c) => c.concept);
    const options = [answer.concept, ...distractors]
      .map((o) => ({ o, k: Math.random() }))
      .sort((a, b) => a.k - b.k)
      .map((x) => x.o);
    return {
      question: `Which term does this describe?\n\n"${answer.definition}"`,
      options,
      correct: options.indexOf(answer.concept),
    };
  });
}

export async function createDuel(opts: {
  challengerId: string;
  opponentId: string;
  materialId: string;
  questions: ReturnType<typeof buildDuelQuestions>;
  timeLimitSeconds: number;
  expiryHours: number;
}) {
  const expiresAt = new Date(Date.now() + opts.expiryHours * 3600_000).toISOString();
  // quiz_challenges / submit_duel_score aren't in the generated Supabase types yet
  // (added via direct migration, not `supabase gen types`) — cast at the edge.
  return (supabase as any)
    .from("quiz_challenges")
    .insert({
      challenger_id: opts.challengerId,
      opponent_id: opts.opponentId,
      material_id: opts.materialId,
      questions: opts.questions,
      time_limit_seconds: opts.timeLimitSeconds,
      expires_at: expiresAt,
      status: "pending",
    })
    .select("*")
    .single();
}

export async function submitDuelScore(challengeId: string, score: number, total: number) {
  const { data, error } = await (supabase as any).rpc("submit_duel_score", {
    p_challenge_id: challengeId,
    p_score: score,
    p_total: total,
  });
  if (error) throw error;
  return data as Duel;
}
