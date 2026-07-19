import { useEffect, useMemo, useState } from "react";
import { Kumi } from "@/components/kumi";

// Duolingo-style loading tips: real, safe study-science facts and nudges.
// A random one shows per load so waits feel like content, not dead time.
const TIPS = [
  "Recalling from memory beats re-reading — that's why we quiz you.",
  "Spacing reviews over days can double how long you remember.",
  "A 7-day streak makes tomorrow's session feel automatic.",
  "Short daily sessions beat one long cram — every time.",
  "Getting it wrong, then corrected, wires memory stronger than getting it right.",
  "Mixing topics in one session (interleaving) boosts exam scores.",
  "Teaching a concept to someone else is the fastest way to master it.",
  "Sleep is when your brain files today's cards into long-term memory.",
];

const LINES = [
  "Kumi is fetching your stuff…",
  "Warming up the brain cells…",
  "Almost there — promise…",
  "Polishing your progress…",
];

/**
 * The app-wide wait state, Duolingo style: Kumi bounces over a ground shadow,
 * a goal-gradient bar fills toward (but never past) done, and a study tip
 * turns the wait into a micro-lesson. Never a bare "Loading..." again.
 */
export function KlausumLoading({ label }: { label?: string }) {
  const [i, setI] = useState(0);
  const [progress, setProgress] = useState(8);
  const tip = useMemo(() => TIPS[Math.floor(Math.random() * TIPS.length)], []);

  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % LINES.length), 2200);
    // Asymptotic fill — always moving, caps at 92% (goal-gradient effect)
    const p = setInterval(() => setProgress((x) => x + (92 - x) * 0.06), 200);
    return () => { clearInterval(t); clearInterval(p); };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center gap-5 px-6 py-16">
      <div className="relative flex flex-col items-center">
        <div className="kumi-bounce">
          <Kumi size={110} />
        </div>
        <div className="kumi-shadow mt-1 h-2.5 w-16 rounded-full bg-foreground/15" />
      </div>

      <div className="w-full max-w-xs">
        <div className="h-3.5 w-full overflow-hidden rounded-full border-2 border-border bg-muted">
          <div
            className="loader-shimmer h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-2 text-center text-sm font-bold text-muted-foreground" aria-live="polite">
          {label ?? LINES[i]}
        </p>
      </div>

      <div className="max-w-sm rounded-2xl border-2 border-border bg-card px-4 py-3 text-center">
        <p className="font-display text-[11px] font-extrabold uppercase tracking-widest text-primary">
          Did you know?
        </p>
        <p className="mt-1 text-sm font-semibold text-foreground/80">{tip}</p>
      </div>
    </div>
  );
}
