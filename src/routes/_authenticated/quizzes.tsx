import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { ListChecks, Sparkles, Loader2, Play } from "lucide-react";
import { generateQuiz } from "@/lib/study.functions";

export const Route = createFileRoute("/_authenticated/quizzes")({ component: QuizzesPage });

function QuizzesPage() {
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const genFn = useServerFn(generateQuiz);

  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("General");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard" | "expert">("medium");
  const [count, setCount] = useState(5);
  const [materialId, setMaterialId] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const { data: quizzes } = useQuery({
    queryKey: ["quizzes", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quizzes")
        .select("id,title,subject,difficulty,question_count,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: materials } = useQuery({
    queryKey: ["materials_for_quiz", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("study_materials")
        .select("id,title,subject,original_content,ai_summary")
        .eq("processing_status", "ready")
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  async function generate() {
    if (!session || !user) return;
    let context: string | undefined;
    let useTopic = topic.trim();
    let useSubject = subject;
    if (materialId) {
      const m = (materials ?? []).find((x) => x.id === materialId);
      if (m) {
        useTopic = useTopic || m.title;
        useSubject = m.subject ?? subject;
        context = m.ai_summary || m.original_content;
      }
    }
    if (!useTopic) return toast.error("Pick a material or type a topic");

    setBusy(true);
    try {
      const r = await genFn({
        data: {
          accessToken: session.access_token,
          topic: useTopic,
          subject: useSubject,
          difficulty,
          count,
          context,
        },
      });
      const { data: quiz, error } = await supabase
        .from("quizzes")
        .insert({
          user_id: user.id,
          material_id: materialId || null,
          title: useTopic,
          subject: useSubject,
          difficulty,
          quiz_type: "mcq",
          questions: r.questions,
          question_count: r.questions.length,
        })
        .select("id")
        .single();
      if (error) throw error;
      toast.success("Quiz ready — let's go.");
      qc.invalidateQueries({ queryKey: ["quizzes", user.id] });
      navigate({ to: "/quizzes/$id/take", params: { id: quiz.id } });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to generate quiz");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <ListChecks className="h-7 w-7 text-primary" /> Quizzes
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Generate Bloom-tagged MCQs from any material or topic.</p>
      </header>

      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 className="font-display text-base font-semibold">New quiz</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="From a material (optional)">
            <select value={materialId} onChange={(e) => setMaterialId(e.target.value)} className="input">
              <option value="">— None —</option>
              {(materials ?? []).map((m) => (
                <option key={m.id} value={m.id}>{m.title} · {m.subject}</option>
              ))}
            </select>
          </Field>
          <Field label="Or topic">
            <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Newton's laws of motion" className="input" />
          </Field>
          <Field label="Subject">
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className="input" />
          </Field>
          <Field label="Difficulty">
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as any)} className="input">
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
              <option value="expert">Expert</option>
            </select>
          </Field>
          <Field label="Question count">
            <select value={count} onChange={(e) => setCount(Number(e.target.value))} className="input">
              {[3, 5, 10, 15, 20, 25].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
        </div>
        <button
          onClick={generate}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {busy ? "Generating…" : "Generate quiz"}
        </button>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold mb-3">Your quizzes</h2>
        {(quizzes ?? []).length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            No quizzes yet. Generate one above.
          </div>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {(quizzes ?? []).map((q) => (
              <li key={q.id} className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-display font-semibold truncate">{q.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {q.subject} · {q.difficulty} · {q.question_count} Qs
                  </div>
                </div>
                <Link
                  to="/quizzes/$id/take"
                  params={{ id: q.id }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 text-primary px-3 py-1.5 text-xs font-semibold hover:bg-primary/20"
                >
                  <Play className="h-3.5 w-3.5" /> Take
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <style>{`.input{width:100%;border:1px solid hsl(var(--border));background:hsl(var(--background));border-radius:0.5rem;padding:0.5rem 0.75rem;font-size:0.875rem;outline:none}.input:focus{border-color:hsl(var(--primary))}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
