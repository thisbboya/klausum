import { useEffect, useState } from "react";
import { Kumi } from "@/components/kumi";

const LINES = [
  "Kumi is fetching your stuff…",
  "Warming up the brain cells…",
  "Almost there — promise…",
  "Good things load to those who wait…",
];

/**
 * The app-wide wait state: Kumi bounces while dots orbit and a rotating line
 * keeps expectancy up. Never a bare "Loading..." again.
 */
export function KlausumLoading({ label }: { label?: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % LINES.length), 2200);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <div className="kumi-bounce">
        <Kumi size={84} />
      </div>
      <div className="flex gap-1.5">
        {[0, 1, 2].map((d) => (
          <span key={d} className="loader-dot h-2 w-2 rounded-full bg-primary" style={{ animationDelay: `${d * 0.15}s` }} />
        ))}
      </div>
      <p className="text-sm font-bold text-muted-foreground" aria-live="polite">
        {label ?? LINES[i]}
      </p>
    </div>
  );
}
