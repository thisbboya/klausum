import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Brain, MessagesSquare, Plus, CalendarClock } from "lucide-react";
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
          .order("created_at", { ascending: false })
          .limit(5),
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
      return {
        profile: profileRes.data,
        materials: materialsRes.data ?? [],
        totalCards: (cardsRes.data ?? []).length,
        dueCount,
        checkin: checkinRes.data,
        exams: examsRes.data ?? [],
        chestUnlocked: allQuestsDone && !chestRes.data,
      };
    },
  });

  const profile = data?.profile;
  const firstName = profile?.full_name?.split(" ")[0] || "there";

  return (
    <div className="space-y-6 pb-12">
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
        className="group relative block overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/20 via-fuchsia-500/10 to-indigo-500/20 p-6 transition hover:border-primary/60"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">✨ New</p>
            <h3 className="mt-1 font-display text-2xl font-bold">Your Klausum Wrapped is ready</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              12 cinematic slides of your learning year — share them, save them, own them.
            </p>
          </div>
          <span className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground group-hover:opacity-90">
            Open →
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

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-semibold">Recent materials</h2>
          <Link to="/materials" className="text-xs text-primary hover:underline">
            View all
          </Link>
        </div>
        {(!data?.materials || data.materials.length === 0) ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center">
            <p className="text-sm text-muted-foreground">No materials yet.</p>
            <Link
              to="/materials"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              <Plus className="h-4 w-4" /> Upload your first
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {data.materials.map((m) => (
              <li key={m.id}>
                <Link
                  to="/materials/$id"
                  params={{ id: m.id }}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-accent/10 transition"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{m.title}</div>
                    <div className="text-xs text-muted-foreground">{m.subject}</div>
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
  const cls = `block rounded-2xl border p-5 transition ${
    accent ? "border-primary/40 bg-primary/5 hover:bg-primary/10" : "border-border bg-card hover:border-primary/40"
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
      className={`block rounded-xl border p-5 transition hover:-translate-y-0.5 ${
        highlight ? "border-primary/60 bg-primary/10 shadow-[var(--shadow-glow)]" : "border-border bg-card hover:border-primary/40"
      }`}
    >
      <Icon className={`h-5 w-5 ${highlight ? "text-primary" : "text-muted-foreground"}`} />
      <h3 className="mt-3 font-display text-base font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </Link>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  const map: Record<string, string> = {
    pending: "bg-muted text-muted-foreground",
    processing: "bg-amber-500/15 text-amber-400",
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
    { v: 1, e: "😞" }, { v: 2, e: "😐" }, { v: 3, e: "🙂" }, { v: 4, e: "😄" }, { v: 5, e: "🔥" },
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
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <CalendarClock className="h-3.5 w-3.5" /> Today's check-in
      </div>
      <h3 className="mt-1 font-display text-base font-semibold">
        {existing ? "How you felt today" : "How are you feeling?"}
      </h3>
      <div className="mt-3 flex gap-2">
        {moods.map((m) => (
          <button
            key={m.v}
            onClick={() => { setMood(m.v); if (energy) save(m.v, energy); }}
            className={`flex-1 rounded-lg border py-2 text-xl transition ${
              mood === m.v ? "border-primary bg-primary/10" : "border-border bg-background hover:border-primary/40"
            }`}
          >
            {m.e}
          </button>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {energies.map((en) => (
          <button
            key={en}
            disabled={saving}
            onClick={() => { setEnergy(en); if (mood) save(mood, en); }}
            className={`rounded-lg border py-2 text-xs font-medium capitalize transition ${
              energy === en ? "border-primary bg-primary/10 text-primary" : "border-border bg-background hover:border-primary/40"
            }`}
          >
            {en} energy
          </button>
        ))}
      </div>
      {existing && (
        <p className="mt-3 text-xs text-muted-foreground">Tap to update today's mood or energy.</p>
      )}
    </div>
  );
}

function ExamCountdown({ exams }: { exams: any[] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarClock className="h-3.5 w-3.5" /> Upcoming exams
        </div>
        <Link to="/exams" className="text-xs text-primary hover:underline">Manage</Link>
      </div>
      {exams.length === 0 ? (
        <div className="mt-3 text-sm text-muted-foreground">
          No exams scheduled. Add one in Settings to track readiness.
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {exams.map((e) => {
            const days = Math.max(0, Math.ceil((new Date(e.exam_date).getTime() - Date.now()) / 86400000));
            return (
              <li key={e.id} className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{e.exam_name}</div>
                  <div className="text-xs text-muted-foreground">{e.subject || "—"}</div>
                </div>
                <div className="text-right">
                  <div className="font-display text-lg font-semibold text-primary">{days}d</div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">to go</div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
