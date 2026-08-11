// Core Drive 1 — Epic Meaning & Calling.
//
// Klausum measures effort in a dozen ways: XP, streaks, levels, badges, gems.
// None of them answer "why am I doing this at 1am". Points motivate a session;
// a reason motivates a semester — and when the points stop feeling new, the
// reason is the only thing left holding someone to the work.
//
// So the student writes the reason themselves, in their own words. That matters
// more than the wording: a purpose the app hands you is a slogan, and a purpose
// you typed is a promise. It is stored once and shown back at the moments where
// motivation actually dips — an empty dashboard, a review queue you don't want
// to open.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Check, X, Compass, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/lib/notify";
import { reportError } from "@/lib/report-error";

/** Reads the student's calling. Shared so the dashboard and the review page
    show the same sentence without each inventing its own query. */
export function useCalling() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["calling", user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("calling_text, is_day1_pioneer, field_of_study, programme")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as {
        calling_text: string | null;
        is_day1_pioneer: boolean | null;
        field_of_study: string | null;
        programme: string | null;
      } | null;
    },
  });
}

/** One line of the student's own reason, for quiet corners of the app. */
export function CallingLine({ className = "" }: { className?: string }) {
  const { data } = useCalling();
  if (!data?.calling_text) return null;
  return (
    <p className={`text-sm font-semibold italic text-muted-foreground ${className}`}>
      “{data.calling_text}”
    </p>
  );
}

export function CallingCard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading } = useCalling();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  if (isLoading || !user) return null;

  const calling = data?.calling_text?.trim() || "";
  // The field the student is training for, used to make the prompt specific.
  // "Why are you studying?" is a hard question in the abstract and an easy one
  // when it names the thing you are actually doing.
  const field = data?.field_of_study || data?.programme || "";

  async function save() {
    const text = draft.trim().slice(0, 180);
    if (!text) return;
    setSaving(true);
    const { error } = await supabase
      .from("user_profiles")
      .update({ calling_text: text, calling_set_at: new Date().toISOString() })
      .eq("id", user!.id);
    setSaving(false);
    if (error) {
      toast.error(reportError("calling.save", error));
      return;
    }
    setEditing(false);
    qc.invalidateQueries({ queryKey: ["calling"] });
    toast.success("That's what this is all for.");
  }

  function startEditing() {
    setDraft(calling);
    setEditing(true);
  }

  if (editing) {
    return (
      <section className="card-chunky bg-card p-4">
        <label className="block font-display text-sm font-extrabold">
          Why are you doing this?
        </label>
        <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
          One sentence, your words.
          {field ? ` Not "pass ${field}" — the thing on the other side of passing.` : ""}
        </p>
        <textarea
          autoFocus
          value={draft}
          maxLength={180}
          rows={2}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void save();
            }
            if (e.key === "Escape") setEditing(false);
          }}
          placeholder="So my mother never has to worry about a hospital bill again."
          className="mt-2.5 w-full resize-none rounded-xl border-2 border-border bg-surface-2 px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold tabular-nums text-muted-foreground">
            {draft.trim().length}/180
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setEditing(false)}
              className="inline-flex items-center gap-1 rounded-xl border-2 border-border px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide transition hover:bg-surface-2"
            >
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
            <button
              onClick={() => void save()}
              disabled={saving || !draft.trim()}
              className="btn-3d inline-flex items-center gap-1 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-wide text-primary-foreground disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" /> Save
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (!calling) {
    // Deliberately an invitation rather than a blocking step. A calling
    // extracted during signup is a form field; one offered later, after the
    // student has done some real work, is a decision.
    return (
      <button
        onClick={startEditing}
        className="flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-border bg-card/60 px-4 py-3 text-left transition hover:border-primary hover:bg-card"
      >
        <Compass className="h-5 w-5 shrink-0 text-primary" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-extrabold">Why are you doing this?</span>
          <span className="block truncate text-xs font-semibold text-muted-foreground">
            Write it once. Klausum will remind you on the hard days.
          </span>
        </span>
      </button>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-2xl border-2 border-primary/40 bg-primary/8 px-4 py-3">
      <div className="flex items-start gap-3">
        <Compass className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-extrabold leading-snug">“{calling}”</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">
            <span>Everything below is for this</span>
            {/* Elitism: the founding cohort is a real, unrepeatable fact about
                this account, so it is worth saying out loud rather than
                sitting unused in a column. */}
            {data?.is_day1_pioneer && (
              <span className="inline-flex items-center gap-1 rounded-full bg-grape/15 px-2 py-0.5 text-grape">
                <Crown className="h-3 w-3" /> Founding class
              </span>
            )}
          </div>
        </div>
        <button
          onClick={startEditing}
          aria-label="Edit your reason"
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
    </section>
  );
}
