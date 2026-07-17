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

export async function createDuel(opts: {
  challengerId: string;
  opponentId: string;
  quizId: string;
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
      quiz_id: opts.quizId,
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
