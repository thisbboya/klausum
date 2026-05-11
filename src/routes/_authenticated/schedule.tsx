import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { generatePlan } from "@/lib/coach.functions";
import { getAccessToken } from "@/lib/auth-helper";
import { toast } from "sonner";
import { Sparkles, Plus, Play, Pause, RotateCcw, Trash2, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/schedule")({ component: SchedulePage });

function SchedulePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const planFn = useServerFn(generatePlan);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: "", subject: "General", block_type: "study", date: new Date().toISOString().slice(0, 10), startTime: "09:00", duration: 25 });

  const { data: blocks = [] } = useQuery({
    queryKey: ["schedule", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const since = new Date(Date.now() - 1 * 86400_000).toISOString();
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

  const grouped = blocks.reduce((acc: Record<string, any[]>, b: any) => {
    const day = new Date(b.starts_at).toDateString();
    (acc[day] ??= []).push(b);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Schedule</h1>
          <p className="text-sm text-muted-foreground">Plan your week. Stay on rhythm.</p>
        </div>
        <div className="flex gap-2">
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

      <Pomodoro />

      {Object.keys(grouped).length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
          No blocks scheduled. Use AI Smart Plan to fill the next 7 days.
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([day, items]) => (
            <section key={day}>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {new Date(day).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
              </h2>
              <ul className="space-y-2">
                {items.map((b: any) => {
                  const s = new Date(b.starts_at), e = new Date(b.ends_at);
                  const dur = Math.round((e.getTime() - s.getTime()) / 60000);
                  const c = b.block_type === "review" ? "border-blue-500/40 bg-blue-500/10"
                    : b.block_type === "quiz" ? "border-amber-500/40 bg-amber-500/10"
                    : b.block_type === "break" ? "border-emerald-500/40 bg-emerald-500/10"
                    : "border-primary/40 bg-primary/10";
                  return (
                    <li key={b.id} className={`flex items-center gap-3 rounded-lg border ${c} p-3 ${b.completed ? "opacity-50" : ""}`}>
                      <div className="text-xs font-mono w-28 text-muted-foreground">
                        {s.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {dur}m
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{b.title}</div>
                        <div className="text-[11px] uppercase text-muted-foreground">{b.block_type} · {b.subject}</div>
                      </div>
                      {!b.completed && (
                        <button onClick={() => complete(b.id)} className="text-emerald-400 hover:text-emerald-300"><CheckCircle2 className="h-4 w-4" /></button>
                      )}
                      <button onClick={() => del(b.id)} className="text-muted-foreground hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <style>{`.input { width:100%; border-radius: 0.5rem; border:1px solid hsl(var(--border)); background: var(--background); padding: 0.5rem 0.75rem; font-size: 0.875rem; outline:none; }`}</style>
    </div>
  );
}

function Pomodoro() {
  const [duration, setDuration] = useState(25);
  const [remaining, setRemaining] = useState(25 * 60);
  const [running, setRunning] = useState(false);
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

  const mm = Math.floor(remaining / 60).toString().padStart(2, "0");
  const ss = (remaining % 60).toString().padStart(2, "0");
  const pct = ((duration * 60 - remaining) / (duration * 60)) * 100;

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
        </div>
      </div>
      <div className="mt-3 h-1.5 rounded-full bg-border/40 overflow-hidden">
        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
