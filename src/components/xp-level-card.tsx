import { Zap } from "lucide-react";
import { getLevelInfo } from "@/lib/levels";
import { useEffect, useState } from "react";

export function XpLevelCard({ xp }: { xp: number }) {
  const info = getLevelInfo(xp);

  // Count-up animation for total XP
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const target = info.total;
    if (target === 0) {
      setShown(0);
      return;
    }
    const start = performance.now();
    const duration = 600;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      setShown(Math.round(target * p));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [info.total]);

  return (
    <div className="card-chunky bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <Zap className="h-5 w-5 fill-primary text-primary" />
          </div>
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
              Level {info.current.level}
            </div>
            <div className="font-display text-base font-extrabold text-foreground leading-tight">
              {info.current.name}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-display text-2xl font-extrabold text-primary leading-none">
            {shown.toLocaleString()}
          </div>
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground mt-0.5">
            Total XP
          </div>
        </div>
      </div>

      <div className="mt-4 h-3 rounded-full bg-surface-3 overflow-hidden">
        <div
          className="xp-bar-fill h-full rounded-full bg-primary"
          style={{ width: `${info.progressPct}%` }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] font-bold text-muted-foreground">
        <span>
          {info.intoLevel} / {info.span} XP
        </span>
        <span>{info.next ? `Next: ${info.next.name}` : "Max level"}</span>
      </div>
    </div>
  );
}
