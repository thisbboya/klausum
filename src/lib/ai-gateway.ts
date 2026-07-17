// Server-side helper to talk to AI models.
// Uses a rotating pool of GEMINI_API_KEY[_2..8]. NEVER import this from client code.
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";
import { pickGeminiKey, blockGeminiKey, hasGeminiKeys } from "./gemini-keys.server";

export const DEFAULT_MODEL = "google/gemini-3-flash-preview";
export const PRO_MODEL = "google/gemini-3.1-pro-preview";

function toGoogleModelId(modelId: string): string {
  const id = modelId.startsWith("google/") ? modelId.slice("google/".length) : modelId;
  const map: Record<string, string> = {
    "gemini-3-flash-preview": "gemini-2.5-flash",
    "gemini-3.1-flash-lite-preview": "gemini-2.5-flash-lite",
    "gemini-3.1-pro-preview": "gemini-2.5-pro",
    "gemini-3.1-flash-image-preview": "gemini-2.5-flash-image",
    "gemini-3-pro-image-preview": "gemini-2.5-flash-image",
  };
  return map[id] ?? id;
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
  for (let attempt = 0; attempt < 4; attempt++) {
    const { model, geminiKey } = resolveModelWithKey(modelId);
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
        if (attempt < 3) continue;
        throw tagged;
      }
      const isRateLimit =
        status === 429 ||
        /429|quota|rate.?limit|resource.?exhausted/i.test(msg);
      if (!isRateLimit) throw err;
      blockGeminiKey(geminiKey, 60_000);
      await new Promise((r) => setTimeout(r, 250 + attempt * 250));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
