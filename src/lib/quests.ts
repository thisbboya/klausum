import { supabase } from "@/integrations/supabase/client";

export type Quest = {
  id: string;
  key: string;
  title: string;
  target: number;
  progress: number;
  reward_xp: number;
  reward_gems: number;
  completed: boolean;
  claimed: boolean;
};

const TEMPLATES = [
  { key: "earn_xp_30", title: "Earn 30 XP", target: 30, reward_xp: 10, reward_gems: 5 },
  { key: "review_10", title: "Review 10 cards", target: 10, reward_xp: 15, reward_gems: 5 },
  { key: "study_15m", title: "Study for 15 minutes", target: 15, reward_xp: 20, reward_gems: 10 },
];

export async function ensureTodayQuests(userId: string): Promise<Quest[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data: existing } = await supabase
    .from("daily_quests")
    .select("*")
    .eq("user_id", userId)
    .eq("quest_date", today);

  if (existing && existing.length > 0) return existing as Quest[];

  const rows = TEMPLATES.map((t) => ({ user_id: userId, quest_date: today, ...t }));
  const { data } = await supabase.from("daily_quests").insert(rows).select("*");
  return (data ?? []) as Quest[];
}

export async function bumpQuestProgress(userId: string, key: string, delta = 1) {
  const today = new Date().toISOString().slice(0, 10);
  const { data: q } = await supabase
    .from("daily_quests")
    .select("*")
    .eq("user_id", userId)
    .eq("quest_date", today)
    .eq("key", key)
    .maybeSingle();
  if (!q || q.claimed) return;
  const next = Math.min(q.target, (q.progress ?? 0) + delta);
  await supabase
    .from("daily_quests")
    .update({ progress: next, completed: next >= q.target })
    .eq("id", q.id);
}

export async function claimQuest(quest: Quest) {
  if (!quest.completed || quest.claimed) return null;
  await supabase.rpc("grant_rewards", { _xp: quest.reward_xp, _gems: quest.reward_gems });
  await supabase.from("daily_quests").update({ claimed: true }).eq("id", quest.id);
  return { xp: quest.reward_xp, gems: quest.reward_gems };
}
