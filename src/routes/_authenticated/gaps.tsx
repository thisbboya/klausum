import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { explainGap } from "@/lib/coach.functions";
import { getAccessToken } from "@/lib/auth-helper";
import { toast } from "sonner";
import { Sparkles, CheckCircle2, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/gaps")({ component: GapsPage });

function GapsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const explain = useServerFn(explainGap);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<Record<string, string>>({});

  const { data: gaps = [] } = useQuery({
    queryKey: ["gaps", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("knowledge_gaps")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const open = gaps.filter((g: any) => g.status === "open");
  const resolved = gaps.filter((g: any) => g.status === "resolved");
  const sevColor = (s: string) =>
    s === "critical" ? "text-red-400 border-red-500/40 bg-red-500/10"
    : s === "moderate" ? "text-amber-400 border-amber-500/40 bg-amber-500/10"
    : "text-emerald-400 border-emerald-500/40 bg-emerald-500/10";

  async function ask(g: any) {
    setBusyId(g.id);
    try {
      const accessToken = await getAccessToken();
      const r = await explain({ data: { accessToken, topic: g.topic, subject: g.subject } });
      setExplanation((m) => ({ ...m, [g.id]: r.explanation }));
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setBusyId(null);
    }
  }

  async function resolve(g: any) {
    await supabase
      .from("knowledge_gaps")
      .update({ status: "resolved", resolved_at: new Date().toISOString(), confidence: 80 })
      .eq("id", g.id);
    toast.success("Gap closed");
    qc.invalidateQueries({ queryKey: ["gaps", user?.id] });
  }

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Knowledge Gaps</h1>
          <p className="text-sm text-muted-foreground">Topics your quizzes flagged as weak. Close them one by one.</p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <div><span className="text-foreground font-semibold">{open.length}</span> open</div>
          <div><span className="text-foreground font-semibold">{resolved.length}</span> closed</div>
        </div>
      </header>

      {open.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
          No open gaps. Take a quiz to surface weak spots. <Link to="/quizzes" className="text-primary underline">Quizzes →</Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {open.map((g: any) => (
            <li key={g.id} className={`rounded-xl border p-4 ${sevColor(g.severity)}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide opacity-80">
                    <AlertTriangle className="h-3.5 w-3.5" /> {g.severity} · {g.subject}
                  </div>
                  <div className="mt-1 font-medium text-foreground">{g.topic}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Confidence: {g.confidence ?? 30}%</div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => ask(g)}
                    disabled={busyId === g.id}
                    className="inline-flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 disabled:opacity-50"
                  >
                    <Sparkles className="h-3.5 w-3.5" /> {busyId === g.id ? "…" : "Explain"}
                  </button>
                  <button
                    onClick={() => resolve(g)}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/10"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Close
                  </button>
                </div>
              </div>
              {explanation[g.id] && (
                <div className="mt-3 rounded-lg border border-border/40 bg-background/40 p-3 text-sm text-foreground/90 whitespace-pre-wrap">
                  {explanation[g.id]}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {resolved.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Closed</h2>
          <ul className="space-y-1.5">
            {resolved.slice(0, 20).map((g: any) => (
              <li key={g.id} className="flex items-center gap-2 rounded-md border border-border/40 px-3 py-2 text-sm">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-muted-foreground">{g.subject}:</span> {g.topic}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
