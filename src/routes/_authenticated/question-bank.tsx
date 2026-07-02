import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Bookmark, Trash2, Search, Plus } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

export const Route = createFileRoute("/_authenticated/question-bank")({
  component: QuestionBankPage,
});

type QBItem = {
  id: string;
  question_text: string;
  answer_text: string;
  subject: string | null;
  source: string;
  image_url: string | null;
  reviewed_count: number;
  created_at: string;
};

function QuestionBankPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<QBItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newQ, setNewQ] = useState("");
  const [newA, setNewA] = useState("");
  const [newSubject, setNewSubject] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("question_bank")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) toast.error(error.message);
      else setItems((data as QBItem[]) ?? []);
      setLoading(false);
    })();
  }, [user]);

  const filtered = items.filter(
    (i) =>
      !query ||
      i.question_text.toLowerCase().includes(query.toLowerCase()) ||
      (i.subject ?? "").toLowerCase().includes(query.toLowerCase()),
  );

  async function del(id: string) {
    const { error } = await supabase.from("question_bank").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setItems((prev) => prev.filter((x) => x.id !== id));
    toast.success("Deleted");
  }

  async function addManual() {
    if (!user || !newQ.trim() || !newA.trim()) return;
    const { data, error } = await supabase
      .from("question_bank")
      .insert({
        user_id: user.id,
        question_text: newQ,
        answer_text: newA,
        subject: newSubject || null,
        source: "manual",
      })
      .select()
      .single();
    if (error) return toast.error(error.message);
    setItems((prev) => [data as QBItem, ...prev]);
    setNewQ("");
    setNewA("");
    setNewSubject("");
    setShowAdd(false);
    toast.success("Saved");
  }

  async function markReviewed(id: string) {
    const item = items.find((x) => x.id === id);
    if (!item) return;
    const { error } = await supabase
      .from("question_bank")
      .update({ reviewed_count: item.reviewed_count + 1, last_reviewed_at: new Date().toISOString() })
      .eq("id", id);
    if (!error)
      setItems((prev) =>
        prev.map((x) => (x.id === id ? { ...x, reviewed_count: x.reviewed_count + 1 } : x)),
      );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-2">
            <Bookmark className="h-7 w-7 text-primary" /> Question Bank
          </h1>
          <p className="text-sm text-muted-foreground">
            Every solved problem — reviewable like flashcards.
          </p>
        </div>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> Add manually
        </button>
      </header>

      {showAdd && (
        <div className="rounded-xl border border-border bg-card/60 p-4 space-y-2">
          <input
            placeholder="Question"
            value={newQ}
            onChange={(e) => setNewQ(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <textarea
            placeholder="Answer / worked solution (Markdown + LaTeX supported)"
            value={newA}
            onChange={(e) => setNewA(e.target.value)}
            className="w-full min-h-24 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            placeholder="Subject (optional)"
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <button
            onClick={addManual}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Save
          </button>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search questions…"
          className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2 text-sm"
        />
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nothing yet. Solve a problem in Snap &amp; Solve and hit “Save to Question Bank”.
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((item) => (
            <li key={item.id} className="rounded-xl border border-border bg-card/50">
              <button
                onClick={() => setExpanded((e) => (e === item.id ? null : item.id))}
                className="w-full text-left p-4 flex items-start gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium line-clamp-2">{item.question_text}</div>
                  <div className="mt-1 flex items-center gap-2 text-[10px] uppercase text-muted-foreground">
                    <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5">
                      {item.source.replace("_", " ")}
                    </span>
                    {item.subject && <span>{item.subject}</span>}
                    <span>· reviewed {item.reviewed_count}×</span>
                  </div>
                </div>
              </button>
              {expanded === item.id && (
                <div className="border-t border-border/60 p-4 space-y-3">
                  {item.image_url && (
                    <img
                      src={item.image_url}
                      alt=""
                      className="max-h-48 rounded-lg border border-border"
                    />
                  )}
                  <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {item.answer_text}
                    </ReactMarkdown>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => markReviewed(item.id)}
                      className="text-xs rounded-md border border-primary/30 bg-primary/10 text-primary px-3 py-1.5"
                    >
                      Mark reviewed
                    </button>
                    <button
                      onClick={() => del(item.id)}
                      className="text-xs rounded-md border border-red-500/30 bg-red-500/10 text-red-400 px-3 py-1.5 inline-flex items-center gap-1"
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
