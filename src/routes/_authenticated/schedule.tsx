import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { generatePlan } from "@/lib/coach.functions";
import { getAccessToken } from "@/lib/auth-helper";
import { toast } from "sonner";
import { Sparkles, Plus, Play, Pause, RotateCcw, Trash2, CheckCircle2, ChevronLeft, ChevronRight, Maximize2, Minimize2, X } from "lucide-react";
import { AvailabilityGrid } from "@/components/availability-grid";

export const Route = createFileRoute("/_authenticated/schedule")({ component: SchedulePage });

type View = "list" | "week" | "month";

function SchedulePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const planFn = useServerFn(generatePlan);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [view, setView] = useState<View>("week");
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setHours(0,0,0,0); return d; });
  const [form, setForm] = useState({ title: "", subject: "General", block_type: "study", date: new Date().toISOString().slice(0, 10), startTime: "09:00", duration: 25 });

  const { data: blocks = [] } = useQuery({
    queryKey: ["schedule", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 86400_000).toISOString();
      const { data } = await supabase.from("schedule_blocks").select("*").eq("user_id", user!.id).gte("starts_at", since).order("starts_at");
      return data ?? [];
    },
  });

  async function smartPlan() {
    setBusy(true);
    try {
      const accessToken = await getAccessToken();
      const profile = await supabase.from("user_profiles").select("daily_goal_minutes").eq("id", user!.id).maybeSingle();
      const subjects = await supabase.from("study_materials").select("subject").eq("user_id", user!.id);
      const subjList = Array.from(new Set((subjects.data ?? []).map((m: any) => m.subject))).slice(0, 5);
      if (subjList.length === 0) subjList.push("General");
      const r = await planFn({
        data: {
          accessToken,
          goalMinutesPerDay: profile.data?.daily_goal_minutes ?? 60,
          subjects: subjList,
          startDate: new Date().toISOString().slice(0, 10),
          daysAhead: 7,
        },
      });
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const rows = r.blocks.map((b) => {
        const s = new Date(today);
        s.setDate(s.getDate() + b.offset_day);
        s.setHours(b.start_hour, 0, 0, 0);
        const e = new Date(s.getTime() + b.duration_minutes * 60_000);
        return {
          user_id: user!.id, title: b.title, subject: b.subject, block_type: b.block_type,
          starts_at: s.toISOString(), ends_at: e.toISOString(),
        };
      });
      await supabase.from("schedule_blocks").insert(rows);
      toast.success(`Planned ${rows.length} blocks`);
      qc.invalidateQueries({ queryKey: ["schedule", user?.id] });
    } catch (e: any) {
      toast.error(e.message ?? "Planner failed");
    } finally {
      setBusy(false);
    }
  }

  async function addBlock() {
    if (!form.title) return toast.error("Title required");
    const s = new Date(`${form.date}T${form.startTime}:00`);
    const e = new Date(s.getTime() + form.duration * 60_000);
    const { error } = await supabase.from("schedule_blocks").insert({
      user_id: user!.id, title: form.title, subject: form.subject, block_type: form.block_type,
      starts_at: s.toISOString(), ends_at: e.toISOString(),
    });
    if (error) return toast.error(error.message);
    setAdding(false);
    setForm({ ...form, title: "" });
    qc.invalidateQueries({ queryKey: ["schedule", user?.id] });
  }

  async function complete(id: string) {
    await supabase.from("schedule_blocks").update({ completed: true }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["schedule", user?.id] });
  }

  async function del(id: string) {
    await supabase.from("schedule_blocks").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["schedule", user?.id] });
  }

  function shift(dir: 1 | -1) {
    const d = new Date(cursor);
    if (view === "month") d.setMonth(d.getMonth() + dir);
    else d.setDate(d.getDate() + dir * 7);
    setCursor(d);
  }

  const colorFor = (t: string) =>
    t === "review" ? "border-blue-500/40 bg-blue-500/15 text-blue-200"
    : t === "quiz" ? "border-amber-500/40 bg-amber-500/15 text-amber-200"
    : t === "break" ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
    : "border-primary/40 bg-primary/15 text-primary";

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold">Schedule</h1>
          <p className="text-sm text-muted-foreground">Plan your week. Stay on rhythm.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="inline-flex rounded-lg border border-border/60 overflow-hidden">
            {(["list","week","month"] as View[]).map(v => (
              <button key={v} onClick={() => setView(v)} className={`px-3 py-2 text-xs font-semibold capitalize ${view===v?"bg-primary text-primary-foreground":"bg-card/40 text-muted-foreground hover:text-foreground"}`}>{v}</button>
            ))}
          </div>
          <button onClick={smartPlan} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary disabled:opacity-50">
            <Sparkles className="h-4 w-4" /> {busy ? "Planning…" : "AI Smart Plan"}
          </button>
          <button onClick={() => setAdding(!adding)} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      </header>

      {adding && (
        <div className="grid md:grid-cols-2 gap-3 rounded-xl border border-border/60 bg-card/60 p-4">
          <input className="input md:col-span-2" placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <input className="input" placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          <select className="input" value={form.block_type} onChange={(e) => setForm({ ...form, block_type: e.target.value })}>
            <option value="study">Study</option><option value="review">Review</option><option value="quiz">Quiz</option><option value="break">Break</option>
          </select>
          <input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <input className="input" type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
          <input className="input" type="number" min={5} max={240} value={form.duration} onChange={(e) => setForm({ ...form, duration: parseInt(e.target.value) || 25 })} />
          <div className="md:col-span-2 flex gap-2">
            <button onClick={addBlock} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">Save</button>
            <button onClick={() => setAdding(false)} className="rounded-lg border border-border px-3 py-1.5 text-xs">Cancel</button>
          </div>
        </div>
      )}

      <AvailabilityGrid />

      <Pomodoro />

      {view !== "list" && (
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">
            {view === "month"
              ? cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })
              : `Week of ${weekStart(cursor).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => shift(-1)} className="rounded-md border border-border p-1.5"><ChevronLeft className="h-4 w-4" /></button>
            <button onClick={() => { const d = new Date(); d.setHours(0,0,0,0); setCursor(d); }} className="rounded-md border border-border px-2 py-1 text-xs">Today</button>
            <button onClick={() => shift(1)} className="rounded-md border border-border p-1.5"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      )}

      {view === "list" && <ListView blocks={blocks} colorFor={colorFor} onComplete={complete} onDelete={del} />}
      {view === "week" && <WeekGrid cursor={cursor} blocks={blocks} colorFor={colorFor} onComplete={complete} onDelete={del} />}
      {view === "month" && <MonthGrid cursor={cursor} blocks={blocks} colorFor={colorFor} onPick={(d: Date) => { setCursor(d); setView("week"); }} />}

      <style>{`.input { width:100%; border-radius: 0.5rem; border:1px solid hsl(var(--border)); background: var(--background); padding: 0.5rem 0.75rem; font-size: 0.875rem; outline:none; }`}</style>
    </div>
  );
}

function weekStart(d: Date) {
  const x = new Date(d); x.setHours(0,0,0,0);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

function ListView({ blocks, colorFor, onComplete, onDelete }: any) {
  const grouped = blocks.reduce((acc: Record<string, any[]>, b: any) => {
    const day = new Date(b.starts_at).toDateString();
    (acc[day] ??= []).push(b);
    return acc;
  }, {});
  if (Object.keys(grouped).length === 0) return (
    <div className="rounded-xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
      No blocks scheduled. Use AI Smart Plan to fill the next 7 days.
    </div>
  );
  return (
    <div className="space-y-5">
      {Object.entries(grouped).map(([day, items]: any) => (
        <section key={day}>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {new Date(day).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
          </h2>
          <ul className="space-y-2">
            {items.map((b: any) => {
              const s = new Date(b.starts_at), e = new Date(b.ends_at);
              const dur = Math.round((e.getTime() - s.getTime()) / 60000);
              return (
                <li key={b.id} className={`flex items-center gap-3 rounded-lg border ${colorFor(b.block_type)} p-3 ${b.completed ? "opacity-50" : ""}`}>
                  <div className="text-xs font-mono w-28 text-muted-foreground">
                    {s.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {dur}m
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{b.title}</div>
                    <div className="text-[11px] uppercase opacity-70">{b.block_type} · {b.subject}</div>
                  </div>
                  {!b.completed && (
                    <button onClick={() => onComplete(b.id)} className="text-emerald-400 hover:text-emerald-300"><CheckCircle2 className="h-4 w-4" /></button>
                  )}
                  <button onClick={() => onDelete(b.id)} className="opacity-60 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function WeekGrid({ cursor, blocks, colorFor, onComplete, onDelete }: any) {
  const start = weekStart(cursor);
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d; });
  const hours = Array.from({ length: 16 }, (_, i) => i + 6); // 6am - 9pm
  const today = new Date().toDateString();

  const byDay = useMemo(() => {
    const m: Record<string, any[]> = {};
    for (const b of blocks) {
      const k = new Date(b.starts_at).toDateString();
      (m[k] ??= []).push(b);
    }
    return m;
  }, [blocks]);

  return (
    <div className="rounded-xl border border-border/60 bg-card/40 overflow-hidden">
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border/60 bg-card/60">
        <div />
        {days.map(d => (
          <div key={d.toISOString()} className={`p-2 text-center text-xs font-semibold ${d.toDateString()===today?"text-primary":"text-muted-foreground"}`}>
            <div>{d.toLocaleDateString(undefined, { weekday: "short" })}</div>
            <div className="text-base">{d.getDate()}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[60px_repeat(7,1fr)] relative" style={{ gridAutoRows: "44px" }}>
        {hours.map((h, hi) => (
          <>
            <div key={`h-${h}`} className="border-r border-t border-border/40 p-1 text-[10px] text-muted-foreground" style={{ gridRow: hi + 1, gridColumn: 1 }}>
              {h}:00
            </div>
            {days.map((_, di) => (
              <div key={`c-${h}-${di}`} className="border-t border-r border-border/40" style={{ gridRow: hi + 1, gridColumn: di + 2 }} />
            ))}
          </>
        ))}
        {days.map((d, di) => (byDay[d.toDateString()] ?? []).map((b: any) => {
          const s = new Date(b.starts_at), e = new Date(b.ends_at);
          const startH = s.getHours() + s.getMinutes()/60;
          const endH = e.getHours() + e.getMinutes()/60;
          if (endH < 6 || startH > 22) return null;
          const top = (Math.max(6, startH) - 6) * 44;
          const height = Math.max(20, (Math.min(22, endH) - Math.max(6, startH)) * 44 - 2);
          return (
            <div key={b.id} className={`absolute rounded-md border ${colorFor(b.block_type)} p-1.5 text-[10px] overflow-hidden ${b.completed?"opacity-50":""}`}
              style={{ top, height, left: `calc(60px + ${(di * 100) / 7}% - 60px / 7 * ${di} + 2px)`, width: `calc((100% - 60px) / 7 - 4px)` }}>
              <div className="font-semibold truncate">{b.title}</div>
              <div className="opacity-70 truncate">{s.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
              <div className="absolute top-0.5 right-0.5 flex gap-0.5">
                {!b.completed && <button onClick={() => onComplete(b.id)} className="text-emerald-300"><CheckCircle2 className="h-3 w-3" /></button>}
                <button onClick={() => onDelete(b.id)} className="opacity-60"><X className="h-3 w-3" /></button>
              </div>
            </div>
          );
        }))}
      </div>
    </div>
  );
}

function MonthGrid({ cursor, blocks, colorFor, onPick }: any) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = new Date(first); start.setDate(1 - first.getDay());
  const cells = Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d; });
  const today = new Date().toDateString();
  const byDay: Record<string, any[]> = {};
  for (const b of blocks) {
    const k = new Date(b.starts_at).toDateString();
    (byDay[k] ??= []).push(b);
  }
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border/60 bg-card/60">
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => <div key={d} className="p-2 text-center text-xs font-semibold text-muted-foreground">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          const inMonth = d.getMonth() === cursor.getMonth();
          const isToday = d.toDateString() === today;
          const items = byDay[d.toDateString()] ?? [];
          return (
            <button key={i} onClick={() => onPick(d)} className={`min-h-[90px] border-r border-b border-border/40 p-1.5 text-left hover:bg-accent/30 ${!inMonth?"opacity-40":""}`}>
              <div className={`text-xs font-semibold mb-1 ${isToday?"text-primary":""}`}>{d.getDate()}</div>
              <div className="space-y-0.5">
                {items.slice(0,3).map((b: any) => (
                  <div key={b.id} className={`truncate rounded border px-1 text-[10px] ${colorFor(b.block_type)}`}>{b.title}</div>
                ))}
                {items.length > 3 && <div className="text-[10px] text-muted-foreground">+{items.length-3} more</div>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Pomodoro() {
  const [duration, setDuration] = useState(25);
  const [remaining, setRemaining] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [focus, setFocus] = useState(false);
  const ref = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    ref.current = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          setRunning(false);
          toast.success("Pomodoro complete");
          return duration * 60;
        }
        return r - 1;
      });
    }, 1000);
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [running, duration]);

  useEffect(() => {
    if (!focus) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFocus(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focus]);

  const mm = Math.floor(remaining / 60).toString().padStart(2, "0");
  const ss = (remaining % 60).toString().padStart(2, "0");
  const pct = ((duration * 60 - remaining) / (duration * 60)) * 100;

  if (focus) {
    return (
      <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl flex flex-col items-center justify-center">
        <button onClick={() => setFocus(false)} className="absolute top-6 right-6 rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground"><Minimize2 className="h-5 w-5" /></button>
        <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-6">Focus mode · Esc to exit</div>
        <div className="font-mono text-[12rem] font-bold leading-none tabular-nums">{mm}:{ss}</div>
        <div className="mt-8 w-[60vw] max-w-2xl h-2 rounded-full bg-border/40 overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-10 flex items-center gap-3">
          <select value={duration} onChange={(e) => { const v = parseInt(e.target.value); setDuration(v); setRemaining(v * 60); setRunning(false); }} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <option value={15}>15m</option><option value={25}>25m</option><option value={45}>45m</option><option value={60}>60m</option><option value={90}>90m</option>
          </select>
          <button onClick={() => setRunning(!running)} className="rounded-lg bg-primary px-6 py-3 text-primary-foreground">
            {running ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </button>
          <button onClick={() => { setRunning(false); setRemaining(duration * 60); }} className="rounded-lg border border-border p-3"><RotateCcw className="h-5 w-5" /></button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase text-muted-foreground">Pomodoro</div>
          <div className="font-mono text-4xl font-bold">{mm}:{ss}</div>
        </div>
        <div className="flex items-center gap-2">
          <select value={duration} onChange={(e) => { const v = parseInt(e.target.value); setDuration(v); setRemaining(v * 60); setRunning(false); }} className="rounded-lg border border-border bg-background px-2 py-1 text-xs">
            <option value={15}>15m</option><option value={25}>25m</option><option value={45}>45m</option><option value={60}>60m</option>
          </select>
          <button onClick={() => setRunning(!running)} className="rounded-lg bg-primary p-2 text-primary-foreground">
            {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button onClick={() => { setRunning(false); setRemaining(duration * 60); }} className="rounded-lg border border-border p-2"><RotateCcw className="h-4 w-4" /></button>
          <button onClick={() => setFocus(true)} className="rounded-lg border border-border p-2" title="Focus mode"><Maximize2 className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="mt-3 h-1.5 rounded-full bg-border/40 overflow-hidden">
        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
