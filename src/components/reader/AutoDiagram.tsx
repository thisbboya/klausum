// A [DIAGRAM: ...] marker, turned into an actual picture.
//
// Drawn on demand rather than when the page loads: a long reading can carry a
// dozen markers, and generating every one on open would cost a dozen model
// calls for pictures the student may scroll straight past. The button states
// what it is about to draw, so the choice is informed.
import { useState } from "react";
import { ImageIcon, Loader2, RefreshCw } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { generateDiagram } from "@/lib/diagram.functions";
import { getAccessToken } from "@/lib/auth-helper";
import { reportError } from "@/lib/report-error";
import { toast } from "@/lib/notify";
import { Diagram } from "@/components/reader/Diagram";

/** Cached per description for the life of the page, so scrolling back to a
    diagram you already drew doesn't pay for it twice. */
const cache = new Map<string, { mermaid: string; caption: string }>();

export function AutoDiagram({
  description,
  context = "",
}: {
  description: string;
  context?: string;
}) {
  const draw = useServerFn(generateDiagram);
  const [result, setResult] = useState(() => cache.get(description) ?? null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    try {
      const accessToken = await getAccessToken();
      const out = await draw({ data: { accessToken, description, context: context.slice(0, 2000) } });
      cache.set(description, out);
      setResult(out);
    } catch (e) {
      toast.error(reportError("auto-diagram", e));
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <figure className="not-prose my-4">
        <Diagram code={result.mermaid} />
        <figcaption className="mt-1.5 flex items-start justify-between gap-2 text-xs font-semibold text-muted-foreground">
          <span className="min-w-0">{result.caption || description}</span>
          <button
            onClick={() => {
              cache.delete(description);
              setResult(null);
              void run();
            }}
            title="Draw it again"
            className="shrink-0 rounded-lg p-1 transition hover:bg-surface-2 hover:text-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </figcaption>
      </figure>
    );
  }

  return (
    <button
      onClick={() => void run()}
      disabled={loading}
      className="not-prose my-4 flex w-full items-center gap-3 rounded-xl border-2 border-dashed border-border bg-surface-2/50 px-4 py-3 text-left transition hover:border-primary hover:bg-surface-2 disabled:opacity-60"
    >
      {loading ? (
        <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
      ) : (
        <ImageIcon className="h-5 w-5 shrink-0 text-primary" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-extrabold">
          {loading ? "Drawing…" : "Draw this diagram"}
        </span>
        <span className="block text-xs font-semibold text-muted-foreground">
          {description}
        </span>
      </span>
    </button>
  );
}
