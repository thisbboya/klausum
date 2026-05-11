import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { NkyinkyimSymbol } from "@/components/adinkra";

export const Route = createFileRoute("/onboarding")({ component: Onboarding });

type Q = { q: string; options: { label: string; style: "visual" | "auditory" | "reading" | "kinesthetic" }[] };

const QUESTIONS: Q[] = [
  {
    q: "When learning a new concept, what helps you most?",
    options: [
      { label: "Diagrams, charts, and color-coded notes", style: "visual" },
      { label: "Listening to someone explain it aloud", style: "auditory" },
      { label: "Reading detailed text and writing notes", style: "reading" },
      { label: "Trying it out with hands-on practice", style: "kinesthetic" },
    ],
  },
  {
    q: "You remember a movie scene best by:",
    options: [
      { label: "Picturing the scene in your head", style: "visual" },
      { label: "Recalling the dialogue or music", style: "auditory" },
      { label: "Remembering the subtitles or script", style: "reading" },
      { label: "Re-enacting what the character did", style: "kinesthetic" },
    ],
  },
  {
    q: "When assembling something from instructions, you:",
    options: [
      { label: "Look at the diagrams first", style: "visual" },
      { label: "Ask someone to walk you through it", style: "auditory" },
      { label: "Read every step before starting", style: "reading" },
      { label: "Just start and learn as you go", style: "kinesthetic" },
    ],
  },
  {
    q: "Which type of class would you choose?",
    options: [
      { label: "One with lots of slides and visuals", style: "visual" },
      { label: "One that's discussion-heavy", style: "auditory" },
      { label: "One based on textbooks and essays", style: "reading" },
      { label: "One with labs and field work", style: "kinesthetic" },
    ],
  },
  {
    q: "When stuck on a math problem, you:",
    options: [
      { label: "Draw it out", style: "visual" },
      { label: "Talk through it out loud", style: "auditory" },
      { label: "Re-read the textbook", style: "reading" },
      { label: "Try plugging in numbers", style: "kinesthetic" },
    ],
  },
  {
    q: "You're given directions to a new place. You prefer:",
    options: [
      { label: "A map", style: "visual" },
      { label: "Spoken directions", style: "auditory" },
      { label: "Written step-by-step instructions", style: "reading" },
      { label: "Walking through it once", style: "kinesthetic" },
    ],
  },
  {
    q: "When studying for an exam, you usually:",
    options: [
      { label: "Make mind maps or flashcards with images", style: "visual" },
      { label: "Read your notes aloud or discuss with a friend", style: "auditory" },
      { label: "Rewrite notes and create summaries", style: "reading" },
      { label: "Practice problems repeatedly", style: "kinesthetic" },
    ],
  },
  {
    q: "If a teacher uses only one teaching method, you wish they'd:",
    options: [
      { label: "Show more visuals on the board", style: "visual" },
      { label: "Talk through more examples", style: "auditory" },
      { label: "Provide written handouts", style: "reading" },
      { label: "Run more lab/group activities", style: "kinesthetic" },
    ],
  },
  {
    q: "You best remember information when you:",
    options: [
      { label: "Visualise a picture of it", style: "visual" },
      { label: "Recall someone's voice explaining it", style: "auditory" },
      { label: "Re-read what you wrote", style: "reading" },
      { label: "Recall doing the action", style: "kinesthetic" },
    ],
  },
  {
    q: "Which describes your ideal study session?",
    options: [
      { label: "Sketching diagrams and color-coding", style: "visual" },
      { label: "Listening to a podcast on the topic", style: "auditory" },
      { label: "Quietly reading and annotating", style: "reading" },
      { label: "Building or simulating something", style: "kinesthetic" },
    ],
  },
  {
    q: "When solving a hard problem, you'd rather:",
    options: [
      { label: "Draw the situation out", style: "visual" },
      { label: "Talk yourself through it", style: "auditory" },
      { label: "Write down everything you know", style: "reading" },
      { label: "Try several approaches physically", style: "kinesthetic" },
    ],
  },
  {
    q: "Pick the kind of online lesson that grabs you:",
    options: [
      { label: "Animated explainer with infographics", style: "visual" },
      { label: "Audio lecture or interview", style: "auditory" },
      { label: "Long-form article with examples", style: "reading" },
      { label: "Interactive simulation or coding sandbox", style: "kinesthetic" },
    ],
  },
  {
    q: "You learn a new app fastest by:",
    options: [
      { label: "Watching the UI tour", style: "visual" },
      { label: "Hearing a friend describe it", style: "auditory" },
      { label: "Reading the documentation", style: "reading" },
      { label: "Tapping every button to see what happens", style: "kinesthetic" },
    ],
  },
  {
    q: "Your favourite kind of textbook page has:",
    options: [
      { label: "Plenty of diagrams and figures", style: "visual" },
      { label: "Quoted dialogue or case interviews", style: "auditory" },
      { label: "Dense, well-structured prose", style: "reading" },
      { label: "Worked exercises you copy step by step", style: "kinesthetic" },
    ],
  },
  {
    q: "Group project — you naturally take on:",
    options: [
      { label: "Designing the slides / visuals", style: "visual" },
      { label: "Presenting and explaining", style: "auditory" },
      { label: "Writing the report", style: "reading" },
      { label: "Building the prototype", style: "kinesthetic" },
    ],
  },
  {
    q: "Music while studying:",
    options: [
      { label: "Helps if there are visuals on screen", style: "visual" },
      { label: "Yes, lyrics and all", style: "auditory" },
      { label: "Distracting — silence please", style: "reading" },
      { label: "Background fine if I'm doing", style: "kinesthetic" },
    ],
  },
  {
    q: "When recalling a past event, you remember:",
    options: [
      { label: "What it looked like", style: "visual" },
      { label: "What was said", style: "auditory" },
      { label: "Notes or messages from then", style: "reading" },
      { label: "What you were doing", style: "kinesthetic" },
    ],
  },
  {
    q: "A new word sticks when you:",
    options: [
      { label: "See it written with imagery", style: "visual" },
      { label: "Hear it pronounced", style: "auditory" },
      { label: "Read its definition twice", style: "reading" },
      { label: "Use it in a sentence yourself", style: "kinesthetic" },
    ],
  },
  {
    q: "When teaching a friend, you tend to:",
    options: [
      { label: "Sketch on paper", style: "visual" },
      { label: "Explain verbally", style: "auditory" },
      { label: "Send them a written summary", style: "reading" },
      { label: "Show them how to do it", style: "kinesthetic" },
    ],
  },
];

function Onboarding() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [scores, setScores] = useState({ visual: 0, auditory: 0, reading: 0, kinesthetic: 0 });
  const [name, setName] = useState("");
  const [country, setCountry] = useState("Ghana");
  const [level, setLevel] = useState("SHS");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }

  const totalSteps = QUESTIONS.length + 2; // intro + questions + profile

  async function complete() {
    setSubmitting(true);
    const top = (Object.entries(scores).sort((a, b) => b[1] - a[1]) as [keyof typeof scores, number][]);
    const primary = top[0][0];
    const secondary = top[1][0];

    const { error } = await supabase
      .from("user_profiles")
      .upsert({
        id: user!.id,
        full_name: name || user!.email || "Student",
        country,
        level,
        visual_score: scores.visual,
        auditory_score: scores.auditory,
        reading_score: scores.reading,
        kinesthetic_score: scores.kinesthetic,
        primary_style: primary,
        secondary_style: secondary,
        vark_completed: true,
        onboarding_completed: true,
      });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success(`Your primary style: ${primary}!`);
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="px-6 py-4 flex items-center gap-2 text-primary">
        <NkyinkyimSymbol size={24} />
        <span className="font-display font-semibold">NkyinkyimIQ</span>
      </header>

      <div className="mx-auto w-full max-w-xl px-4 pb-16 flex-1 flex flex-col justify-center">
        <div className="mb-6">
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
            />
          </div>
          <div className="mt-2 text-xs text-muted-foreground">Step {step + 1} of {totalSteps}</div>
        </div>

        <motion.div
          key={step}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {step === 0 && (
            <div className="text-center">
              <h1 className="font-display text-3xl font-bold">Akwaaba — welcome.</h1>
              <p className="mt-3 text-muted-foreground">
                We'll ask 8 quick questions to discover how you learn best, then tailor every lesson to your mind.
              </p>
              <button
                onClick={() => setStep(1)}
                className="mt-8 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                Begin VARK quiz →
              </button>
            </div>
          )}

          {step > 0 && step <= QUESTIONS.length && (() => {
            const q = QUESTIONS[step - 1];
            return (
              <div>
                <h2 className="font-display text-xl font-semibold leading-snug">{q.q}</h2>
                <div className="mt-5 space-y-2">
                  {q.options.map((opt) => (
                    <button
                      key={opt.label}
                      onClick={() => {
                        setScores((s) => ({ ...s, [opt.style]: s[opt.style] + 1 }));
                        setStep(step + 1);
                      }}
                      className="w-full rounded-lg border border-border bg-card px-4 py-3 text-left text-sm hover:border-primary hover:bg-primary/5 transition"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          {step === QUESTIONS.length + 1 && (
            <div>
              <h2 className="font-display text-2xl font-semibold">Almost done.</h2>
              <p className="mt-1 text-sm text-muted-foreground">A little about you so we can pick the right curriculum.</p>
              <div className="mt-6 space-y-3">
                <Field label="Your name">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Ama Owusu"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                  />
                </Field>
                <Field label="Country">
                  <input
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                  />
                </Field>
                <Field label="Education level">
                  <select
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                  >
                    <option>JHS</option>
                    <option>SHS</option>
                    <option>University</option>
                    <option>Professional</option>
                    <option>Other</option>
                  </select>
                </Field>
              </div>
              <button
                onClick={complete}
                disabled={submitting}
                className="mt-6 w-full rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? "Setting up…" : "Finish & enter NkyinkyimIQ"}
              </button>
            </div>
          )}
        </motion.div>
      </div>
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
