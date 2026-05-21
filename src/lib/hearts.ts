import { supabase } from "@/integrations/supabase/client";

export const HEARTS_MAX = 5;
export const HEARTS_REFILL_MS = 60 * 60 * 1000; // 1 hour per heart

/**
 * Auto-refill hearts based on time elapsed since last refill.
 * Returns the latest hearts count + ms-until-next-refill.
 * Safe to call on app/dashboard load.
 */
export async function refillHeartsIfDue(userId: string): Promise<{
  hearts: number;
  msUntilNext: number;
}> {
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("hearts, hearts_last_refill")
    .eq("id", userId)
    .maybeSingle();

  const current = (profile as any)?.hearts ?? HEARTS_MAX;
  const lastRefill = (profile as any)?.hearts_last_refill
    ? new Date((profile as any).hearts_last_refill).getTime()
    : Date.now();

  if (current >= HEARTS_MAX) {
    return { hearts: HEARTS_MAX, msUntilNext: 0 };
  }

  const elapsed = Date.now() - lastRefill;
  const earned = Math.floor(elapsed / HEARTS_REFILL_MS);
  if (earned <= 0) {
    return { hearts: current, msUntilNext: HEARTS_REFILL_MS - elapsed };
  }

  const newHearts = Math.min(HEARTS_MAX, current + earned);
  const newLast = new Date(lastRefill + earned * HEARTS_REFILL_MS).toISOString();

  await supabase
    .from("user_profiles")
    .update({ hearts: newHearts, hearts_last_refill: newLast } as any)
    .eq("id", userId);

  const remainder = elapsed - earned * HEARTS_REFILL_MS;
  return {
    hearts: newHearts,
    msUntilNext: newHearts >= HEARTS_MAX ? 0 : HEARTS_REFILL_MS - remainder,
  };
}

/** Lose one heart (capped at 0). */
export async function loseHeart(userId: string): Promise<number> {
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("hearts")
    .eq("id", userId)
    .maybeSingle();
  const current = (profile as any)?.hearts ?? HEARTS_MAX;
  const next = Math.max(0, current - 1);
  await supabase
    .from("user_profiles")
    .update({
      hearts: next,
      // Start the refill clock when hearts first dip below max
      ...(current === HEARTS_MAX ? { hearts_last_refill: new Date().toISOString() } : {}),
    } as any)
    .eq("id", userId);
  return next;
}

/** Restore all hearts (e.g. quiz pass, gem spend). */
export async function restoreHearts(userId: string): Promise<void> {
  await supabase
    .from("user_profiles")
    .update({ hearts: HEARTS_MAX, hearts_last_refill: new Date().toISOString() } as any)
    .eq("id", userId);
}

export function formatRefillCountdown(ms: number): string {
  if (ms <= 0) return "Full";
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  }
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
