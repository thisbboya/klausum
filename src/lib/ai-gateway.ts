// Server-side helper to talk to AI models.
// Uses a rotating pool of GEMINI_API_KEY[_2..8]. NEVER import this from client code.
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";
import { pickGeminiKey, blockGeminiKey, hasGeminiKeys } from "./gemini-keys.server";

export const DEFAULT_MODEL = "google/gemini-3-flash-preview";
// The 3.1-pro tier has no free-tier quota (429s immediately), so "pro" work
// runs on the same verified-working flash model. Switch this back to
// "google/gemini-3.1-pro-preview" once billing is enabled on the key's project.
export const PRO_MODEL = "google/gemini-3-flash-preview";

/** Stable siblings to fall back to when the primary model is 503-ing.
 *  All verified available on the current keys. */
const FALLBACK_MODELS = [
  "google/gemini-flash-latest",
  "google/gemini-3.1-flash-lite",
];

/** Strip the `google/` prefix and pass the model id through as-is.
 *
 *  We used to down-map these to the 2.5 family, but Google has retired those
 *  for new projects — `gemini-2.5-flash` now returns
 *  "no longer available to new users" (404). The 3.x ids are live and verified
 *  working, so the mapping is gone. */
function toGoogleModelId(modelId: string): string {
  return modelId.startsWith("google/") ? modelId.slice("google/".length) : modelId;
}

/**
 * Resolve a chat model from the rotating Gemini key pool.
 *
 * Returns the model plus the raw Gemini key string that was picked, so callers
 * can block that key on a 429.
 */
export function resolveModelWithKey(modelId: string = DEFAULT_MODEL): {
  model: LanguageModel;
  geminiKey: string;
} {
  if (!hasGeminiKeys()) {
    throw new Error("No AI provider key configured (set GEMINI_API_KEY).");
  }
  const picked = pickGeminiKey();
  if (!picked) {
    throw new Error("All Gemini keys are rate-limited. Try again shortly.");
  }
  const google = createGoogleGenerativeAI({ apiKey: picked.key });
  return { model: google(toGoogleModelId(modelId)), geminiKey: picked.key };
}

/** Back-compat thin wrapper for code paths that just want a model. */
export function resolveModel(modelId: string = DEFAULT_MODEL): LanguageModel {
  return resolveModelWithKey(modelId).model;
}

/** Retry a Gemini call up to 4 times, rotating keys on 429/quota/permission.
 *  Permanently (24h) blocks a key whose GCP project has the Generative
 *  Language API disabled, and rethrows a tagged `GEMINI_API_DISABLED` error so
 *  the UI can surface an actionable message. */
export async function withGeminiRetry<T>(
  modelId: string,
  fn: (model: LanguageModel) => Promise<T>,
): Promise<T> {
  let lastErr: unknown;
  // Preview models go 503 ("high demand") for minutes at a time. After a couple
  // of failed attempts we swap to a stable sibling rather than failing the user.
  const modelChain = [modelId, ...FALLBACK_MODELS.filter((m) => m !== modelId)];
  for (let attempt = 0; attempt < 6; attempt++) {
    const activeModel = modelChain[Math.min(Math.floor(attempt / 2), modelChain.length - 1)];
    const { model, geminiKey } = resolveModelWithKey(activeModel);
    try {
      return await fn(model);
    } catch (err: any) {
      lastErr = err;
      const msg = String(err?.message ?? err);
      const status = err?.statusCode ?? err?.status;
      const isApiDisabled =
        status === 403 &&
        /not been used in project|SERVICE_DISABLED|generativelanguage\.googleapis\.com/i.test(msg);
      if (isApiDisabled) {
        // Long block — manual re-enable required in GCP.
        blockGeminiKey(geminiKey, 24 * 60 * 60 * 1000);
        const projMatch = msg.match(/project[^0-9]{0,8}(\d{6,})/i);
        const tagged = new Error(
          `GEMINI_API_DISABLED${projMatch ? `:${projMatch[1]}` : ""} — Generative Language API is disabled in the Google Cloud project for this key.`,
        );
        // Try the next pooled key instead of failing outright.
        if (attempt < 5) continue;
        throw tagged;
      }
      const isRateLimit =
        status === 429 ||
        /429|quota|rate.?limit|resource.?exhausted/i.test(msg);
      // Google returns 503 UNAVAILABLE ("model is currently experiencing high
      // demand") fairly often. It's transient and retryable — previously it
      // threw straight through and surfaced as a hard failure to the user.
      const isTransient =
        status === 503 ||
        status === 500 ||
        /unavailable|high demand|overloaded|try again later|internal error/i.test(msg);
      if (!isRateLimit && !isTransient) throw err;
      // Only a rate limit means *this key* is spent; a 503 is server-side, so
      // keep the key usable and just back off.
      if (isRateLimit) blockGeminiKey(geminiKey, 60_000);
      const backoff = isTransient && !isRateLimit ? 700 * (attempt + 1) : 250 + attempt * 250;
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
