import { useEffect, useState } from "react";
import { reportError } from "@/lib/report-error";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/lib/notify";
import { Sparkles, Save } from "lucide-react";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_INDEX = [1, 2, 3, 4, 5, 6, 0];
const HOURS = Array.from({ length: 16 }, (_, i) => i + 6); // 6am-9pm

type Slot = [number, number]; // [day, hour]
type Intensity = "light" | "medium" | "intense";

const INTENSITY_META: Record<Intensity, { label: string; minutes: number; desc: string }> = {
  light: { label: "Light", minutes: 30, desc: "~30 min/day" },
  medium: { label: "Medium", minutes: 60, desc: "~1 hr/day" },
  intense: { label: "Intense", minutes: 120, desc: "~2 hr/day" },
};

export function AvailabilityGrid() {
  const { user } = useAuth();
  const [slots, setSlots] = useState<Set<string>>(new Set());
  const [intensity, setIntensity] = useState<Intensity>("medium");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState<null | { mode: "add" | "remove" }>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("user_profiles")
        .select("available_hours, study_intensity").eq("id", user.id).maybeSingle();
      const arr: Slot[] = (data?.available_hours as Slot[]) ?? [];
      setSlots(new Set(arr.map(([d, h]) => `${d}-${h}`)));
      if (data?.study_intensity) setIntensity(data.study_intensity as Intensity);
    })();
  }, [user]);

  function key(d: number, h: number) { return `${d}-${h}`; }

  function toggle(d: number, h: number, mode?: "add" | "remove") {
    const k = key(d, h);
    setSlots(prev => {
      const next = new Set(prev);
      const has = next.has(k);
      if (mode === "add" || (!mode && !has)) next.add(k);
      else next.delete(k);
      return next;
    });
    setDirty(true);
  }

  async function save() {
    if (!user) return;
    setSaving(true);
    const arr: Slot[] = Array.from(slots).map(s => {
      const [d, h] = s.split("-").map(Number);
      return [d, h];
    });
    const { error } = await supabase.from("user_profiles")
      .update({ available_hours: arr, study_intensity: intensity })
      .eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(reportError("availability-grid", error));
    toast.success("Availability saved");
    setDirty(false);
  }

  useEffect(() => {
    const stop = () => setDragging(null);
    window.addEventListener("mouseup", stop);
    window.addEventListener("touchend", stop);
    return () => { window.removeEventListener("mouseup", stop); window.removeEventListener("touchend", stop); };
  }, []);

  const count = slots.size;
  const weeklyMins = count * 60;
  const targetMins = INTENSITY_META[intensity].minutes * 7;

  return (
    <section className="card-chunky bg-card p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> When can you study?
          </h2>
          <p className="text-xs text-muted-foreground">Click or drag cells to mark hours you're free. Used by AI Smart Plan.</p>
        </div>
        {dirty && (
          <button onClick={save} disabled={saving}
            className="inline-flex items-center gap-1 btn-3d rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">
            <Save className="h-3 w-3" /> {saving ? "Saving…" : "Save"}
          </button>
        )}
      </div>

      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Intensity</div>
        <div className="inline-flex rounded-xl border-2 border-border overflow-hidden">
          {(Object.keys(INTENSITY_META) as Intensity[]).map(k => (
            <button key={k} onClick={() => { setIntensity(k); setDirty(true); }}
              className={`px-3 py-1.5 text-xs font-semibold ${intensity === k ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}>
              {INTENSITY_META[k].label}
              <span className="ml-1 opacity-70">{INTENSITY_META[k].desc}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto select-none">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-[44px_repeat(7,1fr)] gap-0.5 mb-0.5">
            <div />
            {DAYS.map(d => <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground">{d}</div>)}
          </div>
          {HOURS.map(h => (
            <div key={h} className="grid grid-cols-[44px_repeat(7,1fr)] gap-0.5 mb-0.5">
              <div className="text-[10px] text-muted-foreground text-right pr-2 pt-1">{h}:00</div>
              {DAYS.map((_, di) => {
                const d = DAY_INDEX[di];
                const active = slots.has(key(d, h));
                return (
                  <button key={`${d}-${h}`}
                    onMouseDown={() => { const mode = active ? "remove" : "add"; setDragging({ mode }); toggle(d, h, mode); }}
                    onMouseEnter={() => { if (dragging) toggle(d, h, dragging.mode); }}
                    className={`h-7 rounded-lg transition-colors ${active ? "bg-primary/80 hover:bg-primary" : "bg-card hover:bg-accent/40 border-2 border-border/40"}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground flex-wrap gap-2">
        <span>{count} hour{count === 1 ? "" : "s"} selected · ~{Math.round(weeklyMins / 60)} hr/week</span>
        <span className={weeklyMins >= targetMins ? "text-success" : "text-primary"}>
          Target: ~{Math.round(targetMins / 60)} hr/week ({INTENSITY_META[intensity].label})
        </span>
      </div>
    </section>
  );
}
