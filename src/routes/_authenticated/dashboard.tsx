import { createFileRoute, Link } from "@tanstack/react-router";
import { reportError } from "@/lib/report-error";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen, Brain, MessagesSquare, Plus, CalendarClock,
  Frown, Meh, Smile, Laugh, Flame, Sparkles, X, Play, ChevronRight, ListChecks,
  Zap, Gem,
} from "lucide-react";
import { isDue } from "@/lib/fsrs";
import { useEffect, useState } from "react";
import { toast } from "@/lib/notify";
import { checkAndApplyStreakFreeze } from "@/lib/streak-freeze";
import { StreakCelebration } from "@/components/streak-celebration";
import { refillHeartsIfDue } from "@/lib/hearts";

import { WeeklyConsistency } from "@/components/weekly-consistency";
import { CompanionHero } from "@/components/companion-hero";
import { LeaguesCard } from "@/components/leagues-card";
import { XpLevelCard } from "@/components/xp-level-card";
import { HeartsRow } from "@/components/hearts-row";
import { ensureTodayQuests } from "@/lib/quests";
import { BADGES } from "@/lib/gamification";


export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [hearts, setHearts] = useState<{ hearts: number; msUntilNext: number } | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    checkAndApplyStreakFreeze(user.id).then((used) => {
      if (used) qc.invalidateQueries({ queryKey: ["dash", user.id] });
    });
    refillHeartsIfDue(user.id).then(setHearts).catch(() => {});
  }, [user?.id, qc]);

  const { data } = useQuery({
    queryKey: ["dash", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [profileRes, materialsRes, cardsRes, checkinRes, examsRes, questsRes, chestRes, videoRes] = await Promise.all([
        supabase.from("user_profiles").select("*").eq("id", user!.id).maybeSingle(),
        supabase
          .from("study_materials")
          .select("id,title,subject,processing_status,created_at")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("flashcards")
          .select("id,next_review_date,fsrs_state")
          .eq("user_id", user!.id),
        supabase
          .from("daily_checkins")
          .select("id,mood,energy")
          .eq("user_id", user!.id)
          .eq("check_date", today)
          .maybeSingle(),
        supabase
          .from("exam_countdowns")
          .select("id,exam_name,subject,exam_date,current_readiness")
          .eq("user_id", user!.id)
          .gte("exam_date", today)
          .order("exam_date", { ascending: true })
          .limit(3),
        ensureTodayQuests(user!.id),
        supabase
          .from("chest_openings")
          .select("id")
          .eq("user_id", user!.id)
          .gte("opened_at", today + "T00:00:00")
          .maybeSingle(),
        // Most recently watched video — powers "Continue watching"
        (supabase as any)
          .from("video_watch_progress")
          .select("youtube_video_id,watch_seconds,total_seconds,percent_watched,last_watched_at")
          .eq("user_id", user!.id)
          .order("last_watched_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      const dueCount = (cardsRes.data ?? []).filter((c) => c.next_review_date && isDue(c.next_review_date)).length;
      const allQuestsDone = (questsRes ?? []).length > 0 && (questsRes ?? []).every((q) => q.claimed);
      // Dedupe recent materials by normalised title — newest version of each file only
      const seen = new Set<string>();
      const uniqueMaterials = (materialsRes.data ?? []).filter((m) => {
        const key = (m.title || "").trim().toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, 5);
      // Enrich the last-watched video with its title/thumbnail (saved_videos is
      // separate, and the video may never have been explicitly saved).
      let lastVideo: any = null;
      const vp = (videoRes as any)?.data;
      if (vp?.youtube_video_id) {
        const { data: sv } = await (supabase as any)
          .from("saved_videos")
          .select("title,channel,thumbnail_url")
          .eq("user_id", user!.id)
          .eq("youtube_video_id", vp.youtube_video_id)
          .maybeSingle();
        lastVideo = {
          id: vp.youtube_video_id,
          title: sv?.title ?? "Continue your video",
          channel: sv?.channel ?? "",
          thumbnail: sv?.thumbnail_url ?? `https://i.ytimg.com/vi/${vp.youtube_video_id}/mqdefault.jpg`,
          percent: Math.min(100, Math.round(Number(vp.percent_watched) || 0)),
          watchSeconds: Math.floor(Number(vp.watch_seconds) || 0),
        };
      }

      return {
        profile: profileRes.data,
        materials: uniqueMaterials,
        lastVideo,
        totalCards: (cardsRes.data ?? []).length,
        dueCount,
        checkin: checkinRes.data,
        exams: examsRes.data ?? [],
        chestUnlocked: allQuestsDone && !chestRes.data,
      };
    },
  });

  const profile = data?.profile;
  const rawName = profile?.full_name || "";
  const firstName = (rawName.includes("@") ? rawName.split("@")[0] : rawName.split(" ")[0]) || "there";

  // First-run coach mark: brand-new account, nothing uploaded yet
  const [tourDismissed, setTourDismissed] = useState(() => {
    try { return localStorage.getItem("klausum:startTourDone") === "1"; } catch { return true; }
  });
  const showTour =
    !tourDismissed && data && data.materials.length === 0 && data.totalCards === 0;
  function dismissTour() {
    setTourDismissed(true);
    try { localStorage.setItem("klausum:startTourDone", "1"); } catch {}
  }

  return (
    <div className="space-y-6 pb-12">
      {showTour && (
        <div className="fixed inset-x-0 bottom-0 z-50 p-3 md:left-60">
          <div className="card-chunky mx-auto flex max-w-2xl flex-col gap-3 border-sky/50 bg-sky p-4 text-sky-foreground shadow-[0_12px_32px_-12px_rgba(0,0,0,0.35)] sm:flex-row sm:items-center">
            <div className="flex-1">
              <p className="font-display text-sm font-extrabold uppercase tracking-wide">Start here</p>
              <p className="mt-0.5 text-sm font-semibold opacity-90">
                Upload your first material — Klausum will turn it into flashcards, notes, and quizzes.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Link
                to="/materials"
                onClick={dismissTour}
                className="btn-3d rounded-xl bg-background px-4 py-2 text-sm font-extrabold uppercase tracking-wide text-sky [--edge:rgba(0,0,0,0.2)]"
              >
                Take me there
              </Link>
              <button
                onClick={dismissTour}
                aria-label="Dismiss"
                className="rounded-xl border-2 border-sky-foreground/30 p-2 transition hover:bg-sky-foreground/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
      <StreakCelebration streak={profile?.streak_days} />
      <CompanionHero
        firstName={firstName}
        companionId={profile?.companion_id}
        companionName={profile?.companion_name}
        streak={profile?.streak_days}
        due={data?.dueCount}
        freezes={profile?.streak_freezes}
      />

      {hearts && (
        <div className="flex justify-end -mt-2">
          <HeartsRow hearts={hearts.hearts} msUntilNext={hearts.msUntilNext} />
        </div>
      )}

      {/* Duolingo-style stat strip — the four numbers that drive daily return */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[
          {
            to: "/progress" as const,
            icon: Flame,
            label: "Day streak",
            value: profile?.streak_days ?? 0,
            tone: "text-amber",
            chip: "bg-amber/15",
          },
          {
            to: "/progress" as const,
            icon: Zap,
            label: "Total XP",
            value: (profile?.xp_total ?? 0).toLocaleString(),
            tone: "text-primary",
            chip: "bg-primary/15",
          },
          {
            to: "/shop" as const,
            icon: Gem,
            label: "Gems",
            value: profile?.gems ?? 0,
            tone: "text-sky",
            chip: "bg-sky/15",
          },
          {
            to: "/review" as const,
            icon: Brain,
            label: "Cards due",
            value: data?.dueCount ?? 0,
            tone: (data?.dueCount ?? 0) > 0 ? "text-success" : "text-muted-foreground",
            chip: (data?.dueCount ?? 0) > 0 ? "bg-success/15" : "bg-surface-2",
          },
        ].map(({ to, icon: Icon, label, value, tone, chip }) => (
          <Link
            key={label}
            to={to}
            className="card-chunky card-chunky-hover flex items-center gap-2.5 bg-card px-3 py-3"
          >
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${chip}`}>
              <Icon className={`h-4.5 w-4.5 ${tone}`} />
            </span>
            <div className="min-w-0">
              <div className={`font-display text-xl font-extrabold leading-none ${tone}`}>{value}</div>
              <div className="mt-1 truncate text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
                {label}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* CourieX-style two-column layout: content left, status rail right */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <WeeklyConsistency userId={user?.id} streak={profile?.streak_days} />

          {/* Jump back in — CourieX card row */}
          <section>
            <h2 className="mb-3 font-display text-lg font-extrabold">Jump back in</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {data?.materials && data.materials.length > 0 && (
                <Link
                  to="/materials/$id"
                  params={{ id: data.materials[0].id }}
                  className="card-chunky card-chunky-hover flex items-center gap-3 bg-card p-4"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-success/15">
                    <Play className="h-5 w-5 fill-success text-success" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
                      Continue reading
                    </div>
                    <div className="truncate font-display text-sm font-extrabold">
                      {data.materials[0].title}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              )}
              {data?.lastVideo && (
                <Link
                  to="/videos"
                  search={{ v: data.lastVideo.id, t: data.lastVideo.watchSeconds }}
                  className="card-chunky card-chunky-hover flex items-center gap-3 overflow-hidden bg-card p-4"
                >
                  <span className="relative h-12 w-[68px] shrink-0 overflow-hidden rounded-xl bg-surface-3">
                    <img
                      src={data.lastVideo.thumbnail}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/35">
                      <Play className="h-4 w-4 fill-white text-white" />
                    </span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
                      Continue watching
                    </div>
                    <div className="truncate font-display text-sm font-extrabold">
                      {data.lastVideo.title}
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
                      <div
                        className="h-full rounded-full bg-destructive"
                        style={{ width: `${Math.max(3, data.lastVideo.percent)}%` }}
                      />
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              )}
              <Link to="/review" className="card-chunky card-chunky-hover flex items-center gap-3 bg-card p-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15">
                  <Brain className="h-5 w-5 text-primary" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
                    Review
                  </div>
                  <div className="font-display text-sm font-extrabold">
                    {(data?.dueCount ?? 0) > 0 ? `${data?.dueCount} cards due` : "All caught up"}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
              <Link to="/quizzes" className="card-chunky card-chunky-hover flex items-center gap-3 bg-card p-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky/15">
                  <ListChecks className="h-5 w-5 text-sky" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
                    Quiz yourself
                  </div>
                  <div className="font-display text-sm font-extrabold">Practice quiz</div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
              <Link to="/materials" className="card-chunky card-chunky-hover flex items-center gap-3 bg-card p-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface-2">
                  <BookOpen className="h-5 w-5 text-muted-foreground" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
                    Materials
                  </div>
                  <div className="font-display text-sm font-extrabold">Upload &amp; browse</div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            </div>
          </section>

          <QuizPerformance userId={user?.id} />

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-extrabold">Recent materials</h2>
              <Link to="/materials" className="text-xs font-extrabold text-sky hover:underline">
                View all
              </Link>
            </div>
            {(!data?.materials || data.materials.length === 0) ? (
              <div className="card-chunky border-dashed p-10 text-center">
                <p className="text-sm font-semibold text-muted-foreground">No materials yet.</p>
                <Link
                  to="/materials"
                  className="btn-3d btn-3d-success mt-4 inline-flex items-center gap-2 rounded-2xl bg-success px-5 py-2.5 text-sm font-extrabold uppercase tracking-wide text-success-foreground"
                >
                  <Plus className="h-4 w-4" /> Upload your first
                </Link>
              </div>
            ) : (
              <ul className="card-chunky divide-y-2 divide-border overflow-hidden bg-card">
                {data.materials.map((m) => (
                  <li key={m.id}>
                    <Link
                      to="/materials/$id"
                      params={{ id: m.id }}
                      className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-surface-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-extrabold">{m.title}</div>
                        <div className="text-xs font-semibold text-muted-foreground">{m.subject}</div>
                      </div>
                      <StatusBadge status={m.processing_status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Right rail — level, league, weekly snapshot (CourieX style) */}
        <aside className="space-y-4">
          <XpLevelCard xp={profile?.xp_total ?? 0} />
          <LeaguesCard />
          <div className="card-chunky bg-card p-4">
            <h3 className="font-display text-sm font-extrabold uppercase tracking-wide">
              Weekly snapshot
            </h3>
            <ul className="mt-3 space-y-2 text-sm font-semibold">
              <li className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Brain className="h-4 w-4" /> Cards due
                </span>
                <span className="font-extrabold">{data?.dueCount ?? 0}</span>
              </li>
              <li className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Sparkles className="h-4 w-4" /> Total cards
                </span>
                <span className="font-extrabold">{data?.totalCards ?? 0}</span>
              </li>
              <li className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <BookOpen className="h-4 w-4" /> Materials
                </span>
                <span className="font-extrabold">{data?.materials?.length ?? 0}</span>
              </li>
              <li>
                <Link to="/progress" className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2 transition hover:bg-primary/10">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Flame className="h-4 w-4" /> Badges
                  </span>
                  <span className="font-extrabold">{badgesSeenCount()}/{BADGES.length}</span>
                </Link>
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function badgesSeenCount(): number {
  try { return JSON.parse(localStorage.getItem("klausum:badgesSeen") || "[]").length; } catch { return 0; }
}

// CourieX-style Quiz Performance: taken / avg accuracy / correct, plus recents
function QuizPerformance({ userId }: { userId?: string }) {
  const { data } = useQuery({
    queryKey: ["quizPerf", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [{ data: attempts }, { data: quizzes }] = await Promise.all([
        supabase
          .from("quiz_attempts")
          .select("id, quiz_id, score, total, completed_at")
          .eq("user_id", userId!)
          .order("completed_at", { ascending: false })
          .limit(20),
        supabase.from("quizzes").select("id, title").eq("user_id", userId!).limit(50),
      ]);
      const titles = new Map((quizzes ?? []).map((q) => [q.id, q.title]));
      return (attempts ?? []).map((a) => ({ ...a, title: titles.get(a.quiz_id) ?? "Quiz" }));
    },
  });
  if (!data || data.length === 0) return null;
  const correct = data.reduce((s, a) => s + (a.score ?? 0), 0);
  const totalQ = data.reduce((s, a) => s + (a.total ?? 0), 0);
  const acc = totalQ ? Math.round((correct / totalQ) * 100) : 0;
  return (
    <section className="card-chunky bg-card p-4">
      <h2 className="font-display text-lg font-extrabold">Quiz performance</h2>
      <div className="mt-3 grid grid-cols-3 gap-3">
        {[
          { label: "Quizzes taken", value: data.length },
          { label: "Avg accuracy", value: `${acc}%` },
          { label: "Correct answers", value: correct },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl bg-surface-2 p-3 text-center">
            <div className="font-display text-2xl font-extrabold text-primary">{s.value}</div>
            <div className="mt-0.5 text-[11px] font-bold text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 space-y-2">
        {data.slice(0, 3).map((a) => {
          const pct = a.total ? Math.round(((a.score ?? 0) / a.total) * 100) : 0;
          return (
            <div key={a.id} className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2 text-sm">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold ${
                    pct >= 70 ? "bg-success/15 text-success" : pct >= 40 ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"
                  }`}
                >
                  {pct}%
                </span>
                <div className="min-w-0">
                  <div className="truncate font-extrabold">{a.title}</div>
                  <div className="text-xs font-semibold text-muted-foreground">
                    {a.score ?? 0}/{a.total ?? 0} correct
                  </div>
                </div>
              </div>
              <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                {a.completed_at ? new Date(a.completed_at).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : ""}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Maakye";
  if (h < 17) return "Maaha";
  return "Maadwo";
}

function Stat({ icon: Icon, label, value, accent, sub, to }: any) {
  const inner = (
    <>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {Icon ? <Icon className="h-3.5 w-3.5" /> : null} {label}
      </div>
      <div className={`mt-1 font-display text-3xl font-bold ${accent ? "text-primary" : ""}`}>
        {value}
      </div>
      {sub ? <div className="mt-1 text-xs text-muted-foreground">{sub}</div> : null}
    </>
  );
  const cls = `card-chunky card-chunky-hover block p-5 ${
    accent ? "border-primary/50 bg-primary/8" : "bg-card"
  }`;
  return to ? (
    <Link to={to} className={cls}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}


function ActionCard({ to, icon: Icon, title, desc, highlight }: any) {
  return (
    <Link
      to={to}
      className={`card-chunky card-chunky-hover block p-5 ${
        highlight ? "border-success/60 bg-success/8" : "bg-card"
      }`}
    >
      <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${highlight ? "bg-success/15" : "bg-surface-2"}`}>
        <Icon className={`h-5 w-5 ${highlight ? "text-success" : "text-muted-foreground"}`} />
      </div>
      <h3 className="mt-3 font-display text-base font-extrabold">{title}</h3>
      <p className="mt-1 text-sm font-semibold text-muted-foreground">{desc}</p>
    </Link>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  const map: Record<string, string> = {
    pending: "bg-muted text-muted-foreground",
    processing: "bg-primary/15 text-primary",
    ready: "bg-primary/15 text-primary",
    error: "bg-destructive/15 text-destructive",
  };
  const s = status ?? "pending";
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${map[s] || map.pending}`}>{s}</span>
  );
}

function DailyCheckin({ existing, userId, onSaved }: { existing: any; userId?: string; onSaved: () => void }) {
  const [mood, setMood] = useState<number | null>(existing?.mood ?? null);
  const [energy, setEnergy] = useState<string | null>(existing?.energy ?? null);
  const [saving, setSaving] = useState(false);

  const moods = [
    { v: 1, icon: Frown, c: "text-destructive" },
    { v: 2, icon: Meh, c: "text-muted-foreground" },
    { v: 3, icon: Smile, c: "text-sky" },
    { v: 4, icon: Laugh, c: "text-success" },
    { v: 5, icon: Flame, c: "text-primary" },
  ];
  const energies = ["low", "medium", "high"];

  async function save(m: number, en: string) {
    if (!userId) return;
    setSaving(true);
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabase
      .from("daily_checkins")
      .upsert({ user_id: userId, check_date: today, mood: m, energy: en }, { onConflict: "user_id,check_date" } as any);
    setSaving(false);
    if (error) return toast.error(reportError("dashboard", error));
    toast.success("Checked in for today ✦");
    onSaved();
  }

  return (
    <div className="card-chunky bg-card p-5">
      <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
        <CalendarClock className="h-3.5 w-3.5" /> Today's check-in
      </div>
      <h3 className="mt-1 font-display text-base font-extrabold">
        {existing ? "How you felt today" : "How are you feeling?"}
      </h3>
      <div className="mt-3 flex gap-2">
        {moods.map((m) => (
          <button
            key={m.v}
            onClick={() => { setMood(m.v); if (energy) save(m.v, energy); }}
            className={`flex flex-1 items-center justify-center rounded-xl border-2 py-2.5 transition ${
              mood === m.v ? "border-primary bg-primary/10" : "border-border bg-background hover:border-primary/50"
            }`}
          >
            <m.icon className={`h-5 w-5 ${m.c}`} />
          </button>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {energies.map((en) => (
          <button
            key={en}
            disabled={saving}
            onClick={() => { setEnergy(en); if (mood) save(mood, en); }}
            className={`rounded-xl border-2 py-2 text-xs font-extrabold capitalize transition ${
              energy === en ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:border-primary/50"
            }`}
          >
            {en} energy
          </button>
        ))}
      </div>
      {existing && (
        <p className="mt-3 text-xs font-semibold text-muted-foreground">Tap to update today's mood or energy.</p>
      )}
    </div>
  );
}

function ExamCountdown({ exams }: { exams: any[] }) {
  return (
    <div className="card-chunky bg-card p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
          <CalendarClock className="h-3.5 w-3.5" /> Upcoming exams
        </div>
        <Link to="/exams" className="text-xs font-extrabold text-sky hover:underline">Manage</Link>
      </div>
      {exams.length === 0 ? (
        <div className="mt-3 text-sm font-semibold text-muted-foreground">
          No exams scheduled. Add one in Settings to track readiness.
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {exams.map((e) => {
            const days = Math.max(0, Math.ceil((new Date(e.exam_date).getTime() - Date.now()) / 86400000));
            return (
              <li key={e.id} className="flex items-center justify-between rounded-xl border-2 border-border bg-background px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-extrabold">{e.exam_name}</div>
                  <div className="text-xs font-semibold text-muted-foreground">{e.subject || "—"}</div>
                </div>
                <div className="text-right">
                  <div className="font-display text-lg font-extrabold text-primary">{days}d</div>
                  <div className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">to go</div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
