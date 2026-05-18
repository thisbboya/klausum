import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Palette } from "lucide-react";

export const Route = createFileRoute("/_authenticated/timetable")({ component: TimetablePage });

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_INDEX = [1, 2, 3, 4, 5, 6, 0]; // map column index to day_of_week (Sun=0)
const HOURS = Array.from({ length: 15 }, (_, i) => i + 7); // 7am - 9pm
const PRESET_COLORS = ["#F4A300", "#E0457B", "#3FB950", "#5EA0FF", "#A371F7", "#FF7A59", "#10B981", "#EF4444"];

function TimetablePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [addingSubject, setAddingSubject] = useState(false);
  const [subjectForm, setSubjectForm] = useState({ name: "", color: PRESET_COLORS[0] });
  const [addingEvent, setAddingEvent] = useState(false);
  const [eventForm, setEventForm] = useState({
    subject_id: "", day_of_week: 1, start_time: "09:00", end_time: "10:00", location: "",
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ["timetable_subjects", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("timetable_subjects").select("*").eq("user_id", user!.id).order("name");
      return data ?? [];
    },
  });

  const { data: events = [] } = useQuery({
    queryKey: ["timetable_events", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("timetable_events").select("*").eq("user_id", user!.id);
      return data ?? [];
    },
  });

  const byDay = useMemo(() => {
    const m: Record<number, any[]> = {};
    for (const e of events) (m[e.day_of_week] ??= []).push(e);
    return m;
  }, [events]);

  async function addSubject() {
    if (!subjectForm.name.trim()) return toast.error("Name required");
    const { error } = await supabase.from("timetable_subjects").insert({
      user_id: user!.id, name: subjectForm.name.trim(), color: subjectForm.color,
    });
    if (error) return toast.error(error.message);
    setSubjectForm({ name: "", color: PRESET_COLORS[0] });
    setAddingSubject(false);
    qc.invalidateQueries({ queryKey: ["timetable_subjects", user?.id] });
  }

  async function delSubject(id: string) {
    await supabase.from("timetable_subjects").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["timetable_subjects", user?.id] });
    qc.invalidateQueries({ queryKey: ["timetable_events", user?.id] });
  }

  async function addEvent() {
    if (!eventForm.subject_id) return toast.error("Pick a subject");
    if (eventForm.end_time <= eventForm.start_time) return toast.error("End must be after start");
    const subj = subjects.find((s: any) => s.id === eventForm.subject_id);
    const { error } = await supabase.from("timetable_events").insert({
      user_id: user!.id,
      subject_id: eventForm.subject_id,
      subject_name: subj?.name ?? "Subject",
      color: subj?.color ?? "#F4A300",
      day_of_week: eventForm.day_of_week,
      start_time: eventForm.start_time,
      end_time: eventForm.end_time,
      location: eventForm.location || null,
    });
    if (error) return toast.error(error.message);
    setAddingEvent(false);
    qc.invalidateQueries({ queryKey: ["timetable_events", user?.id] });
  }

  async function delEvent(id: string) {
    await supabase.from("timetable_events").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["timetable_events", user?.id] });
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold">Timetable</h1>
          <p className="text-sm text-muted-foreground">Your recurring weekly classes and study blocks.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setAddingSubject(!addingSubject)}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-card/40 px-3 py-2 text-sm font-semibold">
            <Palette className="h-4 w-4" /> Subject
          </button>
          <button onClick={() => setAddingEvent(!addingEvent)} disabled={subjects.length === 0}
            className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            <Plus className="h-4 w-4" /> Event
          </button>
        </div>
      </header>

      {addingSubject && (
        <div className="rounded-xl border border-border/60 bg-card/60 p-4 space-y-3">
          <input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="Subject name (e.g. Calculus 101)" value={subjectForm.name}
            onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })} />
          <div className="flex gap-2 flex-wrap">
            {PRESET_COLORS.map(c => (
              <button key={c} onClick={() => setSubjectForm({ ...subjectForm, color: c })}
                className={`h-8 w-8 rounded-full border-2 ${subjectForm.color === c ? "border-foreground" : "border-transparent"}`}
                style={{ backgroundColor: c }} />
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={addSubject} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">Save</button>
            <button onClick={() => setAddingSubject(false)} className="rounded-lg border border-border px-3 py-1.5 text-xs">Cancel</button>
          </div>
        </div>
      )}

      {addingEvent && (
        <div className="grid md:grid-cols-2 gap-3 rounded-xl border border-border/60 bg-card/60 p-4">
          <select className="rounded-lg border border-border bg-background px-3 py-2 text-sm md:col-span-2"
            value={eventForm.subject_id} onChange={(e) => setEventForm({ ...eventForm, subject_id: e.target.value })}>
            <option value="">Select subject…</option>
            {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            value={eventForm.day_of_week} onChange={(e) => setEventForm({ ...eventForm, day_of_week: parseInt(e.target.value) })}>
            {DAYS.map((d, i) => <option key={d} value={DAY_INDEX[i]}>{d}</option>)}
          </select>
          <input className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="Location (optional)" value={eventForm.location}
            onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })} />
          <input type="time" className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            value={eventForm.start_time} onChange={(e) => setEventForm({ ...eventForm, start_time: e.target.value })} />
          <input type="time" className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            value={eventForm.end_time} onChange={(e) => setEventForm({ ...eventForm, end_time: e.target.value })} />
          <div className="md:col-span-2 flex gap-2">
            <button onClick={addEvent} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">Save</button>
            <button onClick={() => setAddingEvent(false)} className="rounded-lg border border-border px-3 py-1.5 text-xs">Cancel</button>
          </div>
        </div>
      )}

      {subjects.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Subjects</h2>
          <div className="flex flex-wrap gap-2">
            {subjects.map((s: any) => (
              <div key={s.id} className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-3 py-1.5 text-xs">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                <span>{s.name}</span>
                <button onClick={() => delSubject(s.id)} className="text-muted-foreground hover:text-red-400"><Trash2 className="h-3 w-3" /></button>
              </div>
            ))}
          </div>
        </section>
      )}

      {events.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
          {subjects.length === 0 ? "Add a subject, then add weekly events." : "No events yet. Add one above."}
        </div>
      ) : (
        <div className="rounded-xl border border-border/60 bg-card/40 overflow-x-auto">
          <div className="min-w-[700px] grid grid-cols-[60px_repeat(7,1fr)] border-b border-border/60 bg-card/60">
            <div />
            {DAYS.map(d => <div key={d} className="p-2 text-center text-xs font-semibold text-muted-foreground">{d}</div>)}
          </div>
          <div className="min-w-[700px] grid grid-cols-[60px_repeat(7,1fr)] relative" style={{ gridAutoRows: "40px" }}>
            {HOURS.map((h, hi) => (
              <div key={`r-${h}`} className="contents">
                <div className="border-r border-t border-border/40 p-1 text-[10px] text-muted-foreground" style={{ gridRow: hi + 1, gridColumn: 1 }}>
                  {h}:00
                </div>
                {DAYS.map((_, di) => (
                  <div key={`c-${h}-${di}`} className="border-t border-r border-border/40" style={{ gridRow: hi + 1, gridColumn: di + 2 }} />
                ))}
              </div>
            ))}
            {DAYS.map((_, di) => (byDay[DAY_INDEX[di]] ?? []).map((ev: any) => {
              const [sH, sM] = ev.start_time.split(":").map(Number);
              const [eH, eM] = ev.end_time.split(":").map(Number);
              const startH = sH + sM / 60;
              const endH = eH + eM / 60;
              if (endH < HOURS[0] || startH > HOURS[HOURS.length - 1] + 1) return null;
              const top = (Math.max(HOURS[0], startH) - HOURS[0]) * 40;
              const height = Math.max(22, (Math.min(HOURS[HOURS.length - 1] + 1, endH) - Math.max(HOURS[0], startH)) * 40 - 2);
              return (
                <div key={ev.id} className="absolute rounded-md border p-1.5 text-[10px] overflow-hidden group"
                  style={{
                    top, height,
                    left: `calc(60px + ${(di * 100) / 7}% - 60px / 7 * ${di} + 2px)`,
                    width: `calc((100% - 60px) / 7 - 4px)`,
                    backgroundColor: `${ev.color}26`,
                    borderColor: `${ev.color}80`,
                    color: ev.color,
                  }}>
                  <div className="font-semibold truncate">{ev.subject_name}</div>
                  <div className="opacity-70 truncate">{ev.start_time.slice(0, 5)}–{ev.end_time.slice(0, 5)}</div>
                  {ev.location && <div className="opacity-60 truncate">{ev.location}</div>}
                  <button onClick={() => delEvent(ev.id)} className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              );
            }))}
          </div>
        </div>
      )}
    </div>
  );
}
