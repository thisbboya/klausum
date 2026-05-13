import { CompanionSVG, getCompanion } from "@/components/companion-svg";

function pickMessage({
  hour,
  streak,
  due,
  hasGap,
}: {
  hour: number;
  streak: number;
  due: number;
  hasGap: boolean;
}) {
  if (streak > 0) return `Day ${streak} streak — you're unstoppable! 🔥`;
  if (due > 10) return `You have ${due} cards waiting for review — let's go!`;
  if (hasGap) return `Let's close that gap today. You've got this.`;
  if (hour >= 5 && hour < 12) return "Good morning! Ready to crush it today?";
  if (hour >= 12 && hour < 18) return "Still going strong! Keep the momentum.";
  if (hour >= 18 && hour < 24) return "Evening session — legends study at night. 🌙";
  return "Your companion is ready. Let's learn.";
}

export function CompanionHero({
  companionId,
  companionName,
  streak,
  due,
  hasGap,
}: {
  companionId?: number | null;
  companionName?: string | null;
  streak?: number | null;
  due?: number | null;
  hasGap?: boolean;
}) {
  const c = getCompanion(companionId ?? 1);
  const msg = pickMessage({
    hour: new Date().getHours(),
    streak: streak ?? 0,
    due: due ?? 0,
    hasGap: !!hasGap,
  });
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
      <div className="flex-1 min-w-0">
        <div className="relative inline-block bg-background border border-border rounded-2xl rounded-bl-sm px-3 py-2 text-sm text-foreground shadow-sm">
          {msg}
        </div>
      </div>
      <div className="flex flex-col items-center shrink-0">
        <CompanionSVG id={c.id} size={70} />
        <span className="mt-1 text-[10px] font-bold tracking-wide text-primary">{companionName ?? c.name}</span>
      </div>
    </div>
  );
}
