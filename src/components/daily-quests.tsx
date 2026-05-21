import { useEffect, useState } from "react";
import { Gem, Sparkles, Target, Check } from "lucide-react";
import { ensureTodayQuests, claimQuest, type Quest } from "@/lib/quests";
import { Sounds as sounds } from "@/lib/sounds";
import { toast } from "sonner";

export function DailyQuests({ userId }: { userId?: string }) {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    ensureTodayQuests(userId).then((q) => {
      setQuests(q);
      setLoading(false);
    });
  }, [userId]);

  async function handleClaim(q: Quest) {
    const result = await claimQuest(q);
    if (!result) return;
    sounds.questComplete?.();
    toast.success(`+${result.xp} XP · +${result.gems} 💎`);
    setQuests((prev) => prev.map((x) => (x.id === q.id ? { ...x, claimed: true } : x)));
  }

  if (loading) {
    return <div className="h-40 rounded-xl border border-border bg-card animate-pulse" />;
  }

  const completedCount = quests.filter((q) => q.claimed).length;
  const allClaimed = completedCount === quests.length && quests.length > 0;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Target className="h-3.5 w-3.5" /> Daily quests
        </div>
        <span className="text-xs font-medium text-primary">
          {completedCount}/{quests.length}
        </span>
      </div>
      <ul className="space-y-2">
        {quests.map((q) => {
          const pct = Math.round((q.progress / q.target) * 100);
          return (
            <li key={q.id} className="rounded-lg border border-border bg-background p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="text-sm font-medium">{q.title}</div>
                {q.claimed ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-500">
                    <Check className="h-3 w-3" /> claimed
                  </span>
                ) : q.completed ? (
                  <button
                    onClick={() => handleClaim(q)}
                    className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:opacity-90"
                  >
                    Claim
                  </button>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {q.progress}/{q.target}
                  </span>
                )}
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-amber-400 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-amber-400" /> +{q.reward_xp} XP
                </span>
                <span className="flex items-center gap-1">
                  <Gem className="h-3 w-3 text-cyan-400" /> +{q.reward_gems}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      {allClaimed && (
        <p className="mt-3 text-center text-xs text-emerald-500 font-medium">
          ✨ All quests claimed — see you tomorrow!
        </p>
      )}
    </div>
  );
}
