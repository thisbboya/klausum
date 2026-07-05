import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { createUserSupabase, textResult, errorResult } from "./_client";

export default defineTool({
  name: "list_question_bank",
  title: "List saved solved problems",
  description: "List entries from the signed-in student's Question Bank (saved solved problems).",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(20),
    subject: z.string().optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, subject }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const sb = createUserSupabase(ctx);
    let q = sb.from("question_bank")
      .select("id,question,solution,subject,source,created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (subject) q = q.ilike("subject", `%${subject}%`);
    const { data, error } = await q;
    if (error) return errorResult(error.message);
    return textResult(JSON.stringify(data ?? []), { entries: data ?? [] });
  },
});
