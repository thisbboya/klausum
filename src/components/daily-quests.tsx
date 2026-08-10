import { useEffect, useState } from "react";
import { Gem, Sparkles, Target, Check } from "lucide-react";
import { ensureTodayQuests, claimQuest, type Quest } from "@/lib/quests";
import { Sounds as sounds } from "@/lib/sounds";
import { toast } from "@/lib/notify";

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
    toast.success(`+${result.xp} XP · +${result.gems} gems`);
    setQuests((prev) => prev.map((x) => (x.id === q.id ? { ...x, claimed: true } : x)));
  }

  if (loading) {
    return <div className="card-chunky h-40 bg-card animate-pulse" />;
  }

  const completedCount = quests.filter((q) => q.claimed).length;
  const allClaimed = completedCount === quests.length && quests.length > 0;

  return (
    <div className="card-chunky bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
          <Target className="h-3.5 w-3.5" /> Daily quests
        </div>
        <span className="text-xs font-extrabold text-primary">
          {completedCount}/{quests.length}
        </span>
      </div>
      <ul className="space-y-2">
        {quests.map((q) => {
          const pct = Math.round((q.progress / q.target) * 100);
          return (
            <li key={q.id} className="rounded-xl border-2 border-border bg-background p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="text-sm font-extrabold">{q.title}</div>
                {q.claimed ? (
                  <span className="flex items-center gap-1 text-xs font-extrabold text-success">
                    <Check className="h-3 w-3" /> claimed
                  </span>
                ) : q.completed ? (
                  <button
                    onClick={() => handleClaim(q)}
                    className="btn-3d btn-3d-success rounded-xl bg-success px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-success-foreground"
                  >
                    Claim
                  </button>
                ) : (
                  <span className="text-xs font-bold text-muted-foreground">
                    {q.progress}/{q.target}
                  </span>
                )}
              </div>
              <div className="h-2.5 rounded-full bg-surface-3 overflow-hidden">
                <div
                  className={`h-full transition-all ${q.completed || q.claimed ? "bg-success" : "bg-primary"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="mt-2 flex items-center gap-3 text-[11px] font-bold text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-primary" /> +{q.reward_xp} XP
                </span>
                <span className="flex items-center gap-1">
                  <Gem className="h-3 w-3 text-sky" /> +{q.reward_gems}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      {allClaimed && (
        <p className="mt-3 text-center text-xs font-extrabold text-success">
          All quests claimed — see you tomorrow!
        </p>
      )}
    </div>
  );
}
