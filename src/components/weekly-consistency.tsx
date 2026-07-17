import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Check } from "lucide-react";

const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

function startOfWeek(d: Date) {
  const date = new Date(d);
  const day = date.getDay(); // 0 Sun .. 6 Sat
  const diff = (day === 0 ? -6 : 1) - day; // shift to Monday
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function WeeklyConsistency({
  userId,
  streak,
}: {
  userId?: string;
  streak?: number | null;
}) {
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
      return DAY_LETTERS.map((_, i) => {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        return set.has(d.toISOString().slice(0, 10));
      });
    },
  });

  const days = data ?? Array(7).fill(false);
  const completed = days.filter(Boolean).length;
  const todayIdx = (() => {
    const d = new Date().getDay();
    return d === 0 ? 6 : d - 1; // Monday = 0 ... Sunday = 6
  })();

  return (
    <div className="card-chunky bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">Weekly Consistency</h3>
        <span className="text-xs font-bold text-muted-foreground">{completed}/7 days</span>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {DAY_LETTERS.map((letter, i) => {
          const completed = days[i];
          const isToday = i === todayIdx;
          const isPast = i < todayIdx;

          let circleClass = "border-2 border-border bg-transparent text-muted-foreground";
          if (completed && !isToday) circleClass = "bg-success text-success-foreground border-success";
          if (isToday && completed) circleClass = "bg-primary text-primary-foreground border-primary gold-pulse";
          else if (isToday) circleClass = "bg-primary/20 text-primary border-primary gold-pulse";
          else if (!completed && isPast) circleClass = "border-2 border-border bg-muted/40 text-muted-foreground/60";

          return (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <div
                className={`h-9 w-9 rounded-full flex items-center justify-center text-[11px] font-bold transition ${circleClass}`}
                title={["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]}
              >
                {completed && !isToday ? <Check className="h-4 w-4" /> : letter}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 h-2.5 rounded-full bg-surface-3 overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-700"
          style={{ width: `${(completed / 7) * 100}%` }}
        />
      </div>

      <div className="mt-3 flex items-end justify-between">
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
            Current Streak
          </div>
          <div className="font-display text-xl font-extrabold text-foreground streak-bounce">
            {streak ?? 0} {(streak ?? 0) === 1 ? "Day" : "Days"}
          </div>
        </div>
      </div>
    </div>
  );
}
