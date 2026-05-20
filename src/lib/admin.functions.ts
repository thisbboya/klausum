import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { getUserIdFromToken } from "./server-auth";

function admin() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function requireAdmin(token: string) {
  const userId = await getUserIdFromToken(token);
  const sa = admin();
  const { data, error } = await sa
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) throw new Error("Admin only");
  return userId;
}


const TokenInput = z.object({ accessToken: z.string() });

export const getMyRoles = createServerFn({ method: "POST" })
  .inputValidator((d) => TokenInput.parse(d))
  .handler(async ({ data }) => {
    const userId = await getUserIdFromToken(data.accessToken);
    const sa = admin();
    const { data: rows } = await sa.from("user_roles").select("role").eq("user_id", userId);
    return { roles: (rows ?? []).map((r) => r.role as string) };

  });

export const adminListUsers = createServerFn({ method: "POST" })
  .inputValidator((d) => TokenInput.parse(d))
  .handler(async ({ data }) => {
    await requireAdmin(data.accessToken);
    const sa = admin();
    const { data: profiles } = await sa
      .from("user_profiles")
      .select("id, full_name, school, country, xp_total, streak_days, created_at, onboarding_completed")
      .order("created_at", { ascending: false })
      .limit(500);
    const { data: roles } = await sa.from("user_roles").select("user_id, role");
    const { data: authList } = await sa.auth.admin.listUsers({ page: 1, perPage: 500 });
    const emailMap = new Map<string, string>();
    for (const u of authList?.users ?? []) emailMap.set(u.id, u.email ?? "");
    const roleMap = new Map<string, string[]>();
    for (const r of roles ?? []) {
      const a = roleMap.get(r.user_id) ?? [];
      a.push(r.role as string);
      roleMap.set(r.user_id, a);
    }
    return {
      users: (profiles ?? []).map((p) => ({
        ...p,
        email: emailMap.get(p.id) ?? "",
        roles: roleMap.get(p.id) ?? [],
      })),
    };
  });

const SetRoleInput = z.object({
  accessToken: z.string(),
  userId: z.string().uuid(),
  role: z.enum(["admin", "user"]),
  enabled: z.boolean(),
});

export const adminSetRole = createServerFn({ method: "POST" })
  .inputValidator((d) => SetRoleInput.parse(d))
  .handler(async ({ data }) => {
    await requireAdmin(data.accessToken);
    const sa = admin();
    if (data.enabled) {
      await sa.from("user_roles").upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
    } else {
      await sa.from("user_roles").delete().eq("user_id", data.userId).eq("role", data.role);
    }
    return { ok: true };
  });

export const adminGetStats = createServerFn({ method: "POST" })
  .inputValidator((d) => TokenInput.parse(d))
  .handler(async ({ data }) => {
    await requireAdmin(data.accessToken);
    const sa = admin();
    const tables = [
      "user_profiles",
      "study_materials",
      "flashcards",
      "flashcard_decks",
      "quizzes",
      "voice_notes",
      "study_rooms",
      "tutor_sessions",
    ] as const;
    const counts: Record<string, number> = {};
    for (const t of tables) {
      const { count } = await sa.from(t).select("*", { count: "exact", head: true });
      counts[t] = count ?? 0;
    }
    return { counts };
  });

export const adminListMaterials = createServerFn({ method: "POST" })
  .inputValidator((d) => TokenInput.parse(d))
  .handler(async ({ data }) => {
    await requireAdmin(data.accessToken);
    const sa = admin();
    const { data: mats } = await sa
      .from("study_materials")
      .select("id, user_id, title, subject, processing_status, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    const { data: authList } = await sa.auth.admin.listUsers({ page: 1, perPage: 500 });
    const emailMap = new Map<string, string>();
    for (const u of authList?.users ?? []) emailMap.set(u.id, u.email ?? "");
    return {
      materials: (mats ?? []).map((m) => ({ ...m, email: emailMap.get(m.user_id) ?? "" })),
    };
  });
