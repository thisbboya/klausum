import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Timer } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { awardXp } from "@/lib/xp";

export function FocusTimer({ materialId }: { materialId?: string }) {
  const { user } = useAuth();
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  function toggle() {
    if (!running) {
      startedAt.current = Date.now();
      setRunning(true);
    } else {
      setRunning(false);
      void persist();
    }
  }

  function reset() {
    setRunning(false);
    setSeconds(0);
    startedAt.current = null;
  }

  async function persist() {
    if (!user || seconds < 30) return;
    try {
      await supabase.from("focus_sessions").insert({
        user_id: user.id,
        material_id: materialId ?? null,
        duration_seconds: seconds,
        started_at: new Date(startedAt.current ?? Date.now() - seconds * 1000).toISOString(),
      });
      const xp = Math.min(60, Math.floor(seconds / 60) * 2);
      if (xp > 0) await awardXp(user.id, xp, "focus_session", { duration: seconds });
    } catch (e) {
      console.error(e);
    }
  }

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5 text-xs">
      <Timer className="h-3.5 w-3.5 text-primary" />
      <span className="font-mono tabular-nums">{mm}:{ss}</span>
      <button onClick={toggle} className="rounded p-1 hover:bg-accent/20" title={running ? "Pause & save" : "Start"}>
        {running ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
      </button>
      <button onClick={reset} className="rounded p-1 hover:bg-accent/20" title="Reset">
        <RotateCcw className="h-3 w-3" />
      </button>
    </div>
  );
}
