import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { createUserSupabase, textResult, errorResult } from "./_client";

export default defineTool({
  name: "create_cornell_note",
  title: "Create a Cornell note",
  description: "Create a Cornell-style note (cues, notes, summary) for the signed-in student.",
  inputSchema: {
    title: z.string().min(1).max(200),
    cues: z.string().default(""),
    notes: z.string().default(""),
    summary: z.string().default(""),
    subject: z.string().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const sb = createUserSupabase(ctx);
    const { data, error } = await sb
      .from("cornell_notes")
      .insert({
        user_id: ctx.getUserId(),
        title: input.title,
        cues: input.cues,
        notes: input.notes,
        summary: input.summary,
        subject: input.subject ?? null,
      })
      .select()
      .single();
    if (error) return errorResult(error.message);
    return textResult(`Created note "${data.title}" (id: ${data.id})`, { note: data });
  },
});
