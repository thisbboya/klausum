import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, ArrowLeft, Brain } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { generateFlashcards } from "@/lib/materials.functions";
import { useServerFn } from "@tanstack/react-start";
import { getAccessToken } from "@/lib/auth-helper";
import { createNewCard } from "@/lib/fsrs";

export const Route = createFileRoute("/_authenticated/materials/$id")({
  component: MaterialDetail,
});

const TABS = [
  { key: "summary", label: "Summary" },
  { key: "visual", label: "Visual" },
  { key: "auditory", label: "Auditory" },
  { key: "reading", label: "Reading" },
  { key: "kinesthetic", label: "Kinesthetic" },
] as const;

function MaterialDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const generateFn = useServerFn(generateFlashcards);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("summary");
  const [generating, setGenerating] = useState(false);

  const { data: material, isLoading } = useQuery({
    queryKey: ["material", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("study_materials")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: (q) => (q.state.data?.processing_status === "processing" ? 2500 : false),
  });

  const { data: deck } = useQuery({
    queryKey: ["deck-for-material", id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("flashcard_decks")
        .select("*")
        .eq("material_id", id)
        .maybeSingle();
      return data;
    },
  });

  async function makeCards() {
    if (!user || !material) return;
    setGenerating(true);
    try {
      const accessToken = await getAccessToken();
      const content =
        material.adapted_reading ||
        material.ai_summary ||
        material.original_content;
      const { cards } = await generateFn({
        data: {
          accessToken,
          title: material.title,
          materialContent: content,
          count: 12,
        },
      });

      // Create deck
      const { data: newDeck, error: deckErr } = await supabase
        .from("flashcard_decks")
        .insert({
          user_id: user.id,
          material_id: material.id,
          title: material.title,
          subject: material.subject ?? "General",
          total_cards: cards.length,
        })
        .select()
        .single();
      if (deckErr) throw deckErr;

      const initial = createNewCard();
      const rows = cards.map((c) => ({
        user_id: user.id,
        deck_id: newDeck.id,
        front: c.front,
        back: c.back,
        hint: c.hint,
        bloom_level: c.bloom_level,
        tags: c.tags,
        fsrs_state: initial.state,
        fsrs_stability: initial.stability,
        fsrs_difficulty: initial.difficulty,
        fsrs_retrievability: initial.retrievability,
        fsrs_repetitions: initial.repetitions,
        fsrs_lapses: initial.lapses,
        next_review_date: initial.nextReviewDate,
      }));
      const { error: cardsErr } = await supabase.from("flashcards").insert(rows);
      if (cardsErr) throw cardsErr;

      await supabase.rpc("increment_xp", { _amount: 30 });
      toast.success(`Generated ${cards.length} flashcards`);
      qc.invalidateQueries({ queryKey: ["deck-for-material", id] });
      navigate({ to: "/review" });
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-muted-foreground" /></div>;
  }
  if (!material) return <p className="text-muted-foreground">Material not found.</p>;

  const isReady = material.processing_status === "ready";

  return (
    <div className="space-y-6">
      <Link to="/materials" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5 mr-1" /> All materials
      </Link>

      <header>
        <h1 className="font-display text-2xl font-bold">{material.title}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {material.subject} · {material.word_count ? `${material.word_count} words` : "—"} ·{" "}
          {material.estimated_read_minutes ? `${material.estimated_read_minutes} min read` : ""}
        </p>
      </header>

      {!isReady ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
          <p className="mt-3 text-sm">Processing with AI…</p>
          <p className="text-xs text-muted-foreground">Auto-refreshing.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 border-b border-border">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-2 text-sm border-b-2 -mb-px transition ${
                  tab === t.key
                    ? "border-primary text-primary font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <article className="prose prose-invert prose-sm md:prose-base max-w-none">
            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
              {tab === "summary"
                ? renderSummary(material)
                : (material as any)[`adapted_${tab}`] ?? "_(no adaptation)_"}
            </ReactMarkdown>
          </article>

          <div className="rounded-xl border border-border bg-card p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/15 p-2 text-primary">
                <Brain className="h-5 w-5" />
              </div>
              <div>
                <div className="font-display font-semibold">Flashcards</div>
                <div className="text-xs text-muted-foreground">
                  {deck ? `${deck.total_cards} cards generated` : "Not generated yet"}
                </div>
              </div>
            </div>
            {!deck ? (
              <button
                onClick={makeCards}
                disabled={generating}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {generating ? "Generating…" : "Generate flashcards"}
              </button>
            ) : (
              <Link
                to="/review"
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent/10"
              >
                Go review
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function renderSummary(m: any): string {
  const parts: string[] = [];
  if (m.ai_summary) parts.push(`## Summary\n\n${m.ai_summary}`);
  if (Array.isArray(m.key_concepts) && m.key_concepts.length > 0) {
    parts.push(`## Key concepts\n\n` + m.key_concepts.map((c: any) => `- **${c.term}** — ${c.definition}`).join("\n"));
  }
  return parts.join("\n\n") || "_No summary yet._";
}
