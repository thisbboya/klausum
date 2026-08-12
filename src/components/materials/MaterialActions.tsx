// Rename, move and delete for a single material.
//
// Deleting was the only thing you could do to a material, which made a
// mis-typed title or a document filed under the wrong course permanent — the
// only fix was to delete it and upload the file again, losing its flashcards,
// highlights and reading progress with it. Renaming and moving are the two
// edits people actually need, and neither touches the extracted content.
import { useEffect, useRef, useState } from "react";
import { MoreVertical, Pencil, FolderInput, Trash2, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/lib/notify";
import { reportError } from "@/lib/report-error";

type Mode = null | "menu" | "rename" | "move";

export function MaterialActions({
  material,
  courses,
  onChanged,
}: {
  material: { id: string; title: string; subject: string | null };
  /** Course names available to move into. */
  courses: string[];
  onChanged: () => void;
}) {
  const [mode, setMode] = useState<Mode>(null);
  const [title, setTitle] = useState(material.title);
  const [subject, setSubject] = useState(material.subject ?? "General");
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on an outside click, so the menu never strands itself open over a
  // grid where every card has one of these.
  useEffect(() => {
    if (!mode) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setMode(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [mode]);

  // Narrowed to the two columns this component is allowed to touch. A generic
  // Record<string,string> would have let a future edit here rewrite extracted
  // content or processing status by typo, and the generated row type refuses it
  // anyway.
  async function save(patch: { title?: string; subject?: string }, done: string) {
    setBusy(true);
    const { error } = await supabase.from("study_materials").update(patch).eq("id", material.id);
    setBusy(false);
    if (error) {
      toast.error(reportError("material-actions", error));
      return;
    }
    toast.success(done);
    setMode(null);
    onChanged();
  }

  async function remove() {
    if (!confirm(`Delete "${material.title}"? Its flashcards and notes go too.`)) return;
    setBusy(true);
    const { error } = await supabase.from("study_materials").delete().eq("id", material.id);
    setBusy(false);
    if (error) toast.error(reportError("material-actions", error));
    else {
      toast.success("Material deleted");
      setMode(null);
      onChanged();
    }
  }

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        onClick={() => setMode(mode ? null : "menu")}
        aria-label="Material options"
        className="rounded-xl border-2 border-border p-2 text-muted-foreground transition hover:border-primary hover:text-primary active:scale-95"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {mode === "menu" && (
        <div className="absolute bottom-full right-0 z-30 mb-1.5 w-44 overflow-hidden rounded-xl border-2 border-border bg-card shadow-lg">
          <MenuItem icon={Pencil} label="Rename" onClick={() => { setTitle(material.title); setMode("rename"); }} />
          <MenuItem icon={FolderInput} label="Move to course" onClick={() => { setSubject(material.subject ?? "General"); setMode("move"); }} />
          <MenuItem icon={Trash2} label="Delete" tone="destructive" onClick={remove} />
        </div>
      )}

      {mode === "rename" && (
        <Popover title="Rename">
          <input
            autoFocus
            value={title}
            maxLength={140}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && title.trim()) void save({ title: title.trim() }, "Renamed");
              if (e.key === "Escape") setMode(null);
            }}
            className="w-full rounded-lg border-2 border-border bg-surface-2 px-2.5 py-1.5 text-xs font-semibold outline-none focus:border-primary"
          />
          <Actions
            busy={busy}
            disabled={!title.trim()}
            onCancel={() => setMode(null)}
            onSave={() => void save({ title: title.trim() }, "Renamed")}
          />
        </Popover>
      )}

      {mode === "move" && (
        <Popover title="Move to course">
          <select
            autoFocus
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full rounded-lg border-2 border-border bg-surface-2 px-2.5 py-1.5 text-xs font-semibold outline-none focus:border-primary"
          >
            {/* "General" always exists as the fallback bucket, even when the
                student has never created a course. */}
            {Array.from(new Set(["General", ...courses, material.subject ?? "General"])).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <Actions
            busy={busy}
            disabled={subject === (material.subject ?? "General")}
            onCancel={() => setMode(null)}
            onSave={() => void save({ subject }, `Moved to ${subject}`)}
          />
        </Popover>
      )}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  tone,
}: {
  icon: any;
  label: string;
  onClick: () => void;
  tone?: "destructive";
}) {
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

function Popover({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="absolute bottom-full right-0 z-30 mb-1.5 w-60 space-y-2 rounded-xl border-2 border-border bg-card p-2.5 shadow-lg">
      <div className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      {children}
    </div>
  );
}

function Actions({
  busy,
  disabled,
  onCancel,
  onSave,
}: {
  busy: boolean;
  disabled: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="flex justify-end gap-1.5">
      <button
        onClick={onCancel}
        className="rounded-lg border-2 border-border p-1.5 transition hover:bg-surface-2"
        aria-label="Cancel"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={onSave}
        disabled={busy || disabled}
        className="btn-3d rounded-lg bg-primary p-1.5 text-primary-foreground disabled:opacity-50"
        aria-label="Save"
      >
        <Check className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
