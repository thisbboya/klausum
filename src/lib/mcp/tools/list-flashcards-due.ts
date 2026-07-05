import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { createUserSupabase, textResult, errorResult } from "./_client";

export default defineTool({
  name: "list_flashcards_due",
  title: "List flashcards due for review",
  description: "Return flashcards whose next review date is on or before now for the signed-in student.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(20),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const sb = createUserSupabase(ctx);
    const nowIso = new Date().toISOString();
    const { data, error } = await sb
      .from("flashcards")
      .select("id,front,back,next_review_at,deck_id")
      .lte("next_review_at", nowIso)
      .order("next_review_at", { ascending: true })
      .limit(limit);
    if (error) return errorResult(error.message);
    return textResult(JSON.stringify(data ?? []), { due: data ?? [] });
  },
});
