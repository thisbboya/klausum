// Users must never see raw failure detail (stack traces, HTML error pages,
// provider quota text, or "go add a key in Admin"). They get a calm, actionable
// sentence; the real message goes to `app_error_logs`, which only admins can read.
import { supabase } from "@/integrations/supabase/client";

/** Friendly, non-technical wording shown to end users. */
const FEATURE_LABELS: Record<string, string> = {
  quiz_generate: "quiz generation",
  material_process: "material uploads",
  tutor_chat: "AI tutor messages",
  material_chat: "document chat messages",
  video_analyze: "video analyses",
  video_chat: "video chat messages",
  video_quiz: "video quizzes",
  regenerate: "regenerations",
};

export function friendlyMessage(raw: string, status?: number): string {
  const t = (raw ?? "").toString();

  // Admin-configured daily allowance — users must know exactly what happened,
  // so this is checked BEFORE the generic "busy" mapping.
  const rl = t.match(/RATE_LIMIT:([a-z_]+):(\d+)/i);
  if (rl) {
    const label = FEATURE_LABELS[rl[1]] ?? "this feature";
    return `You've used all ${rl[2]} of today's free ${label}. Your allowance resets at midnight (UTC).`;
  }

  // Anything AI/provider related — never mention quotas, keys, or Gemini.
  if (
    /quota|rate.?limit|resource.?exhausted|\b429\b|GEMINI|API key|high demand|unavailable|overloaded/i.test(t) ||
    status === 429 ||
    status === 503
  ) {
    return "Klausum is a bit busy right now. Give it a moment and try again.";
  }
  if (status === 401 || /unauthori[sz]ed/i.test(t)) {
    return "Your session expired — please sign in again.";
  }
  if (/network|fetch failed|timeout|ECONN|ENOTFOUND/i.test(t)) {
    return "Connection problem. Check your internet and try again.";
  }
  if (status && status >= 500) {
    return "Something went wrong on our end. Please try again shortly.";
  }
  return "That didn't work. Please try again.";
}

/**
 * Log the real error for admins and return the message to show the user.
 * Never throws — reporting must not create a second failure.
 */
export function reportError(
  context: string,
  raw: unknown,
  status?: number,
): string {
  const message =
    raw instanceof Error ? (raw.stack ?? raw.message) : String(raw ?? "unknown error");
  // A rate-limit hit is expected behaviour, not an error — usage lives in
  // ai_usage_events, so don't flood the admin error log with it.
  if (/RATE_LIMIT:/i.test(message)) return friendlyMessage(message, status);
  try {
    void (supabase as any)
      .from("app_error_logs")
      .insert({ context, message: message.slice(0, 4000), status_code: status ?? null })
      .then(() => {}, () => {});
  } catch {
    /* reporting is best-effort */
  }
  if (import.meta.env.DEV) console.error(`[${context}]`, raw);
  return friendlyMessage(message, status);
}
