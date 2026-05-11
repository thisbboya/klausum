import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { BlockMath } from "react-katex";
import "katex/dist/katex.min.css";
import { toast } from "sonner";
import { Plus, Search, Star, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/formulas")({ component: FormulasPage });

function FormulasPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [subj, setSubj] = useState("All");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", latex: "", subject: "General", description: "" });

  const { data: formulas = [] } = useQuery({
    queryKey: ["formulas", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("formulas").select("*").eq("user_id", user!.id).order("is_favorite", { ascending: false }).order("name");
      return data ?? [];
    },
  });

  const subjects = useMemo(() => ["All", ...Array.from(new Set(formulas.map((f: any) => f.subject)))], [formulas]);
  const filtered = formulas.filter((f: any) =>
    (subj === "All" || f.subject === subj) &&
    (q === "" || f.name.toLowerCase().includes(q.toLowerCase()) || f.latex.toLowerCase().includes(q.toLowerCase()))
  );

  async function add() {
    if (!form.name || !form.latex) return toast.error("Name and LaTeX required");
    const { error } = await supabase.from("formulas").insert({ ...form, user_id: user!.id });
    if (error) return toast.error(error.message);
    toast.success("Added");
    setForm({ name: "", latex: "", subject: "General", description: "" });
    setAdding(false);
    qc.invalidateQueries({ queryKey: ["formulas", user?.id] });
  }

  async function toggleFav(f: any) {
    await supabase.from("formulas").update({ is_favorite: !f.is_favorite }).eq("id", f.id);
    qc.invalidateQueries({ queryKey: ["formulas", user?.id] });
  }

  async function del(id: string) {
    await supabase.from("formulas").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["formulas", user?.id] });
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Formula Library</h1>
          <p className="text-sm text-muted-foreground">Your reference sheet for every subject.</p>
        </div>
        <button onClick={() => setAdding(!adding)} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
          <Plus className="h-4 w-4" /> Add formula
        </button>
      </header>

      {adding && (
        <div className="space-y-3 rounded-xl border border-border/60 bg-card/60 p-4">
          <div className="grid md:grid-cols-2 gap-3">
            <input className="input" placeholder="Name (e.g. Quadratic formula)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="input" placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          </div>
          <textarea className="input min-h-24 font-mono text-xs" placeholder={"LaTeX, e.g. x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}"} value={form.latex} onChange={(e) => setForm({ ...form, latex: e.target.value })} />
          <input className="input" placeholder="Description (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          {form.latex && (
            <div className="rounded-lg border border-border/40 bg-background/40 p-3 overflow-x-auto">
              <SafeMath latex={form.latex} />
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={add} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">Save</button>
            <button onClick={() => setAdding(false)} className="rounded-lg border border-border px-3 py-1.5 text-xs">Cancel</button>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input className="input pl-9" placeholder="Search formulas…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select value={subj} onChange={(e) => setSubj(e.target.value)} className="input w-40">
          {subjects.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
          No formulas yet. Add your first one above.
        </div>
      ) : (
        <ul className="grid md:grid-cols-2 gap-3">
          {filtered.map((f: any) => (
            <li key={f.id} className="rounded-xl border border-border/60 bg-card/60 p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{f.name}</div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{f.subject}</div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button onClick={() => toggleFav(f)} className="p-1 text-muted-foreground hover:text-amber-400">
                    <Star className={`h-4 w-4 ${f.is_favorite ? "fill-amber-400 text-amber-400" : ""}`} />
                  </button>
                  <button onClick={() => del(f.id)} className="p-1 text-muted-foreground hover:text-red-400">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto rounded-md border border-border/40 bg-background/40 p-3">
                <SafeMath latex={f.latex} />
              </div>
              {f.description && <p className="text-xs text-muted-foreground">{f.description}</p>}
            </li>
          ))}
        </ul>
      )}

      <style>{`.input { width:100%; border-radius: 0.5rem; border:1px solid hsl(var(--border)); background: var(--background); padding: 0.5rem 0.75rem; font-size: 0.875rem; outline:none; } .input:focus { border-color: hsl(var(--primary)); }`}</style>
    </div>
  );
}

function SafeMath({ latex }: { latex: string }) {
  try {
    return <BlockMath math={latex} />;
  } catch {
    return <code className="text-xs text-red-400">Invalid LaTeX</code>;
  }
}
