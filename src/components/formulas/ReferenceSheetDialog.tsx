import { useState } from "react";
import { reportError } from "@/lib/report-error";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles, X } from "lucide-react";
import { toast } from "@/lib/notify";
import { BlockMath } from "react-katex";
import { generateReferenceSheet } from "@/lib/formulas.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

type GenItem = { name: string; latex: string; description: string; category: string; tags: string[] };

export function ReferenceSheetDialog({
  open,
  onClose,
  subjects,
  existingNames,
}: {
  open: boolean;
  onClose: () => void;
  subjects: string[];
  existingNames: string[];
}) {
  const { user, session } = useAuth();
  const qc = useQueryClient();
  const genFn = useServerFn(generateReferenceSheet);
  const [subject, setSubject] = useState(subjects[0] ?? "Physics");
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<GenItem[] | null>(null);
  const [picked, setPicked] = useState<Record<number, boolean>>({});

  if (!open) return null;

  async function generate() {
    if (!session) return;
    setBusy(true);
    setItems(null);
    try {
      const r = await genFn({
        data: { accessToken: session.access_token, subject, topic: topic || undefined, existing: existingNames },
      });
      setItems(r.formulas);
      setPicked(Object.fromEntries(r.formulas.map((_: unknown, i: number) => [i, true])));
    } catch (e: any) {
      toast.error(reportError("ReferenceSheetDialog", e));
    } finally {
      setBusy(false);
    }
  }

  async function addSelected() {
    if (!user || !items) return;
    const rows = items
      .filter((_, i) => picked[i])
      .map((f) => ({
        user_id: user.id,
        name: f.name,
        latex: f.latex,
        description: f.description,
        subject,
        category: f.category,
        tags: f.tags,
      }));
    if (rows.length === 0) return toast.error("Pick at least one");
    const { error } = await supabase.from("formulas").insert(rows);
    if (error) return toast.error(reportError("ReferenceSheetDialog", error));
    toast.success(`Added ${rows.length} formulas`);
    qc.invalidateQueries({ queryKey: ["formulas", user.id] });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden card-chunky bg-card flex flex-col">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="font-display text-lg font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> AI Reference Sheet
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-3 p-4 border-b border-border">
          <div className="grid md:grid-cols-2 gap-3">
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject (e.g. Physics)"
              className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Optional topic (e.g. Kinematics)"
              className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <button
            onClick={generate}
            disabled={busy || !subject}
            className="inline-flex items-center gap-2 btn-3d rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generate
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {!items && !busy && (
            <p className="text-sm text-muted-foreground">Generate a curated sheet of essential formulas for the chosen subject.</p>
          )}
          {busy && <p className="text-sm text-muted-foreground">Composing reference sheet…</p>}
          {items?.map((f, i) => (
            <label
              key={i}
              className={`flex gap-3 rounded-lg border p-3 cursor-pointer ${picked[i] ? "border-primary/60 bg-primary/5" : "border-border"}`}
            >
              <input
                type="checkbox"
                checked={!!picked[i]}
                onChange={(e) => setPicked({ ...picked, [i]: e.target.checked })}
                className="mt-1"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{f.name}</span>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{f.category}</span>
                </div>
                <div className="my-1 overflow-x-auto rounded border border-border/40 bg-background/60 p-2">
                  <SafeBlock latex={f.latex} />
                </div>
                <p className="text-xs text-muted-foreground">{f.description}</p>
              </div>
            </label>
          ))}
        </div>

        {items && (
          <div className="flex justify-end gap-2 border-t border-border p-4">
            <button onClick={onClose} className="rounded-xl border-2 border-border px-3 py-2 text-sm">Cancel</button>
            <button onClick={addSelected} className="btn-3d rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
              Add selected
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SafeBlock({ latex }: { latex: string }) {
  try { return <BlockMath math={latex} />; } catch { return <code className="text-xs text-destructive">Invalid LaTeX</code>; }
}
