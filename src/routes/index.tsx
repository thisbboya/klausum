import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { KlausumMark } from "@/components/klausum-mark";
import {
  Brain,
  Sparkles,
  Layers,
  MessagesSquare,
  Target,
  Lock,
  Repeat,
  Network,
  Trophy,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="border-b border-border/60 backdrop-blur sticky top-0 z-30 bg-background/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-8">
          <Link to="/" className="flex items-center gap-2 text-primary">
            <KlausumMark size={28} />
            <span className="font-display text-lg font-semibold tracking-tight">
              Klausum
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Log in
            </Link>
            <Link
              to="/signup"
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 opacity-40"
          style={{
            background:
              "radial-gradient(60% 60% at 30% 20%, oklch(0.78 0.16 78 / 0.20), transparent 70%), radial-gradient(50% 50% at 80% 60%, oklch(0.62 0.22 295 / 0.15), transparent 70%)",
          }}
        />
        <div className="mx-auto max-w-6xl px-4 pt-16 pb-20 md:px-8 md:pt-28 md:pb-28">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mx-auto max-w-3xl text-center"
          >
            <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Adaptive AI study companion
            </div>
            <h1 className="font-display text-4xl font-bold leading-[1.1] tracking-tight md:text-6xl">
              Your private vault for <span className="text-primary">everything you study.</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground md:text-xl">
              Upload any PDF, lecture, or textbook chapter. Klausum rewrites it
              for the way <em>you</em> learn, drills you with FSRS-5 spaced
              repetition, maps your knowledge gaps, and seals it all behind a
              Socratic AI tutor — your entire study life in one place.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-semibold text-primary-foreground shadow-[var(--shadow-glow)] hover:opacity-90"
              >
                Start learning free
                <Sparkles className="h-4 w-4" />
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center rounded-lg border border-border px-6 py-3 text-base font-medium hover:bg-accent/10"
              >
                I already have an account
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 pb-24 md:px-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
            >
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {f.body}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Why */}
      <section className="border-t border-border/60 bg-card/30">
        <div className="mx-auto max-w-6xl px-4 py-20 md:px-8">
          <div className="grid gap-10 md:grid-cols-2 md:items-center">
            <div>
              <h2 className="font-display text-3xl font-bold md:text-4xl">
                Sealed knowledge. Built on learning science.
              </h2>
              <p className="mt-4 text-muted-foreground">
                <strong className="text-foreground">Klausum</strong> comes from
                the Latin <em>clausum</em> — sealed, closed, kept safe. Every
                document, note, flashcard, and conversation lives in your
                private vault, indexed and retrievable for the rest of your
                study life.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-3">
                  <span className="mt-0.5 text-primary">→</span>
                  FSRS-5 spaced repetition (20–30% more efficient than SM-2)
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 text-primary">→</span>
                  Bloom's Taxonomy question generation (Remember → Create)
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 text-primary">→</span>
                  VARK learning-style adaptations of every document
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 text-primary">→</span>
                  Socratic AI tutoring that resists giving easy answers
                </li>
              </ul>
            </div>
            <div className="relative">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { S: Lock, label: "Clausum", meaning: "your sealed vault" },
                  { S: Repeat, label: "Memoria", meaning: "FSRS-5 recall" },
                  { S: Network, label: "Nexus", meaning: "knowledge graphs" },
                  { S: Trophy, label: "Ascensio", meaning: "XP & mastery" },
                ].map(({ S, label, meaning }) => (
                  <div
                    key={label}
                    className="flex flex-col items-center justify-center rounded-xl border border-border bg-background/60 p-6 text-center"
                  >
                    <div className="text-primary">
                      <S size={48} strokeWidth={1.5} />
                    </div>
                    <div className="mt-3 font-display text-sm font-semibold">{label}</div>
                    <div className="text-xs text-muted-foreground">{meaning}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60 py-10 text-center text-sm text-muted-foreground">
        <div className="flex items-center justify-center gap-2 text-primary">
          <KlausumMark size={20} />
          <span className="font-display font-semibold">Klausum</span>
        </div>
        <p className="mt-2">Your private vault for everything you study.</p>
      </footer>
    </div>
  );
}

const features = [
  {
    icon: Layers,
    title: "Upload any document",
    body: "PDF, Word, or text. Gemini reads the file natively — no broken parsing, no copy-paste.",
  },
  {
    icon: Brain,
    title: "VARK adaptations",
    body: "Every material is rewritten four ways — visual, auditory, reading/writing, and kinesthetic — so you can learn the way you actually think.",
  },
  {
    icon: Target,
    title: "FSRS-5 flashcards",
    body: "State-of-the-art spaced repetition. Reviews are scheduled exactly when you're about to forget — not before, not after.",
  },
  {
    icon: MessagesSquare,
    title: "Socratic AI tutor",
    body: "Ask anything about your material. Switch to Socratic mode and the tutor will only ask questions back — forcing you to think.",
  },
  {
    icon: Sparkles,
    title: "Bloom-tagged questions",
    body: "Auto-generated cards span all six Bloom levels: Remember, Understand, Apply, Analyse, Evaluate, Create.",
  },
  {
    icon: KlausumMark as any,
    title: "Built for the long haul",
    body: "XP, streaks, daily goals, and dark-first design. Made to study with for months, not minutes.",
  },
];
