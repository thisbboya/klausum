// Renders a ```scene block the tutor wrote, and a ```simref block naming a
// simulation we built by hand.
//
// simref exists because a hand-built model will always beat a generated one:
// when a student asks about Faraday's law, giving them the real draggable
// magnet is better than anything the model could describe in twelve lines.
// The AI's job there is recognition, not authorship.
import { useMemo } from "react";
import { AlertTriangle, FlaskConical } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { parseScene, sceneToModel } from "@/lib/sim/scene";
import { simById } from "@/lib/sim/registry";
import { SimulationPlayer } from "@/components/sim/SimulationPlayer";

export function SceneBlock({ code }: { code: string }) {
  const parsed = useMemo(() => {
    try {
      return { model: sceneToModel(parseScene(code)), error: null as string | null };
    } catch (e) {
      return { model: null, error: e instanceof Error ? e.message : "Bad scene" };
    }
  }, [code]);

  if (parsed.error || !parsed.model) {
    // A malformed diagram must not swallow the explanation around it.
    return (
      <div className="not-prose my-3 rounded-xl border-2 border-border bg-surface-2 p-3">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-extrabold text-muted-foreground">
          <AlertTriangle className="h-3.5 w-3.5" /> Diagram couldn't be built
        </div>
        <pre className="overflow-x-auto text-xs leading-relaxed">{code}</pre>
      </div>
    );
  }

  return <SimulationPlayer model={parsed.model} height={280} />;
}

export function SimRefBlock({ code }: { code: string }) {
  const id = code.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  const model = simById(id);

  if (!model) {
    return (
      <div className="not-prose my-3 rounded-xl border-2 border-border bg-surface-2 p-3 text-xs font-semibold text-muted-foreground">
        No built-in simulation called “{id}”.
      </div>
    );
  }

  return (
    <div className="not-prose my-3">
      <SimulationPlayer model={model} height={300} />
      {/* The Lab version carries the missions and the XP; this one is here to
          be played with mid-conversation. */}
      <Link
        to="/lab"
        className="mt-1.5 inline-flex items-center gap-1.5 rounded-xl border-2 border-border px-3 py-1.5 text-xs font-extrabold transition hover:border-primary hover:text-primary"
      >
        <FlaskConical className="h-3.5 w-3.5" /> Open in the Lab for missions and XP
      </Link>
    </div>
  );
}
