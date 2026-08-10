// Server-only: admin-configured daily quotas for AI-dependent features.
//
// Admins set one limit per feature in Admin → Limits; it applies equally to
// every user (admins included, so you can test it yourself). Usage is counted
// per UTC day. When a user is over the cap we throw a tagged error the client
// maps to a clear "you've used today's allowance" message.
import { createClient } from "@supabase/supabase-js";

export type AiFeature =
  | "quiz_generate"
  | "material_process"
  | "tutor_chat"
  | "material_chat"
  | "video_analyze"
  | "video_chat"
  | "video_quiz"
  | "regenerate";

function serviceClient() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

/**
 * Check the caller's remaining allowance for a feature and record one use.
 * Throws `Error("RATE_LIMIT:<feature>:<limit>")` when the cap is reached.
 *
 * Fail-open by design: if the limits table is unreachable we let the call
 * through — a broken limits lookup must never take AI features down with it.
 */
export async function consumeAiQuota(userId: string, feature: AiFeature): Promise<void> {
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!svc) return; // no service key configured → limits can't be enforced
  try {
    const sa = serviceClient();
    const { data: rule } = await sa
      .from("ai_rate_limits")
      .select("daily_limit, enabled")
      .eq("feature", feature)
      .maybeSingle();
    if (!rule || !rule.enabled) return; // unconfigured/disabled → unlimited
    // A cap of 0 (or negative) is treated as unlimited, matching the line
    // above. Without this, `count >= 0` is true on the very first call, so one
    // stray 0 in the admin panel silently and permanently kills an AI feature
    // for every user — and tells them "you've used all 0 of today's free…".
    // That has already happened in production once.
    if (rule.daily_limit <= 0) return;

    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const { count } = await sa
      .from("ai_usage_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("feature", feature)
      .gte("created_at", dayStart.toISOString());

    if ((count ?? 0) >= rule.daily_limit) {
      throw new Error(`RATE_LIMIT:${feature}:${rule.daily_limit}`);
    }
    await sa.from("ai_usage_events").insert({ user_id: userId, feature });
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("RATE_LIMIT:")) throw err;
    // lookup/insert failure → fail open
  }
}
