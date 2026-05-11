import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CalendarClock, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/exams")({ component: ExamsPage });

function ExamsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ exam_name: "", subject: "", exam_date: "", target_grade: "", current_readiness: 0, notes: "" });

  const { data: exams } = useQuery({
    queryKey: ["exams", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("exam_countdowns").select("*").eq("user_id", user!.id).order("exam_date");
      return data ?? [];
    },
  });

  async function add() {
    if (!form.exam_name || !form.exam_date) return toast.error("Name and date required");
    const { error } = await supabase.from("exam_countdowns").insert({ ...form, user_id: user!.id });
    if (error) return toast.error(error.message);
    toast.success("Exam added");
    setOpen(false);
    setForm({ exam_name: "", subject: "", exam_date: "", target_grade: "", current_readiness: 0, notes: "" });
    qc.invalidateQueries({ queryKey: ["exams", user?.id] });
  }

  async function remove(id: string) {
    await supabase.from("exam_countdowns").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["exams", user?.id] });
  }

  async function updateReadiness(id: string, v: number) {
    await supabase.from("exam_countdowns").update({ current_readiness: v }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["exams", user?.id] });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Exam countdowns</h1>
          <p className="text-sm text-muted-foreground mt-1">Track your readiness for what's coming.</p>
        </div>
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
          <Plus className="h-4 w-4" /> New exam
        </button>
      </div>

      {open && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Exam name" value={form.exam_name} onChange={(e) => setForm({ ...form, exam_name: e.target.value })} className="input" />
            <input placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="input" />
            <input type="date" value={form.exam_date} onChange={(e) => setForm({ ...form, exam_date: e.target.value })} className="input" />
            <input placeholder="Target grade (e.g. A1)" value={form.target_grade} onChange={(e) => setForm({ ...form, target_grade: e.target.value })} className="input" />
          </div>
          <textarea placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input min-h-[60px]" />
          <div className="flex gap-2">
            <button onClick={add} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Save</button>
            <button onClick={() => setOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm">Cancel</button>
          </div>
          <style>{`.input { width:100%; border-radius: 0.5rem; border:1px solid hsl(var(--border)); background: var(--background); padding: 0.5rem 0.75rem; font-size: 0.875rem; outline:none; }`}</style>
        </div>
      )}

      {!exams || exams.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No exams scheduled yet.
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {exams.map((e: any) => {
            const days = Math.ceil((new Date(e.exam_date).getTime() - Date.now()) / 86400000);
            const past = days < 0;
            return (
              <li key={e.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-display text-lg font-semibold truncate">{e.exam_name}</div>
                    <div className="text-xs text-muted-foreground">{e.subject || "General"} · {e.exam_date}</div>
                  </div>
                  <div className="text-right">
                    <div className={`font-display text-2xl font-bold ${past ? "text-muted-foreground" : "text-primary"}`}>{Math.abs(days)}d</div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{past ? "ago" : "to go"}</div>
                  </div>
                </div>
                {e.target_grade && <div className="mt-2 text-xs">Target: <span className="text-primary font-semibold">{e.target_grade}</span></div>}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground"><span>Readiness</span><span>{e.current_readiness ?? 0}%</span></div>
                  <input type="range" min={0} max={100} value={e.current_readiness ?? 0} onChange={(ev) => updateReadiness(e.id, parseInt(ev.target.value))} className="w-full mt-1" />
                </div>
                {e.notes && <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{e.notes}</p>}
                <button onClick={() => remove(e.id)} className="mt-3 inline-flex items-center gap-1 text-xs text-destructive hover:underline">
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
