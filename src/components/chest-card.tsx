import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gift, Sparkles, Gem } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { sounds } from "@/lib/sounds";
import { toast } from "sonner";

type Tier = "bronze" | "silver" | "gold";
const TIER_REWARDS: Record<Tier, { xp: [number, number]; gems: [number, number]; color: string }> = {
  bronze: { xp: [10, 25], gems: [5, 15], color: "from-amber-700 to-amber-500" },
  silver: { xp: [25, 60], gems: [15, 35], color: "from-slate-400 to-slate-200" },
  gold: { xp: [60, 150], gems: [35, 80], color: "from-amber-400 to-yellow-200" },
};

function roll([min, max]: [number, number]) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

export function ChestCard({ userId, tier = "bronze", unlocked }: { userId?: string; tier?: Tier; unlocked: boolean }) {
  const [opening, setOpening] = useState(false);
  const [reward, setReward] = useState<{ xp: number; gems: number } | null>(null);

  async function openChest() {
    if (!userId || !unlocked || opening) return;
    setOpening(true);
    const xp = roll(TIER_REWARDS[tier].xp);
    const gems = roll(TIER_REWARDS[tier].gems);
    await supabase.rpc("grant_rewards", { _xp: xp, _gems: gems });
    await supabase.from("chest_openings").insert({
      user_id: userId,
      tier,
      reward_xp: xp,
      reward_gems: gems,
    });
    sounds.levelUp?.();
    setReward({ xp, gems });
    toast.success(`Chest opened! +${xp} XP · +${gems} 💎`);
  }

  const conf = TIER_REWARDS[tier];

  return (
    <div className="rounded-xl border border-border bg-card p-5 text-center">
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mb-3">
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
            <div className="flex justify-center gap-4 text-2xl font-bold font-display">
              <span className="flex items-center gap-1 text-amber-400">
                <Sparkles className="h-5 w-5" /> {reward.xp}
              </span>
              <span className="flex items-center gap-1 text-cyan-400">
                <Gem className="h-5 w-5" /> {reward.gems}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Come back tomorrow for more!</p>
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

      {!unlocked && !reward && (
        <p className="mt-3 text-xs text-muted-foreground">
          Complete all daily quests to unlock
        </p>
      )}
    </div>
  );
}
