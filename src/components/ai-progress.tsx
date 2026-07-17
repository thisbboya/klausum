import { useEffect, useState } from "react";

/**
 * Pseudo-determinate AI wait panel.
 *
 * Research-backed choices:
 * - A visibly moving % bar beats a spinner (determinate progress lowers
 *   perceived wait and abandonment).
 * - The bar advances asymptotically and never stalls or reverses; it caps
 *   at 94% so the real completion lands as a satisfying jump (goal-gradient).
 * - Messages rotate through concrete "work being done" phrases — the labor
 *   illusion: showing effort raises perceived value of the result.
 */
export function AiProgress({ messages, className = "" }: { messages: string[]; className?: string }) {
  const [pct, setPct] = useState(4);
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    const bar = setInterval(() => {
      // Asymptotic: moves fast at first, always creeps, never reaches 94
      setPct((p) => p + (94 - p) * 0.055);
    }, 350);
    const msg = setInterval(() => {
      setMsgIdx((i) => (i + 1) % messages.length);
    }, 2600);
    return () => { clearInterval(bar); clearInterval(msg); };
  }, [messages.length]);

  return (
    <div className={`rounded-xl border-2 border-primary/30 bg-primary/5 p-4 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1 text-xs font-bold text-muted-foreground" aria-live="polite">
          {messages[msgIdx]}
        </div>
        <div className="font-display text-lg font-extrabold text-primary tabular-nums">
          {Math.round(pct)}%
        </div>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface-3">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
