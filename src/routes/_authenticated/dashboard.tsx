import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen, Brain, MessagesSquare, Plus, CalendarClock,
  Frown, Meh, Smile, Laugh, Flame, Sparkles, X, Play, ChevronRight,
} from "lucide-react";
import { isDue } from "@/lib/fsrs";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { checkAndApplyStreakFreeze } from "@/lib/streak-freeze";
import { refillHeartsIfDue } from "@/lib/hearts";

import { WeeklyConsistency } from "@/components/weekly-consistency";
import { CompanionHero } from "@/components/companion-hero";
import { LeaguesCard } from "@/components/leagues-card";
import { XpLevelCard } from "@/components/xp-level-card";
import { HeartsRow } from "@/components/hearts-row";
import { DailyQuests } from "@/components/daily-quests";
import { ChestCard } from "@/components/chest-card";
import { ensureTodayQuests } from "@/lib/quests";


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
      const [profileRes, materialsRes, cardsRes, checkinRes, examsRes, questsRes, chestRes] = await Promise.all([
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
      return {
        profile: profileRes.data,
        materials: uniqueMaterials,
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

      {profile?.primary_style && (
        <p className="text-xs text-muted-foreground -mt-3">
          Primary style:{" "}
          <span className="text-primary font-medium capitalize">{profile.primary_style}</span>
          {profile.secondary_style && (
            <> · secondary <span className="capitalize">{profile.secondary_style}</span></>
          )}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <XpLevelCard xp={profile?.xp_total ?? 0} />
        <Stat
          to="/review"
          label="Cards due now"
          value={data?.dueCount ?? 0}
          sub={`of ${data?.totalCards ?? 0} total`}
          accent
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <WeeklyConsistency userId={user?.id} streak={profile?.streak_days} />
        <LeaguesCard />
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr,300px]">
        <DailyQuests userId={user?.id} />
        <ChestCard userId={user?.id} tier="bronze" unlocked={!!data?.chestUnlocked} />
      </div>

      <Link
        to="/wrapped"
        className="card-chunky card-chunky-hover group block border-grape/40 bg-grape/8 p-6"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-1 text-xs font-extrabold uppercase tracking-widest text-grape">
              <Sparkles className="h-3.5 w-3.5" /> New
            </p>
            <h3 className="mt-1 font-display text-2xl font-extrabold">Your Klausum Wrapped is ready</h3>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              12 cinematic slides of your learning year — share them, save them, own them.
            </p>
          </div>
          <span className="btn-3d shrink-0 rounded-2xl bg-grape px-5 py-2.5 text-sm font-extrabold uppercase tracking-wide text-grape-foreground [--edge:oklch(0.55_0.17_300)]">
            Open
          </span>
        </div>
      </Link>










      <section className="grid gap-4 md:grid-cols-3">
        <ActionCard
          to="/review"
          icon={Brain}
          title={`Review ${data?.dueCount ?? 0} cards`}
          desc="Spaced-repetition session powered by FSRS-5."
          highlight={(data?.dueCount ?? 0) > 0}
        />
        <ActionCard
          to="/materials"
          icon={BookOpen}
          title="Upload material"
          desc="PDF, Word, or text. AI rewrites it for your learning style."
        />
        <ActionCard
          to="/tutor"
          icon={MessagesSquare}
          title="Ask the tutor"
          desc="Standard or Socratic mode. Math & code supported."
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <DailyCheckin
          existing={data?.checkin}
          userId={user?.id}
          onSaved={() => qc.invalidateQueries({ queryKey: ["dash", user?.id] })}
        />
        <ExamCountdown exams={data?.exams ?? []} />
      </section>

      {data?.materials && data.materials.length > 0 && (
        <section>
          <h2 className="font-display text-lg font-extrabold mb-3">Jump back in</h2>
          <Link
            to="/materials/$id"
            params={{ id: data.materials[0].id }}
            className="card-chunky card-chunky-hover flex items-center gap-4 bg-card p-4"
          >
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-success/15">
              <Play className="h-6 w-6 fill-success text-success" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
                Last material
              </div>
              <div className="truncate font-display text-base font-extrabold">
                {data.materials[0].title}
              </div>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
          </Link>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between mb-3">
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
    if (error) return toast.error(error.message);
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
