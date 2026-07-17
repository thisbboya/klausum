import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { HEARTS_MAX, formatRefillCountdown } from "@/lib/hearts";

export function HeartsRow({
  hearts,
  msUntilNext,
}: {
  hearts: number;
  msUntilNext: number;
}) {
  const [ms, setMs] = useState(msUntilNext);
  useEffect(() => {
    setMs(msUntilNext);
    if (!msUntilNext) return;
    const t = setInterval(() => setMs((v) => Math.max(0, v - 1000)), 1000);
    return () => clearInterval(t);
  }, [msUntilNext]);

  if (hearts >= HEARTS_MAX) return null;

  return (
    <div className="inline-flex items-center gap-2 rounded-full border-2 border-border bg-card px-3 py-1.5 text-xs font-bold">
      <div className="flex items-center gap-0.5">
        {Array.from({ length: HEARTS_MAX }).map((_, i) => (
          <Heart
            key={i}
            className={`h-3.5 w-3.5 ${
              i < hearts ? "fill-destructive text-destructive" : "text-muted-foreground/30"
            }`}
          />
        ))}
      </div>
      <span className="text-muted-foreground">Refills in {formatRefillCountdown(ms)}</span>
    </div>
  );
}
