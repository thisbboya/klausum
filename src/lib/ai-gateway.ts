// Server-side helper to talk to AI models.
// Prefers the user's own GEMINI_API_KEY (direct Google API) when present,
// and falls back to Lovable AI Gateway via Vercel AI SDK otherwise.
// NEVER import this from client code — it reads server-side keys.
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";

export const DEFAULT_MODEL = "google/gemini-3-flash-preview";
export const PRO_MODEL = "google/gemini-3.1-pro-preview";

// Map Lovable gateway model IDs to native Google model IDs.
function toGoogleModelId(modelId: string): string {
  const id = modelId.startsWith("google/") ? modelId.slice("google/".length) : modelId;
  // Preview aliases → closest available Google API model
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
 * Resolve a chat model. Prefers GEMINI_API_KEY (direct Google) for `google/*`
 * model IDs, then falls back to Lovable AI Gateway with LOVABLE_API_KEY.
 */
export function resolveModel(modelId: string = DEFAULT_MODEL): LanguageModel {
  const gemKey = process.env.GEMINI_API_KEY;
  if (gemKey && modelId.startsWith("google/")) {
    const google = createGoogleGenerativeAI({ apiKey: gemKey });
    return google(toGoogleModelId(modelId));
  }
  const lovableKey = process.env.LOVABLE_API_KEY;
  if (!lovableKey) {
    throw new Error("No AI provider key configured (set GEMINI_API_KEY or LOVABLE_API_KEY).");
  }
  return createLovableAiGatewayProvider(lovableKey)(modelId);
}
