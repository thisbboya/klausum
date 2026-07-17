import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Trophy, Shield } from "lucide-react";

const TIERS = [
  { name: "Bronze", min: 0, color: "text-amber-700", bg: "bg-amber-700/10" },
  { name: "Silver", min: 100, color: "text-slate-400", bg: "bg-slate-400/10" },
  { name: "Gold", min: 300, color: "text-primary", bg: "bg-primary/10" },
  { name: "Sapphire", min: 700, color: "text-sky", bg: "bg-sky/10" },
  { name: "Ruby", min: 1200, color: "text-destructive", bg: "bg-destructive/10" },
  { name: "Diamond", min: 2000, color: "text-grape", bg: "bg-grape/10" },
];

function tierFor(xp: number) {
  let current = TIERS[0];
  let next = TIERS[1];
  for (let i = 0; i < TIERS.length; i++) {
    if (xp >= TIERS[i].min) {
      current = TIERS[i];
      next = TIERS[i + 1] ?? TIERS[i];
    }
  }
  return { current, next };
}

export function LeaguesCard() {
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ["leagues", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const weekStart = new Date();
      const day = weekStart.getDay();
      const diff = (day === 0 ? -6 : 1) - day;
      weekStart.setDate(weekStart.getDate() + diff);
      const ws = weekStart.toISOString().slice(0, 10);

      const { data: rows } = await supabase
        .from("leaderboard_weekly")
        .select("user_id,xp_this_week")
        .eq("week_start", ws)
        .order("xp_this_week", { ascending: false })
        .limit(50);

      const mine = rows?.find((r) => r.user_id === user!.id);
      const rank = mine ? (rows!.findIndex((r) => r.user_id === user!.id) + 1) : null;
      return { xp: mine?.xp_this_week ?? 0, rank, total: rows?.length ?? 0 };
    },
  });

  const xp = data?.xp ?? 0;
  const { current, next } = tierFor(xp);
  const progress = next.min === current.min ? 100 : Math.min(100, Math.round(((xp - current.min) / (next.min - current.min)) * 100));

  // Days left in this Monday-based league week
  const dayIdx = (new Date().getDay() + 6) % 7; // 0 = Monday
  const daysLeft = 7 - dayIdx;
  const rank = data?.rank ?? null;
  const total = data?.total ?? 0;
  const inPromotionZone = rank !== null && rank <= Math.max(1, Math.ceil(total * 0.3));
  const inDemotionZone = rank !== null && total > 5 && rank > total - Math.ceil(total * 0.2);

  return (
    <div className="card-chunky bg-card p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
          <Trophy className="h-3.5 w-3.5" /> Weekly League
        </div>
        {rank && (
          <span className="text-xs font-extrabold text-muted-foreground">#{rank} of {total}</span>
        )}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${current.bg}`}>
          <Shield className={`h-6 w-6 fill-current ${current.color}`} />
        </div>
        <div className="flex-1">
          <div className={`font-display text-lg font-extrabold ${current.color}`}>{current.name}</div>
          <div className="text-xs font-bold text-muted-foreground">{xp} XP this week</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {inPromotionZone && (
          <span className="rounded-full bg-success/15 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-success">
            Promotion zone
          </span>
        )}
        {inDemotionZone && (
          <span className="rounded-full bg-destructive/15 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-destructive">
            Demotion zone
          </span>
        )}
        {rank && (
          <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">
            Rank #{rank}
          </span>
        )}
        <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">
          {daysLeft} {daysLeft === 1 ? "day" : "days"} left
        </span>
      </div>

      <div className="mt-4">
        <div className="flex justify-between text-[11px] font-extrabold text-muted-foreground mb-1">
          <span>{current.name}</span>
          <span>{next.name}</span>
        </div>
        <div className="h-2.5 rounded-full bg-surface-3 overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
        {next.min > current.min && (
          <div className="mt-1 text-[11px] font-bold text-muted-foreground text-right">
            {Math.max(0, next.min - xp)} XP to {next.name}
          </div>
        )}
      </div>
    </div>
  );
}
