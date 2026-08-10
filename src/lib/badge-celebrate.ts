import { toast } from "@/lib/notify";
import { Sounds } from "@/lib/sounds";
import { BADGES, type BadgeStats } from "@/lib/gamification";

const KEY = "klausum:badgesSeen";

/**
 * Automatic achievement unlocks: badges derive live from user history, so we
 * only need to notice which ones are newly true and throw the party once.
 */
export function celebrateNewBadges(stats: BadgeStats) {
  let seen: string[] = [];
  try { seen = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch {}
  const earned = BADGES.filter((b) => b.test(stats)).map((b) => b.id);
  const fresh = earned.filter((id) => !seen.includes(id));

  // First visit ever: mark everything already earned as seen, no spam
  if (seen.length === 0 && fresh.length > 2) {
    try { localStorage.setItem(KEY, JSON.stringify(earned)); } catch {}
    return;
  }

  fresh.forEach((id, i) => {
    const b = BADGES.find((x) => x.id === id)!;
    setTimeout(() => {
      Sounds.chest();
      toast.success(`${b.emoji} Badge unlocked — ${b.name}`, { description: b.desc, duration: 6000 });
    }, i * 1200);
  });
  if (fresh.length > 0) {
    try { localStorage.setItem(KEY, JSON.stringify([...seen, ...fresh])); } catch {}
  }
}
