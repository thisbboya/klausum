import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { createUserSupabase, textResult, errorResult } from "./_client";

export default defineTool({
  name: "list_study_materials",
  title: "List study materials",
  description: "List the signed-in student's study materials (title, subject, id, created_at).",
  inputSchema: {
    limit: z.number().int().min(1).max(100).default(25).describe("Max rows to return"),
    subject: z.string().optional().describe("Filter by subject (case-insensitive contains)"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, subject }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const sb = createUserSupabase(ctx);
    let q = sb.from("study_materials")
      .select("id,title,subject,created_at,processing_status")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (subject) q = q.ilike("subject", `%${subject}%`);
    const { data, error } = await q;
    if (error) return errorResult(error.message);
    return textResult(JSON.stringify(data ?? []), { materials: data ?? [] });
  },
});
