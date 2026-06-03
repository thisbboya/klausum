import { supabase } from "@/integrations/supabase/client";

// Centralized XP award helper.
// Increments xp_total, logs xp_event, and updates the weekly leaderboard.
export async function awardXp(opts: {
  userId: string;
  amount: number;
  action: string;
  description?: string;
}) {
  const { userId, amount, action, description } = opts;
  if (!amount || amount <= 0) return;
  try {
    await Promise.all([
      supabase.rpc("increment_xp", { _amount: amount }),
      supabase.rpc("log_xp_event", { _action: action, _amount: amount, _description: description ?? null }),
      supabase.rpc("update_weekly_leaderboard", { p_user_id: userId, p_xp: amount }),
    ]);
  } catch (e) {
    console.warn("[awardXp] failed", e);
  }
}
