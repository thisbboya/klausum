// The Collection: what the gems are actually for.
//
// Grouped into sets rather than shown as one long shelf, because "2 of 4" is a
// goal and a shelf is just inventory.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Gem, Lock, Check, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/lib/notify";
import { reportError } from "@/lib/report-error";
import { Sounds } from "@/lib/sounds";
import {
  CRESTS,
  SETS,
  crestEarned,
  setProgress,
  type Crest,
  type CrestSet,
} from "@/lib/collectibles";

/** What the student owns, and which one they are wearing. */
export function useCollection() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["collectibles", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_collectibles")
        .select("item_id, equipped")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function Collection({ stats }: { stats: Record<string, number> }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: rows = [] } = useCollection();
  const { data: gems = 0 } = useQuery({
    queryKey: ["gem-balance", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_profiles")
        .select("gems")
        .eq("id", user!.id)
        .maybeSingle();
      return data?.gems ?? 0;
    },
  });

  const owned = new Set(rows.map((r) => r.item_id));
  const equipped = rows.find((r) => r.equipped)?.item_id ?? null;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["collectibles"] });
    qc.invalidateQueries({ queryKey: ["profile"] });
    qc.invalidateQueries({ queryKey: ["gem-balance"] });
  };

  async function buy(c: Crest) {
    const { data, error } = await supabase.rpc("purchase_crest", { _crest: c.id });
    if (error) {
      toast.error(reportError("collection.buy", error));
      return;
    }
    const res = data as any;
    if (!res?.ok) {
      toast.error(
        res?.reason === "not_enough_gems"
          ? `Need ${c.gems} gems · you have ${res.balance}`
          : res?.reason === "already_owned"
            ? "You already own that one"
            : "Could not buy that",
      );
      return;
    }
    Sounds.chest();
    toast.success(`${c.emoji} ${c.name} is yours.`);
    refresh();
  }

  /** Earned crests are claimed rather than granted silently — the act of
      taking it is what makes it feel like yours. */
  async function claim(c: Crest) {
    if (!user) return;
    const { error } = await supabase
      .from("user_collectibles")
      .insert({ user_id: user.id, item_id: c.id });
    if (error) {
      toast.error(reportError("collection.claim", error));
      return;
    }
    Sounds.levelUp();
    toast.success(`${c.emoji} ${c.name} — earned, not bought.`);
    refresh();
  }

  async function equip(c: Crest) {
    const { error } = await supabase.rpc("equip_crest", { _crest: c.id });
    if (error) {
      toast.error(reportError("collection.equip", error));
      return;
    }
    refresh();
  }

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-extrabold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-grape" /> Your Collection
          </h2>
          <p className="text-sm text-muted-foreground">
            Crests are kept, not spent. Wear one and it shows up beside your name.
          </p>
        </div>
        {/* The balance belongs next to the things it buys, not on another page. */}
        <span className="inline-flex items-center gap-1.5 rounded-xl border-2 border-border bg-card px-3 py-1.5 text-sm font-extrabold">
          <Gem className="h-4 w-4 text-sky" /> {gems}
        </span>
      </header>

      {(Object.keys(SETS) as CrestSet[]).map((setId) => {
        const meta = SETS[setId];
        const prog = setProgress(setId, owned);
        return (
          <div key={setId} className="card-chunky bg-card p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h3 className="font-display text-base font-extrabold">{meta.name}</h3>
                <p className="text-xs font-semibold text-muted-foreground">{meta.blurb}</p>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold tabular-nums ${
                  prog.complete
                    ? "bg-success/15 text-success"
                    : "bg-surface-2 text-muted-foreground"
                }`}
              >
                {prog.have}/{prog.total}
                {prog.complete ? " · complete" : ""}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {CRESTS.filter((c) => c.set === setId).map((c) => {
                const have = owned.has(c.id);
                const isEquipped = equipped === c.id;
                const earnable = !have && crestEarned(c, stats);
                const buyable = !have && c.gems !== null;
                return (
                  <div
                    key={c.id}
                    className={`rounded-xl border-2 p-2.5 text-center transition ${
                      isEquipped
                        ? "border-primary bg-primary/10"
                        : have
                          ? "border-border bg-surface-2"
                          : "border-dashed border-border bg-card"
                    }`}
                  >
                    <div className={`text-3xl ${have ? "" : "opacity-25 grayscale"}`}>
                      {c.emoji}
                    </div>
                    <div className="mt-1 truncate text-xs font-extrabold">{c.name}</div>

                    {have ? (
                      <button
                        onClick={() => void equip(c)}
                        disabled={isEquipped}
                        className={`mt-1.5 w-full rounded-lg px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide transition ${
                          isEquipped
                            ? "bg-primary text-primary-foreground"
                            : "border-2 border-border hover:border-primary hover:text-primary"
                        }`}
                      >
                        {isEquipped ? (
                          <span className="inline-flex items-center gap-1">
                            <Check className="h-3 w-3" /> Worn
                          </span>
                        ) : (
                          "Wear"
                        )}
                      </button>
                    ) : earnable ? (
                      <button
                        onClick={() => void claim(c)}
                        className="btn-3d mt-1.5 w-full rounded-lg bg-success px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide text-success-foreground"
                      >
                        Claim
                      </button>
                    ) : buyable ? (
                      <button
                        onClick={() => void buy(c)}
                        className="mt-1.5 inline-flex w-full items-center justify-center gap-1 rounded-lg border-2 border-border px-2 py-1 text-[10px] font-extrabold transition hover:border-sky hover:text-sky"
                      >
                        <Gem className="h-3 w-3" /> {c.gems}
                      </button>
                    ) : (
                      // A locked crest that says what unlocks it is a goal; one
                      // that just shows a padlock is a dead square.
                      <div className="mt-1.5 flex items-center justify-center gap-1 text-[10px] font-semibold leading-tight text-muted-foreground">
                        <Lock className="h-3 w-3 shrink-0" />
                        <span className="truncate" title={c.earn?.label}>
                          {c.earn?.label}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </section>
  );
}

/** The worn crest, for anywhere the student's name appears. */
export function EquippedCrest({ className = "" }: { className?: string }) {
  const { data: rows = [] } = useCollection();
  const id = rows.find((r) => r.equipped)?.item_id;
  const crest = CRESTS.find((c) => c.id === id);
  if (!crest) return null;
  return (
    <span title={crest.name} className={className}>
      {crest.emoji}
    </span>
  );
}
