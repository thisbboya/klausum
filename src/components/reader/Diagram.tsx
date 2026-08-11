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

let mermaidPromise: Promise<any> | null = null;

/** Load-and-configure once per session, themed from the app's own tokens. */
function loadMermaid(isDark: boolean) {
  if (!mermaidPromise) {
    mermaidPromise = import("mermaid").then((mod) => {
      const mermaid = mod.default;
      const css = getComputedStyle(document.documentElement);
      // Mermaid's colour library cannot parse oklch(), and every token in this
      // app is oklch — that is why diagrams failed with "Unsupported color
      // format". Round-tripping through a canvas makes the browser do the
      // conversion for us and hands mermaid a plain hex string.
      const toHex = (color: string, fallback: string): string => {
        try {
          const ctx = document.createElement("canvas").getContext("2d");
          if (!ctx) return fallback;
          ctx.fillStyle = "#000";
          ctx.fillStyle = color;
          const resolved = ctx.fillStyle as string;
          // canvas normalises to #rrggbb or rgba(...); mermaid is happy with both
          return resolved.startsWith("#") || resolved.startsWith("rgb")
            ? resolved
            : fallback;
        } catch {
          return fallback;
        }
      };
      const v = (name: string, fallback: string) =>
        toHex(css.getPropertyValue(name).trim(), fallback);
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict", // never execute click handlers from model output
        theme: "base",
        fontFamily: "Lato, ui-sans-serif, system-ui, sans-serif",
        themeVariables: {
          background: "transparent",
          primaryColor: v("--surface-2", "#f1f1f1"),
          primaryTextColor: v("--foreground", "#2B3A67"),
          primaryBorderColor: v("--primary", "#FF8B38"),
          lineColor: v("--muted-foreground", "#69727D"),
          secondaryColor: v("--sky", "#0490DC"),
          tertiaryColor: v("--success", "#008452"),
          fontSize: "15px",
        },
      });
      return mermaid;
    });
  }
  return mermaidPromise;
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

  if (error) {
    // A diagram that won't parse must not eat the explanation around it — show
    // the source so the answer is still usable.
    return (
      <div className="not-prose my-3 rounded-xl border-2 border-border bg-surface-2 p-3">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-extrabold text-muted-foreground">
          <AlertTriangle className="h-3.5 w-3.5" /> Diagram couldn't be drawn
        </div>
        <pre className="overflow-x-auto text-xs leading-relaxed">{code}</pre>
      </div>
    );
  }

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
