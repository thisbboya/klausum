// Server-side helper to talk to AI models.
// Uses a rotating pool of GEMINI_API_KEY[_2..8] when available, falls back to
// Lovable AI Gateway otherwise. NEVER import this from client code.
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
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

export const createLovableAiGatewayProvider = (lovableApiKey: string) =>
  createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": lovableApiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });

/**
 * Resolve a chat model. Prefers the rotating Gemini key pool for `google/*`
 * model IDs, then falls back to Lovable AI Gateway with LOVABLE_API_KEY.
 *
 * Returns a tuple of [model, keyUsed]. `keyUsed` is the raw Gemini key string
 * if a Gemini key was picked (so callers can block it on 429), or null when
 * we fell back to the Lovable gateway.
 */
export function resolveModelWithKey(modelId: string = DEFAULT_MODEL): {
  model: LanguageModel;
  geminiKey: string | null;
} {
  if (modelId.startsWith("google/") && hasGeminiKeys()) {
    const picked = pickGeminiKey();
    if (picked) {
      const google = createGoogleGenerativeAI({ apiKey: picked.key });
      return { model: google(toGoogleModelId(modelId)), geminiKey: picked.key };
    }
    // pool exhausted → fall through to gateway
  }
  const lovableKey = process.env.LOVABLE_API_KEY;
  if (!lovableKey) {
    throw new Error("No AI provider key configured (set GEMINI_API_KEY or LOVABLE_API_KEY).");
  }
  return { model: createLovableAiGatewayProvider(lovableKey)(modelId), geminiKey: null };
}

/** Back-compat thin wrapper for code paths that just want a model. */
export function resolveModel(modelId: string = DEFAULT_MODEL): LanguageModel {
  return resolveModelWithKey(modelId).model;
}

/** Retry a Gemini call up to 4 times, rotating keys on 429/quota/permission. */
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
      const isRateLimit =
        status === 429 ||
        /429|quota|rate.?limit|resource.?exhausted|permission/i.test(msg);
      if (!isRateLimit) throw err;
      if (geminiKey) blockGeminiKey(geminiKey, 60_000);
      // Small backoff so a burst of parallel callers don't all retry instantly.
      await new Promise((r) => setTimeout(r, 250 + attempt * 250));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
