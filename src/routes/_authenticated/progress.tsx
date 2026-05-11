import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { generateWeeklyInsight } from "@/lib/insights.functions";
import { useState } from "react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, LineChart, Line } from "recharts";
import { Flame, Trophy, Target, BookOpen, Sparkles, Lock } from "lucide-react";
import { LEVELS, levelFor, BADGES, type BadgeStats } from "@/lib/gamification";

export const Route = createFileRoute("/_authenticated/progress")({ component: ProgressPage });

function ProgressPage() {
  const { user } = useAuth();
  const callInsight = useServerFn(generateWeeklyInsight);
  const [insights, setInsights] = useState<any[] | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);

  const { data } = useQuery({
    queryKey: ["progress-v2", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const since = new Date(Date.now() - 90 * 86400_000).toISOString();
      const [profile, attempts, reviews, materials, xp, gaps, voiceNotes, formulas, rooms, tutorSessions, cards] = await Promise.all([
        supabase.from("user_profiles").select("*").eq("id", user!.id).maybeSingle(),
        supabase.from("quiz_attempts").select("*").eq("user_id", user!.id).gte("completed_at", since),
        supabase.from("flashcard_reviews").select("rating, reviewed_at").eq("user_id", user!.id).gte("reviewed_at", since),
        supabase.from("study_materials").select("id, subject, processing_status, created_at").eq("user_id", user!.id),
        supabase.from("xp_events").select("xp_amount, created_at").eq("user_id", user!.id).gte("created_at", since),
        supabase.from("knowledge_gaps").select("id, status").eq("user_id", user!.id),
        supabase.from("voice_notes").select("id").eq("user_id", user!.id),
        supabase.from("formulas").select("id").eq("user_id", user!.id),
        supabase.from("study_rooms").select("id").eq("host_id", user!.id),
        supabase.from("tutor_sessions").select("id, mode").eq("user_id", user!.id),
        supabase.from("flashcards").select("fsrs_stability, fsrs_state, fsrs_lapses, next_review_date").eq("user_id", user!.id),
      ]);
      return {
        profile: profile.data,
        attempts: attempts.data ?? [],
        reviews: reviews.data ?? [],
        materials: materials.data ?? [],
        xp: xp.data ?? [],
        gaps: gaps.data ?? [],
        voiceNotes: voiceNotes.data ?? [],
        formulas: formulas.data ?? [],
        rooms: rooms.data ?? [],
        tutorSessions: tutorSessions.data ?? [],
        cards: cards.data ?? [],
      };
    },
  });

  if (!data) return <div className="text-sm text-muted-foreground">Loading…</div>;
  const { profile, attempts, reviews, materials, xp, gaps, voiceNotes, formulas, rooms, tutorSessions, cards } = data;

  // FSRS card health bins (by stability days)
  const healthBins = [
    { label: "New", min: -1, max: 0.001, color: "bg-muted text-muted-foreground" },
    { label: "Learning", min: 0.001, max: 7, color: "bg-amber-500/20 text-amber-400" },
    { label: "Young", min: 7, max: 21, color: "bg-sky-500/20 text-sky-400" },
    { label: "Mature", min: 21, max: 90, color: "bg-emerald-500/20 text-emerald-400" },
    { label: "Mastered", min: 90, max: Infinity, color: "bg-primary/25 text-primary" },
  ];
  const healthData = healthBins.map((b) => ({
    ...b,
    count: cards.filter((c: any) => {
      const s = c.fsrs_stability ?? 0;
      if (b.label === "New") return c.fsrs_state === "new" || s === 0;
      return s > b.min && s <= b.max && c.fsrs_state !== "new";
    }).length,
  }));
  const totalCards = cards.length;
  const dueToday = cards.filter((c: any) => c.next_review_date && c.next_review_date <= new Date().toISOString().slice(0, 10) && c.fsrs_state !== "new").length;
  const leeches = cards.filter((c: any) => (c.fsrs_lapses ?? 0) >= 4).length;
  const totalReviews = reviews.length;
  const correctReviews = reviews.filter((r: any) => r.rating >= 3).length;
  const retention = totalReviews ? Math.round((correctReviews / totalReviews) * 100) : 0;

  // Bloom radar
  const bloomTotals: Record<number, { c: number; t: number }> = {};
  let bestBloom = 0;
  for (const a of attempts as any[]) {
    const bd = (a.bloom_breakdown ?? {}) as Record<string, { correct: number; total: number }>;
    for (const k of Object.keys(bd)) {
      const lvl = parseInt(k);
      bloomTotals[lvl] ??= { c: 0, t: 0 };
      bloomTotals[lvl].c += bd[k].correct;
      bloomTotals[lvl].t += bd[k].total;
      if (bd[k].correct > 0 && lvl > bestBloom) bestBloom = lvl;
    }
  }
  const bloomData = [1, 2, 3, 4, 5, 6].map((l) => ({
    level: `L${l}`,
    score: bloomTotals[l]?.t ? Math.round((bloomTotals[l].c / bloomTotals[l].t) * 100) : 0,
  }));
  const weakest = bloomData.reduce((a, b) => (a.score < b.score ? a : b)).level;

  // Daily activity (90d for heatmap, 14d for charts)
  const days14: { day: string; reviews: number; xp: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400_000);
    const key = d.toISOString().slice(0, 10);
    days14.push({
      day: d.toLocaleDateString(undefined, { weekday: "short" }),
      reviews: reviews.filter((r: any) => r.reviewed_at?.startsWith(key)).length,
      xp: xp.filter((e: any) => e.created_at?.startsWith(key)).reduce((s: number, e: any) => s + (e.xp_amount ?? 0), 0),
    });
  }

  // Heatmap: 13 weeks (91 days)
  const heatmap: { date: string; xp: number }[] = [];
  for (let i = 90; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400_000);
    const key = d.toISOString().slice(0, 10);
    const dayXp = xp.filter((e: any) => e.created_at?.startsWith(key)).reduce((s: number, e: any) => s + (e.xp_amount ?? 0), 0);
    const reviewsXp = reviews.filter((r: any) => r.reviewed_at?.startsWith(key)).length * 5;
    heatmap.push({ date: key, xp: dayXp + reviewsXp });
  }

  // Material coverage donut
  const coverage = {
    mastered: materials.filter((m: any) => m.processing_status === "ready").length,
    inProgress: materials.filter((m: any) => m.processing_status === "processing").length,
    notStarted: materials.filter((m: any) => m.processing_status === "pending" || !m.processing_status).length,
  };

  // Subject breakdown
  const subjMap: Record<string, number> = {};
  for (const a of attempts as any[]) {
    const subj = (a as any).subject ?? "General";
    if ((a as any).total > 0) subjMap[subj] = Math.max(subjMap[subj] ?? 0, Math.round((a.score / a.total) * 100));
  }
  const strongestSubject = Object.entries(subjMap).sort((a, b) => b[1] - a[1])[0]?.[0];

  const xpTotal = profile?.xp_total ?? 0;
  const lvl = levelFor(xpTotal);

  // Badge stats
  const badgeStats: BadgeStats = {
    materials: materials.length,
    reviews: totalReviews,
    streak: profile?.streak_days ?? 0,
    longestStreak: profile?.longest_streak ?? 0,
    attempts: attempts.length,
    bestBloom,
    gapsResolved: gaps.filter((g: any) => g.status === "resolved").length,
    voiceNotes: voiceNotes.length,
    formulas: formulas.length,
    roomsHosted: rooms.length,
    codeRuns: 0,
    feynmanSessions: tutorSessions.filter((t: any) => t.mode === "socratic").length,
    xp: xpTotal,
  };

  async function runInsight() {
    if (!user) return;
    setInsightLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not signed in");
      const xpWeek = xp.filter((e: any) => Date.now() - new Date(e.created_at).getTime() < 7 * 86400_000).reduce((s: number, e: any) => s + (e.xp_amount ?? 0), 0);
      const avgScore = attempts.length ? Math.round(attempts.reduce((s: number, a: any) => s + (a.total ? (a.score / a.total) * 100 : 0), 0) / attempts.length) : 0;
      const res = await callInsight({ data: {
        accessToken: token,
        stats: {
          review_count: totalReviews,
          avg_quiz_score: avgScore,
          streak_days: profile?.streak_days ?? 0,
          xp_week: xpWeek,
          open_gaps: gaps.filter((g: any) => g.status === "open").length,
          weakest_bloom: weakest,
          strongest_subject: strongestSubject,
        },
      }});
      setInsights(res.insights);
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setInsightLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-bold">Progress</h1>
        <p className="text-sm text-muted-foreground">Last 90 days of learning activity.</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={Flame} label="Streak" value={`${profile?.streak_days ?? 0}d`} hint={`Longest: ${profile?.longest_streak ?? 0}`} />
        <Stat icon={Trophy} label="Level" value={lvl.current.name} hint={`${xpTotal} XP`} />
        <Stat icon={Target} label="Retention" value={`${retention}%`} hint={`${totalReviews} reviews`} />
        <Stat icon={BookOpen} label="Materials" value={`${materials.length}`} hint={`${attempts.length} quizzes`} />
      </div>

      {/* XP Ladder */}
      <Card title="Level progression">
        <div className="space-y-4">
          <div>
            <div className="flex items-baseline justify-between">
              <div>
                <div className="font-display text-2xl font-bold text-primary">{lvl.current.name}</div>
                <div className="text-xs text-muted-foreground">{xpTotal} XP earned</div>
              </div>
              {lvl.next && (
                <div className="text-right text-xs text-muted-foreground">
                  Next: <span className="text-foreground">{lvl.next.name}</span><br />
                  {lvl.next.xp - xpTotal} XP to go
                </div>
              )}
            </div>
            <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-gradient-to-r from-primary to-primary/60 transition-all" style={{ width: `${lvl.pct}%` }} />
            </div>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-11 gap-1">
            {LEVELS.map((L) => {
              const reached = xpTotal >= L.xp;
              const isCurrent = L.name === lvl.current.name;
              return (
                <div key={L.name} className={`rounded-md border p-2 text-center text-[10px] transition ${isCurrent ? "border-primary bg-primary/10 text-primary" : reached ? "border-border/60 bg-card text-foreground" : "border-border/30 bg-background/50 text-muted-foreground/60"}`}>
                  <div className="font-mono">{L.xp}</div>
                  <div className="truncate" title={L.name}>{L.name.split(" ")[0]}</div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* AI Weekly Insight */}
      <Card title="AI weekly insight">
        {!insights ? (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground mb-3">Generate a personalised reflection on your last 7 days.</p>
            <button onClick={runInsight} disabled={insightLoading} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              <Sparkles className="h-4 w-4" /> {insightLoading ? "Analysing…" : "Generate insight"}
            </button>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {insights.map((i, idx) => {
              const tone = i.type === "strength" ? "border-emerald-500/40 bg-emerald-500/5" : i.type === "warning" ? "border-amber-500/40 bg-amber-500/5" : "border-sky-500/40 bg-sky-500/5";
              const label = i.type === "strength" ? "Strength" : i.type === "warning" ? "Watch out" : "Action";
              return (
                <div key={idx} className={`rounded-lg border p-3 ${tone}`}>
                  <div className="text-[10px] uppercase tracking-wide font-bold mb-1">{label}</div>
                  <p className="text-sm">{i.insight}</p>
                  <div className="mt-2 text-xs font-medium text-primary">→ {i.cta}</div>
                  <div className="mt-2 text-[10px] text-muted-foreground italic">based on: {i.science_basis}</div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Streak heatmap */}
      <Card title="Activity heatmap (90 days)">
        <Heatmap days={heatmap} />
      </Card>

      <Card title="Daily activity (14d)">
        <div className="h-56">
          <ResponsiveContainer>
            <BarChart data={days14}>
              <XAxis dataKey="day" stroke="currentColor" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="currentColor" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Bar dataKey="reviews" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Bloom mastery">
          <div className="h-64">
            <ResponsiveContainer>
              <RadarChart data={bloomData}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="level" stroke="currentColor" fontSize={11} />
                <PolarRadiusAxis domain={[0, 100]} stroke="hsl(var(--border))" fontSize={10} />
                <Radar dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.35} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="XP earned (14d)">
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={days14}>
                <XAxis dataKey="day" stroke="currentColor" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="currentColor" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Line type="monotone" dataKey="xp" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card title="Material coverage">
        <div className="grid grid-cols-3 gap-3">
          <CoverageBlock label="Mastered" value={coverage.mastered} color="bg-emerald-500/15 text-emerald-400 border-emerald-500/30" />
          <CoverageBlock label="In progress" value={coverage.inProgress} color="bg-amber-500/15 text-amber-400 border-amber-500/30" />
          <CoverageBlock label="Not started" value={coverage.notStarted} color="bg-muted/40 text-muted-foreground border-border" />
        </div>
      </Card>

      {/* Achievements */}
      <Card title="Achievements">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {BADGES.map((b) => {
            const earned = b.test(badgeStats);
            return (
              <div key={b.id} className={`rounded-lg border p-3 text-center transition ${earned ? "border-primary/40 bg-primary/5" : "border-border/40 bg-background/50 opacity-60"}`}>
                <div className="text-2xl mb-1">{earned ? b.emoji : <Lock className="h-5 w-5 mx-auto text-muted-foreground" />}</div>
                <div className={`text-xs font-semibold ${earned ? "" : "text-muted-foreground"}`}>{b.name}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{b.desc}</div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function Heatmap({ days }: { days: { date: string; xp: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.xp));
  // Pad to start on Sunday
  const first = new Date(days[0].date);
  const padStart = first.getUTCDay();
  const cells: ({ date: string; xp: number } | null)[] = Array(padStart).fill(null).concat(days);
  // Group into weeks (columns)
  const weeks: ({ date: string; xp: number } | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return (
    <div className="overflow-x-auto">
      <div className="flex gap-1">
        {weeks.map((w, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {Array.from({ length: 7 }).map((_, di) => {
              const c = w[di];
              if (!c) return <div key={di} className="h-3 w-3" />;
              const intensity = c.xp === 0 ? 0 : Math.min(4, Math.ceil((c.xp / max) * 4));
              const bg = ["bg-muted/30", "bg-primary/20", "bg-primary/40", "bg-primary/70", "bg-primary"][intensity];
              return <div key={di} className={`h-3 w-3 rounded-sm ${bg}`} title={`${c.date}: ${c.xp} XP`} />;
            })}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
        Less
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className={`h-3 w-3 rounded-sm ${["bg-muted/30", "bg-primary/20", "bg-primary/40", "bg-primary/70", "bg-primary"][i]}`} />
        ))}
        More
      </div>
    </div>
  );
}

function CoverageBlock({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-lg border p-4 text-center ${color}`}>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-xs uppercase tracking-wide mt-1">{label}</div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-4">
      <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground"><Icon className="h-3.5 w-3.5" /> {label}</div>
      <div className="mt-1 text-xl font-bold tracking-tight truncate">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border/60 bg-card/60 p-4">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}
