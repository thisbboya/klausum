import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/notify";
import { Loader2, Shield, Users, BarChart3, BookOpen, Megaphone, KeyRound, SlidersHorizontal, Trash2, Brain, AlertTriangle, Gauge } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/use-is-admin";
// Admin data comes from SECURITY DEFINER RPCs (admin_list_users, admin_stats,
// admin_recent_materials, admin_set_role) so no service-role key is needed.

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

function AdminPage() {
  const { isAdmin, isLoading } = useIsAdmin();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"users" | "insights" | "stats" | "materials" | "updates" | "apis" | "algorithm" | "errors" | "limits">("users");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  // Visible gate instead of a silent bounce — failures stay debuggable
  if (!isAdmin) {
    return (
      <div className="card-chunky mx-auto max-w-md border-dashed p-10 text-center">
        <Shield className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-3 text-sm font-bold text-muted-foreground">
          This area is for admins. If you were just granted access, refresh the page.
        </p>
        <button
          onClick={() => navigate({ to: "/dashboard" })}
          className="mt-4 rounded-xl border-2 border-border px-4 py-2 text-sm font-bold text-muted-foreground hover:text-foreground"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-primary" />
        <div>
          <h1 className="font-display text-2xl font-bold">Admin</h1>
          <p className="text-sm text-muted-foreground">Manage users, roles, and platform stats.</p>
        </div>
      </header>

      <div className="flex gap-2 border-b border-border">
        <TabBtn active={tab === "users"} onClick={() => setTab("users")} icon={Users}>
          Users
        </TabBtn>
        <TabBtn active={tab === "insights"} onClick={() => setTab("insights")} icon={Brain}>
          Insights
        </TabBtn>
        <TabBtn active={tab === "stats"} onClick={() => setTab("stats")} icon={BarChart3}>
          Stats
        </TabBtn>
        <TabBtn active={tab === "materials"} onClick={() => setTab("materials")} icon={BookOpen}>
          Recent materials
        </TabBtn>
        <TabBtn active={tab === "updates"} onClick={() => setTab("updates")} icon={Megaphone}>
          Updates
        </TabBtn>
        <TabBtn active={tab === "apis"} onClick={() => setTab("apis")} icon={KeyRound}>
          AI Providers
        </TabBtn>
        <TabBtn active={tab === "algorithm"} onClick={() => setTab("algorithm")} icon={SlidersHorizontal}>
          Algorithm
        </TabBtn>
        <TabBtn active={tab === "errors"} onClick={() => setTab("errors")} icon={AlertTriangle}>
          Errors
        </TabBtn>
        <TabBtn active={tab === "limits"} onClick={() => setTab("limits")} icon={Gauge}>
          Limits
        </TabBtn>
      </div>

      {tab === "users" && <UsersTab />}
      {tab === "insights" && <InsightsTab />}
      {tab === "stats" && <StatsTab />}
      {tab === "materials" && <MaterialsTab />}
      {tab === "updates" && <UpdatesAdminTab />}
      {tab === "apis" && <ProvidersTab />}
      {tab === "algorithm" && <AlgorithmTab />}
      {tab === "errors" && <ErrorsTab />}
      {tab === "limits" && <LimitsTab />}
    </div>
  );
}

// ── Limits (per-feature daily AI quotas, same for every user) ──────────────
const FEATURE_META: Record<string, { label: string; hint: string }> = {
  quiz_generate: { label: "Quiz generation", hint: "New quizzes per user per day" },
  material_process: { label: "Material uploads (AI)", hint: "AI processing runs at upload" },
  tutor_chat: { label: "AI Tutor messages", hint: "Messages sent to the tutor" },
  material_chat: { label: "Document chat", hint: "Ask-about-this-page messages" },
  video_analyze: { label: "Video analyses", hint: "New videos analyzed (cache hits are free)" },
  video_chat: { label: "Video chat", hint: "Messages in Watch & Study" },
  video_quiz: { label: "Video quizzes", hint: "Quizzes generated from videos" },
  regenerate: { label: "Regenerations", hint: "Concepts / Bloom / formula rebuilds" },
};

function LimitsTab() {
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, number>>({});

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["admin_limits"],
    queryFn: async () => {
      const { data } = await (sb as any)
        .from("ai_rate_limits")
        .select("feature, daily_limit, enabled")
        .order("feature");
      return data ?? [];
    },
  });

  const { data: usage = {} } = useQuery({
    queryKey: ["admin_ai_usage"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data } = await (sb as any).rpc("admin_ai_usage_today");
      return (data ?? {}) as Record<string, number>;
    },
  });

  async function save(feature: string, patch: { daily_limit?: number; enabled?: boolean }) {
    const { error } = await (sb as any)
      .from("ai_rate_limits")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("feature", feature);
    if (error) return toast.error(error.message);
    toast.success("Limit updated");
    qc.invalidateQueries({ queryKey: ["admin_limits"] });
  }

  return (
    <div className="space-y-3">
      <div className="card-chunky border-sky/40 bg-sky/5 p-4 text-xs font-semibold text-muted-foreground">
        <strong className="text-foreground">How it works:</strong> each limit is a per-user daily cap
        on that AI feature, counted per UTC day and applied to everyone — including you, so you can
        test it. When a user hits a cap they see “You've used all N of today's free …, resets at
        midnight.” Disable a row to make that feature unlimited.
      </div>

      {isLoading ? (
        <div className="text-sm font-semibold text-muted-foreground">Loading…</div>
      ) : (
        <ul className="space-y-2">
          {rules.map((r: any) => {
            const meta = FEATURE_META[r.feature] ?? { label: r.feature, hint: "" };
            const draft = drafts[r.feature] ?? r.daily_limit;
            const used = usage[r.feature] ?? 0;
            return (
              <li key={r.feature} className="card-chunky flex flex-wrap items-center gap-3 bg-card p-3">
                <div className="min-w-0 flex-1">
                  <div className="font-display text-sm font-extrabold">{meta.label}</div>
                  <div className="text-[11px] font-semibold text-muted-foreground">{meta.hint}</div>
                </div>
                <span
                  className="rounded-full bg-surface-3 px-2.5 py-1 text-[10px] font-extrabold"
                  title="All users combined, today (UTC)"
                >
                  {used} used today
                </span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    max={10000}
                    value={draft}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      if (!Number.isNaN(n)) setDrafts((d) => ({ ...d, [r.feature]: Math.max(0, n) }));
                    }}
                    className="h-9 w-20 rounded-lg border-2 border-border bg-background px-2 text-center text-sm font-extrabold outline-none focus:border-primary"
                    aria-label={`Daily limit for ${meta.label}`}
                  />
                  <span className="text-[10px] font-bold text-muted-foreground">/day</span>
                  {draft !== r.daily_limit && (
                    <button
                      onClick={() => save(r.feature, { daily_limit: draft })}
                      className="btn-3d rounded-lg bg-primary px-2.5 py-1.5 text-xs font-extrabold text-primary-foreground"
                    >
                      Save
                    </button>
                  )}
                </div>
                <button
                  onClick={() => save(r.feature, { enabled: !r.enabled })}
                  className={`rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-wide ${
                    r.enabled ? "bg-success/15 text-success" : "bg-surface-3 text-muted-foreground"
                  }`}
                  title={r.enabled ? "Click to disable (feature becomes unlimited)" : "Click to enable the cap"}
                >
                  {r.enabled ? "Enforced" : "Off (unlimited)"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── Errors (admin-only; users only ever see friendly messages) ─────────────
function ErrorsTab() {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin_errors"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data } = await (sb as any)
        .from("app_error_logs")
        .select("id, context, message, status_code, created_at, user_id")
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  async function clearAll() {
    await (sb as any).from("app_error_logs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    qc.invalidateQueries({ queryKey: ["admin_errors"] });
  }

  return (
    <div className="space-y-3">
      <div className="card-chunky border-sky/40 bg-sky/5 p-4 text-xs font-semibold text-muted-foreground">
        <strong className="text-foreground">Why this exists:</strong> users never see raw failures —
        they get a calm message like “Klausum is a bit busy right now.” The real error lands here.
        Only admins can read this table.
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm font-bold">
          {isLoading ? "Loading…" : `${rows.length} recent error${rows.length === 1 ? "" : "s"}`}
        </p>
        {rows.length > 0 && (
          <button
            onClick={clearAll}
            className="rounded-lg border-2 border-border px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide text-muted-foreground hover:text-destructive"
          >
            Clear all
          </button>
        )}
      </div>

      {!isLoading && rows.length === 0 ? (
        <div className="card-chunky border-dashed p-8 text-center text-sm font-semibold text-muted-foreground">
          No errors logged. 🎉
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r: any) => (
            <li key={r.id} className="card-chunky bg-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-destructive/12 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-destructive">
                  {r.context}
                </span>
                {r.status_code && (
                  <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[10px] font-extrabold">
                    {r.status_code}
                  </span>
                )}
                <span className="text-[10px] font-bold text-muted-foreground">
                  {new Date(r.created_at).toLocaleString()}
                </span>
              </div>
              <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words text-[11px] font-medium text-muted-foreground">
                {r.message}
              </pre>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: any;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 text-sm border-b-2 -mb-px transition ${
        active ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}

function UsersTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      const { data: rows, error } = await (supabase as any).rpc("admin_list_users");
      if (error) throw error;
      return {
        users: (rows ?? []).map((u: any) => ({
          ...u,
          school: u.handle ?? "",
          streak_days: u.streak_days ?? 0,
          roles: u.is_admin ? ["admin"] : [],
        })),
      };
    },
  });

  async function toggleAdmin(email: string, makeAdmin: boolean, id: string) {
    setPendingId(id);
    try {
      const { error } = await (supabase as any).rpc("admin_set_role", {
        p_email: email,
        p_make_admin: makeAdmin,
      });
      if (error) throw error;
      toast.success(makeAdmin ? "Admin granted" : "Admin removed");
      await qc.invalidateQueries({ queryKey: ["admin", "users"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setPendingId(null);
    }
  }

  const users = (data?.users ?? []).filter((u: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      u.email?.toLowerCase().includes(s) ||
      u.full_name?.toLowerCase().includes(s) ||
      u.school?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-3">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by email, name, or school"
        className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
      />
      {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm flex items-center justify-between">
          <span>Failed to load users: {(error as any)?.message ?? "unknown error"}</span>
          <button
            onClick={() => refetch()}
            className="rounded-xl border-2 border-border px-2 py-1 text-xs hover:bg-accent/10"
          >
            Retry
          </button>
        </div>
      )}
      <div className="card-chunky overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">Email / Name</th>
              <th className="text-left px-3 py-2">School</th>
              <th className="text-left px-3 py-2">XP</th>
              <th className="text-left px-3 py-2">Streak</th>
              <th className="text-left px-3 py-2">Roles</th>
              <th className="text-right px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u: any) => {
              const isAdmin = u.roles.includes("admin");
              const pending = pendingId === u.id;
              return (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <div className="font-medium">{u.full_name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{u.school || "—"}</td>
                  <td className="px-3 py-2">{u.xp_total ?? 0}</td>
                  <td className="px-3 py-2">{u.streak_days ?? 0}d</td>
                  <td className="px-3 py-2">
                    {isAdmin ? (
                      <span className="rounded bg-primary/15 text-primary px-2 py-0.5 text-xs">admin</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">user</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => toggleAdmin(u.email, !isAdmin, u.id)}
                      disabled={pending}
                      className="inline-flex items-center gap-1.5 rounded-xl border-2 border-border px-2 py-1 text-xs hover:bg-accent/10 disabled:opacity-50"
                    >
                      {pending && <Loader2 className="h-3 w-3 animate-spin" />}
                      {isAdmin ? "Remove admin" : "Make admin"}
                    </button>
                  </td>
                </tr>
              );
            })}
            {!isLoading && !error && users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {isFetching ? "Loading…" : "No users found."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Per-user learning analytics: engagement score + churn-risk classification,
// computed in the DB (admin_user_insights) from XP, streaks, cards, attempts,
// accuracy, materials, and recency of activity.
function InsightsTab() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "insights"],
    queryFn: async () => {
      const { data: rows, error } = await (supabase as any).rpc("admin_user_insights");
      if (error) throw error;
      return (rows ?? []) as any[];
    },
  });
  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (error) return <div className="text-sm text-destructive">Failed: {(error as any)?.message}</div>;

  const riskStyle: Record<string, string> = {
    hooked: "bg-success/15 text-success",
    casual: "bg-primary/15 text-primary",
    "cooling off": "bg-sky/15 text-sky",
    "churn risk": "bg-destructive/15 text-destructive",
  };
  const summary = (data ?? []).reduce<Record<string, number>>((acc, u) => {
    acc[u.risk] = (acc[u.risk] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {["hooked", "casual", "cooling off", "churn risk"].map((r) => (
          <div key={r} className="card-chunky bg-card p-4">
            <div className="text-xs text-muted-foreground capitalize">{r}</div>
            <div className="mt-1 font-display text-2xl font-bold">{summary[r] ?? 0}</div>
          </div>
        ))}
      </div>
      <div className="card-chunky overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">User</th>
              <th className="px-3 py-2 text-left">Engagement</th>
              <th className="px-3 py-2 text-left">XP</th>
              <th className="px-3 py-2 text-left">Streak</th>
              <th className="px-3 py-2 text-left">Quizzes</th>
              <th className="px-3 py-2 text-left">Accuracy</th>
              <th className="px-3 py-2 text-left">Cards</th>
              <th className="px-3 py-2 text-left">Inactive</th>
              <th className="px-3 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="px-3 py-2">
                  <div className="font-medium">{u.full_name || "—"}</div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-16 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${u.engagement}%` }} />
                    </div>
                    <span className="text-xs font-bold">{u.engagement}</span>
                  </div>
                </td>
                <td className="px-3 py-2">{u.xp_total}</td>
                <td className="px-3 py-2">{u.streak_days}d</td>
                <td className="px-3 py-2">{u.attempts}</td>
                <td className="px-3 py-2">{u.avg_accuracy != null ? `${u.avg_accuracy}%` : "—"}</td>
                <td className="px-3 py-2">{u.cards}</td>
                <td className="px-3 py-2 text-muted-foreground">{u.days_inactive != null ? `${u.days_inactive}d` : "—"}</td>
                <td className="px-3 py-2">
                  <span className={`rounded px-2 py-0.5 text-xs ${riskStyle[u.risk] ?? "bg-muted text-muted-foreground"}`}>
                    {u.risk}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: async () => {
      const { data: counts, error } = await (supabase as any).rpc("admin_stats");
      if (error) throw error;
      return { counts: (counts ?? {}) as Record<string, number> };
    },
  });
  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  const counts = data?.counts ?? {};
  const cards: { key: string; label: string }[] = [
    { key: "user_profiles", label: "Users" },
    { key: "study_materials", label: "Materials" },
    { key: "flashcards", label: "Flashcards" },
    { key: "flashcard_decks", label: "Decks" },
    { key: "quizzes", label: "Quizzes" },
    { key: "voice_notes", label: "Voice notes" },
    { key: "study_rooms", label: "Study rooms" },
    { key: "tutor_sessions", label: "Tutor chats" },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div key={c.key} className="card-chunky bg-card p-4">
          <div className="text-xs text-muted-foreground">{c.label}</div>
          <div className="font-display text-2xl font-bold mt-1">{counts[c.key] ?? 0}</div>
        </div>
      ))}
    </div>
  );
}

function MaterialsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "materials"],
    queryFn: async () => {
      const { data: rows, error } = await (supabase as any).rpc("admin_recent_materials");
      if (error) throw error;
      return { materials: (rows ?? []) as any[] };
    },
  });
  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  return (
    <div className="card-chunky overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/30 text-xs text-muted-foreground">
          <tr>
            <th className="text-left px-3 py-2">Title</th>
            <th className="text-left px-3 py-2">Owner</th>
            <th className="text-left px-3 py-2">Subject</th>
            <th className="text-left px-3 py-2">Status</th>
            <th className="text-left px-3 py-2">Created</th>
          </tr>
        </thead>
        <tbody>
          {(data?.materials ?? []).map((m) => (
            <tr key={m.id} className="border-t border-border">
              <td className="px-3 py-2 font-medium">{m.title}</td>
              <td className="px-3 py-2 text-xs text-muted-foreground">{m.email}</td>
              <td className="px-3 py-2">{m.subject}</td>
              <td className="px-3 py-2">
                <span
                  className={`text-xs rounded px-2 py-0.5 ${
                    m.processing_status === "ready"
                      ? "bg-primary/15 text-primary"
                      : m.processing_status === "failed"
                        ? "bg-destructive/15 text-destructive"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {m.processing_status}
                </span>
              </td>
              <td className="px-3 py-2 text-xs text-muted-foreground">
                {new Date(m.created_at!).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Updates (DB-backed changelog every student sees) ───────────────────────

const sb = supabase as any;

function UpdatesAdminTab() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const { data: updates = [] } = useQuery({
    queryKey: ["admin_updates"],
    queryFn: async () => {
      const { data } = await sb.from("app_updates").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  async function publish() {
    const { error } = await sb.from("app_updates").insert({ title: title.trim(), body: body.trim() });
    if (error) return toast.error(error.message);
    toast.success("Published — students see it in Settings → Updates");
    setTitle(""); setBody("");
    qc.invalidateQueries({ queryKey: ["admin_updates"] });
  }

  async function remove(id: string) {
    const { error } = await sb.from("app_updates").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin_updates"] });
  }

  return (
    <div className="space-y-4">
      <div className="card-chunky bg-card p-4 space-y-2">
        <div className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">Publish an update</div>
        <input
          value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (e.g. Quiz duels are here)"
          className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <textarea
          value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="What changed, in student language…"
          className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <button
          onClick={publish} disabled={!title.trim() || !body.trim()}
          className="btn-3d rounded-xl bg-primary px-4 py-2 text-sm font-extrabold text-primary-foreground disabled:opacity-40"
        >
          Publish
        </button>
      </div>

      <ul className="space-y-2">
        {updates.map((u: any) => (
          <li key={u.id} className="card-chunky flex items-start justify-between gap-3 bg-card p-4">
            <div className="min-w-0">
              <div className="font-display font-extrabold">{u.title}</div>
              <p className="mt-0.5 text-sm text-muted-foreground">{u.body}</p>
              <div className="mt-1 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
                {new Date(u.created_at).toLocaleDateString()}
              </div>
            </div>
            <button onClick={() => remove(u.id)} className="shrink-0 p-2 text-muted-foreground hover:text-destructive" aria-label="Delete update">
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── AI Providers (keys that rotate or race in parallel) ────────────────────

const PROVIDER_OPTIONS = ["gemini", "youtube", "groq", "openrouter", "cerebras"];

function ProvidersTab() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [provider, setProvider] = useState("gemini");
  const [apiKey, setApiKey] = useState("");
  const [mode, setMode] = useState<"rotate" | "parallel">("rotate");

  const { data: providers = [] } = useQuery({
    queryKey: ["admin_providers"],
    queryFn: async () => {
      const { data } = await sb.from("api_providers").select("*").order("priority");
      return data ?? [];
    },
  });

  async function add() {
    const { error } = await sb.from("api_providers").insert({
      name: name.trim() || `${provider} key`, provider, api_key: apiKey.trim(), mode,
    });
    if (error) return toast.error(error.message);
    toast.success("Provider added");
    setName(""); setApiKey("");
    qc.invalidateQueries({ queryKey: ["admin_providers"] });
  }

  async function toggle(id: string, enabled: boolean) {
    await sb.from("api_providers").update({ enabled }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin_providers"] });
  }

  async function remove(id: string) {
    await sb.from("api_providers").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin_providers"] });
  }

  return (
    <div className="space-y-4">
      <div className="card-chunky border-sky/40 bg-sky/5 p-4 text-xs font-semibold text-muted-foreground">
        <strong className="text-foreground">How it runs:</strong> keys marked <em>rotate</em> take turns request-by-request
        (spreads free-tier limits); keys marked <em>parallel</em> are raced by priority and the fastest healthy one wins.
        The server falls back to the GEMINI_API_KEY env var when this table is empty.
      </div>

      <div className="card-chunky bg-card p-4 space-y-2">
        <div className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">Add a provider key</div>
        <div className="grid gap-2 sm:grid-cols-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Label (e.g. Groq main)"
            className="rounded-xl border-2 border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
          <select value={provider} onChange={(e) => setProvider(e.target.value)}
            className="rounded-xl border-2 border-border bg-background px-3 py-2 text-sm">
            {PROVIDER_OPTIONS.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
        <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="API key" type="password"
          className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
        <div className="flex items-center gap-2">
          {(["rotate", "parallel"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)}
              className={`rounded-full border-2 px-3 py-1 text-xs font-extrabold uppercase ${mode === m ? "border-primary/40 bg-primary/12 text-primary" : "border-border text-muted-foreground"}`}>
              {m}
            </button>
          ))}
          <button onClick={add} disabled={!apiKey.trim()}
            className="btn-3d ml-auto rounded-xl bg-primary px-4 py-2 text-sm font-extrabold text-primary-foreground disabled:opacity-40">
            Add key
          </button>
        </div>
      </div>

      <ul className="space-y-2">
        {providers.map((p: any) => (
          <li key={p.id} className="card-chunky flex items-center gap-3 bg-card p-4">
            <KeyRound className="h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <div className="font-bold">{p.name} <span className="ml-1 text-xs font-semibold text-muted-foreground">({p.provider} · {p.mode})</span></div>
              <div className="font-mono text-xs text-muted-foreground">••••{String(p.api_key).slice(-4)}</div>
            </div>
            <button onClick={() => toggle(p.id, !p.enabled)}
              className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase ${p.enabled ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
              {p.enabled ? "Enabled" : "Disabled"}
            </button>
            <button onClick={() => remove(p.id)} className="p-1.5 text-muted-foreground hover:text-destructive" aria-label="Delete key">
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Algorithm (engagement knobs, applied app-wide) ─────────────────────────

function AlgorithmTab() {
  const qc = useQueryClient();
  const { data: settings } = useQuery({
    queryKey: ["app_settings"],
    queryFn: async () => {
      const { data } = await sb.from("app_settings").select("*").eq("id", 1).single();
      return data;
    },
  });
  const [draft, setDraft] = useState<any>(null);
  const s = draft ?? settings;

  async function save() {
    const { updated_at, ...rest } = draft;
    void updated_at;
    const { error } = await sb.from("app_settings").update({ ...rest, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) return toast.error(error.message);
    toast.success("Algorithm updated — applies to everyone immediately");
    setDraft(null);
    qc.invalidateQueries({ queryKey: ["app_settings"] });
  }

  if (!s) return <div className="text-sm font-semibold text-muted-foreground">Loading…</div>;

  const num = (key: string, label: string, hint: string, min: number, max: number) => (
    <div key={key} className="card-chunky bg-card p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-bold">{label}</div>
          <div className="text-xs text-muted-foreground">{hint}</div>
        </div>
        <div className="font-display text-2xl font-extrabold text-primary tabular-nums">{s[key]}</div>
      </div>
      <input
        type="range" min={min} max={max} value={s[key]}
        onChange={(e) => setDraft({ ...s, [key]: parseInt(e.target.value) })}
        className="mt-3 w-full accent-[hsl(var(--primary))]"
      />
    </div>
  );

  const flag = (key: string, label: string, hint: string) => (
    <div key={key} className="card-chunky flex items-center justify-between bg-card p-4">
      <div>
        <div className="font-bold">{label}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
      <button
        onClick={() => setDraft({ ...s, [key]: !s[key] })}
        className={`rounded-full px-3 py-1.5 text-xs font-extrabold uppercase ${s[key] ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}
      >
        {s[key] ? "On" : "Off"}
      </button>
    </div>
  );

  return (
    <div className="space-y-3">
      {num("daily_goal_xp", "Daily XP goal", "The bar students clear to keep their streak — the core Duolingo loop", 10, 100)}
      {num("xp_per_material", "XP per upload", "Reward for feeding the system content", 5, 100)}
      {num("xp_per_review", "XP per flashcard review", "Small, frequent wins (dopamine cadence)", 1, 10)}
      {num("xp_per_quiz", "XP per quiz", "Bigger payoff for effortful practice", 5, 50)}
      {num("variable_reward_min", "Surprise gems — minimum", "Variable rewards beat fixed ones for habit formation", 0, 50)}
      {num("variable_reward_max", "Surprise gems — maximum", "The jackpot end of the surprise range", 5, 100)}
      {flag("loss_aversion_nudges", "Streak-at-risk nudges", "Loss aversion: warning about a streak loss beats gain framing")}
      {flag("streak_freeze_enabled", "Streak freezes", "A safety net reduces rage-quit after a missed day")}
      {draft && (
        <button onClick={save} className="btn-3d w-full rounded-xl bg-primary py-3 text-sm font-extrabold uppercase tracking-wide text-primary-foreground">
          Save changes
        </button>
      )}
    </div>
  );
}
