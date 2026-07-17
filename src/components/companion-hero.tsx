import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Crown, Snowflake } from "lucide-react";
import { CompanionSVG, getCompanion } from "@/components/companion-svg";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

const BUBBLE_MESSAGES = (streak: number, due: number) => [
  "Good " + greeting() + "! Ready to crush it today?",
  "Let's review those flashcards first!",
  due > 0 ? `${due} card${due === 1 ? "" : "s"} waiting. Let's go!` : "Your memory is fresh. Build on it!",
  "Your memory health is climbing. Time to review!",
  "Ayekoo! You're on a roll — keep going!",
  "Small sessions daily beat long sessions weekly.",
  "One quiz away from closing a knowledge gap.",
  streak > 0
    ? `Day ${streak} streak — let's make it ${streak + 1}!`
    : "Start your streak today!",
];

/**
 * Deterministic pick by day so the bubble doesn't churn each render,
 * but rotates over time inside a single session.
 */
function dayHash() {
  const d = new Date();
  return d.getFullYear() * 1000 + d.getMonth() * 50 + d.getDate();
}

export function CompanionHero({
  firstName,
  companionId,
  companionName,
  streak,
  due,
  freezes,
}: {
  firstName?: string | null;
  companionId?: number | null;
  companionName?: string | null;
  streak?: number | null;
  due?: number | null;
  freezes?: number | null;
}) {
  const c = getCompanion(companionId ?? 1);
  const name = companionName ?? c.name;
  const streakDays = streak ?? 0;
  const dueCount = due ?? 0;

  const messages = useMemo(
    () => BUBBLE_MESSAGES(streakDays, dueCount),
    [streakDays, dueCount],
  );

  // Rotate every 8s, deterministic starting point per day
  const [idx, setIdx] = useState(dayHash() % messages.length);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % messages.length), 8000);
    return () => clearInterval(t);
  }, [messages.length]);

  // Count-up streak number
  const [shownStreak, setShownStreak] = useState(0);
  useEffect(() => {
    if (streakDays === 0) {
      setShownStreak(0);
      return;
    }
    const start = performance.now();
    const dur = 400;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setShownStreak(Math.round(streakDays * p));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [streakDays]);

  const isCentury = streakDays >= 100;
  const isMonth = streakDays >= 30 && !isCentury;
  const isWeek = streakDays >= 7 && !isMonth && !isCentury;

  return (
    <div
      className="card-chunky relative overflow-hidden p-5 md:p-6"
      style={{
        backgroundColor: `color-mix(in srgb, ${c.color} 10%, transparent)`,
        borderColor: `color-mix(in srgb, ${c.color} 30%, transparent)`,
      }}
    >
      {/* Subtle topology lines (decorative) */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full opacity-40"
        viewBox="0 0 400 200"
        preserveAspectRatio="none"
      >
        <path d="M0 60 Q100 20 200 60 T400 60" stroke="rgba(244,163,0,0.15)" strokeWidth="1" fill="none" />
        <path d="M0 110 Q100 75 200 110 T400 110" stroke="rgba(244,163,0,0.12)" strokeWidth="1" fill="none" />
        <path d="M0 160 Q100 125 200 160 T400 160" stroke="rgba(244,163,0,0.1)" strokeWidth="1" fill="none" />
      </svg>

      <div className="relative flex items-center gap-4">
        {/* Left: greeting */}
        <div className="flex-1 min-w-0">
          <h1 className="break-words font-display text-3xl md:text-4xl font-extrabold leading-tight text-foreground">
            Hey {firstName || "there"}!
          </h1>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            Good {greeting()} — your pilot's warmed up!
          </p>

          {/* Streak pill */}
          <div className="mt-4 inline-flex items-center gap-3 rounded-2xl border-2 border-border bg-card px-4 py-2">
            {isCentury ? (
              <Crown className="h-5 w-5 fill-primary text-primary" />
            ) : (
              <Flame
                className={`h-5 w-5 ${
                  isMonth || isWeek
                    ? "fill-primary text-primary animate-pulse"
                    : "text-primary"
                }`}
              />
            )}
            <div>
              <div className="text-[9px] font-extrabold uppercase tracking-widest text-muted-foreground leading-none">
                Streak
              </div>
              {streakDays === 0 ? (
                <div className="font-display text-sm font-extrabold text-foreground">
                  Start today
                </div>
              ) : streakDays === 1 ? (
                <div className="font-display text-sm font-extrabold text-foreground">
                  Day 1 — great start!
                </div>
              ) : (
                <div className="font-display text-2xl font-extrabold text-foreground leading-none streak-bounce">
                  {shownStreak}
                  <span className="text-xs font-bold text-muted-foreground ml-1">days</span>
                </div>
              )}
            </div>

            {(freezes ?? 0) > 0 && (
              <div
                className="ml-2 flex items-center gap-0.5 border-l-2 border-border pl-3"
                title="Streak Freezes — auto-protect a missed day"
              >
                {Array.from({ length: 2 }).map((_, i) => (
                  <Snowflake
                    key={i}
                    className={`h-3.5 w-3.5 ${
                      i < (freezes ?? 0) ? "text-sky" : "text-border"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: speech bubble + pilot */}
        <div className="flex flex-col items-end shrink-0 gap-2">
          <div className="relative max-w-[160px] rounded-2xl rounded-br-sm border-2 border-border bg-card px-3 py-2 text-xs font-bold text-foreground min-h-[44px] flex items-center">
            <AnimatePresence mode="wait">
              <motion.span
                key={idx}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.3 }}
              >
                {messages[idx]}
              </motion.span>
            </AnimatePresence>
          </div>
          <div className="pilot-float">
            <CompanionSVG id={c.id} size={72} animate={false} />
          </div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">{name}</span>
        </div>
      </div>
    </div>
  );
}
