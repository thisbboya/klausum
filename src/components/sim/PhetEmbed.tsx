// A PhET simulation, loaded only when asked for.
//
// The iframe is not mounted until the student taps: each sim is roughly a
// megabyte, and rendering a grid of eighteen of them would spend twenty
// megabytes of someone's data allowance to show eighteen things they were
// only browsing.
import { useState } from "react";
import { ExternalLink, Play, X } from "lucide-react";
import { phetUrl, type PhetSim } from "@/lib/sim/phet";

export function PhetEmbed({ sim }: { sim: PhetSim }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-start gap-3 rounded-2xl border-2 border-border bg-card p-3 text-left transition hover:border-primary"
      >
        <span className="mt-0.5 rounded-xl bg-sky/15 p-2 text-sky">
          <Play className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-extrabold">{sim.title}</span>
          <span className="block text-xs font-semibold leading-snug text-muted-foreground">
            {sim.blurb}
          </span>
          {/* Said before they commit, not after. */}
          <span className="mt-1 block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            PhET · ~1 MB · explore only, no XP
          </span>
        </span>
      </button>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border-2 border-primary bg-card">
      <div className="flex items-center justify-between gap-2 border-b-2 border-border px-3 py-2">
        <span className="min-w-0 truncate text-sm font-extrabold">{sim.title}</span>
        <span className="flex shrink-0 items-center gap-1">
          <a
            href={phetUrl(sim.id)}
            target="_blank"
            rel="noopener noreferrer"
            title="Open full screen at PhET"
            className="rounded-lg border-2 border-border p-1.5 transition hover:bg-surface-2"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <button
            onClick={() => setOpen(false)}
            title="Close"
            className="rounded-lg border-2 border-border p-1.5 transition hover:bg-surface-2"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </span>
      </div>
      <iframe
        src={phetUrl(sim.id)}
        title={sim.title}
        loading="lazy"
        // Third-party code in a frame gets the narrowest sandbox that still
        // lets a canvas simulation run: scripts and same-origin for its own
        // storage, and nothing that would let it navigate us or open windows.
        sandbox="allow-scripts allow-same-origin"
        allowFullScreen
        className="block h-[460px] w-full border-0 bg-white"
      />
      <p className="border-t-2 border-border px-3 py-2 text-[11px] font-semibold text-muted-foreground">
        Simulation by PhET Interactive Simulations, University of Colorado Boulder, licensed CC-BY.
        Klausum can't score this one — missions live in the Lab.
      </p>
    </div>
  );
}
