import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Star, Trash2, Plus, Search, FileCode } from "lucide-react";
import { toast } from "sonner";

export type Snippet = {
  id: string;
  title: string;
  language: string;
  code: string;
  tags: string[];
  is_favorite: boolean;
  updated_at: string;
};

export function SnippetsRail({ currentLang, currentCode, onLoad }: { currentLang: string; currentCode: string; onLoad: (s: Snippet) => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [saveOpen, setSaveOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");

  const { data: snippets = [] } = useQuery({
    queryKey: ["snippets", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("code_snippets").select("*").order("is_favorite", { ascending: false }).order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Snippet[];
    },
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      if (!title.trim()) throw new Error("Title required");
      const { error } = await supabase.from("code_snippets").insert({
        user_id: user.id,
        title: title.trim(),
        language: currentLang,
        code: currentCode,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Snippet saved");
      setSaveOpen(false); setTitle(""); setTags("");
      qc.invalidateQueries({ queryKey: ["snippets"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  async function toggleFav(s: Snippet) {
    await supabase.from("code_snippets").update({ is_favorite: !s.is_favorite }).eq("id", s.id);
    qc.invalidateQueries({ queryKey: ["snippets"] });
  }
  async function del(s: Snippet) {
    if (!confirm(`Delete "${s.title}"?`)) return;
    await supabase.from("code_snippets").delete().eq("id", s.id);
    qc.invalidateQueries({ queryKey: ["snippets"] });
  }

  const filtered = q ? snippets.filter((s) => s.title.toLowerCase().includes(q.toLowerCase()) || s.tags.some((t) => t.toLowerCase().includes(q.toLowerCase()))) : snippets;

  return (
    <aside className="rounded-xl border border-border/60 bg-card/60 p-3 space-y-3 w-full md:w-64 shrink-0">
      <div className="flex items-center justify-between">
        <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Snippets</h3>
        <button onClick={() => setSaveOpen((v) => !v)} className="inline-flex items-center gap-1 text-xs text-primary hover:underline"><Plus className="h-3 w-3" /> Save</button>
      </div>

      {saveOpen && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-2 space-y-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="w-full rounded border border-border bg-background px-2 py-1 text-xs" />
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="tags, comma, separated" className="w-full rounded border border-border bg-background px-2 py-1 text-xs" />
          <div className="flex gap-1">
            <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="flex-1 rounded bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-50">Save</button>
            <button onClick={() => setSaveOpen(false)} className="rounded border border-border px-2 py-1 text-xs">Cancel</button>
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="w-full rounded border border-border bg-background pl-7 pr-2 py-1 text-xs" />
      </div>

      <div className="max-h-[400px] overflow-y-auto space-y-1">
        {filtered.length === 0 && <p className="text-[11px] text-muted-foreground italic px-1">No snippets yet.</p>}
        {filtered.map((s) => (
          <div key={s.id} className="group rounded-md border border-border/40 bg-background/60 p-2 text-xs hover:border-primary/40 transition">
            <button onClick={() => onLoad(s)} className="w-full text-left">
              <div className="flex items-center gap-1.5">
                <FileCode className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="font-medium truncate">{s.title}</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="rounded bg-muted/50 px-1.5 py-0.5">{s.language}</span>
                {s.tags.slice(0, 2).map((t) => <span key={t} className="text-primary/70">#{t}</span>)}
              </div>
            </button>
            <div className="mt-1.5 flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition">
              <button onClick={() => toggleFav(s)} title="Favorite"><Star className={`h-3 w-3 ${s.is_favorite ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} /></button>
              <button onClick={() => del(s)} title="Delete"><Trash2 className="h-3 w-3 text-muted-foreground hover:text-rose-400" /></button>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
