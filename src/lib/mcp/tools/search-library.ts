import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { createUserSupabase, textResult, errorResult } from "./_client";

export default defineTool({
  name: "search_library",
  title: "Search library",
  description:
    "Keyword search across the signed-in student's study materials. Returns matching materials with a short snippet.",
  inputSchema: {
    query: z.string().min(1).describe("Search term or phrase"),
    limit: z.number().int().min(1).max(20).default(8),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const sb = createUserSupabase(ctx);
    const { data, error } = await sb
      .from("study_materials")
      .select("id,title,subject,original_content")
      .limit(50);
    if (error) return errorResult(error.message);
    const q = query.toLowerCase();
    const hits = (data ?? [])
      .map((m) => {
        const text = (m.original_content ?? "").toLowerCase();
        const idx = text.indexOf(q);
        if (idx < 0) return null;
        return {
          id: m.id,
          title: m.title,
          subject: m.subject,
          snippet: (m.original_content ?? "").slice(Math.max(0, idx - 80), idx + 240),
        };
      })
      .filter(Boolean)
      .slice(0, limit);
    return textResult(JSON.stringify(hits), { results: hits });
  },
});
