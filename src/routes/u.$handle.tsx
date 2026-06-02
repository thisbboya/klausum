import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CompanionSVG, COMPANIONS } from "@/components/companion-svg";
import { Flame, Trophy, Sparkles, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/u/$handle")({
  component: PublicProfilePage,
});

function PublicProfilePage() {
  const { handle } = Route.useParams();
  const clean = handle.replace(/^@/, "").toLowerCase();

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-profile", clean],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("public_profiles")
        .select(
          "id, full_name, handle, avatar_url, school, country, level, field_of_study, companion_id, companion_name, xp_total, streak_days, longest_streak, is_day1_pioneer, cohort_units, created_at",
        )
        .eq("handle", clean)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw notFound();
      return data;
    },
  });

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <p className="text-muted-foreground">No student found at @{clean}</p>
        <Link to="/" className="text-sm text-primary underline">Back home</Link>
      </div>
    );
  }

  const companion = COMPANIONS.find((c) => c.id === (data.companion_id ?? 1)) ?? COMPANIONS[0];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Klausum
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10 space-y-6">
        <section className="rounded-2xl border border-border bg-card p-6 flex items-start gap-5">
          <div className="shrink-0">
            {data.avatar_url ? (
              <img src={data.avatar_url} alt={data.full_name} className="h-20 w-20 rounded-full object-cover" />
            ) : (
              <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center text-2xl font-bold">
                {data.full_name?.[0] ?? "?"}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-2xl font-bold truncate">{data.full_name}</h1>
            <div className="text-sm text-muted-foreground">@{data.handle}</div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {data.school && <span className="rounded-full bg-muted px-2 py-0.5">{data.school}</span>}
              {data.level && <span className="rounded-full bg-muted px-2 py-0.5">{data.level}</span>}
              {data.field_of_study && (
                <span className="rounded-full bg-muted px-2 py-0.5">{data.field_of_study}</span>
              )}
              {data.country && <span className="rounded-full bg-muted px-2 py-0.5">{data.country}</span>}
              {data.is_day1_pioneer && (
                <span className="rounded-full bg-primary/15 text-primary px-2 py-0.5">Day 1 pioneer ⭐</span>
              )}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat icon={Sparkles} label="Total XP" value={data.xp_total ?? 0} />
          <Stat icon={Flame} label="Streak" value={`${data.streak_days ?? 0}d`} />
          <Stat icon={Trophy} label="Longest" value={`${data.longest_streak ?? 0}d`} />
          <Stat icon={Sparkles} label="Cohort #" value={data.cohort_units ?? 0} />
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 flex items-center gap-4">
          <CompanionSVG id={companion.id} size={72} animate />
          <div>
            <div className="text-xs text-muted-foreground">Study companion</div>
            <div className="font-display text-lg font-bold">
              {data.companion_name || companion.name} · <span className="text-primary">{companion.trait}</span>
            </div>
          </div>
        </section>

        <p className="text-xs text-muted-foreground text-center">
          Member since {new Date(data.created_at!).toLocaleDateString()}
        </p>
      </main>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: any }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <Icon className="h-4 w-4 text-primary mb-2" />
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-display text-xl font-bold mt-0.5">{value}</div>
    </div>
  );
}
