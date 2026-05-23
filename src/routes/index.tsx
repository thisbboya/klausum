import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { KlausumMark } from "@/components/klausum-mark";
import {
  Brain, Sparkles, FileText, Target, Tv, Trophy, Map, Code2,
  Flame, ArrowRight, Star, Upload, Wand2,
} from "lucide-react";

export const Route = createFileRoute("/")({ component: Landing });

/* ─────────────────── HERO BG ─────────────────── */
function HeroBg() {
  return (
    <>
      <div className="absolute inset-0 -z-10 bg-[#0A0F1E]" />
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 35%, rgba(244,163,0,0.10) 0%, transparent 70%), radial-gradient(ellipse 60% 40% at 0% 100%, rgba(59,130,246,0.08) 0%, transparent 70%)",
        }}
      />
      {/* topology lines */}
      <svg
        className="absolute inset-0 -z-10 h-full w-full opacity-[0.06]"
        preserveAspectRatio="none"
        viewBox="0 0 1200 800"
        aria-hidden
      >
        {Array.from({ length: 14 }).map((_, i) => (
          <path
            key={i}
            d={`M0,${60 + i * 50} Q300,${20 + i * 50} 600,${60 + i * 50} T1200,${60 + i * 50}`}
            stroke="#F4A300"
            strokeWidth="1"
            fill="none"
          />
        ))}
      </svg>
      {/* orbs */}
      <motion.div
        className="absolute -z-10 rounded-full pointer-events-none hidden md:block"
        style={{ width: 300, height: 300, top: "10%", right: "5%", background: "rgba(244,163,0,0.10)", filter: "blur(80px)" }}
        animate={{ y: [-20, 20, -20] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -z-10 rounded-full pointer-events-none hidden md:block"
        style={{ width: 200, height: 200, bottom: "10%", left: "5%", background: "rgba(59,130,246,0.08)", filter: "blur(80px)" }}
        animate={{ y: [15, -15, 15] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -z-10 rounded-full pointer-events-none hidden md:block"
        style={{ width: 150, height: 150, top: "50%", right: "30%", background: "rgba(139,92,246,0.06)", filter: "blur(80px)" }}
        animate={{ y: [-10, 10, -10] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
    </>
  );
}

/* ─────────────────── HEADLINE w/ char stagger ─────────────────── */
function AnimatedHeadline() {
  const line1 = "Your private vault for";
  const line2 = "everything you study.";
  return (
    <h1
      className="font-display font-bold tracking-tight text-[#F1F5F9]"
      style={{ fontSize: "clamp(36px, 8vw, 72px)", lineHeight: 1.1, wordBreak: "keep-all", overflowWrap: "normal" }}
    >
      <span className="block">
        {line1.split(" ").map((word, wi) => (
          <span key={`a-${wi}`} style={{ display: "inline-block", whiteSpace: "nowrap", marginRight: "0.25em" }}>
            {word.split("").map((ch, i) => (
              <motion.span
                key={`a-${wi}-${i}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + (wi * 4 + i) * 0.018, duration: 0.4 }}
                style={{ display: "inline-block" }}
              >
                {ch}
              </motion.span>
            ))}
          </span>
        ))}
      </span>
      <span className="block text-[#F4A300]">
        {line2.split(" ").map((word, wi) => (
          <span key={`b-${wi}`} style={{ display: "inline-block", whiteSpace: "nowrap", marginRight: "0.25em" }}>
            {word.split("").map((ch, i) => (
              <motion.span
                key={`b-${wi}-${i}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + (wi * 4 + i) * 0.018, duration: 0.4 }}
                style={{ display: "inline-block" }}
              >
                {ch}
              </motion.span>
            ))}
          </span>
        ))}
      </span>
    </h1>
  );
}


/* ─────────────────── PHONE MOCKUP ─────────────────── */
function PhoneMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, x: 40, rotate: -3 }}
      animate={{ opacity: 1, x: 0, rotate: -3 }}
      transition={{ delay: 0.5, duration: 0.8 }}
      className="relative mx-auto mt-12 w-[300px] md:mt-0 md:w-[340px]"
      style={{ filter: "drop-shadow(0 40px 60px rgba(0,0,0,0.5)) drop-shadow(0 0 80px rgba(244,163,0,0.15))" }}
    >
      <motion.div
        animate={{ y: [-8, 8, -8] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="rounded-[36px] border border-white/10 bg-[#0F172A] p-3"
      >
        <div className="mx-auto mb-2 h-1 w-16 rounded-full bg-white/20" />
        <div className="rounded-[28px] bg-gradient-to-br from-[#111c33] to-[#0a0f1e] p-4 text-[#F1F5F9]">
          <div className="flex items-center justify-between text-xs text-[#94A3B8]">
            <span>9:41</span>
            <span>●●●</span>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F4A300]/20 text-xl">🦅</div>
            <div>
              <div className="text-xs text-[#94A3B8]">Good evening</div>
              <div className="text-sm font-semibold">Ready, Pilot?</div>
            </div>
          </div>
          <div className="mt-4 rounded-2xl bg-white/5 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#94A3B8]">Daily streak</span>
              <span className="text-[#F4A300] font-bold">🔥 12</span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: "68%" }}
                transition={{ delay: 1, duration: 1.2 }}
                className="h-full rounded-full bg-gradient-to-r from-[#F4A300] to-[#F59E0B]"
              />
            </div>
            <div className="mt-1 text-[10px] text-[#94A3B8]">340 / 500 XP to next level</div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              { l: "Cards", v: "8" },
              { l: "Quizzes", v: "2" },
              { l: "Gaps", v: "3" },
            ].map((s) => (
              <div key={s.l} className="rounded-xl bg-white/5 p-2">
                <div className="text-sm font-bold text-[#F4A300]">{s.v}</div>
                <div className="text-[10px] text-[#94A3B8]">{s.l}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-xl bg-[#F4A300]/10 p-3 text-xs">
            <div className="font-semibold text-[#F4A300]">📚 Continue reading</div>
            <div className="mt-1 text-[#94A3B8]">Engineering Thermodynamics — Ch.4</div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─────────────────── FEATURES ─────────────────── */
const FEATURES = [
  { icon: Brain, t: "FSRS-5 Spaced Repetition", b: "20% fewer reviews. 100% more retention." },
  { icon: FileText, t: "PDF Reader + AI Tutor", b: "Your AI reads every page with you." },
  { icon: Target, t: "Knowledge Gap Radar", b: "Know exactly what you don't know." },
  { icon: Tv, t: "Video Study Mode", b: "YouTube becomes a classroom, not a distraction." },
  { icon: Trophy, t: "Leagues & Quests", b: "Compete. Level up. Never study alone." },
  { icon: Map, t: "Learning Map", b: "See your entire semester as a visual journey." },
  { icon: Code2, t: "Code Lab", b: "Run code. Debug with AI. Build real things." },
  { icon: Flame, t: "Friend Streaks", b: "Hold each other accountable. Together." },
];

function FeaturesSection() {
  return (
    <section className="relative bg-[#0A0F1E] px-4 py-12 md:px-8 md:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 text-center">
          <h2 className="font-display text-[32px] font-bold text-[#F1F5F9] md:text-[40px]">
            Everything you need. Nothing you don't.
          </h2>
          <p className="mt-3 text-[#94A3B8]">Built for how students actually study.</p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.t}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: i * 0.08, duration: 0.5 }}
              className="group relative rounded-[20px] border border-white/[0.06] bg-[#1E293B]/60 p-7 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-[#F4A300]/25 hover:bg-[#1E293B]/90"
              style={{ boxShadow: "0 0 0 0 transparent" }}
            >
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#F4A300]/15 text-[#F4A300]">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-display text-[17px] font-semibold text-[#F1F5F9]">{f.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#94A3B8]">{f.b}</p>
              <div className="absolute left-0 top-7 h-12 w-[3px] origin-top scale-y-0 rounded-r bg-[#F4A300]/40 transition-transform duration-200 group-hover:scale-y-100" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────── TESTIMONIALS ─────────────────── */
const TESTIMONIALS = [
  { quote: "I revised my entire Mechanics notes in 40 minutes. The AI explained exactly what was on page 23 of my lecture.", name: "Kofi A.", role: "BSc Engineering, KNUST", pilot: "🦅" },
  { quote: "My 30-day streak is the longest commitment I've had to anything. 🔥 Klausum makes studying feel like a game I actually want to play.", name: "Abena M.", role: "Medicine Year 2, UG", pilot: "🦁" },
  { quote: "The gap radar found 7 things I thought I understood. It saved me in my midterm.", name: "Yoofi K.", role: "Computer Science, KNUST", pilot: "🐆" },
  { quote: "I watched a 3Blue1Brown video with AI notes and made 12 flashcards in one session. I've never done that before.", name: "Amma D.", role: "BSc Mathematics, UCC", pilot: "🦋" },
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
    <section className="relative bg-[#0A0F1E] py-24 px-4 md:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <h2 className="font-display text-[32px] font-bold text-[#F1F5F9] md:text-[40px]">
            What students are saying
          </h2>
          <p className="mt-3 text-[#94A3B8]">Real students. Real results. 🇬🇭</p>
        </div>
        <div
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          className="relative mx-auto max-w-2xl"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.4 }}
              className="rounded-2xl border border-white/[0.06] bg-[#1E293B] p-6 md:p-8"
            >
              <div className="mb-3 flex gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-[#F4A300] text-[#F4A300]" />
                ))}
              </div>
              <p className="italic text-[15px] leading-relaxed text-[#F1F5F9]">
                "{TESTIMONIALS[index].quote}"
              </p>
              <div className="mt-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F4A300]/20 text-lg">
                  {TESTIMONIALS[index].pilot}
                </div>
                <div>
                  <div className="font-semibold text-[#F1F5F9]">{TESTIMONIALS[index].name}</div>
                  <div className="text-xs text-[#94A3B8]">{TESTIMONIALS[index].role}</div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
          <div className="mt-6 flex justify-center gap-2">
            {TESTIMONIALS.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                aria-label={`Testimonial ${i + 1}`}
                className={`h-2 rounded-full transition-all ${i === index ? "w-8 bg-[#F4A300]" : "w-2 bg-white/20"}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────── HOW IT WORKS (SVG draw) ─────────────────── */
function HowItWorks() {
  return (
    <section className="relative bg-[#0A0F1E] py-24 px-4 md:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 text-center">
          <h2 className="font-display text-[32px] font-bold text-[#F1F5F9] md:text-[40px]">
            From upload to mastery in minutes.
          </h2>
        </div>

        <div className="relative grid gap-12 md:grid-cols-3 md:gap-6">
          {/* connector */}
          <svg className="pointer-events-none absolute left-0 right-0 top-12 hidden h-2 w-full md:block" viewBox="0 0 1000 8" preserveAspectRatio="none">
            <motion.path
              d="M 100 4 L 900 4"
              stroke="#F4A300"
              strokeWidth="2"
              strokeDasharray="6 6"
              fill="none"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.5, ease: "easeOut" }}
            />
          </svg>

          {[
            { icon: Upload, n: "01", title: "Upload anything", body: "Drop a PDF, paste text, or snap a photo of handwritten notes. Klausum extracts every concept, formula, and question — in seconds." },
            { icon: Wand2, n: "02", title: "AI rewrites it YOUR way", body: "Your content is rewritten 4 ways: visual, auditory, reading, or hands-on. Flashcards, Cornell notes, and quizzes are auto-generated." },
            { icon: Flame, n: "03", title: "Study smarter, daily", body: "FSRS-5 tells you exactly what to review and when. Leagues, streaks, and your AI companion keep you coming back." },
          ].map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.2, duration: 0.5 }}
              className="relative z-10 text-center"
            >
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-[#F4A300]/30 bg-[#0A0F1E]">
                <s.icon className="h-8 w-8 text-[#F4A300]" />
              </div>
              <div className="mt-4 font-display text-5xl font-bold text-[#F4A300]/90">{s.n}</div>
              <h3 className="mt-2 font-display text-xl font-semibold text-[#F1F5F9]">{s.title}</h3>
              <p className="mx-auto mt-2 max-w-xs text-sm text-[#94A3B8]">{s.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────── NAV ─────────────────── */
function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 100);
    window.addEventListener("scroll", on);
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header
      className="sticky top-0 z-50 border-b transition-all"
      style={{
        backdropFilter: "blur(12px)",
        background: scrolled ? "rgba(10,15,30,0.95)" : "rgba(10,15,30,0.8)",
        borderColor: scrolled ? "rgba(244,163,0,0.2)" : "rgba(244,163,0,0.1)",
      }}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-8">
        <Link to="/" className="flex items-center gap-2 text-[#F4A300]">
          <KlausumMark size={28} />
          <span className="font-display text-lg font-bold tracking-tight text-[#F1F5F9]">Klausum</span>
        </Link>
        <nav className="hidden gap-7 text-sm text-[#94A3B8] md:flex">
          {["Features", "How it works", "Community", "Pricing"].map((l) => (
            <a key={l} href={`#${l.toLowerCase().replace(/\s/g, "-")}`} className="transition-colors hover:text-[#F4A300]">
              {l}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/login" className="rounded-md px-3 py-2 text-sm text-[#94A3B8] transition-colors hover:text-[#F1F5F9]">
            Log in
          </Link>
          <Link
            to="/signup"
            className="inline-flex items-center gap-1 rounded-full bg-gradient-to-br from-[#F4A300] to-[#F59E0B] px-4 py-2 text-sm font-semibold text-[#0A0F1E] transition-all hover:scale-[1.02]"
            style={{ boxShadow: "0 0 20px rgba(244,163,0,0.3)" }}
          >
            Get started free <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ─────────────────── LANDING ─────────────────── */
function Landing() {
  // grain overlay class on body
  useEffect(() => {
    document.body.classList.add("landing");
    return () => document.body.classList.remove("landing");
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0F1E] text-[#F1F5F9]">
      <Nav />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <HeroBg />
        <div className="mx-auto grid max-w-6xl gap-8 px-4 pt-16 pb-24 md:grid-cols-[1fr_auto] md:items-center md:px-8 md:pt-28 md:pb-32">
          <div className="max-w-2xl text-center md:text-left">
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-[#F4A300]/30 bg-[#F4A300]/10 px-3 py-1 text-xs font-medium text-[#F4A300] md:mx-0"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Adaptive AI study companion
            </motion.div>

            <AnimatedHeadline />

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="mx-auto mt-6 max-w-xl text-[17px] leading-relaxed text-[#94A3B8] md:mx-0 md:text-[18px]"
            >
              Upload any PDF, lecture, or textbook chapter. Klausum rewrites it for the way{" "}
              <em>you</em> learn, drills you with FSRS-5 spaced repetition, maps your knowledge
              gaps, and seals it all behind a Socratic AI tutor — your entire study life in one
              place.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6, duration: 0.4 }}
              className="mt-8 flex flex-wrap items-center justify-center gap-3 md:justify-start"
            >
              <Link
                to="/signup"
                className="inline-flex h-14 items-center gap-2 rounded-full bg-gradient-to-br from-[#F4A300] to-[#F59E0B] px-8 font-display text-base font-semibold text-[#0A0F1E] transition-all hover:-translate-y-0.5"
                style={{ boxShadow: "0 8px 32px rgba(244,163,0,0.35)" }}
              >
                Start learning free <Sparkles className="h-4 w-4" />
              </Link>
              <Link
                to="/login"
                className="inline-flex h-14 items-center rounded-full border border-white/15 bg-white/[0.05] px-8 text-base font-medium text-[#F1F5F9] transition-colors hover:border-[#F4A300]/40 hover:bg-white/10"
              >
                I already have an account
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.5 }}
              className="mt-10"
            >
              <p className="text-xs text-[#94A3B8]">
                Trusted by students at KNUST, UG, UCC, Legon and more
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2 md:justify-start">
                {["📚 1,200+ materials processed", "⚡ 48,000+ flashcards reviewed", "🇬🇭 Built in Ghana"].map((p) => (
                  <span
                    key={p}
                    className="rounded-full border border-[#F4A300]/20 bg-[#F4A300]/[0.08] px-3 py-1 text-xs text-[#F4A300]"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </motion.div>
          </div>

          <div className="md:pl-4">
            <PhoneMockup />
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <div id="features">
        <FeaturesSection />
      </div>

      {/* HOW IT WORKS */}
      <div id="how-it-works">
        <HowItWorks />
      </div>

      {/* TESTIMONIALS */}
      <div id="community">
        <TestimonialsSection />
      </div>

      {/* FINAL CTA */}
      <section
        className="relative border-t border-[#F4A300]/10 px-4 py-24 md:px-8"
        style={{ background: "linear-gradient(135deg, rgba(244,163,0,0.08) 0%, transparent 50%)" }}
      >
        <div className="mx-auto max-w-3xl text-center">
          <KlausumMark size={60} />
          <h2 className="mt-6 font-display text-[36px] font-bold leading-tight text-[#F1F5F9] md:text-[48px]">
            Your semester starts now.
          </h2>
          <p className="mt-4 text-[18px] text-[#94A3B8]">
            Free forever for students. No credit card. No catch.
          </p>
          <Link
            to="/signup"
            className="mt-8 inline-flex h-14 items-center gap-2 rounded-full bg-gradient-to-br from-[#F4A300] to-[#F59E0B] px-8 font-display text-base font-semibold text-[#0A0F1E] transition-all hover:-translate-y-0.5"
            style={{ boxShadow: "0 8px 32px rgba(244,163,0,0.35)" }}
          >
            Start learning free <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="mt-4 text-xs text-[#94A3B8]">
            Join 1,200+ students already studying smarter 🇬🇭
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/[0.05] bg-[#0A0F1E] px-4 py-12 md:px-8">
        <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2 text-[#F4A300]">
              <KlausumMark size={24} />
              <span className="font-display text-base font-bold text-[#F1F5F9]">Klausum</span>
            </div>
            <p className="mt-3 text-sm text-[#94A3B8]">Learning that bends to your mind.</p>
            <p className="mt-1 text-sm text-[#94A3B8]">Built in Ghana 🇬🇭</p>
          </div>
          {[
            { h: "Product", links: ["Features", "How it works", "Pricing", "Changelog"] },
            { h: "Study Tools", links: ["Materials", "Flashcards", "AI Tutor", "Code Lab"] },
            { h: "Community", links: ["Leaderboard", "Study Rooms", "Groups", "Student Blog"] },
          ].map((col) => (
            <div key={col.h}>
              <div className="font-display text-sm font-semibold text-[#F1F5F9]">{col.h}</div>
              <ul className="mt-3 space-y-2 text-sm text-[#94A3B8]">
                {col.links.map((l) => (
                  <li key={l}><a href="#" className="hover:text-[#F4A300]">{l}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mx-auto mt-10 max-w-6xl border-t border-white/[0.05] pt-6 text-center text-xs text-[#94A3B8]">
          © 2026 Klausum · Privacy Policy · Terms · Made with 💛 in Accra
        </div>
      </footer>
    </div>
  );
}
