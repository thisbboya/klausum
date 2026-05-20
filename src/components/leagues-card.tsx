import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Trophy } from "lucide-react";

const TIERS = [
  { name: "Bronze", min: 0, color: "text-amber-700", bg: "bg-amber-700/10", emoji: "🥉" },
  { name: "Silver", min: 100, color: "text-slate-300", bg: "bg-slate-400/10", emoji: "🥈" },
  { name: "Gold", min: 300, color: "text-amber-400", bg: "bg-amber-400/10", emoji: "🥇" },
  { name: "Sapphire", min: 700, color: "text-sky-400", bg: "bg-sky-400/10", emoji: "💎" },
  { name: "Ruby", min: 1200, color: "text-rose-400", bg: "bg-rose-400/10", emoji: "❤️" },
  { name: "Diamond", min: 2000, color: "text-cyan-300", bg: "bg-cyan-300/10", emoji: "💠" },
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

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          <h3 className="font-display text-sm font-semibold">Weekly League</h3>
        </div>
        {data?.rank && (
          <span className="text-xs font-semibold text-muted-foreground">#{data.rank} of {data.total}</span>
        )}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl text-2xl ${current.bg}`}>
          {current.emoji}
        </div>
        <div className="flex-1">
          <div className={`font-display text-lg font-bold ${current.color}`}>{current.name}</div>
          <div className="text-xs text-muted-foreground">{xp} XP this week</div>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
          <span>{current.name}</span>
          <span>{next.name}</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all" style={{ width: `${progress}%` }} />
        </div>
        {next.min > current.min && (
          <div className="mt-1 text-[11px] text-muted-foreground text-right">
            {Math.max(0, next.min - xp)} XP to {next.name}
          </div>
        )}
      </div>
    </div>
  );
}
