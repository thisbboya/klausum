import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { awardXp } from "@/lib/xp";
import { CHALLENGES, challengeWindow, type Challenge } from "@/lib/challenges";
import { toast } from "sonner";
import {
  Users, Trophy, Target, UsersRound, Search, UserPlus, Check, X, Crown,
  Plus, LogIn, Copy, Sparkles, CheckCircle2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/community")({ component: CommunityPage });

type Tab = "friends" | "leaderboard" | "challenges" | "groups";

function CommunityPage() {
  const [tab, setTab] = useState<Tab>("friends");
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold">Community</h1>
        <p className="text-sm text-muted-foreground">Friends, leaderboard, challenges, and study groups.</p>
      </header>

      <div className="inline-flex rounded-lg border border-border/60 overflow-hidden">
        {([
          ["friends", "Friends", Users],
          ["leaderboard", "Leaderboard", Trophy],
          ["challenges", "Challenges", Target],
          ["groups", "Groups", UsersRound],
        ] as [Tab, string, any][]).map(([k, label, Icon]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold ${tab === k ? "bg-primary text-primary-foreground" : "bg-card/40 text-muted-foreground hover:text-foreground"}`}>
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      {tab === "friends" && <FriendsTab />}
      {tab === "leaderboard" && <LeaderboardTab />}
      {tab === "challenges" && <ChallengesTab />}
      {tab === "groups" && <GroupsTab />}
    </div>
  );
}

// ─── FRIENDS ──────────────────────────────────────────────────────────────

function FriendsTab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const { data: friendships = [] } = useQuery({
    queryKey: ["friendships", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("friendships").select("*")
        .or(`requester_id.eq.${user!.id},addressee_id.eq.${user!.id}`);
      return data ?? [];
    },
  });

  const otherIds = useMemo(() => {
    const ids = new Set<string>();
    for (const f of friendships) ids.add(f.requester_id === user?.id ? f.addressee_id : f.requester_id);
    return Array.from(ids);
  }, [friendships, user]);

  const { data: profiles = [] } = useQuery({
    queryKey: ["friend_profiles", otherIds.join(",")],
    enabled: otherIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("public_profiles")
        .select("id, full_name, handle, avatar_url, xp_total, level")
        .in("id", otherIds);
      return data ?? [];
    },
  });

  const friends = friendships.filter((f: any) => f.status === "accepted");
  const incoming = friendships.filter((f: any) => f.status === "pending" && f.addressee_id === user?.id);
  const outgoing = friendships.filter((f: any) => f.status === "pending" && f.requester_id === user?.id);

  const profById = useMemo(() => Object.fromEntries(profiles.map((p: any) => [p.id, p])), [profiles]);

  async function runSearch() {
    if (!q.trim()) return;
    setSearching(true);
    const term = q.trim().toLowerCase().replace(/^@/, "");
    const { data } = await supabase.from("public_profiles")
      .select("id, full_name, handle, avatar_url, xp_total, level")
      .or(`handle.ilike.%${term}%,full_name.ilike.%${term}%`)
      .neq("id", user!.id)
      .limit(20);
    setSearchResults(data ?? []);
    setSearching(false);
  }

  async function sendRequest(addressee_id: string) {
    const { error } = await supabase.from("friendships").insert({
      requester_id: user!.id, addressee_id, status: "pending",
    });
    if (error) return toast.error(error.message);
    toast.success("Friend request sent");
    qc.invalidateQueries({ queryKey: ["friendships", user?.id] });
  }

  async function respond(id: string, accept: boolean) {
    if (accept) {
      await supabase.from("friendships").update({ status: "accepted" }).eq("id", id);
    } else {
      await supabase.from("friendships").delete().eq("id", id);
    }
    qc.invalidateQueries({ queryKey: ["friendships", user?.id] });
  }

  async function unfriend(id: string) {
    await supabase.from("friendships").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["friendships", user?.id] });
  }

  const existingIds = new Set(otherIds);

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-border/60 bg-card/60 p-4">
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5"><Search className="h-4 w-4" /> Find friends</h2>
        <div className="flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
            placeholder="Search by @handle or name"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <button onClick={runSearch} disabled={searching}
            className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {searching ? "…" : "Search"}
          </button>
        </div>
        {searchResults.length > 0 && (
          <ul className="mt-3 space-y-2">
            {searchResults.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-lg border border-border/40 bg-card/40 p-2">
                <Avatar p={p} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{p.full_name}</div>
                  <div className="text-xs text-muted-foreground truncate">{p.handle ? `@${p.handle}` : "—"} · {p.xp_total ?? 0} XP</div>
                </div>
                {existingIds.has(p.id) ? (
                  <span className="text-xs text-muted-foreground">Connected</span>
                ) : (
                  <button onClick={() => sendRequest(p.id)} className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-xs text-primary">
                    <UserPlus className="h-3 w-3" /> Add
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {incoming.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Incoming requests</h2>
          <ul className="space-y-2">
            {incoming.map((f: any) => {
              const p = profById[f.requester_id];
              return (
                <li key={f.id} className="flex items-center gap-3 rounded-lg border border-border/60 bg-card/40 p-2">
                  <Avatar p={p} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{p?.full_name ?? "User"}</div>
                    <div className="text-xs text-muted-foreground truncate">{p?.handle ? `@${p.handle}` : ""}</div>
                  </div>
                  <button onClick={() => respond(f.id, true)} className="rounded-md bg-emerald-500/20 p-1.5 text-emerald-300"><Check className="h-4 w-4" /></button>
                  <button onClick={() => respond(f.id, false)} className="rounded-md bg-red-500/20 p-1.5 text-red-300"><X className="h-4 w-4" /></button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Your friends ({friends.length})</h2>
        {friends.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
            No friends yet. Search by @handle to add some.
          </div>
        ) : (
          <ul className="space-y-2">
            {friends.map((f: any) => {
              const otherId = f.requester_id === user?.id ? f.addressee_id : f.requester_id;
              const p = profById[otherId];
              return (
                <li key={f.id} className="flex items-center gap-3 rounded-lg border border-border/60 bg-card/40 p-2">
                  <Avatar p={p} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{p?.full_name ?? "User"}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {p?.handle ? `@${p.handle} · ` : ""}{p?.xp_total ?? 0} XP
                    </div>
                  </div>
                  <button onClick={() => unfriend(f.id)} className="text-xs text-muted-foreground hover:text-red-400">Remove</button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {outgoing.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Pending sent</h2>
          <ul className="space-y-1.5">
            {outgoing.map((f: any) => {
              const p = profById[f.addressee_id];
              return (
                <li key={f.id} className="flex items-center gap-3 rounded-lg border border-dashed border-border/60 p-2 text-sm">
                  <span className="flex-1 truncate text-muted-foreground">Waiting on {p?.full_name ?? "user"}{p?.handle ? ` (@${p.handle})` : ""}</span>
                  <button onClick={() => unfriend(f.id)} className="text-xs text-muted-foreground hover:text-red-400">Cancel</button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function Avatar({ p }: { p: any }) {
  const initial = (p?.full_name ?? p?.handle ?? "?").slice(0, 1).toUpperCase();
  return (
    <div className="h-9 w-9 rounded-full bg-primary/20 text-primary font-semibold flex items-center justify-center text-sm shrink-0">
      {p?.avatar_url ? <img src={p.avatar_url} className="h-full w-full rounded-full object-cover" alt="" /> : initial}
    </div>
  );
}

// ─── LEADERBOARD ──────────────────────────────────────────────────────────

function LeaderboardTab() {
  const { user } = useAuth();
  const [scope, setScope] = useState<"global" | "friends">("global");

  const { data: friendIds = [] } = useQuery({
    queryKey: ["friend_ids", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("friendships").select("requester_id,addressee_id").eq("status", "accepted")
        .or(`requester_id.eq.${user!.id},addressee_id.eq.${user!.id}`);
      const ids = new Set<string>([user!.id]);
      for (const f of data ?? []) ids.add(f.requester_id === user!.id ? f.addressee_id : f.requester_id);
      return Array.from(ids);
    },
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["leaderboard", scope, friendIds.join(",")],
    enabled: !!user,
    queryFn: async () => {
      const weekStart = (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); d.setHours(0, 0, 0, 0); return d.toISOString().slice(0, 10); })();
      let q = supabase.from("leaderboard_weekly").select("user_id, xp_this_week").eq("week_start", weekStart);
      if (scope === "friends" && friendIds.length > 0) q = q.in("user_id", friendIds);
      const { data: lb } = await q.order("xp_this_week", { ascending: false }).limit(50);
      const ids = (lb ?? []).map((r) => r.user_id);
      if (ids.length === 0) return [];
      const { data: profs } = await supabase.from("public_profiles")
        .select("id, full_name, handle, avatar_url, level").in("id", ids);
      const byId = Object.fromEntries((profs ?? []).map((p) => [p.id, p]));
      return (lb ?? []).map((r) => ({ ...r, profile: byId[r.user_id] }));
    },
  });

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border border-border/60 overflow-hidden">
        {(["global", "friends"] as const).map((s) => (
          <button key={s} onClick={() => setScope(s)}
            className={`px-3 py-1.5 text-xs font-semibold capitalize ${scope === s ? "bg-primary text-primary-foreground" : "bg-card/40 text-muted-foreground hover:text-foreground"}`}>
            {s}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
          No XP earned this week yet. Be the first.
        </div>
      ) : (
        <ol className="space-y-1.5">
          {rows.map((r: any, i: number) => (
            <li key={r.user_id} className={`flex items-center gap-3 rounded-lg border p-2.5 ${r.user_id === user?.id ? "border-primary/40 bg-primary/10" : "border-border/60 bg-card/40"}`}>
              <div className="w-7 text-center font-mono text-sm font-semibold">
                {i === 0 ? <Crown className="h-4 w-4 text-amber-400 mx-auto" /> : i + 1}
              </div>
              <Avatar p={r.profile} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {r.profile?.full_name ?? "Anonymous"}
                  {r.user_id === user?.id && <span className="ml-1 text-xs text-primary">(you)</span>}
                </div>
                {r.profile?.handle && <div className="text-xs text-muted-foreground">@{r.profile.handle}</div>}
              </div>
              <div className="text-sm font-mono font-semibold text-primary">{r.xp_this_week} XP</div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ─── CHALLENGES ───────────────────────────────────────────────────────────

function ChallengesTab() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: completions = [] } = useQuery({
    queryKey: ["challenge_completions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const since = new Date(); since.setDate(since.getDate() - 14);
      const { data } = await supabase.from("challenge_completions").select("*")
        .eq("user_id", user!.id).gte("completed_at", since.toISOString());
      return data ?? [];
    },
  });

  function isComplete(c: Challenge): boolean {
    const { start, end } = challengeWindow(c.cadence);
    return completions.some((x: any) =>
      x.challenge_key === c.key &&
      new Date(x.completed_at) >= start &&
      new Date(x.completed_at) < end
    );
  }

  async function claim(c: Challenge) {
    if (isComplete(c)) return;
    const { error } = await supabase.from("challenge_completions").insert({
      user_id: user!.id, challenge_key: c.key, xp_awarded: c.xp,
    });
    if (error) return toast.error(error.message);
    await awardXp({ userId: user!.id, amount: c.xp, action: "challenge_completed", description: c.title });
    toast.success(`+${c.xp} XP — ${c.title}`);
    qc.invalidateQueries({ queryKey: ["challenge_completions", user?.id] });
  }

  const daily = CHALLENGES.filter((c) => c.cadence === "daily");
  const weekly = CHALLENGES.filter((c) => c.cadence === "weekly");

  return (
    <div className="space-y-6">
      <ChallengeSection title="Daily" challenges={daily} isComplete={isComplete} onClaim={claim} />
      <ChallengeSection title="Weekly" challenges={weekly} isComplete={isComplete} onClaim={claim} />
    </div>
  );
}

function ChallengeSection({ title, challenges, isComplete, onClaim }: {
  title: string; challenges: Challenge[]; isComplete: (c: Challenge) => boolean; onClaim: (c: Challenge) => void;
}) {
  return (
    <section>
      <h2 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">{title}</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        {challenges.map((c) => {
          const done = isComplete(c);
          return (
            <div key={c.key} className={`rounded-xl border p-4 ${done ? "border-emerald-500/40 bg-emerald-500/10" : "border-border/60 bg-card/40"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm flex items-center gap-1.5">
                    {done && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
                    {c.title}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{c.description}</div>
                </div>
                <div className="text-xs font-mono font-semibold text-primary shrink-0">+{c.xp} XP</div>
              </div>
              <button onClick={() => onClaim(c)} disabled={done}
                className="mt-3 w-full rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary disabled:opacity-50 inline-flex items-center justify-center gap-1.5">
                <Sparkles className="h-3 w-3" /> {done ? "Claimed" : "Mark complete"}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── GROUPS ───────────────────────────────────────────────────────────────

function GroupsTab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [form, setForm] = useState({ name: "", subject: "General", description: "" });
  const [joinCode, setJoinCode] = useState("");

  const { data: groups = [] } = useQuery({
    queryKey: ["study_groups", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: mem } = await supabase.from("study_group_members").select("group_id").eq("user_id", user!.id);
      const ids = (mem ?? []).map((m) => m.group_id);
      if (ids.length === 0) return [];
      const { data } = await supabase.from("study_groups").select("*").in("id", ids).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  async function createGroup() {
    if (!form.name.trim()) return toast.error("Name required");
    const { data, error } = await supabase.from("study_groups").insert({
      creator_id: user!.id, name: form.name.trim(), subject: form.subject, description: form.description,
    }).select().single();
    if (error || !data) return toast.error(error?.message ?? "Failed");
    await supabase.from("study_group_members").insert({ group_id: data.id, user_id: user!.id, role: "admin" });
    setCreating(false);
    setForm({ name: "", subject: "General", description: "" });
    qc.invalidateQueries({ queryKey: ["study_groups", user?.id] });
    toast.success("Group created");
  }

  async function joinGroup() {
    if (!joinCode.trim()) return;
    const { error } = await supabase.rpc("join_study_group", { p_invite_code: joinCode.trim().toUpperCase() });
    if (error) return toast.error(error.message);
    setJoinCode(""); setJoining(false);
    qc.invalidateQueries({ queryKey: ["study_groups", user?.id] });
    toast.success("Joined group");
  }

  async function leave(group_id: string) {
    await supabase.from("study_group_members").delete().eq("group_id", group_id).eq("user_id", user!.id);
    qc.invalidateQueries({ queryKey: ["study_groups", user?.id] });
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => { setCreating(!creating); setJoining(false); }}
          className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
          <Plus className="h-4 w-4" /> Create
        </button>
        <button onClick={() => { setJoining(!joining); setCreating(false); }}
          className="inline-flex items-center gap-1 rounded-lg border border-border bg-card/40 px-3 py-2 text-sm font-semibold">
          <LogIn className="h-4 w-4" /> Join with code
        </button>
      </div>

      {creating && (
        <div className="rounded-xl border border-border/60 bg-card/60 p-4 space-y-2">
          <input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="Group name"
            value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="Subject"
            value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          <textarea className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" rows={2} placeholder="Description (optional)"
            value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="flex gap-2">
            <button onClick={createGroup} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">Create</button>
            <button onClick={() => setCreating(false)} className="rounded-lg border border-border px-3 py-1.5 text-xs">Cancel</button>
          </div>
        </div>
      )}

      {joining && (
        <div className="rounded-xl border border-border/60 bg-card/60 p-4 flex gap-2">
          <input className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono uppercase" placeholder="ABC12345"
            value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} maxLength={8} />
          <button onClick={joinGroup} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">Join</button>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
          You're not in any groups yet. Create one or join with a code.
        </div>
      ) : (
        <ul className="space-y-2">
          {groups.map((g: any) => (
            <li key={g.id} className="rounded-xl border border-border/60 bg-card/40 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{g.name}</div>
                  <div className="text-xs text-muted-foreground">{g.subject} · {g.member_count} member{g.member_count === 1 ? "" : "s"}</div>
                  {g.description && <p className="mt-1 text-xs text-muted-foreground">{g.description}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => { navigator.clipboard.writeText(g.invite_code); toast.success("Code copied"); }}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-mono">
                    <Copy className="h-3 w-3" /> {g.invite_code}
                  </button>
                  <button onClick={() => leave(g.id)} className="text-xs text-muted-foreground hover:text-red-400">Leave</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
