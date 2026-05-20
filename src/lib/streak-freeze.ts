import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Auto-activates a streak freeze if the user missed yesterday but has a streak ≥3.
 * Call on dashboard load. Returns true if a freeze was used.
 */
export async function checkAndApplyStreakFreeze(userId: string): Promise<boolean> {
  const { data: p } = await supabase
    .from("user_profiles")
    .select("streak_days, last_study_date, streak_freezes, streak_freeze_used_date")
    .eq("id", userId)
    .maybeSingle();
  if (!p) return false;

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().slice(0, 10);

  // already used today or studied today → nothing to do
  if (p.streak_freeze_used_date === todayStr) return false;
  if (p.last_study_date === todayStr) return false;

  // last study was yesterday → streak is intact
  if (p.last_study_date === yStr) return false;

  // streak would break — try to freeze
  const streak = p.streak_days ?? 0;
  const freezes = p.streak_freezes ?? 0;
  if (streak < 3 || freezes < 1) return false;

  const { error } = await supabase
    .from("user_profiles")
    .update({
      streak_freezes: freezes - 1,
      streak_freeze_used_date: todayStr,
      last_study_date: todayStr,
    })
    .eq("id", userId);

  if (error) return false;

  toast.success(`🧊 Streak Freeze used! Your ${streak}-day streak is safe. ${freezes - 1} freeze${freezes - 1 === 1 ? "" : "s"} remaining.`);
  return true;
}
