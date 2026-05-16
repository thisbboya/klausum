import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { CompanionSVG, getCompanion } from "@/components/companion-svg";
import { X, Sparkles } from "lucide-react";

export function FloatingCompanion({
  companionId,
  companionName,
}: {
  companionId?: number | null;
  companionName?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const c = getCompanion(companionId ?? 1);
  const name = companionName ?? c.name;

  return (
    <div className="fixed bottom-4 right-4 z-40 hidden sm:block">
      {open && (
        <div className="mb-2 w-64 rounded-xl border border-border bg-card p-3 shadow-lg animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-start justify-between gap-2">
            <div className="text-sm font-semibold">{name}</div>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            I'm here whenever you need a nudge. Tap below to change me.
          </p>
          <Link
            to="/companion-select"
            onClick={() => setOpen(false)}
            className="mt-2 inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] font-semibold text-primary-foreground"
          >
            <Sparkles className="h-3 w-3" /> Change companion
          </Link>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`Talk to ${name}`}
        className="rounded-full bg-card border border-border p-2 shadow-md hover:shadow-lg transition"
      >
        <CompanionSVG id={c.id} size={48} />
      </button>
    </div>
  );
}
