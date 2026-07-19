import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { KlausumMark, KlausumLogo } from "@/components/klausum-mark";
import {
  Brain, FileText, Target, Trophy, Flame, ArrowRight, Star,
  Upload, Wand2, Heart, Zap, BookOpen, Users,
} from "lucide-react";

export const Route = createFileRoute("/")({ component: Landing });

const spring = { type: "spring", stiffness: 100, damping: 20 } as const;

/* ─────────────────── PHONE MOCKUP ─────────────────── */
function PhoneMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring, delay: 0.2 }}
      className="relative mx-auto w-[290px] md:w-[330px]"
    >
      <motion.div
        animate={{ y: [-6, 6, -6] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        className="rounded-[40px] border-2 border-border bg-card p-3 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.12)]"
      >
        <div className="mx-auto mb-2 h-1.5 w-16 rounded-full bg-border" />
        <div className="rounded-[30px] border-2 border-border bg-background p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/20">
                <KlausumMark size={20} />
              </div>
              <div className="text-sm font-extrabold">Ready, pilot?</div>
            </div>
            <div className="flex items-center gap-1 text-destructive">
              {[0, 1, 2].map((i) => (
                <Heart key={i} className="h-4 w-4 fill-current" />
              ))}
            </div>
          </div>

          {/* streak */}
          <div className="card-chunky mt-4 bg-card p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground">Daily streak</span>
              <span className="inline-flex items-center gap-1 text-sm font-extrabold text-primary">
                <motion.span
                  animate={{ scale: [1, 1.25, 1] }}
                  transition={{ duration: 1.8, repeat: Infinity }}
                  className="inline-flex"
                >
                  <Flame className="h-4 w-4 fill-primary text-primary" />
                </motion.span>
                12
              </span>
            </div>
            <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-surface-3">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: "68%" }}
                transition={{ delay: 0.8, duration: 1.2, ease: [0.34, 1.56, 0.64, 1] }}
                className="h-full rounded-full bg-success"
              />
            </div>
            <div className="mt-1.5 text-[10px] font-bold text-muted-foreground">340 / 500 XP today</div>
          </div>

          {/* stats */}
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              { l: "Cards", v: "8", c: "text-sky" },
              { l: "Quizzes", v: "2", c: "text-grape" },
              { l: "Gaps", v: "3", c: "text-destructive" },
            ].map((s) => (
              <div key={s.l} className="card-chunky bg-card p-2">
                <div className={`text-sm font-extrabold ${s.c}`}>{s.v}</div>
                <div className="text-[10px] font-bold text-muted-foreground">{s.l}</div>
              </div>
            ))}
          </div>

          {/* continue */}
          <div className="card-chunky mt-3 border-primary/40 bg-primary/10 p-3">
            <div className="flex items-center gap-2 text-xs font-extrabold text-foreground">
              <BookOpen className="h-4 w-4 text-primary" />
              Continue reading
            </div>
            <div className="mt-1 text-xs font-semibold text-muted-foreground">
              Engineering Thermodynamics — Ch. 4
            </div>
          </div>

          <button className="btn-3d btn-3d-success mt-4 w-full rounded-2xl bg-success py-3 text-sm font-extrabold uppercase tracking-wide text-success-foreground">
            Start lesson
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─────────────────── NAV (floating pill) ─────────────────── */
function Nav() {
  return (
    <header className="sticky top-3 z-50 px-3 md:px-6">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between rounded-full border-2 border-border bg-card/95 px-4 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.18)] backdrop-blur md:px-6">
        <Link to="/" className="flex items-center gap-2">
          <KlausumLogo size={28} />
        </Link>
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="px-3 py-2 text-sm font-extrabold uppercase tracking-wide text-sky transition-colors hover:text-sky/80"
          >
            Log in
          </Link>
          <Link
            to="/signup"
            className="btn-3d btn-3d-success hidden rounded-full bg-success px-5 py-2 text-sm font-extrabold uppercase tracking-wide text-success-foreground sm:inline-flex"
          >
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ─────────────────── ROTATING HEADLINE PHRASE ─────────────────── */
const HERO_PHRASES = [
  "actually pass your exams.",
  "master any topic.",
  "keep the streak alive.",
  "close every gap.",
];

function RotatingPhrase() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((v) => (v + 1) % HERO_PHRASES.length), 3200);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="block text-primary">
      <motion.span
        key={i}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="inline-block"
      >
        {HERO_PHRASES[i]}
      </motion.span>
    </span>
  );
}

/* ─────────────────── FEATURE ROWS (zig-zag) ─────────────────── */
const FEATURE_ROWS = [
  {
    icon: Brain,
    color: "text-success",
    bg: "bg-success/12",
    title: "Reviews that stick.",
    body: "FSRS-5 spaced repetition schedules every flashcard at the exact moment you're about to forget it. Fewer reviews, longer retention — the same science behind the world's best study apps.",
    visual: <SpacedRepetitionVisual />,
  },
  {
    icon: FileText,
    color: "text-sky",
    bg: "bg-sky/12",
    title: "Your PDFs, rewritten for your brain.",
    body: "Upload a lecture, textbook chapter, or handwritten notes. Klausum rewrites it four ways — visual, auditory, reading, hands-on — and generates flashcards, Cornell notes, and quizzes automatically.",
    visual: <UploadVisual />,
  },
  {
    icon: Target,
    color: "text-destructive",
    bg: "bg-destructive/12",
    title: "Know what you don't know.",
    body: "The knowledge-gap radar watches every answer and pinpoints the concepts you keep missing — before the exam does.",
    visual: <GapsVisual />,
  },
  {
    icon: Trophy,
    color: "text-grape",
    bg: "bg-grape/12",
    title: "Studying, but you can't put it down.",
    body: "Streaks, XP, weekly leagues, quests and friend challenges turn showing up every day into the easiest part of your degree.",
    visual: <LeagueVisual />,
  },
];

function SpacedRepetitionVisual() {
  return (
    <div className="card-chunky mx-auto w-full max-w-sm bg-card p-5">
      <div className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
        Due today
      </div>
      {[
        { t: "First law of thermodynamics", d: "now", c: "bg-destructive" },
        { t: "Carnot efficiency", d: "2 h", c: "bg-primary" },
        { t: "Entropy definition", d: "6 h", c: "bg-success" },
      ].map((card, i) => (
        <motion.div
          key={card.t}
          initial={{ opacity: 0, x: -16 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ ...spring, delay: i * 0.12 }}
          className="mt-3 flex items-center gap-3 rounded-xl border-2 border-border p-3"
        >
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${card.c}`} />
          <span className="flex-1 text-sm font-bold">{card.t}</span>
          <span className="text-xs font-bold text-muted-foreground">{card.d}</span>
        </motion.div>
      ))}
    </div>
  );
}

function UploadVisual() {
  return (
    <div className="card-chunky mx-auto w-full max-w-sm bg-card p-5">
      <div className="flex items-center gap-3 rounded-xl border-2 border-dashed border-sky/50 bg-sky/8 p-4">
        <Upload className="h-6 w-6 text-sky" />
        <div>
          <div className="text-sm font-extrabold">EE 152 — Lecture 7.pdf</div>
          <div className="text-xs font-bold text-muted-foreground">24 pages</div>
        </div>
      </div>
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.4 }}
        className="mt-3 grid grid-cols-2 gap-2"
      >
        {[
          { t: "32 flashcards", icon: Zap, c: "text-primary" },
          { t: "Cornell notes", icon: FileText, c: "text-success" },
          { t: "2 quizzes", icon: Target, c: "text-grape" },
          { t: "Mind map", icon: Brain, c: "text-sky" },
        ].map((x, i) => (
          <motion.div
            key={x.t}
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ ...spring, delay: 0.5 + i * 0.1 }}
            className="flex items-center gap-2 rounded-xl bg-surface-2 p-2.5 text-xs font-extrabold"
          >
            <x.icon className={`h-4 w-4 ${x.c}`} />
            {x.t}
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

function GapsVisual() {
  return (
    <div className="card-chunky mx-auto w-full max-w-sm bg-card p-5">
      <div className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
        Gap radar
      </div>
      {[
        { t: "Signal flow graphs", v: 34 },
        { t: "Laplace transforms", v: 58 },
        { t: "Bode plots", v: 81 },
      ].map((g, i) => (
        <div key={g.t} className="mt-3">
          <div className="flex justify-between text-sm font-bold">
            <span>{g.t}</span>
            <span className={g.v < 50 ? "text-destructive" : g.v < 70 ? "text-primary" : "text-success"}>
              {g.v}%
            </span>
          </div>
          <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-surface-3">
            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: `${g.v}%` }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 + i * 0.15, duration: 0.9, ease: [0.34, 1.56, 0.64, 1] }}
              className={`h-full rounded-full ${g.v < 50 ? "bg-destructive" : g.v < 70 ? "bg-primary" : "bg-success"}`}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function LeagueVisual() {
  return (
    <div className="card-chunky mx-auto w-full max-w-sm bg-card p-5">
      <div className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
        Sapphire league · 3 days left
      </div>
      {[
        { n: "Efua", xp: 1240, me: false },
        { n: "You", xp: 1180, me: true },
        { n: "Kwabena", xp: 1090, me: false },
      ].map((r, i) => (
        <motion.div
          key={r.n}
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ ...spring, delay: i * 0.12 }}
          className={`mt-3 flex items-center gap-3 rounded-xl border-2 p-3 ${
            r.me ? "border-primary/50 bg-primary/10" : "border-border"
          }`}
        >
          <span className="w-5 text-center font-extrabold text-muted-foreground">{i + 1}</span>
          <span className="flex-1 text-sm font-extrabold">{r.n}</span>
          <span className="text-xs font-extrabold text-sky">{r.xp.toLocaleString()} XP</span>
        </motion.div>
      ))}
    </div>
  );
}

/* ─────────────────── TESTIMONIALS ─────────────────── */
const TESTIMONIALS = [
  { quote: "I revised my entire Mechanics notes in 40 minutes. The AI explained exactly what was on page 23 of my lecture.", name: "Kofi Asamoah", role: "BSc Engineering, KNUST" },
  { quote: "My 30-day streak is the longest commitment I've had to anything. Klausum makes studying feel like a game I actually want to play.", name: "Abena Mensimah", role: "Medicine Year 2, UG" },
  { quote: "The gap radar found 7 things I thought I understood. It saved me in my midterm.", name: "Yoofi Kumi", role: "Computer Science, KNUST" },
  { quote: "I watched one maths video with AI notes and made 12 flashcards in a single session. I've never done that before.", name: "Amma Darkoa", role: "BSc Mathematics, UCC" },
];

function TestimonialsSection() {
  const [paused, setPaused] = useState(false);
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % TESTIMONIALS.length), 5000);
    return () => clearInterval(id);
  }, [paused]);

  return (
    <section className="px-4 py-20 md:px-8">
      <div className="mx-auto max-w-6xl">
        <h2 className="font-display text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">
          Students are hooked.
        </h2>
        <div
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          className="mt-10 max-w-2xl"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={spring}
              className="card-chunky bg-card p-6 md:p-8"
            >
              <div className="mb-3 flex gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                ))}
              </div>
              <p className="text-[15px] font-semibold leading-relaxed text-foreground">
                "{TESTIMONIALS[index].quote}"
              </p>
              <div className="mt-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky/15 font-extrabold text-sky">
                  {TESTIMONIALS[index].name[0]}
                </div>
                <div>
                  <div className="text-sm font-extrabold">{TESTIMONIALS[index].name}</div>
                  <div className="text-xs font-bold text-muted-foreground">{TESTIMONIALS[index].role}</div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
          <div className="mt-6 flex gap-2">
            {TESTIMONIALS.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                aria-label={`Testimonial ${i + 1}`}
                className={`h-2.5 rounded-full transition-all ${i === index ? "w-8 bg-primary" : "w-2.5 bg-border"}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────── LANDING ─────────────────── */
function Landing() {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <Nav />

      {/* HERO — split, illustration left / copy right (Duolingo layout) */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-12 md:grid-cols-2 md:px-8 md:pb-28 md:pt-20">
        <div className="order-2 md:order-1">
          <PhoneMockup />
        </div>
        <div className="order-1 md:order-2">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={spring}
            className="mb-5 inline-flex items-center gap-2 rounded-full border-2 border-border bg-card px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-wide text-sky"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            AI-powered study companion
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={spring}
            className="font-display text-4xl font-extrabold leading-[1.12] tracking-tight text-foreground md:text-5xl"
          >
            The fun, free way to
            <RotatingPhrase />
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="mt-5 max-w-[52ch] text-base font-semibold leading-relaxed text-muted-foreground md:text-lg"
          >
            Upload any PDF or lecture. Klausum rewrites it for the way you learn,
            drills you with spaced repetition, and keeps you coming back with
            streaks, quests, and leagues.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.25 }}
            className="mt-8 flex max-w-[340px] flex-col gap-3"
          >
            <Link
              to="/signup"
              className="btn-3d btn-3d-success group inline-flex h-[52px] items-center justify-center gap-2 rounded-2xl bg-success text-base font-extrabold uppercase tracking-wide text-success-foreground"
            >
              Start learning free
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              to="/login"
              className="btn-3d btn-3d-secondary inline-flex h-[52px] items-center justify-center rounded-2xl border-2 border-border bg-card text-base font-extrabold uppercase tracking-wide text-sky"
            >
              I already have an account
            </Link>
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="mt-8 flex flex-wrap gap-2"
          >
            {[
              { icon: BookOpen, t: "1,200+ materials processed" },
              { icon: Zap, t: "48,000+ flashcards reviewed" },
              { icon: Users, t: "Built in Ghana" },
            ].map((p) => (
              <span
                key={p.t}
                className="inline-flex items-center gap-1.5 rounded-full border-2 border-border bg-surface-2 px-3 py-1 text-xs font-extrabold text-muted-foreground"
              >
                <p.icon className="h-3.5 w-3.5 text-primary" />
                {p.t}
              </span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* FEATURES — zig-zag rows */}
      <section id="features" className="border-t-2 border-border">
        <div className="mx-auto max-w-6xl px-4 py-20 md:px-8">
          {FEATURE_ROWS.map((f, i) => (
            <div
              key={f.title}
              className={`grid items-center gap-10 md:grid-cols-2 ${i > 0 ? "mt-20 md:mt-28" : ""}`}
            >
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={spring}
                className={i % 2 === 1 ? "md:order-2" : ""}
              >
                <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${f.bg}`}>
                  <f.icon className={`h-6 w-6 ${f.color}`} />
                </div>
                <h2 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">
                  {f.title}
                </h2>
                <p className="mt-4 max-w-[55ch] text-base font-semibold leading-relaxed text-muted-foreground">
                  {f.body}
                </p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ ...spring, delay: 0.1 }}
                className={i % 2 === 1 ? "md:order-1" : ""}
              >
                {f.visual}
              </motion.div>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="border-t-2 border-border bg-surface-2">
        <div className="mx-auto max-w-6xl px-4 py-20 md:px-8">
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">
            Upload to mastery in minutes.
          </h2>
          <div className="mt-12 grid gap-10 md:grid-cols-3 md:gap-6">
            {[
              { icon: Upload, n: "1", title: "Upload anything", body: "Drop a PDF, paste text, or snap a photo of handwritten notes. Every concept, formula, and question gets extracted in seconds." },
              { icon: Wand2, n: "2", title: "AI rewrites it your way", body: "Content is rewritten for your learning style. Flashcards, Cornell notes, and quizzes generate themselves." },
              { icon: Flame, n: "3", title: "Show up daily", body: "Spaced repetition tells you exactly what to review and when. Streaks and leagues make sure you do." },
            ].map((s, i) => (
              <motion.div
                key={s.n}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ ...spring, delay: i * 0.15 }}
              >
                <div className="flex items-center gap-3">
                  <span className="btn-3d flex h-12 w-12 items-center justify-center rounded-2xl bg-primary font-display text-lg font-extrabold text-primary-foreground">
                    {s.n}
                  </span>
                  <s.icon className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="mt-4 font-display text-xl font-extrabold">{s.title}</h3>
                <p className="mt-2 max-w-[40ch] text-sm font-semibold leading-relaxed text-muted-foreground">
                  {s.body}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <div id="community" className="border-t-2 border-border">
        <TestimonialsSection />
      </div>

      {/* FINAL CTA */}
      <section className="border-t-2 border-border bg-surface-2 px-4 py-20 md:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-display text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">
              Your semester starts now.
            </h2>
            <p className="mt-2 text-base font-semibold text-muted-foreground">
              Upload your first material, generate your first quiz, and watch the
              streak grow.
            </p>
          </div>
          <Link
            to="/signup"
            className="btn-3d btn-3d-success group inline-flex h-[52px] shrink-0 items-center gap-2 rounded-2xl bg-success px-8 text-base font-extrabold uppercase tracking-wide text-success-foreground"
          >
            Get started
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
        <div className="mx-auto mt-8 flex max-w-6xl flex-wrap gap-2">
          {["No credit card", "AI tutor included", "XP + streaks", "Free forever for students"].map((t) => (
            <span
              key={t}
              className="rounded-full border-2 border-border bg-card px-3.5 py-1.5 text-xs font-extrabold text-muted-foreground"
            >
              {t}
            </span>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t-2 border-border px-4 py-12 md:px-8">
        <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <KlausumLogo size={20} />
            </div>
            <p className="mt-3 text-sm font-semibold text-muted-foreground">
              Learning that bends to your mind.
            </p>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">Built in Accra, Ghana.</p>
          </div>
          {[
            { h: "Product", links: ["Features", "How it works", "Pricing", "Changelog"] },
            { h: "Study tools", links: ["Materials", "Flashcards", "AI Tutor", "Code Lab"] },
            { h: "Community", links: ["Leaderboard", "Study Rooms", "Groups", "Student Blog"] },
          ].map((col) => (
            <div key={col.h}>
              <div className="text-sm font-extrabold uppercase tracking-wide text-muted-foreground">
                {col.h}
              </div>
              <ul className="mt-3 space-y-2 text-sm font-bold text-muted-foreground">
                {col.links.map((l) => (
                  <li key={l}>
                    <a href="#" className="transition-colors hover:text-primary">{l}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mx-auto mt-10 max-w-6xl border-t-2 border-border pt-6 text-xs font-bold text-muted-foreground">
          © 2026 Klausum · Privacy Policy · Terms
        </div>
      </footer>
    </div>
  );
}
