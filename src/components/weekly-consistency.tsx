import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function startOfWeek(d: Date) {
  const date = new Date(d);
  const day = date.getDay(); // 0 Sun .. 6 Sat
  const diff = (day === 0 ? -6 : 1) - day; // shift to Monday
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function WeeklyConsistency({ userId, streak }: { userId?: string; streak?: number | null }) {
  const { data } = useQuery({
    queryKey: ["weekly-consistency", userId],
    enabled: !!userId,
    queryFn: async () => {
      const start = startOfWeek(new Date());
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      const { data, error } = await supabase
        .from("daily_checkins")
        .select("check_date")
        .eq("user_id", userId!)
        .gte("check_date", start.toISOString().slice(0, 10))
        .lt("check_date", end.toISOString().slice(0, 10));
      if (error) throw error;
      const set = new Set<string>((data ?? []).map((r) => r.check_date as string));
      const filled = DAYS.map((_, i) => {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        return set.has(d.toISOString().slice(0, 10));
      });
      return filled;
    },
  });

  const days = data ?? Array(7).fill(false);
  const completed = days.filter(Boolean).length;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-sm font-semibold">Weekly Consistency</h3>
        <span className="text-xs text-muted-foreground">{completed}/7 days completed</span>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((on, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div
              className={`h-3 w-full rounded-full ${on ? "bg-primary" : "bg-muted"}`}
              title={DAYS[i]}
            />
            <span className="text-[10px] text-muted-foreground">{DAYS[i].slice(0, 1)}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 text-[10px] uppercase tracking-wide text-muted-foreground">
        Current streak: <span className="text-foreground font-semibold">{streak ?? 0} Days</span>
      </div>
    </div>
  );
}
