import { createFileRoute } from "@tanstack/react-router";
import { reportError } from "@/lib/report-error";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CalendarClock, Plus, Trash2, Sparkles } from "lucide-react";

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
    if (error) return toast.error(reportError("exams", error));
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

  async function autoReadiness(id: string, subject: string) {
    const subj = (subject || "").trim();
    // Quiz score average for matching subject quizzes
    const { data: quizzes } = await supabase.from("quizzes").select("id,subject").eq("user_id", user!.id);
    const matchingQuizIds = (quizzes ?? []).filter((q: any) => !subj || (q.subject || "").toLowerCase() === subj.toLowerCase()).map((q: any) => q.id);
    let quizAvg = 0;
    if (matchingQuizIds.length) {
      const { data: attempts } = await supabase.from("quiz_attempts").select("score,total").in("quiz_id", matchingQuizIds);
      const scores = (attempts ?? []).filter((a: any) => a.total > 0).map((a: any) => (a.score / a.total) * 100);
      if (scores.length) quizAvg = scores.reduce((a, b) => a + b, 0) / scores.length;
    }
    // Flashcard retention via decks subject
    const { data: decks } = await supabase.from("flashcard_decks").select("id,subject").eq("user_id", user!.id);
    const matchingDeckIds = (decks ?? []).filter((d: any) => !subj || (d.subject || "").toLowerCase() === subj.toLowerCase()).map((d: any) => d.id);
    let retAvg = 0;
    if (matchingDeckIds.length) {
      const { data: cards } = await supabase.from("flashcards").select("fsrs_retrievability").in("deck_id", matchingDeckIds);
      const rs = (cards ?? []).map((c: any) => (c.fsrs_retrievability ?? 0) * 100).filter((n: number) => n > 0);
      if (rs.length) retAvg = rs.reduce((a, b) => a + b, 0) / rs.length;
    }
    const combined = Math.round(quizAvg && retAvg ? quizAvg * 0.6 + retAvg * 0.4 : (quizAvg || retAvg));
    if (!combined) return toast.error("No quiz attempts or card reviews for this subject yet");
    await updateReadiness(id, combined);
    toast.success(`Readiness: ${combined}% (quizzes ${Math.round(quizAvg)}% · retention ${Math.round(retAvg)}%)`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Exam countdowns</h1>
          <p className="text-sm text-muted-foreground mt-1">Track your readiness for what's coming.</p>
        </div>
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 btn-3d rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
          <Plus className="h-4 w-4" /> New exam
        </button>
      </div>

      {open && (
        <div className="card-chunky bg-card p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Exam name" value={form.exam_name} onChange={(e) => setForm({ ...form, exam_name: e.target.value })} className="input" />
            <input placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="input" />
            <input type="date" value={form.exam_date} onChange={(e) => setForm({ ...form, exam_date: e.target.value })} className="input" />
            <input placeholder="Target grade (e.g. A1)" value={form.target_grade} onChange={(e) => setForm({ ...form, target_grade: e.target.value })} className="input" />
          </div>
          <textarea placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input min-h-[60px]" />
          <div className="flex gap-2">
            <button onClick={add} className="btn-3d rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Save</button>
            <button onClick={() => setOpen(false)} className="rounded-xl border-2 border-border px-4 py-2 text-sm">Cancel</button>
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
              <li key={e.id} className="card-chunky bg-card p-4">
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
                <div className="mt-3 flex items-center gap-3">
                  <button onClick={() => autoReadiness(e.id, e.subject)} className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                    <Sparkles className="h-3 w-3" /> Auto-compute
                  </button>
                  <button onClick={() => remove(e.id)} className="inline-flex items-center gap-1 text-xs text-destructive hover:underline">
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
