import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame } from "lucide-react";
import { Kumi } from "@/components/kumi";
import { Sounds } from "@/lib/sounds";

// Long-tail milestones (playbook: design for day 1, 30, 365, 1000)
const MILESTONES = [3, 7, 14, 30, 50, 100, 200, 365, 500, 1000];

const COPY: Record<number, string> = {
  3: "Three days in — a habit is being born.",
  7: "A full week. You officially study more than most people.",
  14: "Two weeks straight. This is who you are now.",
  30: "A month of showing up. Unstoppable.",
  50: "50 days. Kumi is in awe of you.",
  100: "Triple digits. You're in the top tier of learners.",
  200: "200 days. Legends are built like this.",
  365: "A FULL YEAR. Nothing can stop you.",
  500: "500 days. You've outlasted everyone's excuses.",
  1000: "1000 days. You are the streak.",
};

const KEY = "klausum:lastStreakMilestone";

/**
 * Full-screen streak milestone party. Fires once per milestone (tracked in
 * localStorage), with confetti, Kumi, and the milestone fanfare. Duolingo's
 * exact retention peak-moment, in Klausum's own voice.
 */
export function StreakCelebration({ streak }: { streak?: number | null }) {
  const [open, setOpen] = useState(false);
  const [milestone, setMilestone] = useState(0);

  useEffect(() => {
    if (!streak) return;
    const hit = [...MILESTONES].reverse().find((m) => streak >= m);
    if (!hit) return;
    let last = 0;
    try { last = Number(localStorage.getItem(KEY) || 0); } catch {}
    if (hit > last) {
      setMilestone(hit);
      setOpen(true);
      Sounds.streakMilestone();
    }
  }, [streak]);

  const confetti = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        left: `${(i * railPrime(i)) % 100}%`,
        delay: `${(i % 12) * 0.12}s`,
        color: ["#FFC800", "#FF9600", "#58CC02", "#1CB0F6", "#FF4B4B", "#CE82FF"][i % 6],
        size: 6 + (i % 3) * 3,
      })),
    [],
  );

  function dismiss() {
    try { localStorage.setItem(KEY, String(milestone)); } catch {}
    setOpen(false);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-6"
          role="dialog"
          aria-label="Streak milestone"
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {confetti.map((c, i) => (
              <span
                key={i}
                className="confetti-drop absolute top-[-12px] rounded-sm"
                style={{
                  left: c.left,
                  animationDelay: c.delay,
                  backgroundColor: c.color,
                  width: c.size,
                  height: c.size * 1.6,
                }}
              />
            ))}
          </div>

          <motion.div
            initial={{ scale: 0.7, y: 24 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.85, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
            className="card-chunky relative w-full max-w-sm bg-card p-8 text-center"
          >
            <div className="mx-auto -mt-16 mb-2 w-fit">
              <Kumi size={104} />
            </div>
            <div className="flex items-center justify-center gap-2">
              <Flame className="h-10 w-10 fill-orange-500 text-primary" />
              <span className="font-display text-6xl font-extrabold text-primary">
                {milestone}
              </span>
            </div>
            <p className="mt-1 font-display text-xl font-extrabold uppercase tracking-wide">
              day streak!
            </p>
            <p className="mt-2 text-sm font-semibold text-muted-foreground">
              {COPY[milestone] ?? "Keep the fire alive."}
            </p>
            <button
              onClick={dismiss}
              className="btn-3d mt-6 w-full rounded-2xl bg-primary px-6 py-3 font-display font-extrabold uppercase tracking-wide text-primary-foreground"
            >
              Keep it burning
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Spreads confetti pseudo-randomly but deterministically across the width
function railPrime(i: number) {
  return [7, 13, 17, 23, 29, 31][i % 6];
}
