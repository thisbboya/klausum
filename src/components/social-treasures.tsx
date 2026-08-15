// Core Drive 5 — the cooperative half.
//
// A leaderboard is the competitive half of social influence and the easy half
// to build. On its own it is a wall of strangers you are losing to. What was
// missing is any way for one student to do something FOR another.
//
// A treasure costs the sender nothing and is worth more to the receiver than
// to the giver (25 XP against 10). That asymmetry is deliberate: a gift paid
// for out of your own balance creates hoarding and guilt, which is the
// black-hat shape of the same mechanic, whereas a free daily gift that is
// worth more to them than to you is simply a reason to think about someone
// else once a day.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Gift, HeartHandshake, Check } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/lib/notify";
import { reportError } from "@/lib/report-error";
import { Sounds } from "@/lib/sounds";

export function useTreasures() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["treasures", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [inbox, sent] = await Promise.all([
        supabase
          .from("social_treasures")
          .select("id, sender_id")
          .eq("receiver_id", user!.id)
          .eq("claimed", false),
        supabase
          .from("social_treasures")
          .select("receiver_id")
          .eq("sender_id", user!.id)
          .eq("sent_on", today),
      ]);
      return {
        waiting: inbox.data ?? [],
        sentToday: new Set((sent.data ?? []).map((r: any) => r.receiver_id as string)),
      };
    },
  });
}

/** The claim banner — only rendered when something is actually waiting. */
export function TreasureInbox() {
  const qc = useQueryClient();
  const { data } = useTreasures();
  const [claiming, setClaiming] = useState(false);
  const waiting = data?.waiting.length ?? 0;
  if (waiting === 0) return null;

  async function claim() {
    setClaiming(true);
    try {
      const { data: res, error } = await supabase.rpc("claim_treasures");
      if (error) throw error;
      const r = res as any;
      Sounds.chest?.();
      toast.success(`${r.count} gift${r.count === 1 ? "" : "s"} from friends — +${r.xp} XP`);
      qc.invalidateQueries({ queryKey: ["treasures"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["dash"] });
    } catch (e) {
      toast.error(reportError("treasure-claim", e));
    } finally {
      setClaiming(false);
    }
  }

  return (
    <div className="mb-4 flex items-center gap-3 rounded-2xl border-2 border-success bg-success/10 px-4 py-3">
      <Gift className="h-5 w-5 shrink-0 text-success" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-extrabold">
          {waiting} gift{waiting === 1 ? "" : "s"} waiting
        </div>
        <div className="text-xs font-semibold text-muted-foreground">
          Friends sent you a boost — {waiting * 25} XP.
        </div>
      </div>
      <button
        onClick={() => void claim()}
        disabled={claiming}
        className="btn-3d shrink-0 rounded-xl bg-success px-4 py-2 text-xs font-extrabold uppercase tracking-wide text-success-foreground disabled:opacity-50"
      >
        Claim
      </button>
    </div>
  );
}

/** The send button that sits on a friend row. */
export function SendTreasureButton({ friendId, name }: { friendId: string; name?: string }) {
  const qc = useQueryClient();
  const { data } = useTreasures();
  const [sending, setSending] = useState(false);
  const alreadySent = data?.sentToday.has(friendId) ?? false;

  async function send() {
    setSending(true);
    try {
      const { data: res, error } = await supabase.rpc("send_treasure", { _to: friendId });
      if (error) throw error;
      const r = res as any;
      if (!r?.ok) {
        // The only outcome worth explaining is the daily limit; the others
        // (not friends, self) are unreachable from this button.
        toast(r?.reason === "already_sent_today" ? "Already sent today" : "Couldn't send that");
        qc.invalidateQueries({ queryKey: ["treasures"] });
        return;
      }
      toast.success(`Boost sent to ${name ?? "your friend"} — +${r.xp} XP for you`);
      qc.invalidateQueries({ queryKey: ["treasures"] });
    } catch (e) {
      toast.error(reportError("treasure-send", e));
    } finally {
      setSending(false);
    }
  }

  if (alreadySent) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-xl border-2 border-border px-2.5 py-1 text-[11px] font-extrabold text-muted-foreground">
        <Check className="h-3 w-3" /> Sent
      </span>
    );
  }

  return (
    <button
      onClick={() => void send()}
      disabled={sending}
      data-tour-boost
      title="Send a free daily boost"
      className="inline-flex shrink-0 items-center gap-1 rounded-xl border-2 border-border px-2.5 py-1 text-[11px] font-extrabold transition hover:border-success hover:text-success disabled:opacity-50"
    >
      <HeartHandshake className="h-3 w-3" /> Boost
    </button>
  );
}
