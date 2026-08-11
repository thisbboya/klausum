import { useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CompanionSVG, getCompanion } from "@/components/companion-svg";
import { X, Sparkles, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { isDue } from "@/lib/fsrs";
import { coachFor, type CoachStats } from "@/lib/companion-coach";

export function FloatingCompanion({
  companionId,
  companionName,
}: {
  companionId?: number | null;
  companionName?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const location = useLocation();
  const c = getCompanion(companionId ?? 1);
  const name = companionName ?? c.name;

  // Everything the nudge needs, in one round trip, and only once the student
  // actually opens the bubble — a coach that costs six queries on every page
  // load is not worth what it says.
  const { data: stats } = useQuery({
    queryKey: ["coach-stats", user?.id],
    enabled: !!user && open,
    staleTime: 60_000,
    queryFn: async (): Promise<CoachStats> => {
      const today = new Date().toISOString().slice(0, 10);
      const [cards, gaps, quests, profile, materials] = await Promise.all([
        supabase.from("flashcards").select("next_review_date").eq("user_id", user!.id).limit(200),
        supabase.from("knowledge_gaps").select("status").eq("user_id", user!.id),
        supabase.from("daily_quests").select("completed, claimed").eq("user_id", user!.id).eq("quest_date", today),
        supabase.from("user_profiles").select("streak_days, last_study_date, calling_text").eq("id", user!.id).maybeSingle(),
        supabase.from("study_materials").select("processing_status").eq("user_id", user!.id),
      ]);
      const mats = materials.data ?? [];
      return {
        dueCards: (cards.data ?? []).filter((c) => c.next_review_date && isDue(c.next_review_date)).length,
        openGaps: (gaps.data ?? []).filter((g: any) => g.status !== "resolved").length,
        unclaimedQuests: (quests.data ?? []).filter((q: any) => q.completed && !q.claimed).length,
        streak: (profile.data as any)?.streak_days ?? 0,
        studiedToday: (profile.data as any)?.last_study_date === today,
        materialCount: mats.length,
        processingCount: mats.filter((m: any) => m.processing_status && m.processing_status !== "ready" && m.processing_status !== "failed").length,
        hasCalling: !!(profile.data as any)?.calling_text,
      };
    },
  });

  const nudge = stats ? coachFor(location.pathname, stats) : null;

  return (
    <div className="fixed bottom-4 right-4 z-40 hidden sm:block">
      {open && (
        <div className="mb-2 w-72 card-chunky bg-card p-3 shadow-lg animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 text-sm font-extrabold">
              {name}
              {nudge?.urgent && (
                <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-primary">
                  Now
                </span>
              )}
            </div>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="mt-1 text-xs font-semibold leading-relaxed text-muted-foreground">
            {nudge ? nudge.text : "Let me see where you're at…"}
          </p>

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {nudge?.action && (
              <Link
                to={nudge.action.to}
                onClick={() => setOpen(false)}
                className="btn-3d inline-flex items-center gap-1 rounded-xl bg-primary px-2.5 py-1 text-[11px] font-extrabold text-primary-foreground"
              >
                {nudge.action.label} <ArrowRight className="h-3 w-3" />
              </Link>
            )}
            <Link
              to="/companion-select"
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-1 rounded-xl border-2 border-border px-2.5 py-1 text-[11px] font-extrabold transition hover:border-primary hover:text-primary"
            >
              <Sparkles className="h-3 w-3" /> Change
            </Link>
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`Talk to ${name}`}
        className="rounded-full border-2 p-2 transition hover:-translate-y-0.5"
        style={{
          borderColor: `color-mix(in srgb, ${c.color} 45%, transparent)`,
          backgroundColor: `color-mix(in srgb, ${c.color} 12%, var(--card))`,
          boxShadow: `0 4px 0 0 color-mix(in srgb, ${c.color} 35%, transparent)`,
        }}
      >
        <CompanionSVG id={c.id} size={48} />
      </button>
    </div>
  );
}
