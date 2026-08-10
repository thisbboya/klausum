import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/lib/notify";
import { Gem, Snowflake, Zap, Lightbulb, Loader2 } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/shop")({ component: Shop });

type Item = {
  id: "streak_freeze" | "xp_boost" | "hint_pack";
  title: string;
  desc: string;
  cost: number;
  icon: any;
  accent: string;
};

const ITEMS: Item[] = [
  { id: "streak_freeze", title: "Streak Freeze", desc: "Adds +1 freeze to protect your streak on a missed day.", cost: 30, icon: Snowflake, accent: "text-sky-400" },
  { id: "hint_pack", title: "Hint Pack", desc: "5 hints you can use on hard quiz questions.", cost: 20, icon: Lightbulb, accent: "text-primary" },
  { id: "xp_boost", title: "2× XP Boost", desc: "Doubles XP for the next 30 minutes of study.", cost: 50, icon: Zap, accent: "text-fuchsia-400" },
];

function Shop() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [buying, setBuying] = useState<string | null>(null);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("user_profiles").select("gems, streak_freezes").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  async function buy(item: Item) {
    if (!user) return;
    setBuying(item.id);
    try {
      const { data, error } = await supabase.rpc("purchase_shop_item", { _item: item.id });
      if (error) throw error;
      const res = data as any;
      if (!res?.ok) {
        toast.error(res?.reason === "not_enough_gems" ? `Need ${item.cost} gems · you have ${res.balance}` : "Purchase failed");
      } else {
        toast.success(`Purchased ${item.title} · −${item.cost} gems`);
        if (item.id === "xp_boost") {
          localStorage.setItem("klausum:xpBoostUntil", String(Date.now() + 30 * 60 * 1000));
        }
        if (item.id === "hint_pack") {
          const cur = Number(localStorage.getItem("klausum:hints") || 0);
          localStorage.setItem("klausum:hints", String(cur + 5));
        }
        qc.invalidateQueries({ queryKey: ["profile"] });
      }
    } catch (e: any) {
      toast.error(e.message ?? "Purchase failed");
    } finally {
      setBuying(null);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-2">
            <Gem className="h-7 w-7 text-sky" /> Gem Shop
          </h1>
          <p className="text-sm text-muted-foreground">Spend gems earned from chests, quests, and perfect quizzes.</p>
        </div>
        <div className="card-chunky/60 bg-card/60 px-4 py-2 flex items-center gap-2 text-lg font-semibold">
          <Gem className="h-5 w-5 text-sky" /> {profile?.gems ?? 0}
        </div>
      </header>

      <div className="rounded-xl border-2 border-border/50 bg-muted/20 px-4 py-2 text-xs text-muted-foreground flex items-center gap-2">
        <Snowflake className="h-3.5 w-3.5 text-sky-400" /> You have {profile?.streak_freezes ?? 0} streak freeze{(profile?.streak_freezes ?? 0) === 1 ? "" : "s"} available.
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {ITEMS.map((it) => {
          const Icon = it.icon;
          const affordable = (profile?.gems ?? 0) >= it.cost;
          const isBuying = buying === it.id;
          return (
            <div key={it.id} className="card-chunky/60 bg-card/60 p-5 flex flex-col gap-3">
              <div className={`h-11 w-11 rounded-xl bg-background/60 border border-border/60 flex items-center justify-center ${it.accent}`}>
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold text-base">{it.title}</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{it.desc}</p>
              </div>
              <button
                onClick={() => buy(it)}
                disabled={!affordable || isBuying}
                className="mt-auto inline-flex items-center justify-center gap-1.5 btn-3d rounded-xl bg-primary text-primary-foreground text-sm font-semibold px-3 py-2 disabled:opacity-50 hover:opacity-90"
              >
                {isBuying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gem className="h-4 w-4" />}
                {it.cost}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
