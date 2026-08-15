import { createFileRoute, Link } from "@tanstack/react-router";
import { reportError } from "@/lib/report-error";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { awardXp } from "@/lib/xp";
import { CHALLENGES, challengeWindow, type Challenge } from "@/lib/challenges";
import { createDuel, buildDuelQuestions, TIME_LIMIT_OPTIONS, EXPIRY_OPTIONS, type Duel } from "@/lib/duels";
import { toast } from "@/lib/notify";
import { TreasureInbox, SendTreasureButton } from "@/components/social-treasures";
import {
  Users, Trophy, Target, UsersRound, Search, UserPlus, Check, X, Crown,
  Plus, LogIn, Copy, Sparkles, CheckCircle2, Swords, Clock, Hourglass, Share2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/community")({ component: CommunityPage });

type Tab = "friends" | "leaderboard" | "duels" | "challenges" | "groups";

const TABS: [Tab, string, any][] = [
  ["friends", "Friends", Users],
  ["leaderboard", "Leaderboard", Trophy],
  ["duels", "Duels", Swords],
  ["challenges", "Challenges", Target],
  ["groups", "Groups", UsersRound],
];

function CommunityPage() {
  const [tab, setTab] = useState<Tab>("friends");
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-extrabold">Community</h1>
        <p className="text-sm font-semibold text-muted-foreground">Friends, leaderboard, duels, and study groups.</p>
      </header>

      <div data-tour-community-tabs className="flex flex-wrap gap-2">
        {TABS.map(([k, label, Icon]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`inline-flex items-center gap-1.5 rounded-full border-2 px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-wide transition ${
              tab === k
                ? "border-sky/40 bg-sky/12 text-sky"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}>
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      {tab === "friends" && <FriendsTab />}
      {tab === "leaderboard" && <LeaderboardTab />}
      {tab === "duels" && <DuelsTab />}
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
    if (error) return toast.error(reportError("community", error));
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
      <section data-tour-find className="card-chunky bg-card p-4">
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5"><Search className="h-4 w-4" /> Find friends</h2>
        <div className="flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
            placeholder="Search by @handle or name"
            className="flex-1 rounded-xl border-2 border-border bg-background px-3 py-2 text-sm" />
          <button onClick={runSearch} disabled={searching}
            className="btn-3d rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {searching ? "…" : "Search"}
          </button>
        </div>
        {searchResults.length > 0 && (
          <ul className="mt-3 space-y-2">
            {searchResults.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-xl border-2 border-border/40 bg-card p-2">
                <Avatar p={p} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{p.full_name}</div>
                  <div className="text-xs text-muted-foreground truncate">{p.handle ? `@${p.handle}` : "—"} · {p.xp_total ?? 0} XP</div>
                </div>
                {existingIds.has(p.id) ? (
                  <span className="text-xs text-muted-foreground">Connected</span>
                ) : (
                  <button onClick={() => sendRequest(p.id)} className="inline-flex items-center gap-1 rounded-xl border border-primary/40 bg-primary/10 px-2 py-1 text-xs text-primary">
                    <UserPlus className="h-3 w-3" /> Add
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Gifts first: something waiting for you is a better reason to open
          this page than a list of people you already know. */}
      <TreasureInbox />

      {incoming.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Incoming requests</h2>
          <ul className="space-y-2">
            {incoming.map((f: any) => {
              const p = profById[f.requester_id];
              return (
                <li key={f.id} className="flex items-center gap-3 rounded-xl border-2 border-border bg-card p-2">
                  <Avatar p={p} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{p?.full_name ?? "User"}</div>
                    <div className="text-xs text-muted-foreground truncate">{p?.handle ? `@${p.handle}` : ""}</div>
                  </div>
                  <button onClick={() => respond(f.id, true)} className="rounded-xl bg-success/20 p-1.5 text-success"><Check className="h-4 w-4" /></button>
                  <button onClick={() => respond(f.id, false)} className="rounded-xl bg-destructive/20 p-1.5 text-destructive"><X className="h-4 w-4" /></button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Your friends ({friends.length})</h2>
        {friends.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No friends yet. Search by @handle to add some.
          </div>
        ) : (
          <ul className="space-y-2">
            {friends.map((f: any) => {
              const otherId = f.requester_id === user?.id ? f.addressee_id : f.requester_id;
              const p = profById[otherId];
              return (
                <li key={f.id} className="flex items-center gap-3 rounded-xl border-2 border-border bg-card p-2">
                  <Avatar p={p} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{p?.full_name ?? "User"}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {p?.handle ? `@${p.handle} · ` : ""}{p?.xp_total ?? 0} XP
                    </div>
                  </div>
                  <SendTreasureButton friendId={otherId} name={p?.full_name} />
                  <button onClick={() => unfriend(f.id)} className="text-xs text-muted-foreground hover:text-destructive">Remove</button>
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
                <li key={f.id} className="flex items-center gap-3 rounded-lg border border-dashed border-border p-2 text-sm">
                  <span className="flex-1 truncate text-muted-foreground">Waiting on {p?.full_name ?? "user"}{p?.handle ? ` (@${p.handle})` : ""}</span>
                  <button onClick={() => unfriend(f.id)} className="text-xs text-muted-foreground hover:text-destructive">Cancel</button>
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
  const [scope, setScope] = useState<"global" | "school" | "friends">("global");

  const { data: myProfile } = useQuery({
    queryKey: ["my_school", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("user_profiles").select("school").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

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

  const { data: schoolIds } = useQuery({
    queryKey: ["school_ids", myProfile?.school],
    enabled: scope === "school" && !!myProfile?.school,
    queryFn: async () => {
      const { data } = await supabase.from("public_profiles").select("id").eq("school", myProfile!.school as string);
      return (data ?? []).map((p) => p.id).filter((id): id is string => !!id);
    },
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["leaderboard", scope, friendIds.join(","), (schoolIds ?? []).join(",")],
    enabled: !!user && (scope !== "school" || schoolIds !== undefined),
    queryFn: async () => {
      // Monday-based, matching DATE_TRUNC('week', ...) in update_weekly_leaderboard
      const weekStart = (() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); d.setHours(0, 0, 0, 0); return d.toISOString().slice(0, 10); })();
      let q = supabase.from("leaderboard_weekly").select("user_id, xp_this_week").eq("week_start", weekStart);
      if (scope === "friends" && friendIds.length > 0) q = q.in("user_id", friendIds);
      if (scope === "school") q = q.in("user_id", schoolIds ?? []);
      const { data: lb } = await q.order("xp_this_week", { ascending: false }).limit(50);
      const ids = (lb ?? []).map((r) => r.user_id);
      if (ids.length === 0) return [];
      const { data: profs } = await supabase.from("public_profiles")
        .select("id, full_name, handle, avatar_url, level").in("id", ids);
      const byId = Object.fromEntries((profs ?? []).map((p) => [p.id, p]));
      return (lb ?? []).map((r) => ({ ...r, profile: byId[r.user_id] }));
    },
  });

  // Podium only makes sense fully seated; with 1-2 entrants everyone goes in the list
  const hasPodium = rows.length >= 3;
  const podium = hasPodium ? rows.slice(0, 3) : [];
  const rest = hasPodium ? rows.slice(3) : rows;
  const rankOffset = hasPodium ? 4 : 1;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {(["global", "school", "friends"] as const).map((s) => (
          <button key={s} onClick={() => setScope(s)}
            disabled={s === "school" && !myProfile?.school}
            className={`rounded-full border-2 px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-wide capitalize transition disabled:cursor-not-allowed disabled:opacity-40 ${
              scope === s
                ? "border-primary/40 bg-primary/12 text-primary"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}>
            {s}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-sm font-semibold text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="card-chunky border-dashed p-8 text-center text-sm font-semibold text-muted-foreground">
          {scope === "school" && !myProfile?.school
            ? "Add your school in Settings to see this leaderboard."
            : "No XP earned this week yet. Be the first."}
        </div>
      ) : (
        <>
          <YourStanding rows={rows} meId={user?.id} />
          {hasPodium && (
            <div className="grid grid-cols-3 items-end gap-2">
              <PodiumCard rank={2} row={podium[1]} isMe={podium[1].user_id === user?.id} />
              <PodiumCard rank={1} row={podium[0]} isMe={podium[0].user_id === user?.id} />
              <PodiumCard rank={3} row={podium[2]} isMe={podium[2].user_id === user?.id} />
            </div>
          )}
          <ol className="space-y-1.5">
            {rest.map((r: any, i: number) => (
              <li key={r.user_id} className={`flex items-center gap-3 rounded-xl border-2 p-2.5 ${r.user_id === user?.id ? "border-primary/40 bg-primary/10" : "border-border bg-card"}`}>
                <div className="w-7 text-center font-mono text-sm font-extrabold text-muted-foreground">
                  {i + rankOffset}
                </div>
                <Avatar p={r.profile} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-extrabold truncate">
                    {r.profile?.full_name ?? "A classmate"}
                    {r.user_id === user?.id && <span className="ml-1 text-xs text-primary">(you)</span>}
                  </div>
                  {r.profile?.handle && <div className="text-xs font-semibold text-muted-foreground">@{r.profile.handle}</div>}
                </div>
                <div className="text-sm font-mono font-extrabold text-primary">{r.xp_this_week} XP</div>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}

/**
 * Where you actually stand, and who is directly in front of you.
 *
 * A podium of three strangers is demotivating for everyone who isn't on it —
 * an absolute global ranking tells the other forty-seven people only that they
 * lost. What moves someone is a gap they could close this evening, so the
 * headline number here is the distance to the single person above you, not the
 * distance to first.
 */
function YourStanding({ rows, meId }: { rows: any[]; meId?: string }) {
  const idx = rows.findIndex((r) => r.user_id === meId);
  if (idx === -1) {
    // On the board's scope but with no XP banked this week.
    return (
      <div className="card-chunky bg-card p-3.5 text-sm font-semibold text-muted-foreground">
        You're not on this week's board yet. Any session at all puts you on it.
      </div>
    );
  }

  const me = rows[idx];
  const ahead = idx > 0 ? rows[idx - 1] : null;
  const behind = rows[idx + 1] ?? null;
  const gap = ahead ? Math.max(0, ahead.xp_this_week - me.xp_this_week) : 0;
  // How far you are along the stretch between the person behind and the one
  // ahead — a bar that is nearly full reads as "almost", which is the point.
  const floor = behind?.xp_this_week ?? 0;
  const span = ahead ? Math.max(1, ahead.xp_this_week - floor) : 1;
  const pct = ahead
    ? Math.min(100, Math.max(4, Math.round(((me.xp_this_week - floor) / span) * 100)))
    : 100;

  return (
    <div className="card-chunky bg-card p-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">
          Your standing
        </span>
        <span className="font-display text-lg font-extrabold tabular-nums">
          #{idx + 1}
          <span className="ml-1 text-xs font-bold text-muted-foreground">
            of {rows.length}
          </span>
        </span>
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="mt-2 text-sm font-extrabold">
        {ahead ? (
          gap === 0 ? (
            <>You're level with {ahead.profile?.full_name ?? "the player above"} — one card breaks the tie.</>
          ) : (
            <>
              <span className="text-primary">{gap} XP</span> behind{" "}
              {ahead.profile?.full_name ?? "the player above"}.
            </>
          )
        ) : (
          <>You're top of this board. {behind ? `${me.xp_this_week - behind.xp_this_week} XP clear.` : ""}</>
        )}
      </p>
      {behind && ahead && (
        // Loss avoidance, stated once and quietly. Said louder or more often it
        // becomes nagging, which is exactly the black-hat trap.
        <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
          {behind.profile?.full_name ?? "Someone"} is {me.xp_this_week - behind.xp_this_week} XP behind you.
        </p>
      )}
    </div>
  );
}

function PodiumCard({ rank, row, isMe }: { rank: 1 | 2 | 3; row: any; isMe: boolean }) {
  const heights = { 1: "h-40", 2: "h-32", 3: "h-28" } as const;
  const tones = {
    1: "bg-primary text-primary-foreground border-primary",
    2: "bg-surface-3 text-foreground border-border",
    3: "bg-surface-2 text-foreground border-border",
  } as const;
  return (
    <div className="flex flex-col items-center">
      <div className="relative mb-2">
        {rank === 1 && <Crown className="absolute -top-6 left-1/2 h-5 w-5 -translate-x-1/2 fill-primary text-primary" />}
        <Avatar p={row.profile} />
      </div>
      <div className="w-full truncate text-center text-xs font-extrabold">
        {row.profile?.full_name ?? "A classmate"}{isMe && <span className="text-primary"> (you)</span>}
      </div>
      <div
        className={`card-chunky mt-2 flex w-full flex-col items-center justify-end gap-1 border-2 p-2 ${heights[rank]} ${tones[rank]}`}
      >
        <span className="font-display text-2xl font-extrabold">#{rank}</span>
        <span className="text-xs font-extrabold">{row.xp_this_week} XP</span>
      </div>
    </div>
  );
}

// ─── DUELS ────────────────────────────────────────────────────────────────

function DuelsTab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [listFilter, setListFilter] = useState<"active" | "finished" | "all">("active");

  const { data: friends = [] } = useQuery({
    queryKey: ["duel_friends", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: fr } = await supabase.from("friendships").select("*").eq("status", "accepted")
        .or(`requester_id.eq.${user!.id},addressee_id.eq.${user!.id}`);
      const ids = (fr ?? []).map((f: any) => (f.requester_id === user!.id ? f.addressee_id : f.requester_id));
      if (ids.length === 0) return [];
      const { data } = await supabase.from("public_profiles").select("id, full_name, handle, avatar_url").in("id", ids);
      return data ?? [];
    },
  });

  // Materials, not quizzes. A duel pointed at a saved quiz could be opened and
  // read in another tab before accepting, so the winner was whoever thought of
  // that first. Only materials with enough key concepts to build a real set are
  // offered.
  const { data: myMaterials = [] } = useQuery({
    queryKey: ["duel_materials", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("study_materials")
        .select("id, title, subject, key_concepts")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      return (data ?? []).filter((m: any) => Array.isArray(m.key_concepts) && m.key_concepts.length >= 4);
    },
  });

  const { data: duels = [], isLoading } = useQuery({
    queryKey: ["duels", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await (supabase as any).from("quiz_challenges").select("*")
        .or(`challenger_id.eq.${user!.id},opponent_id.eq.${user!.id}`)
        .order("created_at", { ascending: false });
      return (data ?? []) as Duel[];
    },
  });

  const otherIds = useMemo(() => {
    const ids = new Set<string>();
    for (const d of duels) ids.add(d.challenger_id === user?.id ? d.opponent_id : d.challenger_id);
    return Array.from(ids);
  }, [duels, user]);

  const { data: duelProfiles = [] } = useQuery({
    queryKey: ["duel_profiles", otherIds.join(",")],
    enabled: otherIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("public_profiles").select("id, full_name, handle, avatar_url").in("id", otherIds);
      return data ?? [];
    },
  });
  const profById = useMemo(() => Object.fromEntries(duelProfiles.map((p: any) => [p.id, p])), [duelProfiles]);

  // Titles come from the material a duel was built from. Older duels still
  // carry a quiz_id and no material, so both are looked up.
  const { data: duelTitles = [] } = useQuery({
    queryKey: ["duel_titles", duels.map((d: any) => d.material_id ?? d.quiz_id).join(",")],
    enabled: duels.length > 0,
    queryFn: async () => {
      const matIds = Array.from(new Set(duels.map((d: any) => d.material_id).filter(Boolean)));
      const quizIds = Array.from(new Set(duels.map((d: any) => d.quiz_id).filter(Boolean)));
      const [mats, quizzes] = await Promise.all([
        matIds.length
          ? supabase.from("study_materials").select("id, title").in("id", matIds as string[])
          : Promise.resolve({ data: [] as any[] }),
        quizIds.length
          ? supabase.from("quizzes").select("id, title").in("id", quizIds as string[])
          : Promise.resolve({ data: [] as any[] }),
      ]);
      return [...(mats.data ?? []), ...(quizzes.data ?? [])];
    },
  });
  const titleById = useMemo(() => Object.fromEntries(duelTitles.map((q: any) => [q.id, q.title])), [duelTitles]);

  // Shared as text rather than a link or an image: it survives WhatsApp, means
  // something to a friend who has never heard of Klausum, and needs nothing
  // generated or hosted.
  async function shareWin(mine: number, theirs: number | null, name?: string) {
    const text = `Beat ${name ?? "a friend"} ${mine}% to ${theirs ?? 0}% in a Klausum duel. ${window.location.origin}`;
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        /* dismissed — fall through to the clipboard */
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied — go and gloat");
    } catch {
      toast.error("Couldn't copy that");
    }
  }

  const now = Date.now();
  const isExpired = (d: Duel) => d.status !== "completed" && new Date(d.expires_at).getTime() < now;
  const filtered = duels.filter((d) => {
    if (listFilter === "all") return true;
    const finished = d.status === "completed" || isExpired(d);
    return listFilter === "finished" ? finished : !finished;
  });

  return (
    <div className="space-y-5">
      <button
        onClick={() => setModalOpen(true)}
        className="btn-3d btn-3d-success inline-flex items-center gap-2 rounded-2xl bg-success px-4 py-2.5 text-sm font-extrabold uppercase tracking-wide text-success-foreground"
      >
        <Swords className="h-4 w-4" /> New Duel
      </button>

      <div className="flex gap-2">
        {(["active", "finished", "all"] as const).map((f) => (
          <button key={f} onClick={() => setListFilter(f)}
            className={`rounded-full border-2 px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide transition ${
              listFilter === f ? "border-primary/40 bg-primary/12 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}>
            {f}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-sm font-semibold text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="card-chunky border-dashed p-8 text-center text-sm font-semibold text-muted-foreground">
          {duels.length === 0
            ? "No duels yet. Challenge a friend to a quiz — best score wins XP."
            : "Nothing here."}
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((d) => {
            const other = profById[d.challenger_id === user?.id ? d.opponent_id : d.challenger_id];
            const iAmChallenger = d.challenger_id === user?.id;
            const myScore = iAmChallenger ? d.challenger_score : d.opponent_score;
            const theirScore = iAmChallenger ? d.opponent_score : d.challenger_score;
            const expired = isExpired(d);
            const finished = d.status === "completed" || expired;
            const iWon = d.winner_id === user?.id;
            const tied = finished && d.winner_id === null && myScore !== null && theirScore !== null;
            return (
              <li key={d.id} className={`card-chunky flex items-center gap-3 p-3 ${finished && iWon ? "border-success/40 bg-success/8" : ""}`}>
                <Avatar p={other} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-extrabold">
                    {titleById[d.quiz_id] ?? "Quiz"} vs {other?.full_name ?? "Friend"}
                  </div>
                  <div className="flex items-center gap-3 text-xs font-bold text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {d.time_limit_seconds}s / question</span>
                    {!finished && (
                      <span className="inline-flex items-center gap-1"><Hourglass className="h-3 w-3" /> expires {new Date(d.expires_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    )}
                  </div>
                </div>
                {finished ? (
                  <div className="shrink-0 text-right">
                    <div className={`text-xs font-extrabold uppercase tracking-wide ${iWon ? "text-success" : tied ? "text-muted-foreground" : expired && myScore === null ? "text-muted-foreground" : "text-destructive"}`}>
                      {expired && myScore === null ? "Expired" : iWon ? "You won" : tied ? "Tied" : "You lost"}
                    </div>
                    <div className="text-xs font-bold text-muted-foreground">
                      {myScore ?? "—"}% vs {theirScore ?? "—"}%
                    </div>
                    {/* Bragging rights: a win nobody can see is worth much
                        less than one you can show someone. */}
                    {iWon && myScore !== null && (
                      <button
                        onClick={() => shareWin(myScore as number, theirScore, other?.full_name)}
                        className="mt-1 inline-flex items-center gap-1 rounded-lg border-2 border-border px-2 py-0.5 text-[10px] font-extrabold transition hover:border-sky hover:text-sky"
                      >
                        <Share2 className="h-3 w-3" /> Share
                      </button>
                    )}
                  </div>
                ) : myScore !== null ? (
                  <span className="shrink-0 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">Waiting on {other?.full_name ?? "friend"}</span>
                ) : (
                  <Link
                    // Material duels carry their own questions and are played
                    // here; anything older still points at its quiz.
                    to={(d as any).material_id ? "/duel/$id" : "/quizzes/$id/take"}
                    params={{ id: (d as any).material_id ? d.id : d.quiz_id }}
                    search={(d as any).material_id ? undefined : { challenge: d.id, timer: d.time_limit_seconds }}
                    className="btn-3d btn-3d-success shrink-0 rounded-xl bg-success px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide text-success-foreground"
                  >
                    Go first
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {modalOpen && (
        <NewDuelModal
          friends={friends}
          materials={myMaterials}
          onClose={() => setModalOpen(false)}
          onCreated={() => {
            setModalOpen(false);
            qc.invalidateQueries({ queryKey: ["duels", user?.id] });
          }}
        />
      )}
    </div>
  );
}

function NewDuelModal({
  friends, materials, onClose, onCreated,
}: {
  friends: any[]; materials: any[]; onClose: () => void; onCreated: () => void;
}) {
  const { user } = useAuth();
  const [friendId, setFriendId] = useState<string | null>(null);
  const [materialId, setMaterialId] = useState<string | null>(null);
  const [timeLimit, setTimeLimit] = useState(60);
  const [expiryHours, setExpiryHours] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  async function issue() {
    if (!user || !friendId || !materialId) return;
    const material = materials.find((m: any) => m.id === materialId);
    // Questions are built here, at the moment the duel is issued, from the
    // material's key concepts. Nothing exists to be looked up beforehand,
    // which is the entire point of moving off saved quizzes.
    const concepts = (material?.key_concepts ?? []).map((c: any) => ({
      concept: String(c?.concept ?? c?.term ?? "").trim(),
      definition: String(c?.definition ?? c?.description ?? "").trim(),
    }));
    const questions = buildDuelQuestions(concepts);
    if (questions.length < 3) {
      return toast.error("That material needs a few more key concepts first");
    }

    setSubmitting(true);
    const { error } = await createDuel({
      challengerId: user.id,
      opponentId: friendId,
      materialId,
      questions,
      timeLimitSeconds: timeLimit,
      expiryHours,
    });
    setSubmitting(false);
    if (error) return toast.error(reportError("community", error));
    toast.success("Duel issued — same questions for both of you");
    onCreated();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="card-chunky max-h-[85vh] w-full max-w-md overflow-y-auto bg-card p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <Swords className="h-5 w-5 text-success" />
          <h2 className="font-display text-lg font-extrabold">New Duel</h2>
        </div>

        <div className="mt-4">
          <div className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">Challenge a friend</div>
          {friends.length === 0 ? (
            <div className="mt-2 rounded-xl border-2 border-dashed border-border p-4 text-center text-xs font-semibold text-muted-foreground">
              No friends yet — add some in the Friends tab first.
            </div>
          ) : (
            <div className="mt-2 max-h-32 space-y-1.5 overflow-y-auto">
              {friends.map((f: any) => (
                <button key={f.id} onClick={() => setFriendId(f.id)}
                  className={`flex w-full items-center gap-2 rounded-xl border-2 p-2 text-left transition ${friendId === f.id ? "border-success bg-success/10" : "border-border hover:border-success/50"}`}>
                  <Avatar p={f} />
                  <span className="truncate text-sm font-bold">{f.full_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4">
          <div className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">Material to duel on</div>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">
            Fresh questions are generated when you send it, so neither of you can see them first.
          </p>
          {materials.length === 0 ? (
            <div className="mt-2 rounded-xl border-2 border-dashed border-border p-4 text-center text-xs font-semibold text-muted-foreground">
              No material has enough key concepts yet — open one so Klausum can read it.
            </div>
          ) : (
            <div className="mt-2 max-h-32 space-y-1.5 overflow-y-auto">
              {materials.map((m: any) => (
                <button key={m.id} onClick={() => setMaterialId(m.id)}
                  className={`flex w-full items-center justify-between rounded-xl border-2 p-2 text-left transition ${materialId === m.id ? "border-success bg-success/10" : "border-border hover:border-success/50"}`}>
                  <span className="truncate text-sm font-bold">{m.title}</span>
                  <span className="shrink-0 text-xs font-bold text-muted-foreground">{m.key_concepts.length} concepts</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4">
          <div className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">Time limit per attempt</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {TIME_LIMIT_OPTIONS.map((t) => (
              <button key={t.seconds} onClick={() => setTimeLimit(t.seconds)}
                className={`rounded-full border-2 px-3 py-1 text-xs font-extrabold transition ${timeLimit === t.seconds ? "border-success bg-success/10 text-success" : "border-border text-muted-foreground hover:border-success/50"}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <div className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">Challenge expiry</div>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">After this timer runs out, nobody else can submit a score.</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {EXPIRY_OPTIONS.map((t) => (
              <button key={t.hours} onClick={() => setExpiryHours(t.hours)}
                className={`rounded-full border-2 px-3 py-1 text-xs font-extrabold transition ${expiryHours === t.hours ? "border-success bg-success/10 text-success" : "border-border text-muted-foreground hover:border-success/50"}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-2xl border-2 border-border py-2.5 text-sm font-extrabold text-muted-foreground">
            Cancel
          </button>
          <button
            onClick={issue}
            disabled={!friendId || !materialId || submitting}
            className="btn-3d btn-3d-success flex-1 rounded-2xl bg-success py-2.5 text-sm font-extrabold uppercase tracking-wide text-success-foreground disabled:cursor-not-allowed"
          >
            <Swords className="mr-1.5 inline h-4 w-4" /> Issue Challenge
          </button>
        </div>
      </div>
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
    // Scope the row to this challenge's period so daily/weekly ones can be
    // claimed again next period (unique is user+key+period_start).
    const { start } = challengeWindow(c.cadence);
    const periodStart = new Date(start.getTime() - start.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10);
    const { error } = await (supabase as any).from("challenge_completions").insert({
      user_id: user!.id, challenge_key: c.key, xp_awarded: c.xp, period_start: periodStart,
    });
    if (error) {
      if (error.code === "23505") return toast.error("Already claimed for this period.");
      return toast.error(reportError("community", error));
    }
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
            <div key={c.key} className={`rounded-xl border p-4 ${done ? "border-success/40 bg-success/10" : "border-border bg-card"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm flex items-center gap-1.5">
                    {done && <CheckCircle2 className="h-3.5 w-3.5 text-success" />}
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
    if (error || !data) return toast.error(reportError("community", error));
    // creator is auto-added as admin via DB trigger
    setCreating(false);
    setForm({ name: "", subject: "General", description: "" });
    qc.invalidateQueries({ queryKey: ["study_groups", user?.id] });
    toast.success("Group created");
  }

  async function joinGroup() {
    if (!joinCode.trim()) return;
    const { error } = await supabase.rpc("join_study_group", { p_invite_code: joinCode.trim().toUpperCase() });
    if (error) return toast.error(reportError("community", error));
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
          className="inline-flex items-center gap-1 btn-3d rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
          <Plus className="h-4 w-4" /> Create
        </button>
        <button onClick={() => { setJoining(!joining); setCreating(false); }}
          className="inline-flex items-center gap-1 rounded-xl border-2 border-border bg-card px-3 py-2 text-sm font-semibold">
          <LogIn className="h-4 w-4" /> Join with code
        </button>
      </div>

      {creating && (
        <div className="card-chunky bg-card p-4 space-y-2">
          <input className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm" placeholder="Group name"
            value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm" placeholder="Subject"
            value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          <textarea className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm" rows={2} placeholder="Description (optional)"
            value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="flex gap-2">
            <button onClick={createGroup} className="btn-3d rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">Create</button>
            <button onClick={() => setCreating(false)} className="rounded-xl border-2 border-border px-3 py-1.5 text-xs">Cancel</button>
          </div>
        </div>
      )}

      {joining && (
        <div className="card-chunky bg-card p-4 flex gap-2">
          <input className="flex-1 rounded-xl border-2 border-border bg-background px-3 py-2 text-sm font-mono uppercase" placeholder="ABC12345"
            value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} maxLength={8} />
          <button onClick={joinGroup} className="btn-3d rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">Join</button>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          You're not in any groups yet. Create one or join with a code.
        </div>
      ) : (
        <ul className="space-y-2">
          {groups.map((g: any) => (
            <li key={g.id} className="card-chunky bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{g.name}</div>
                  <div className="text-xs text-muted-foreground">{g.subject} · {g.member_count} member{g.member_count === 1 ? "" : "s"}</div>
                  {g.description && <p className="mt-1 text-xs text-muted-foreground">{g.description}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => { navigator.clipboard.writeText(g.invite_code); toast.success("Code copied"); }}
                    className="inline-flex items-center gap-1 rounded-xl border-2 border-border bg-background px-2 py-1 text-xs font-mono">
                    <Copy className="h-3 w-3" /> {g.invite_code}
                  </button>
                  <button onClick={() => leave(g.id)} className="text-xs text-muted-foreground hover:text-destructive">Leave</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
