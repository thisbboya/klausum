// Server-side helper to talk to Lovable AI Gateway via Vercel AI SDK.
// NEVER import this from client code — it reads LOVABLE_API_KEY.
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export const createLovableAiGatewayProvider = (lovableApiKey: string) =>
  createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": lovableApiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });

export const DEFAULT_MODEL = "google/gemini-3-flash-preview";
export const PRO_MODEL = "google/gemini-3.1-pro-preview";
