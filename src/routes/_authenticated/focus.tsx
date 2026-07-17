import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { awardXp } from "@/lib/xp";
import { toast } from "sonner";
import { Play, Pause, RotateCcw, SkipForward, Focus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/focus")({ component: FocusMode });

type Phase = "focus" | "break";
const DURATIONS: Record<Phase, number> = { focus: 25 * 60, break: 5 * 60 };

function FocusMode() {
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>("focus");
  const [remaining, setRemaining] = useState(DURATIONS.focus);
  const [running, setRunning] = useState(false);
  const [completedFocus, setCompletedFocus] = useState(0);
  const startRef = useRef<number | null>(null);
  const phaseStartRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          void handleComplete();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, phase]);

  async function handleComplete() {
    setRunning(false);
    if (phase === "focus") {
      setCompletedFocus((n) => n + 1);
      const minutes = Math.round(DURATIONS.focus / 60);
      if (user) {
        try {
          await supabase.from("focus_sessions").insert({
            user_id: user.id,
            actual_minutes: minutes,
            completed: true,
            started_at: new Date(phaseStartRef.current ?? Date.now() - DURATIONS.focus * 1000).toISOString(),
            ended_at: new Date().toISOString(),
            session_type: "focus",
          });
          const boostUntil = Number(localStorage.getItem("klausum:xpBoostUntil") || 0);
          const boosted = boostUntil > Date.now();
          const xp = Math.min(60, minutes * 2) * (boosted ? 2 : 1);
          await awardXp({ userId: user.id, amount: xp, action: "focus_session", description: `${minutes}m pomodoro` });
          toast.success(`Focus complete · +${xp} XP${boosted ? " (2×)" : ""}`);
        } catch (e) {
          console.error(e);
        }
      }
      setPhase("break");
      setRemaining(DURATIONS.break);
    } else {
      toast.info("Break over — ready for another round?");
      setPhase("focus");
      setRemaining(DURATIONS.focus);
    }
    phaseStartRef.current = null;
    startRef.current = null;
  }

  function toggle() {
    if (!running) {
      if (!phaseStartRef.current) phaseStartRef.current = Date.now();
      if (!startRef.current) startRef.current = Date.now();
    }
    setRunning((r) => !r);
  }

  function reset() {
    setRunning(false);
    setRemaining(DURATIONS[phase]);
    phaseStartRef.current = null;
  }

  function skip() {
    void handleComplete();
  }

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const total = DURATIONS[phase];
  const pct = ((total - remaining) / total) * 100;
  const isBreak = phase === "break";

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center space-y-8 py-8">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Focus className="h-4 w-4 text-primary" />
        <span>Focus Mode · Pomodoro</span>
      </div>

      <div className="flex gap-2 text-xs">
        <span className={`rounded-full px-3 py-1 font-semibold ${!isBreak ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground"}`}>
          Focus 25:00
        </span>
        <span className={`rounded-full px-3 py-1 font-semibold ${isBreak ? "bg-sky-500 text-white" : "bg-muted/40 text-muted-foreground"}`}>
          Break 05:00
        </span>
      </div>

      <div className="relative">
        <svg width="280" height="280" viewBox="0 0 280 280" className="-rotate-90">
          <circle cx="140" cy="140" r="120" strokeWidth="12" className="stroke-muted/30" fill="none" />
          <circle
            cx="140" cy="140" r="120" strokeWidth="12" fill="none" strokeLinecap="round"
            className={isBreak ? "stroke-sky-500" : "stroke-primary"}
            strokeDasharray={2 * Math.PI * 120}
            strokeDashoffset={2 * Math.PI * 120 * (1 - pct / 100)}
            style={{ transition: "stroke-dashoffset 1s linear" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-mono text-6xl md:text-7xl font-bold tabular-nums">{mm}:{ss}</div>
          <div className="text-xs text-muted-foreground mt-2 uppercase tracking-wider">{isBreak ? "Take a break" : "Deep work"}</div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={reset} className="rounded-full border border-border/60 bg-card/60 p-3 hover:bg-accent/20" title="Reset">
          <RotateCcw className="h-5 w-5" />
        </button>
        <button onClick={toggle} className="btn-3d rounded-full bg-primary text-primary-foreground p-5 hover:opacity-90 shadow-lg">
          {running ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7" />}
        </button>
        <button onClick={skip} className="rounded-full border border-border/60 bg-card/60 p-3 hover:bg-accent/20" title="Skip phase">
          <SkipForward className="h-5 w-5" />
        </button>
      </div>

      <div className="text-xs text-muted-foreground">
        Completed focus rounds today: <span className="font-semibold text-foreground">{completedFocus}</span>
      </div>
    </div>
  );
}
