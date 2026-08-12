// The first-run walkthrough.
//
// Klausum's onboarding was a single dismissible card that said "upload
// something" and then left you in a sidebar with eighteen destinations. The
// result is the state most accounts are in: one material, nothing else touched,
// because nobody explains what Review or the Lab are for.
//
// This is the CourieX-style version — a spotlight that dims the app, points at
// one thing, and will not let you click past it. Deliberately blocking: an
// overlay you can click through is a tooltip, and tooltips get dismissed
// without being read. It is also short. Six steps is a tour; twenty is a
// hostage situation, and the fastest way to make someone hate an app on the
// first morning.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, X } from "lucide-react";

export type TourStep = {
  /** CSS selector for the element to spotlight. Missing ones are skipped. */
  target: string;
  title: string;
  body: string;
};

const SEEN_KEY = "klausum:tourDone";

export function hasSeenTour() {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return true; // storage blocked: never nag
  }
}

export function GuidedTour({
  steps,
  onDone,
  /** Whether finishing writes the global "seen the tour" flag. Per-page tours
      keep their own record, so they opt out of the shared one. */
  persist = true,
}: {
  steps: TourStep[];
  onDone?: () => void;
  persist?: boolean;
}) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [ready, setReady] = useState(false);
  const rafRef = useRef(0);

  // Keep only steps whose target is actually VISIBLE, not merely present.
  // Both navs are in the DOM at once — the sidebar is `hidden md:flex` and the
  // thumb row is `md:hidden` — so an existence check would happily spotlight a
  // display:none element and draw a ring of zero size in the corner.
  const live = steps.filter((s) => {
    const el = document.querySelector(s.target) as HTMLElement | null;
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
  const step = live[i];

  useLayoutEffect(() => {
    if (!step) return;
    const measure = () => {
      const el = document.querySelector(step.target);
      if (!el) return;
      const r = el.getBoundingClientRect();
      setRect(r);
      setReady(true);
    };
    // Scroll the target into view first, then measure on the next frames while
    // the smooth scroll settles — measuring once lands the ring in the wrong
    // place on any page that had to move.
    document.querySelector(step.target)?.scrollIntoView({ behavior: "smooth", block: "center" });
    let n = 0;
    const tick = () => {
      measure();
      if (n++ < 40) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", measure);
    };
  }, [step]);

  // The page must not scroll underneath a blocking overlay.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  function finish() {
    if (persist) {
      try {
        localStorage.setItem(SEEN_KEY, "1");
      } catch {
        /* nothing to remember it with; the tour simply runs again */
      }
    }
    onDone?.();
  }

  if (!step || !ready || !rect) return null;

  const pad = 8;
  const box = {
    top: Math.max(4, rect.top - pad),
    left: Math.max(4, rect.left - pad),
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  };
  // Put the card under the target unless that would fall off the bottom.
  const below = box.top + box.height + 190 < window.innerHeight;

  return createPortal(
    <div className="fixed inset-0 z-[100]">
      {/* Four panels rather than one box-shadow: this leaves a genuine hole,
          so the spotlighted element keeps its real colours instead of being
          dimmed along with everything else. */}
      <div className="absolute inset-x-0 top-0 bg-sky-950/70" style={{ height: box.top }} />
      <div
        className="absolute left-0 bg-sky-950/70"
        style={{ top: box.top, height: box.height, width: box.left }}
      />
      <div
        className="absolute right-0 bg-sky-950/70"
        style={{ top: box.top, height: box.height, left: box.left + box.width }}
      />
      <div
        className="absolute inset-x-0 bottom-0 bg-sky-950/70"
        style={{ top: box.top + box.height }}
      />

      {/* The ring around the hole */}
      <div
        className="pointer-events-none absolute rounded-2xl border-[3px] border-sky ring-4 ring-sky/30"
        style={box}
      />

      <div
        className="absolute w-[min(340px,calc(100vw-24px))] rounded-2xl border-2 border-sky bg-card p-4 shadow-2xl"
        style={{
          top: below ? box.top + box.height + 12 : undefined,
          bottom: below ? undefined : window.innerHeight - box.top + 12,
          left: Math.min(Math.max(12, box.left), window.innerWidth - 352),
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="rounded-full bg-sky/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-sky">
            {i + 1} of {live.length}
          </span>
          <button
            onClick={finish}
            aria-label="Skip the tour"
            className="text-muted-foreground transition hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <h3 className="mt-2 font-display text-base font-extrabold">{step.title}</h3>
        <p className="mt-1 text-sm font-semibold leading-relaxed text-muted-foreground">{step.body}</p>
        <button
          onClick={() => (i + 1 >= live.length ? finish() : setI(i + 1))}
          className="btn-3d mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-sky px-4 py-2.5 text-sm font-extrabold uppercase tracking-wide text-sky-foreground"
        >
          {i + 1 >= live.length ? "Start studying" : "Next"} <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>,
    document.body,
  );
}
