// Renders a ```scene block the tutor wrote, and a ```simref block naming a
// simulation we built by hand.
//
// simref exists because a hand-built model will always beat a generated one:
// when a student asks about Faraday's law, giving them the real draggable
// magnet is better than anything the model could describe in twelve lines.
// The AI's job there is recognition, not authorship.
import { useEffect, useMemo, useState } from "react";
import { Check, FlaskConical } from "lucide-react";
import { reportError } from "@/lib/report-error";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/lib/notify";
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

  // A student must never be shown our failures — and least of all the raw
  // source of the thing that failed, which is what this used to print. The
  // explanation around the diagram is still perfectly good on its own, so the
  // block simply isn't there; the detail goes to the admin error log instead.
  useEffect(() => {
    if (parsed.error) reportError("scene-block", `${parsed.error}\n---\n${code.slice(0, 800)}`);
  }, [parsed.error, code]);

  if (parsed.error || !parsed.model) return null;

  return (
    <div className="not-prose my-3">
      <SimulationPlayer model={parsed.model} height={280} />
      <SaveToLab title={parsed.model.title} code={code} />
    </div>
  );
}

/**
 * Keeps a generated simulation.
 *
 * This is the whole answer to "can students get simulations for their own
 * topics": the engine already ships, so a saved scene costs a few hundred
 * bytes of text instead of the megabytes a Python or SPICE runtime would add
 * to every page load — and unlike an embedded third-party sim, it stays inside
 * our renderer, which is the only thing that can report state to a mission.
 */
function SaveToLab({ title, code }: { title: string; code: string }) {
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!user) return null;

  async function save() {
    setBusy(true);
    const { error } = await supabase
      .from("user_scenes")
      .insert({ user_id: user!.id, title: title.slice(0, 120), code });
    setBusy(false);
    if (error) {
      toast.error(reportError("scene-save", error));
      return;
    }
    setSaved(true);
    toast.success("Saved to your Lab");
  }

  return (
    <button
      onClick={() => void save()}
      disabled={busy || saved}
      className="mt-1.5 inline-flex items-center gap-1.5 rounded-xl border-2 border-border px-3 py-1.5 text-xs font-extrabold transition hover:border-primary hover:text-primary disabled:opacity-60"
    >
      {saved ? <Check className="h-3.5 w-3.5" /> : <FlaskConical className="h-3.5 w-3.5" />}
      {saved ? "In your Lab" : "Save to my Lab"}
    </button>
  );
}

export function SimRefBlock({ code }: { code: string }) {
  const id = code.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  const model = simById(id);

  // Same rule: a wrong id is our problem, not the student's. It is logged for
  // admins and simply omitted from the answer.
  useEffect(() => {
    if (!model) reportError("simref-block", `Unknown simulation id: ${id}`);
  }, [model, id]);

  if (!model) return null;

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
