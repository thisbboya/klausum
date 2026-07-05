import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { createUserSupabase, textResult, errorResult } from "./_client";

export default defineTool({
  name: "get_study_stats",
  title: "Get study stats",
  description: "Return the signed-in student's XP total, current streak, and materials count.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const sb = createUserSupabase(ctx);
    const [{ data: profile, error: pErr }, { count: materialCount }] = await Promise.all([
      sb.from("user_profiles").select("xp_total,streak_days,gems,level").eq("id", ctx.getUserId()!).maybeSingle(),
      sb.from("study_materials").select("*", { count: "exact", head: true }),
    ]);
    if (pErr) return errorResult(pErr.message);
    const stats = {
      xp_total: profile?.xp_total ?? 0,
      current_streak: profile?.streak_days ?? 0,
      gems: profile?.gems ?? 0,
      level: profile?.level ?? "1",
      materials_count: materialCount ?? 0,
    };
    return textResult(JSON.stringify(stats), { stats });
  },
});
