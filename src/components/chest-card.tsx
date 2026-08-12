import { useState } from "react";
import { reportError } from "@/lib/report-error";
import { motion, AnimatePresence } from "framer-motion";
import { Gift, Sparkles, Gem } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Sounds as sounds } from "@/lib/sounds";
import { toast } from "@/lib/notify";
import { useQueryClient } from "@tanstack/react-query";
import confetti from "canvas-confetti";
import { CHEST_ODDS, crestById } from "@/lib/collectibles";

// The gradients below deliberately use literal palette values: a chest is a
// physical object and bronze/silver/gold read as metals, not as theme states.
type Tier = "bronze" | "silver" | "gold";
const TIER_REWARDS: Record<Tier, { xp: [number, number]; gems: [number, number]; color: string }> = {
  bronze: { xp: [10, 25], gems: [5, 15], color: "from-amber-700 to-primary" },
  silver: { xp: [25, 60], gems: [15, 35], color: "from-slate-400 to-slate-200" },
  gold: { xp: [60, 150], gems: [35, 80], color: "from-primary to-yellow-200" },
};

function roll([min, max]: [number, number]) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

export function ChestCard({ userId, tier = "bronze", unlocked }: { userId?: string; tier?: Tier; unlocked: boolean }) {
  const [opening, setOpening] = useState(false);
  const [reward, setReward] = useState<{ xp: number; gems: number; crest?: string | null } | null>(null);
  const qc = useQueryClient();
  const odds = CHEST_ODDS[tier];

  async function openChest() {
    if (!userId || !unlocked || opening) return;
    setOpening(true);
    const { data, error } = await supabase.rpc("open_chest", { _tier: tier });
    if (error) {
      setOpening(false);
      toast.error(reportError("chest-card", error));
      return;
    }
    const row: any = Array.isArray(data) ? data[0] : data;
    const xp = row?.reward_xp ?? 0;
    const gems = row?.reward_gems ?? 0;
    const crestId: string | null = row?.reward_crest ?? null;
    sounds.levelUp?.();
    setReward({ xp, gems, crest: crestId });

    if (crestId) {
      // The rare outcome has to feel different from the common one, or the
      // published odds are just a number nobody ever sees pay off.
      const crest = crestById(crestId);
      confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 } });
      toast.success(`${crest?.emoji ?? "✨"} RARE — ${crest?.name ?? "Curio"} found!`);
      qc.invalidateQueries({ queryKey: ["collectibles"] });
    } else {
      toast.success(`Chest opened! +${xp} XP · +${gems} gems`);
    }
  }

  const conf = TIER_REWARDS[tier];

  return (
    <div className="card-chunky bg-card p-5 text-center">
      <div className="flex items-center justify-center gap-2 text-xs font-extrabold uppercase tracking-wide text-muted-foreground mb-3">
        <Gift className="h-3.5 w-3.5" /> {tier.charAt(0).toUpperCase() + tier.slice(1)} chest
      </div>

      <AnimatePresence mode="wait">
        {reward ? (
          <motion.div
            key="reward"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="py-4"
          >
            <div className="flex justify-center gap-4 text-2xl font-extrabold font-display">
              <span className="flex items-center gap-1 text-primary">
                <Sparkles className="h-5 w-5" /> {reward.xp}
              </span>
              <span className="flex items-center gap-1 text-sky">
                <Gem className="h-5 w-5" /> {reward.gems}
              </span>
            </div>
            {reward.crest && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border-2 border-grape bg-grape/15 px-3 py-1 text-xs font-extrabold text-grape">
                {crestById(reward.crest)?.emoji} {crestById(reward.crest)?.name} — rare find
              </div>
            )}
            <p className="mt-2 text-xs font-semibold text-muted-foreground">Come back tomorrow for more!</p>
          </motion.div>
        ) : (
          <motion.button
            key="chest"
            disabled={!unlocked || opening}
            onClick={openChest}
            whileHover={unlocked ? { scale: 1.05, rotate: [-2, 2, -2, 0] } : {}}
            whileTap={unlocked ? { scale: 0.95 } : {}}
            className={`mx-auto block rounded-2xl bg-gradient-to-br ${conf.color} p-6 shadow-lg transition ${
              !unlocked ? "opacity-40 grayscale cursor-not-allowed" : "cursor-pointer"
            }`}
          >
            <Gift className="h-12 w-12 text-white drop-shadow-lg" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* The possibility space, stated before you open it. A hidden range is
          just noise — 40 gems means nothing if you never learn whether that
          was lucky. Knowing what COULD be in there is what turns a random
          number into anticipation, and printing the rare odds is the
          difference between a surprise and a slot machine. */}
      {!reward && odds && (
        <dl className="mt-3 space-y-1 rounded-xl border-2 border-border bg-surface-2 px-3 py-2 text-left text-[11px] font-bold">
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">XP</dt>
            <dd className="tabular-nums">{odds.xp[0]}–{odds.xp[1]}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Gems</dt>
            <dd className="tabular-nums">{odds.gems[0]}–{odds.gems[1]}</dd>
          </div>
          <div className="flex items-center justify-between text-grape">
            <dt>Rare curio</dt>
            <dd className="tabular-nums">{Math.round(odds.crest * 100)}%</dd>
          </div>
        </dl>
      )}

      {!unlocked && !reward && (
        <p className="mt-3 text-xs font-semibold text-muted-foreground">
          Complete all daily quests to unlock
        </p>
      )}
    </div>
  );
}
