import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { KlausumLoading } from "@/components/loading";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { toast } from "@/lib/notify";
import { reportError } from "@/lib/report-error";
import { Check } from "lucide-react";
import { KlausumLogo } from "@/components/klausum-mark";
import { COMPANIONS, CompanionSVG } from "@/components/companion-svg";

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
    q: "When studying for an exam, you usually:",
    options: [
      { label: "Make mind maps or flashcards with images", style: "visual" },
      { label: "Read your notes aloud or discuss with a friend", style: "auditory" },
      { label: "Rewrite notes and create summaries", style: "reading" },
      { label: "Practice problems repeatedly", style: "kinesthetic" },
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

const GOALS = [
  "Ace my exams",
  "Understand difficult topics",
  "Stay consistent with studying",
  "Improve my grades",
  "Prepare for a big test",
];

const FREQUENCIES = ["Every day", "3-4 times a week", "Weekends only", "Occasionally"];

const BUILD_STEPS = [
  "Setting up your profile",
  "Calibrating lessons to your learning style",
  "Preparing your study tools",
  "Almost ready!",
];

function Onboarding() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [pilotId, setPilotId] = useState<number | null>(null);
  const [pilotConfirmed, setPilotConfirmed] = useState(false);
  const [scores, setScores] = useState({ visual: 0, auditory: 0, reading: 0, kinesthetic: 0 });
  const [name, setName] = useState("");
  const [country, setCountry] = useState("Ghana");
  const [level, setLevel] = useState("SHS");
  const [goals, setGoals] = useState<string[]>([]);
  const [frequency, setFrequency] = useState<string | null>(null);
  // Mon–Fri by default: the most common answer, so most students just tap through.
  const [studyDays, setStudyDays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [dailyMinutes, setDailyMinutes] = useState(30);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return <div className="flex min-h-[100dvh] items-center justify-center"><KlausumLoading /></div>;
  }

  // steps: 0 pilot · 1..8 VARK · 9 profile · 10 goals · 11 frequency ·
  //        12 schedule · 13 building
  const totalSteps = QUESTIONS.length + 6;
  const pilot = COMPANIONS.find((c) => c.id === pilotId) ?? null;

  async function complete() {
    setSubmitting(true);
    const top = (Object.entries(scores).sort((a, b) => b[1] - a[1]) as [keyof typeof scores, number][]);
    const chosen = pilot ?? COMPANIONS[0];

    try {
      localStorage.setItem("klausum:goals", JSON.stringify({ goals, frequency }));
    } catch {}

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
        primary_style: top[0][0],
        secondary_style: top[1][0],
        vark_completed: true,
        onboarding_completed: true,
        companion_id: chosen.id,
        companion_name: chosen.name,
        // 0 = Monday. Stored as JSON because available_hours is a Json column
        // that already existed for exactly this kind of preference.
        available_hours: { study_days: studyDays },
        daily_goal_minutes: dailyMinutes,
      } as any);
    setSubmitting(false);
    if (error) {
      // Route through reportError, not toast.error(error.message). A Supabase
      // message often reads like a sentence, so the notify layer treats it as
      // hand-written copy and shows it verbatim without logging — meaning a
      // failure at the very last step of onboarding was invisible to admins.
      toast.error(reportError("onboarding.complete", error));
      return false;
    }
    try { localStorage.setItem("klausum:onboarded", "1"); } catch {}
    return true;
  }

  const tint = pilot
    ? { background: `linear-gradient(color-mix(in srgb, ${pilot.color} 7%, transparent), color-mix(in srgb, ${pilot.color} 7%, transparent))` }
    : undefined;

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col transition-colors" style={tint}>
      <header className="px-6 py-4 flex items-center gap-2">
        <KlausumLogo size={22} />
      </header>

      <div className="mx-auto w-full max-w-xl px-4 pb-16 flex-1 flex flex-col justify-center">
        {/* Step dots + "n of m", OnePrep style. A bare progress bar tells you
            how far along you are; a count tells you how much is left, which is
            what actually stops people abandoning a wizard. Dots collapse to the
            bar on narrow screens where 14 of them would not fit. */}
        <div className="mb-6 flex items-center gap-3">
          {step > 0 && step < totalSteps - 1 && (
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              aria-label="Back"
              className="shrink-0 rounded-lg border-2 border-border px-2 py-1 text-xs font-extrabold text-muted-foreground transition hover:text-foreground"
            >
              ←
            </button>
          )}
          <div className="hidden flex-1 items-center gap-1.5 sm:flex">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <span
                key={i}
                className={`h-2 flex-1 rounded-full transition-colors ${
                  i <= step ? "bg-success" : "bg-surface-3"
                }`}
              />
            ))}
          </div>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-3 sm:hidden">
            <div
              className="h-full rounded-full bg-success transition-all duration-500"
              style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
            />
          </div>
          <span className="shrink-0 text-xs font-extrabold tabular-nums text-muted-foreground">
            {Math.min(step + 1, totalSteps)} of {totalSteps}
          </span>
        </div>

        <motion.div
          key={`${step}-${pilotConfirmed}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {step === 0 && !pilotConfirmed && (
            <div>
              <div className="text-center">
                <h1 className="font-display text-3xl font-extrabold">Choose your pilot</h1>
                <p className="mt-2 font-semibold text-muted-foreground">
                  Your companion guides every session — celebrates wins, nudges streaks, keeps you company.
                </p>
              </div>

              <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
                {COMPANIONS.map((c) => {
                  const selected = pilotId === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setPilotId(c.id)}
                      className={`card-chunky group p-3 text-center transition ${
                        selected ? "bg-card scale-[1.02]" : "bg-card hover:-translate-y-0.5"
                      }`}
                      style={selected ? { borderColor: c.color } : undefined}
                    >
                      <div className="flex justify-center">
                        <CompanionSVG id={c.id} size={64} animate={selected} />
                      </div>
                      <div className="mt-2 font-display text-sm font-extrabold tracking-wide">{c.name}</div>
                      <div
                        className="inline-block mt-1 rounded-full px-2 py-0.5 text-[9px] font-extrabold tracking-widest text-white"
                        style={{ backgroundColor: c.color }}
                      >
                        {c.trait}
                      </div>
                      <div className="mt-1.5 text-[10px] font-semibold text-muted-foreground line-clamp-2">
                        {c.description}
                      </div>
                    </button>
                  );
                })}
              </div>

              <button
                disabled={pilotId === null}
                onClick={() => setPilotConfirmed(true)}
                className="mt-6 w-full btn-3d btn-3d-success rounded-2xl bg-success py-3 text-sm font-extrabold uppercase tracking-wide text-success-foreground disabled:cursor-not-allowed"
              >
                {pilotId === null ? "Pick a pilot to continue" : "Continue"}
              </button>
              <p className="mt-2 text-center text-[11px] font-semibold text-muted-foreground">
                You can change your pilot later in Settings.
              </p>
            </div>
          )}

          {step === 0 && pilotConfirmed && (
            <div className="text-center">
              <div className="flex justify-center">
                <div className="pilot-float">
                  <CompanionSVG id={pilotId ?? 1} size={120} />
                </div>
              </div>
              <h1 className="mt-4 font-display text-3xl font-extrabold">
                {pilot?.name} is ready!
              </h1>
              <p className="mt-3 font-semibold text-muted-foreground">
                Now {QUESTIONS.length} quick questions to discover how you learn best.
              </p>
              <button
                onClick={() => setStep(1)}
                className="mt-8 btn-3d btn-3d-success rounded-2xl bg-success px-8 py-3 text-sm font-extrabold uppercase tracking-wide text-success-foreground"
              >
                Let's go
              </button>
            </div>
          )}

          {step > 0 && step <= QUESTIONS.length && (() => {
            const q = QUESTIONS[step - 1];
            return (
              <div>
                <h2 className="font-display text-xl font-extrabold leading-snug">{q.q}</h2>
                <div className="mt-5 space-y-2">
                  {q.options.map((opt) => (
                    <button
                      key={opt.label}
                      onClick={() => {
                        setScores((s) => ({ ...s, [opt.style]: s[opt.style] + 1 }));
                        setStep(step + 1);
                      }}
                      className="w-full rounded-2xl border-2 border-border bg-card px-4 py-3 text-left text-sm font-bold transition hover:border-success hover:bg-success/8"
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
              <h2 className="font-display text-2xl font-extrabold">Almost done.</h2>
              <p className="mt-1 text-sm font-semibold text-muted-foreground">A little about you so we can pick the right curriculum.</p>
              <div className="mt-6 space-y-3">
                <Field label="Your name">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Ama Owusu"
                    className="w-full rounded-xl border-2 border-border bg-surface-2 px-3 py-2.5 text-sm font-semibold outline-none focus:border-sky focus:bg-background"
                  />
                </Field>
                <Field label="Country">
                  <input
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full rounded-xl border-2 border-border bg-surface-2 px-3 py-2.5 text-sm font-semibold outline-none focus:border-sky focus:bg-background"
                  />
                </Field>
                <Field label="Education level">
                  <select
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                    className="w-full rounded-xl border-2 border-border bg-surface-2 px-3 py-2.5 text-sm font-semibold outline-none focus:border-sky focus:bg-background"
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
                onClick={() => setStep(step + 1)}
                className="mt-6 w-full btn-3d btn-3d-success rounded-2xl bg-success py-3 text-sm font-extrabold uppercase tracking-wide text-success-foreground"
              >
                Continue
              </button>
            </div>
          )}

          {step === QUESTIONS.length + 2 && (
            <div>
              <h2 className="font-display text-2xl font-extrabold">What's your main goal?</h2>
              <p className="mt-1 text-sm font-semibold text-muted-foreground">Pick up to 3 ({goals.length}/3)</p>
              <div className="mt-6 space-y-2">
                {GOALS.map((g) => {
                  const on = goals.includes(g);
                  return (
                    <button
                      key={g}
                      onClick={() =>
                        setGoals((prev) =>
                          on ? prev.filter((x) => x !== g) : prev.length < 3 ? [...prev, g] : prev,
                        )
                      }
                      className={`w-full rounded-2xl border-2 px-4 py-3 text-center text-sm font-extrabold transition ${
                        on
                          ? "border-success bg-success/10 text-success"
                          : "border-border bg-card hover:border-success/50"
                      }`}
                    >
                      {g}
                    </button>
                  );
                })}
              </div>
              <button
                disabled={goals.length === 0}
                onClick={() => setStep(step + 1)}
                className="mt-6 w-full btn-3d btn-3d-success rounded-2xl bg-success py-3 text-sm font-extrabold uppercase tracking-wide text-success-foreground disabled:cursor-not-allowed"
              >
                Continue
              </button>
            </div>
          )}

          {step === QUESTIONS.length + 3 && (
            <div>
              <h2 className="font-display text-2xl font-extrabold">How often do you want to study?</h2>
              <p className="mt-1 text-sm font-semibold text-muted-foreground">
                We'll tune your streak goals and reminders to match.
              </p>
              <div className="mt-6 space-y-2">
                {FREQUENCIES.map((f) => (
                  <button
                    key={f}
                    onClick={() => {
                      setFrequency(f);
                      setStep(step + 1);
                    }}
                    className={`w-full rounded-2xl border-2 px-4 py-3 text-center text-sm font-extrabold transition ${
                      frequency === f
                        ? "border-success bg-success/10 text-success"
                        : "border-border bg-card hover:border-success/50"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Study schedule. Unlike "how often", these two answers are load
              bearing: the days drive which mornings Today's Session expects you,
              and the minutes size the plan it builds. Both land in columns that
              already existed (available_hours, daily_goal_minutes). */}
          {step === QUESTIONS.length + 4 && (
            <div>
              <h2 className="font-display text-2xl font-extrabold">Which days do you want to study?</h2>
              <p className="mt-1 text-sm font-semibold text-muted-foreground">
                We'll build your daily session on these days — and leave you alone on the rest.
              </p>
              <div className="mt-6 grid grid-cols-7 gap-1.5">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => {
                  const on = studyDays.includes(i);
                  return (
                    <button
                      key={d}
                      onClick={() =>
                        setStudyDays((prev) =>
                          prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i].sort(),
                        )
                      }
                      aria-pressed={on}
                      className={`rounded-xl border-2 px-1 py-3 text-[11px] font-extrabold transition ${
                        on
                          ? "border-success bg-success/12 text-success"
                          : "border-border bg-card text-muted-foreground hover:border-success/40"
                      }`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>

              <h3 className="mt-7 font-display text-base font-extrabold">
                How long is a study day?
              </h3>
              <div className="mt-2 grid grid-cols-4 gap-1.5">
                {[15, 30, 45, 60].map((m) => (
                  <button
                    key={m}
                    onClick={() => setDailyMinutes(m)}
                    aria-pressed={dailyMinutes === m}
                    className={`rounded-xl border-2 py-2.5 text-xs font-extrabold transition ${
                      dailyMinutes === m
                        ? "border-success bg-success/12 text-success"
                        : "border-border bg-card text-muted-foreground hover:border-success/40"
                    }`}
                  >
                    {m} min
                  </button>
                ))}
              </div>

              <button
                disabled={studyDays.length === 0}
                onClick={() => setStep(step + 1)}
                className="btn-3d btn-3d-success mt-7 w-full rounded-2xl bg-success py-3 text-sm font-extrabold uppercase tracking-wide text-success-foreground disabled:opacity-40"
              >
                {studyDays.length === 0 ? "Pick at least one day" : "Continue"}
              </button>
            </div>
          )}

          {step === QUESTIONS.length + 5 && (
            <BuildingScreen
              pilotId={pilotId ?? 1}
              submitting={submitting}
              onDone={async () => {
                const ok = await complete();
                if (ok) {
                  toast.success(`Welcome aboard, ${(pilot ?? COMPANIONS[0]).name} is ready!`);
                  navigate({ to: "/dashboard" });
                }
              }}
            />
          )}
        </motion.div>
      </div>
    </div>
  );
}

function BuildingScreen({
  pilotId,
  submitting,
  onDone,
}: {
  pilotId: number;
  submitting: boolean;
  onDone: () => void;
}) {
  const [done, setDone] = useState(0);

  useEffect(() => {
    const timers = BUILD_STEPS.map((_, i) =>
      setTimeout(() => setDone(i + 1), (i + 1) * 650),
    );
    const finish = setTimeout(onDone, BUILD_STEPS.length * 650 + 500);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(finish);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="text-center">
      <div className="flex justify-center">
        <div className="pilot-float">
          <CompanionSVG id={pilotId} size={96} />
        </div>
      </div>
      <h2 className="mt-4 font-display text-2xl font-extrabold">Building your experience…</h2>
      <p className="mt-1 text-sm font-semibold text-muted-foreground">Personalizing Klausum just for you</p>
      <ul className="mx-auto mt-8 max-w-xs space-y-4 text-left">
        {BUILD_STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-3">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors duration-300 ${
                done > i ? "bg-success text-success-foreground" : "bg-surface-3 text-transparent"
              }`}
            >
              <Check className="h-4 w-4" />
            </span>
            <span className={`text-sm font-extrabold transition-opacity ${done > i ? "opacity-100" : "opacity-50"}`}>
              {s}
            </span>
          </li>
        ))}
      </ul>
      {submitting && (
        <p className="mt-6 text-xs font-bold text-muted-foreground">Saving your profile…</p>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
