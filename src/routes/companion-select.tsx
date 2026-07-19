import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { COMPANIONS, CompanionSVG } from "@/components/companion-svg";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { KlausumLogo } from "@/components/klausum-mark";

export const Route = createFileRoute("/companion-select")({
  component: CompanionSelect,
});

function CompanionSelect() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  async function save() {
    if (!selected || !user) return;
    setSaving(true);
    const c = COMPANIONS.find((x) => x.id === selected)!;
    const { error } = await supabase
      .from("user_profiles")
      .update({ companion_id: c.id, companion_name: c.name })
      .eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`${c.name} is now your companion!`);
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="px-6 py-4 flex items-center gap-2 text-primary">
        <KlausumLogo size={22} />
      </header>
      <div className="mx-auto w-full max-w-5xl px-4 pb-32 flex-1">
        <div className="text-center mb-10">
          <h1 className="font-display text-3xl md:text-4xl font-bold">Choose your study companion</h1>
          <p className="mt-2 text-sm text-muted-foreground">They'll be with you every step of the way.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-4">
          {COMPANIONS.map((c) => {
            const active = selected === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setSelected(c.id)}
                className={`relative rounded-xl p-4 transition flex flex-col items-center gap-2 bg-card ${
                  active ? "border-2 border-primary shadow-lg" : "border border-border hover:border-primary/40"
                }`}
              >
                {active && (
                  <div className="absolute top-2 right-2 h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                    <Check className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
                <CompanionSVG id={c.id} size={70} />
                <div className="font-display font-bold text-sm tracking-wide">{c.name}</div>
                <span
                  className="text-[10px] font-extrabold uppercase rounded-full px-2 py-0.5"
                  style={{ color: c.color, backgroundColor: `color-mix(in srgb, ${c.color} 16%, transparent)` }}
                >
                  {c.trait}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/95 backdrop-blur p-4">
        <div className="mx-auto max-w-2xl">
          <button
            disabled={!selected || saving}
            onClick={save}
            className="w-full btn-3d rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40"
          >
            {saving ? "Saving…" : selected ? `Continue with ${COMPANIONS.find((c) => c.id === selected)?.name} →` : "Pick a companion"}
          </button>
        </div>
      </div>
    </div>
  );
}
