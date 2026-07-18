import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Shield, Users, BarChart3, BookOpen, Megaphone, KeyRound, SlidersHorizontal, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { getAccessToken } from "@/lib/auth-helper";
import {
  adminListUsers,
  adminSetRole,
  adminGetStats,
  adminListMaterials,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

function AdminPage() {
  const { isAdmin, isLoading } = useIsAdmin();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"users" | "stats" | "materials" | "updates" | "apis" | "algorithm">("users");

  useEffect(() => {
    if (!isLoading && !isAdmin) navigate({ to: "/dashboard" });
  }, [isAdmin, isLoading, navigate]);

  if (isLoading || !isAdmin) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
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
      </div>

      {tab === "users" && <UsersTab />}
      {tab === "stats" && <StatsTab />}
      {tab === "materials" && <MaterialsTab />}
      {tab === "updates" && <UpdatesAdminTab />}
      {tab === "apis" && <ProvidersTab />}
      {tab === "algorithm" && <AlgorithmTab />}
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
  const fn = useServerFn(adminListUsers);
  const setRoleFn = useServerFn(adminSetRole);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: async () => fn({ data: { accessToken: await getAccessToken() } }),
  });

  async function toggleAdmin(userId: string, makeAdmin: boolean) {
    setPendingId(userId);
    try {
      await setRoleFn({
        data: { accessToken: await getAccessToken(), userId, role: "admin", enabled: makeAdmin },
      });
      toast.success(makeAdmin ? "Admin granted" : "Admin removed");
      await qc.invalidateQueries({ queryKey: ["admin", "users"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setPendingId(null);
    }
  }

  const users = (data?.users ?? []).filter((u) => {
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
            className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent/10"
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
            {users.map((u) => {
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
                      onClick={() => toggleAdmin(u.id, !isAdmin)}
                      disabled={pending}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent/10 disabled:opacity-50"
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

function StatsTab() {
  const fn = useServerFn(adminGetStats);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: async () => fn({ data: { accessToken: await getAccessToken() } }),
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
  const fn = useServerFn(adminListMaterials);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "materials"],
    queryFn: async () => fn({ data: { accessToken: await getAccessToken() } }),
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

const PROVIDER_OPTIONS = ["gemini", "groq", "openrouter", "cerebras"];

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
