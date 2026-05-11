import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Flame, Sparkles, BookOpen, Brain, MessagesSquare, Plus, CalendarClock } from "lucide-react";
import { isDue } from "@/lib/fsrs";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ["dash", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [profileRes, materialsRes, cardsRes] = await Promise.all([
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
      ]);
      const dueCount = (cardsRes.data ?? []).filter((c) => c.next_review_date && isDue(c.next_review_date)).length;
      return {
        profile: profileRes.data,
        materials: materialsRes.data ?? [],
        totalCards: (cardsRes.data ?? []).length,
        dueCount,
      };
    },
  });

  const profile = data?.profile;

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm text-muted-foreground">
          {greeting()},
        </p>
        <h1 className="font-display text-3xl font-bold mt-1">
          {profile?.full_name?.split(" ")[0] || "Student"}.
        </h1>
        {profile?.primary_style && (
          <p className="mt-2 text-sm text-muted-foreground">
            Your primary learning style is{" "}
            <span className="text-primary font-medium capitalize">{profile.primary_style}</span>
            {profile.secondary_style && (
              <> — secondary <span className="capitalize">{profile.secondary_style}</span></>
            )}
            .
          </p>
        )}
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={Flame} label="Streak" value={`${profile?.streak_days ?? 0}d`} />
        <Stat icon={Sparkles} label="XP" value={profile?.xp_total ?? 0} />
        <Stat icon={Brain} label="Due cards" value={data?.dueCount ?? 0} accent />
        <Stat icon={BookOpen} label="Total cards" value={data?.totalCards ?? 0} />
      </div>

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

function Stat({ icon: Icon, label, value, accent }: any) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className={`mt-1 text-2xl font-semibold ${accent ? "text-primary" : ""}`}>{value}</div>
    </div>
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
