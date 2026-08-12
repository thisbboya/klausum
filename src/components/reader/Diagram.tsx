// Renders a ```mermaid fenced block as a real, drawn diagram.
//
// Why this exists: the AI could only ever answer in prose. Ask it to explain a
// process, a hierarchy, a cycle or a system and you got a numbered list —
// "lines kind of diagram". Mermaid lets the model emit a diagram *specification*
// which we draw properly: flowcharts, sequences, state machines, ER diagrams,
// mindmaps, timelines, pie and quadrant charts.
//
// Mermaid is ~500 kB, so it is imported dynamically the first time a diagram
// actually appears. A student who never asks for one never pays for it.
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Maximize2 } from "lucide-react";
import { reportError } from "@/lib/report-error";

let mermaidPromise: Promise<any> | null = null;
/** Theme the loaded instance was configured for, so a switch re-applies it. */
let themedFor: boolean | null = null;

// Mermaid's colour library cannot parse oklch(), and every token in this app is
// oklch — that is why diagrams once failed with "Unsupported color format".
// Round-tripping through a canvas makes the browser do the conversion and hands
// mermaid a plain hex string.
function toHexColor(color: string, fallback: string): string {
  try {
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) return fallback;
    ctx.fillStyle = "#000";
    ctx.fillStyle = color;
    const resolved = ctx.fillStyle as string;
    return resolved.startsWith("#") || resolved.startsWith("rgb") ? resolved : fallback;
  } catch {
    return fallback;
  }
}

const tokens = () => {
  const css = getComputedStyle(document.documentElement);
  return (name: string, fallback: string) =>
    toHexColor(css.getPropertyValue(name).trim(), fallback);
};

/**
 * Mermaid does not use these variables the way their names suggest, which is
 * how a diagram ended up as white boxes on a bright green slab with blue
 * highlighter behind every edge label: `tertiaryColor` is the *cluster
 * background*, and `secondaryColor` backs edge labels. Feeding those the brand
 * green and blue painted the chrome in accent colours instead of the nodes.
 * Backgrounds are surfaces; accents are reserved for borders and lines.
 */
function configure(mermaid: any, v: (n: string, f: string) => string) {
  const surface = v("--card", "#ffffff");
  const text = v("--foreground", "#2B3A67");
  const line = v("--muted-foreground", "#69727D");
  const border = v("--border", "#d8dce3");
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict", // never execute click handlers from model output
    theme: "base",
    fontFamily: "Lato, ui-sans-serif, system-ui, sans-serif",
    themeVariables: {
      background: "transparent",
      primaryColor: v("--surface-2", "#f1f1f1"),
      primaryTextColor: text,
      primaryBorderColor: v("--primary", "#FF8B38"),
      lineColor: line,
      // Node and cluster fills stay on the surface ramp so the diagram reads
      // as part of the page rather than a poster stuck onto it.
      secondaryColor: v("--surface-3", "#e7e9ee"),
      secondaryTextColor: text,
      secondaryBorderColor: border,
      tertiaryColor: surface,
      tertiaryTextColor: text,
      tertiaryBorderColor: border,
      clusterBkg: v("--surface-2", "#f1f1f1"),
      clusterBorder: border,
      titleColor: text,
      // Edge labels sit on the canvas, not in a highlighter box.
      edgeLabelBackground: surface,
      labelBackground: surface,
      nodeTextColor: text,
      fontSize: "15px",
    },
  });
}

/** Load once, then re-theme whenever light/dark changes. */
function loadMermaid(isDark: boolean) {
  if (!mermaidPromise) {
    mermaidPromise = import("mermaid").then((mod) => {
      const mermaid = mod.default;
      configure(mermaid, tokens());
      themedFor = isDark;
      return mermaid;
    });
  }
  // The theme was previously captured on first load and never revisited, so a
  // diagram drawn in light mode kept light-mode fills after switching to dark.
  return mermaidPromise.then((mermaid) => {
    if (themedFor !== isDark) {
      configure(mermaid, tokens());
      themedFor = isDark;
    }
    return mermaid;
  });
}

export function Diagram({ code }: { code: string }) {
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [zoom, setZoom] = useState(false);
  const idRef = useRef(`kd-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    let cancelled = false;
    const isDark = document.documentElement.classList.contains("dark");
    loadMermaid(isDark)
      .then(async (mermaid) => {
        // parse() first so a malformed diagram surfaces as a handled error
        // rather than mermaid injecting its own red error graphic into the page.
        await mermaid.parse(code);
        const { svg } = await mermaid.render(idRef.current, code);
        if (!cancelled) setSvg(svg);
      })
      .catch((e) => {
        if (import.meta.env.DEV) console.error("[Diagram] render failed", e);
        if (!cancelled) setError(e?.message ?? "Could not draw this diagram");
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  // Never show a student our failure, and never dump the source that caused
  // it — the surrounding explanation stands on its own without the visual.
  // The detail goes to the admin error log instead.
  useEffect(() => {
    if (error) reportError("diagram-block", String(code).slice(0, 800));
  }, [error, code]);

  if (error) return null;

  if (!svg) {
    return (
      <div className="not-prose my-3 h-32 animate-pulse rounded-xl border-2 border-border bg-surface-2" />
    );
  }

  return (
    <figure className="not-prose group relative my-3 overflow-hidden rounded-xl border-2 border-border bg-card">
      <button
        onClick={() => setZoom((z) => !z)}
        title={zoom ? "Fit to width" : "Zoom in"}
        className="absolute right-2 top-2 z-10 rounded-lg border-2 border-border bg-card/90 p-1.5 text-muted-foreground opacity-0 transition group-hover:opacity-100 focus:opacity-100"
      >
        <Maximize2 className="h-3.5 w-3.5" />
      </button>
      {/* overflow-x-auto so a wide flowchart scrolls inside its own box instead
          of widening the page — the same rule the rest of the app follows. */}
      <div
        className={`overflow-x-auto p-3 [&_svg]:h-auto ${
          zoom ? "[&_svg]:max-w-none" : "[&_svg]:mx-auto [&_svg]:max-w-full"
        }`}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </figure>
  );
}
