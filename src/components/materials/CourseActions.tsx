// Rename, move and delete for a whole course.
//
// Materials could already be edited one at a time, but the course itself could
// not: a mistyped course name was permanent, and moving a subject's worth of
// documents meant opening every single one. Renaming a course has to rewrite
// the subject on every material inside it, because that string IS the link
// between them — there is no foreign key to update.
import { useEffect, useRef, useState } from "react";
import { MoreVertical, Pencil, FolderInput, Trash2, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/lib/notify";
import { reportError } from "@/lib/report-error";

type Mode = null | "menu" | "rename" | "merge";

export function CourseActions({
  name,
  courseId,
  count,
  allCourses,
  onChanged,
}: {
  name: string;
  /** Null for a bare subject that has materials but no course row. */
  courseId?: string | null;
  count: number;
  allCourses: string[];
  onChanged: () => void;
}) {
  const [mode, setMode] = useState<Mode>(null);
  const [draft, setDraft] = useState(name);
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mode) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setMode(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [mode]);

  /** Point every material in `from` at `to`, and update the course row if any. */
  async function retag(from: string, to: string) {
    const { error: mErr } = await supabase
      .from("study_materials")
      .update({ subject: to })
      .eq("subject", from);
    if (mErr) throw mErr;
    if (courseId) {
      const { error: cErr } = await (supabase as any)
        .from("courses")
        .update({ name: to })
        .eq("id", courseId);
      if (cErr) throw cErr;
    }
  }

  async function rename() {
    const to = draft.trim();
    if (!to || to === name) return setMode(null);
    if (allCourses.includes(to)) {
      return toast.error(`"${to}" already exists — use Merge into instead`);
    }
    setBusy(true);
    try {
      await retag(name, to);
      toast.success(`Renamed to ${to}`);
      setMode(null);
      onChanged();
    } catch (e) {
      toast.error(reportError("course-rename", e));
    } finally {
      setBusy(false);
    }
  }

  async function merge() {
    if (!target || target === name) return;
    setBusy(true);
    try {
      // Merging is the same operation as renaming onto a name that already
      // exists: the materials simply join the other course's pile.
      await retag(name, target);
      if (courseId) await (supabase as any).from("courses").delete().eq("id", courseId);
      toast.success(`Moved ${count} material${count === 1 ? "" : "s"} into ${target}`);
      setMode(null);
      onChanged();
    } catch (e) {
      toast.error(reportError("course-merge", e));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    // The materials are the expensive thing; the course is only a label. So
    // deleting a course never deletes what is inside it, and the confirmation
    // says so plainly.
    if (
      !confirm(
        `Delete the course "${name}"?\n\nIts ${count} material${count === 1 ? "" : "s"} are kept and move to General.`,
      )
    )
      return;
    setBusy(true);
    try {
      await retag(name, "General");
      if (courseId) await (supabase as any).from("courses").delete().eq("id", courseId);
      toast.success("Course deleted — materials moved to General");
      setMode(null);
      onChanged();
    } catch (e) {
      toast.error(reportError("course-delete", e));
    } finally {
      setBusy(false);
    }
  }

  const others = allCourses.filter((c) => c !== name);

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        onClick={(e) => {
          // The card behind this is itself a button that opens the course.
          e.stopPropagation();
          e.preventDefault();
          setMode(mode ? null : "menu");
        }}
        aria-label={`Options for ${name}`}
        className="rounded-lg border-2 border-border bg-card/80 p-1.5 text-muted-foreground transition hover:border-primary hover:text-primary"
      >
        <MoreVertical className="h-3.5 w-3.5" />
      </button>

      {mode === "menu" && (
        <div
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
          className="absolute right-0 top-full z-30 mt-1.5 w-48 overflow-hidden rounded-xl border-2 border-border bg-card shadow-lg"
        >
          <Item icon={Pencil} label="Rename course" onClick={() => { setDraft(name); setMode("rename"); }} />
          <Item icon={FolderInput} label="Merge into…" onClick={() => { setTarget(others[0] ?? ""); setMode("merge"); }} />
          <Item icon={Trash2} label="Delete course" tone="destructive" onClick={remove} />
        </div>
      )}

      {mode === "rename" && (
        <Pop onClick={(e) => { e.stopPropagation(); e.preventDefault(); }} title="Rename course">
          <input
            autoFocus
            value={draft}
            maxLength={60}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void rename();
              if (e.key === "Escape") setMode(null);
            }}
            className="w-full rounded-lg border-2 border-border bg-surface-2 px-2.5 py-1.5 text-xs font-semibold outline-none focus:border-primary"
          />
          <p className="text-[10px] font-semibold text-muted-foreground">
            All {count} material{count === 1 ? "" : "s"} follow the new name.
          </p>
          <Row busy={busy} disabled={!draft.trim()} onCancel={() => setMode(null)} onSave={rename} />
        </Pop>
      )}

      {mode === "merge" && (
        <Pop onClick={(e) => { e.stopPropagation(); e.preventDefault(); }} title="Merge into">
          {others.length === 0 ? (
            <p className="text-[11px] font-semibold text-muted-foreground">
              There is no other course to merge into yet.
            </p>
          ) : (
            <>
              <select
                autoFocus
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="w-full rounded-lg border-2 border-border bg-surface-2 px-2.5 py-1.5 text-xs font-semibold outline-none focus:border-primary"
              >
                {others.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <p className="text-[10px] font-semibold text-muted-foreground">
                Moves all {count} material{count === 1 ? "" : "s"} across, then removes this course.
              </p>
              <Row busy={busy} disabled={!target} onCancel={() => setMode(null)} onSave={merge} />
            </>
          )}
        </Pop>
      )}
    </div>
  );
}

function Item({ icon: Icon, label, onClick, tone }: { icon: any; label: string; onClick: () => void; tone?: "destructive" }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-extrabold transition hover:bg-surface-2 ${
        tone === "destructive" ? "text-destructive" : ""
      }`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" /> {label}
    </button>
  );
}

function Pop({ title, children, onClick }: { title: string; children: React.ReactNode; onClick: (e: any) => void }) {
  return (
    <div
      onClick={onClick}
      className="absolute right-0 top-full z-30 mt-1.5 w-60 space-y-2 rounded-xl border-2 border-border bg-card p-2.5 text-left shadow-lg"
    >
      <div className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}

function Row({ busy, disabled, onCancel, onSave }: { busy: boolean; disabled: boolean; onCancel: () => void; onSave: () => void }) {
  return (
    <div className="flex justify-end gap-1.5">
      <button onClick={onCancel} aria-label="Cancel" className="rounded-lg border-2 border-border p-1.5 transition hover:bg-surface-2">
        <X className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={onSave}
        disabled={busy || disabled}
        aria-label="Save"
        className="btn-3d rounded-lg bg-primary p-1.5 text-primary-foreground disabled:opacity-50"
      >
        <Check className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
