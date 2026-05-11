import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, LineChart, Line } from "recharts";
import { Flame, Trophy, Target, BookOpen } from "lucide-react";

export const Route = createFileRoute("/_authenticated/progress")({ component: ProgressPage });

function ProgressPage() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["progress", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 86400_000).toISOString();
      const [profile, attempts, reviews, materials, xp] = await Promise.all([
        supabase.from("user_profiles").select("*").eq("id", user!.id).maybeSingle(),
        supabase.from("quiz_attempts").select("*").eq("user_id", user!.id).gte("completed_at", since),
        supabase.from("flashcard_reviews").select("rating, reviewed_at").eq("user_id", user!.id).gte("reviewed_at", since),
        supabase.from("study_materials").select("id, subject, created_at").eq("user_id", user!.id),
        supabase.from("xp_events").select("xp_amount, created_at").eq("user_id", user!.id).gte("created_at", since),
      ]);
      return {
        profile: profile.data,
        attempts: attempts.data ?? [],
        reviews: reviews.data ?? [],
        materials: materials.data ?? [],
        xp: xp.data ?? [],
      };
    },
  });

  if (!data) return <div className="text-sm text-muted-foreground">Loading…</div>;
  const { profile, attempts, reviews, materials, xp } = data;

  const totalReviews = reviews.length;
  const correctReviews = reviews.filter((r: any) => r.rating >= 3).length;
  const retention = totalReviews ? Math.round((correctReviews / totalReviews) * 100) : 0;

  // Bloom radar across attempts
  const bloomTotals: Record<number, { c: number; t: number }> = {};
  for (const a of attempts as any[]) {
    const bd = (a.bloom_breakdown ?? {}) as Record<string, { correct: number; total: number }>;
    for (const k of Object.keys(bd)) {
      const lvl = parseInt(k);
      bloomTotals[lvl] ??= { c: 0, t: 0 };
      bloomTotals[lvl].c += bd[k].correct;
      bloomTotals[lvl].t += bd[k].total;
    }
  }
  const bloomData = [1, 2, 3, 4, 5, 6].map((l) => ({
    level: `L${l}`,
    score: bloomTotals[l]?.t ? Math.round((bloomTotals[l].c / bloomTotals[l].t) * 100) : 0,
  }));

  // Daily reviews last 14 days
  const days: { day: string; reviews: number; xp: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400_000);
    const key = d.toISOString().slice(0, 10);
    days.push({
      day: d.toLocaleDateString(undefined, { weekday: "short" }),
      reviews: reviews.filter((r: any) => r.reviewed_at?.startsWith(key)).length,
      xp: xp.filter((e: any) => e.created_at?.startsWith(key)).reduce((s: number, e: any) => s + (e.xp_amount ?? 0), 0),
    });
  }

  // Subject distribution
  const subj: Record<string, number> = {};
  for (const m of materials as any[]) subj[m.subject ?? "General"] = (subj[m.subject ?? "General"] ?? 0) + 1;
  const subjData = Object.entries(subj).map(([subject, count]) => ({ subject, count }));

  const xpTotal = profile?.xp_total ?? 0;
  const level = Math.floor(Math.sqrt(xpTotal / 50)) + 1;
  const nextLevelXp = Math.pow(level, 2) * 50;
  const prevLevelXp = Math.pow(level - 1, 2) * 50;
  const lvlPct = Math.min(100, Math.round(((xpTotal - prevLevelXp) / (nextLevelXp - prevLevelXp)) * 100));

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-bold">Progress</h1>
        <p className="text-sm text-muted-foreground">Last 30 days of learning activity.</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={Flame} label="Streak" value={`${profile?.streak_days ?? 0} days`} hint={`Longest: ${profile?.longest_streak ?? 0}`} />
        <Stat icon={Trophy} label="Level" value={`Lv ${level}`} hint={`${xpTotal} XP · ${lvlPct}% to next`} />
        <Stat icon={Target} label="Retention" value={`${retention}%`} hint={`${totalReviews} reviews`} />
        <Stat icon={BookOpen} label="Materials" value={`${materials.length}`} hint={`${attempts.length} quizzes`} />
      </div>

      <Card title="Daily activity (14d)">
        <div className="h-56">
          <ResponsiveContainer>
            <BarChart data={days}>
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
              <LineChart data={days}>
                <XAxis dataKey="day" stroke="currentColor" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="currentColor" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Line type="monotone" dataKey="xp" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card title="Subjects studied">
        {subjData.length === 0 ? (
          <p className="text-sm text-muted-foreground">No materials yet.</p>
        ) : (
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={subjData} layout="vertical">
                <XAxis type="number" stroke="currentColor" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="subject" stroke="currentColor" fontSize={11} tickLine={false} axisLine={false} width={120} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
}

function Stat({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-4">
      <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground"><Icon className="h-3.5 w-3.5" /> {label}</div>
      <div className="mt-1 text-2xl font-bold tracking-tight">{value}</div>
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
