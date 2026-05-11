import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Shield, Users, BarChart3, BookOpen } from "lucide-react";
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
  const [tab, setTab] = useState<"users" | "stats" | "materials">("users");

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
      </div>

      {tab === "users" && <UsersTab />}
      {tab === "stats" && <StatsTab />}
      {tab === "materials" && <MaterialsTab />}
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

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: async () => fn({ data: { accessToken: await getAccessToken() } }),
  });

  async function toggleAdmin(userId: string, makeAdmin: boolean) {
    try {
      await setRoleFn({
        data: { accessToken: await getAccessToken(), userId, role: "admin", enabled: makeAdmin },
      });
      toast.success(makeAdmin ? "Admin granted" : "Admin removed");
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
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
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
      />
      {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
      <div className="rounded-xl border border-border overflow-hidden">
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
                      className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent/10"
                    >
                      {isAdmin ? "Remove admin" : "Make admin"}
                    </button>
                  </td>
                </tr>
              );
            })}
            {!isLoading && users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-sm text-muted-foreground">
                  No users found.
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
        <div key={c.key} className="rounded-xl border border-border bg-card p-4">
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
    <div className="rounded-xl border border-border overflow-hidden">
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
