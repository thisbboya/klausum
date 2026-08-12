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

// Literal palette values on purpose: a chest is a physical object, and
// bronze/silver/gold read as metals rather than as theme states. Tinting these
// with the app's semantic tokens would make a gold chest change colour when
// somebody switched theme, which is not what gold does.
type Tier = "bronze" | "silver" | "gold";

const METAL: Record<Tier, { body: string; lid: string; dark: string; metal: string; spark: string }> = {
  bronze: { body: "#8A5A2B", lid: "#A9713A", dark: "#4E3117", metal: "#D8A657", spark: "#FFD98A" },
  silver: { body: "#8E97A6", lid: "#AAB3C0", dark: "#525A67", metal: "#E2E8F0", spark: "#FFFFFF" },
  gold:   { body: "#B8860B", lid: "#DAA520", dark: "#6B4E06", metal: "#FFD700", spark: "#FFF3B0" },
};

/**
 * A drawn chest, rather than a gift icon on a gradient square.
 *
 * SVG rather than an image file: it has to be tinted per tier and stay crisp
 * at any size, and shipping three PNGs to say "bronze, silver, gold" would be
 * three network requests to express one variable.
 */
function ChestArt({ tier, unlocked }: { tier: Tier; unlocked: boolean }) {
  const m = METAL[tier];
  return (
    <svg width="112" height="96" viewBox="0 0 112 96" fill="none" aria-hidden>
      {/* glow behind an available chest */}
      {unlocked && (
        <ellipse cx="56" cy="82" rx="40" ry="7" fill={m.dark} opacity="0.28" />
      )}
      {/* body */}
      <rect x="14" y="44" width="84" height="38" rx="6" fill={m.body} stroke={m.dark} strokeWidth="3" />
      {/* wood banding */}
      <rect x="14" y="56" width="84" height="5" fill={m.dark} opacity="0.45" />
      {/* lid */}
      <path
        d="M14 46 C14 28, 30 18, 56 18 C82 18, 98 28, 98 46 Z"
        fill={m.lid}
        stroke={m.dark}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* metal straps */}
      <rect x="24" y="20" width="7" height="62" fill={m.metal} opacity="0.75" />
      <rect x="81" y="20" width="7" height="62" fill={m.metal} opacity="0.75" />
      {/* lock plate */}
      <rect x="48" y="42" width="16" height="18" rx="3" fill={m.metal} stroke={m.dark} strokeWidth="2.5" />
      <circle cx="56" cy="51" r="3" fill={m.dark} />
      {/* a hint of light escaping a chest you can open */}
      {unlocked && (
        <>
          <path d="M40 44 L44 30" stroke={m.spark} strokeWidth="2.5" strokeLinecap="round" opacity="0.85" />
          <path d="M56 42 L56 26" stroke={m.spark} strokeWidth="2.5" strokeLinecap="round" opacity="0.85" />
          <path d="M72 44 L68 30" stroke={m.spark} strokeWidth="2.5" strokeLinecap="round" opacity="0.85" />
        </>
      )}
    </svg>
  );
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
            // An unlocked chest rocks on its own, the way Duolingo's does. That
            // idle motion is the whole reason a closed box reads as "open me"
            // rather than as an icon someone forgot to make interactive.
            animate={
              unlocked && !opening
                ? { rotate: [-3, 3, -3], y: [0, -2, 0] }
                : opening
                  ? { rotate: [-14, 14, -14, 14, 0], scale: [1, 1.12, 1] }
                  : {}
            }
            transition={
              opening
                ? { duration: 0.5, ease: "easeInOut" }
                : { duration: 2.2, repeat: Infinity, ease: "easeInOut" }
            }
            whileTap={unlocked ? { scale: 0.92 } : {}}
            className={`mx-auto block transition ${
              !unlocked ? "cursor-not-allowed opacity-45 grayscale" : "cursor-pointer"
            }`}
          >
            <ChestArt tier={tier} unlocked={unlocked} />
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
