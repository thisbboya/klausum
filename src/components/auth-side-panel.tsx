import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { KlausumMark } from "@/components/klausum-mark";

const slides = [
  {
    eyebrow: "Adaptive learning",
    title: "Your textbook, rewritten in your voice.",
    body: "Klausum maps how you learn and rewrites every concept to match your mind — visual, auditory, kinesthetic.",
    accent: "from-primary/30 to-primary/0",
  },
  {
    eyebrow: "Streaks that stick",
    title: "Show up daily. Watch yourself become unstoppable.",
    body: "Daily quests, hearts, and league climbs turn studying into a habit you actually crave.",
    accent: "from-success/30 to-primary/0",
  },
  {
    eyebrow: "Wrapped",
    title: "Your year in learning — Spotify Wrapped, for your brain.",
    body: "Twelve cinematic slides that show what you mastered, what you struggled with, and the moments that made you smarter.",
    accent: "from-fuchsia-400/30 to-primary/0",
  },
];

export function AuthSidePanel() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % slides.length), 5200);
    return () => clearInterval(t);
  }, []);
  const s = slides[i];
  return (
    <div className="relative hidden h-full overflow-hidden bg-[#0a0f1f] lg:block">
      <div className={`absolute inset-0 bg-gradient-to-br ${s.accent} transition-colors duration-700`} />
      <svg className="absolute inset-0 h-full w-full opacity-[0.08]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M48 0 L0 0 0 48" fill="none" stroke="currentColor" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
      <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
      <div className="absolute -bottom-24 -right-24 h-[28rem] w-[28rem] rounded-full bg-primary/10 blur-3xl" />

      <div className="relative z-10 flex h-full flex-col justify-between p-12">
        <div className="flex items-center gap-2 text-primary">
          <KlausumMark size={28} />
          <span className="font-display text-xl font-semibold text-white">Klausum</span>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-md"
          >
            <span className="inline-block rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-primary">
              {s.eyebrow}
            </span>
            <h2 className="mt-5 font-display text-4xl font-bold leading-tight text-white">
              {s.title}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-white/70">{s.body}</p>
          </motion.div>
        </AnimatePresence>

        <div className="flex gap-2">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setI(idx)}
              className={`h-1.5 rounded-full transition-all ${
                idx === i ? "w-10 bg-primary" : "w-6 bg-white/20"
              }`}
              aria-label={`Slide ${idx + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
