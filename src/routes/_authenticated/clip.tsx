import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { fetchWebClip } from "@/lib/clipper.functions";
import { processMaterial } from "@/lib/materials.functions";
import { getAccessToken } from "@/lib/auth-helper";
import { toast } from "sonner";
import { Loader2, Link2, Scissors, Wand2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/clip")({ component: Clipper });

function Clipper() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const clip = useServerFn(fetchWebClip);
  const processFn = useServerFn(processMaterial);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [subject, setSubject] = useState("General");
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);

  async function doFetch() {
    if (!url.trim()) return;
    setFetching(true);
    try {
      const r = await clip({ data: { url: url.trim() } });
      setTitle(r.title);
      setText(r.text);
      toast.success("Page fetched — review then Save");
    } catch (e: any) {
      toast.error(e.message ?? "Fetch failed");
    } finally {
      setFetching(false);
    }
  }

  async function save() {
    if (!user || !text.trim()) return;
    setSaving(true);
    try {
      const accessToken = await getAccessToken();
      const body = note.trim() ? `${note.trim()}\n\n---\n\n${text}` : text;
      const finalTitle = (title || "Web Clip").slice(0, 300);

      const { data: row, error } = await supabase
        .from("study_materials")
        .insert({
          user_id: user.id,
          title: finalTitle,
          subject,
          field_category: "Web",
          original_content: body,
          processing_status: "processing",
        })
        .select()
        .single();
      if (error) throw error;

      toast.success("Material created — analyzing…");
      navigate({ to: "/materials/$id", params: { id: row.id } });

      // Process in background (non-blocking for navigation)
      processFn({
        data: {
          accessToken,
          title: finalTitle,
          subject,
          fieldCategory: "Web",
          isStem: false,
          text: body,
        },
      })
        .then(async (result) => {
          await supabase
            .from("study_materials")
            .update({
              ai_summary: (result as any).summary,
              key_concepts: (result as any).key_concepts,
              adapted_visual: (result as any).visual,
              adapted_auditory: (result as any).auditory,
              adapted_reading: (result as any).reading,
              adapted_kinesthetic: (result as any).kinesthetic,
              cornell_cue: (result as any).cornell?.cue_column,
              cornell_notes: (result as any).cornell?.notes_column,
              processing_status: "ready",
            })
            .eq("id", row.id);
        })
        .catch(async (e) => {
          console.error("clip processing failed", e);
          await supabase.from("study_materials").update({ processing_status: "ready" }).eq("id", row.id);
        });
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <Scissors className="h-7 w-7 text-primary" /> Web Clipper
        </h1>
        <p className="text-sm text-muted-foreground">Paste any article, blog, or docs URL. Klausum extracts the text and turns it into a study material.</p>
      </header>

      <div className="rounded-2xl border border-border/60 bg-card/60 p-5 space-y-3">
        <label className="text-xs uppercase tracking-wide text-muted-foreground">Source URL</label>
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 rounded-lg border border-border bg-background px-3">
            <Link2 className="h-4 w-4 text-muted-foreground" />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doFetch()}
              placeholder="https://en.wikipedia.org/wiki/…"
              className="flex-1 bg-transparent py-2 text-sm outline-none"
            />
          </div>
          <button
            onClick={doFetch}
            disabled={fetching || !url.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {fetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} Fetch
          </button>
        </div>
      </div>

      {text && (
        <div className="rounded-2xl border border-border/60 bg-card/60 p-5 space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground">Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground">Subject</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground">Your note (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Why you clipped this…"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground">Extracted text ({text.length.toLocaleString()} chars)</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={10}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono"
            />
          </div>
          <button
            onClick={save}
            disabled={saving || !text.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scissors className="h-4 w-4" />} Save as Material
          </button>
        </div>
      )}
    </div>
  );
}
