import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { generateWrapped, saveWrappedSnapshot, type WrappedData } from "@/lib/wrapped";
import { VarkRadar } from "@/components/wrapped/VarkRadar";
import { ChevronLeft, ChevronRight, X, Download, Share2, Sparkles } from "lucide-react";
import html2canvas from "html2canvas";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/wrapped")({ component: WrappedPage });

function useCountUp(target: number, duration = 1200, active = true) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, active]);
  return val;
}

function WrappedPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<WrappedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [showSwipeHint, setShowSwipeHint] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return navigate({ to: "/login" });
      const d = await generateWrapped(u.user.id);
      setData(d);
      setLoading(false);
      saveWrappedSnapshot(u.user.id, d).catch(() => {});
    })();
  }, [navigate]);

  if (loading || !data) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#0a0f1f] text-white">
        <Sparkles className="h-12 w-12 animate-pulse text-primary" />
        <p className="mt-4 font-display text-2xl">Wrapping your year…</p>
        <p className="mt-1 text-sm text-white/60">Counting every card, every minute, every spark.</p>
      </div>
    );
  }

  const slides = buildSlides(data);
  const total = slides.length;
  const next = () => { setShowSwipeHint(false); setIdx((i) => Math.min(total - 1, i + 1)); };
  const prev = () => { setShowSwipeHint(false); setIdx((i) => Math.max(0, i - 1)); };

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-[#0a0f1f] text-white">
      {/* Progress bars */}
      <div className="absolute left-3 right-3 top-3 z-20 flex gap-1">
        {slides.map((_, i) => (
          <div key={i} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/25">
            <div
              className="h-full transition-all duration-300"
              style={{
                width: i <= idx ? "100%" : "0%",
                background: i < idx ? "rgba(255,255,255,0.9)" : i === idx ? "#ffffff" : "transparent",
              }}
            />
          </div>
        ))}
      </div>

      {/* Close */}
      <button
        onClick={() => navigate({ to: "/dashboard" })}
        className="absolute right-3 top-7 z-20 rounded-full bg-white/10 p-2 backdrop-blur hover:bg-white/20"
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Tap zones */}
      <button className="absolute inset-y-0 left-0 z-10 w-1/3" onClick={prev} aria-label="Previous" />
      <button className="absolute inset-y-0 right-0 z-10 w-1/3" onClick={next} aria-label="Next" />

      {/* Nav arrows */}
      <button onClick={prev} className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/30 p-2 backdrop-blur hover:bg-black/50"><ChevronLeft className="h-5 w-5" /></button>
      <button onClick={next} className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/30 p-2 backdrop-blur hover:bg-black/50"><ChevronRight className="h-5 w-5" /></button>

      <motion.div
        className="absolute inset-0 z-[5]"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.18}
        onDragEnd={(_, info) => {
          if (info.offset.x < -60) next();
          else if (info.offset.x > 60) prev();
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 flex items-center justify-center p-2 sm:p-6"
          >
            {slides[idx]}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {showSwipeHint && idx === 0 && (
        <div className="pointer-events-none absolute bottom-8 left-1/2 z-20 -translate-x-1/2 flex items-center gap-2 rounded-full bg-black/40 px-3 py-1.5 text-[11px] text-white/80 backdrop-blur animate-pulse">
          <span>←</span><span>Swipe or tap to continue</span><span>→</span>
        </div>
      )}
    </div>
  );
}


function SlideShell({ bg, children, shareable, label }: { bg: string; children: React.ReactNode; shareable?: boolean; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  async function share() {
    if (!ref.current) return;
    try {
      const canvas = await html2canvas(ref.current, { backgroundColor: null, scale: 2 });
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], "klausum-wrapped.png", { type: "image/png" });
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: "My Klausum Wrapped" });
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url; a.download = "klausum-wrapped.png"; a.click();
          URL.revokeObjectURL(url);
          toast.success("Saved to downloads");
        }
      });
    } catch { toast.error("Couldn't capture slide"); }
  }
  return (
    <div
      ref={ref}
      className={`relative flex h-full w-full max-w-md flex-col items-center justify-center overflow-hidden rounded-3xl px-6 py-16 text-center sm:px-8 ${bg}`}
      style={{ minHeight: "min(844px, calc(100vh - 24px))" }}
    >
      <div className="absolute left-6 top-6 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] opacity-70">
        <Sparkles className="h-3 w-3" /> Klausum Wrapped
      </div>
      {label && (
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-white/60">{label}</p>
      )}
      <div className="flex flex-col items-center justify-center gap-2">{children}</div>
      {shareable && (
        <button onClick={share} className="absolute bottom-6 right-6 flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium backdrop-blur hover:bg-white/25">
          <Share2 className="h-3.5 w-3.5" /> Share
        </button>
      )}
    </div>
  );
}

function StatNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const v = useCountUp(value);
  return <span>{v.toLocaleString()}{suffix}</span>;
}

function PilotOrb({ emoji, big = false }: { emoji: string; big?: boolean }) {
  const size = big ? "h-24 w-24 text-5xl" : "h-20 w-20 text-4xl";
  return (
    <div
      className={`flex ${size} items-center justify-center rounded-full border-2 border-white/30 bg-white/20 backdrop-blur-sm`}
      style={{ boxShadow: "0 0 40px rgba(255,255,255,0.2)", animation: "klausumPilotFloat 3s ease-in-out infinite" }}
    >
      {emoji}
    </div>
  );
}

function buildSlides(d: WrappedData) {
  const s: React.ReactNode[] = [];
  const pilotEmoji = "🦅";
  const period: "weekly" | "monthly" | "semester" | "yearly" = "semester";
  const closingLine = { weekly: "See you next Sunday.", monthly: "See you next month.", semester: "See you at the end of semester.", yearly: "See you next year." }[period];
  const pilotQuote = { weekly: "Another week in the books. Keep the momentum.", monthly: "A whole month of learning. Look at what you built.", semester: "You showed up. You did the work. You got smarter.", yearly: "One full year of learning. You are not the same person you were." }[period];
  const slideTitleEra = { weekly: "YOUR WEEK", monthly: "YOUR MONTH", semester: "YOUR SEMESTER", yearly: "YOUR YEAR" }[period];

  // 1 — Cover
  s.push(
    <SlideShell key="cover" bg="bg-gradient-to-br from-primary via-orange-500 to-fuchsia-600">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">Welcome back, {d.fullName.split(" ")[0] || "Pilot"}</p>
      <h1 className="mt-3 font-display text-6xl font-black leading-none">Your<br/>{slideTitleEra.split(" ")[1]}<br/>in Learning.</h1>
      <div className="mt-8"><PilotOrb emoji={pilotEmoji} /></div>
      <p className="mt-3 text-sm text-white/70">{d.companionName} has your story ready</p>
      <p className="mt-6 text-xs text-white/60">Tap to begin →</p>
    </SlideShell>
  );

  // 2 — Minutes (zero-state aware)
  if (d.totals.studyMinutes === 0) {
    s.push(
      <SlideShell key="minutes" bg="bg-gradient-to-br from-indigo-700 via-violet-700 to-fuchsia-600" shareable label="YOUR JOURNEY BEGINS">
        <p className="font-display text-4xl font-black leading-tight">Your story<br/>starts now.</p>
        <p className="mt-5 max-w-xs text-sm text-white/80">Every Klausum journey begins with a single session. This is your first chapter.</p>
      </SlideShell>
    );
  } else {
    s.push(
      <SlideShell key="minutes" bg="bg-gradient-to-br from-indigo-700 via-violet-700 to-fuchsia-600" shareable label="YOU STUDIED FOR">
        <p className="font-display text-7xl font-black leading-none"><StatNumber value={d.totals.studyMinutes} /></p>
        <p className="mt-2 text-xl font-semibold text-white/90">minutes</p>
        <p className="mt-5 max-w-xs text-sm text-white/70">
          That's {d.totals.studyHours} hours of pure focus across {d.totals.sessions} sessions.
        </p>
      </SlideShell>
    );
  }

  // 3 — Cards reviewed
  if (d.totals.cardsReviewed === 0) {
    s.push(
      <SlideShell key="cards" bg="bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700" shareable label="YOUR DECK AWAITS">
        <p className="font-display text-4xl font-black leading-tight">Ready to remember<br/>everything.</p>
        <p className="mt-5 max-w-xs text-sm text-white/80">Upload a note, generate cards, and watch your memory get a superpower.</p>
      </SlideShell>
    );
  } else {
    s.push(
      <SlideShell key="cards" bg="bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700" shareable label="YOU REVIEWED">
        <p className="font-display text-7xl font-black leading-none"><StatNumber value={d.totals.cardsReviewed} /></p>
        <p className="mt-2 text-xl font-semibold text-white/90">flashcards</p>
        <p className="mt-5 max-w-xs text-sm text-white/80">
          And nailed <span className="font-bold text-white">{d.totals.cardsAcedFirstTry}</span> of them with a confident response.
        </p>
      </SlideShell>
    );
  }

  // 4 — XP earned
  if (d.totals.xpEarned === 0) {
    s.push(
      <SlideShell key="xp" bg="bg-gradient-to-br from-yellow-500 via-amber-500 to-orange-600" shareable label="YOUR XP STORY">
        <p className="font-display text-5xl font-black">Ready to earn.</p>
        <p className="mt-5 max-w-xs text-sm text-white/85">Every quest completed, every card reviewed, every gap closed — all earn XP. Start today.</p>
      </SlideShell>
    );
  } else {
    s.push(
      <SlideShell key="xp" bg="bg-gradient-to-br from-yellow-500 via-amber-500 to-orange-600" shareable label="TOTAL XP EARNED">
        <p className="font-display text-7xl font-black leading-none"><StatNumber value={d.totals.xpEarned} /></p>
        <p className="mt-2 text-xl font-semibold text-white/90">XP</p>
        <p className="mt-5 max-w-xs text-sm text-white/85">Every correct answer, every quest claimed, every flame kept alive.</p>
      </SlideShell>
    );
  }

  // 5 — Top subject
  if (d.topSubject) {
    s.push(
      <SlideShell key="subject" bg="bg-gradient-to-br from-rose-600 via-pink-600 to-fuchsia-700" shareable label="YOU SPENT THE MOST TIME ON">
        <p className="font-display text-5xl font-black">{d.topSubject.name}</p>
        <p className="mt-3 text-xl text-white/90">{d.topSubject.minutes} minutes deep</p>
        <p className="mt-5 max-w-xs text-sm text-white/80">More than any other topic. You're becoming dangerous in this subject.</p>
      </SlideShell>
    );
  }

  // 6 — Peak hour
  if (d.peakHour) {
    s.push(
      <SlideShell key="hour" bg="bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900" shareable label="YOUR PRIME TIME">
        <p className="font-display text-5xl font-black">{d.peakHour.hourLabel}</p>
        <p className="mt-5 max-w-xs text-sm text-white/80">
          You studied here more than any other time of day. Your brain knows when it's ready.
        </p>
      </SlideShell>
    );
  }

  // 7 — Toughest card
  if (d.toughestCard) {
    s.push(
      <SlideShell key="tough" bg="bg-gradient-to-br from-red-700 via-rose-700 to-orange-700" shareable label="YOUR NEMESIS CARD">
        <p className="line-clamp-4 max-w-xs font-display text-2xl font-bold italic">"{d.toughestCard.front}"</p>
        <p className="mt-4 text-lg">You wrestled with it <span className="font-black">{d.toughestCard.lapses}</span> times.</p>
        <p className="mt-3 max-w-xs text-sm text-white/80">But you kept showing up. That's how mastery is built.</p>
      </SlideShell>
    );
  }

  // 8 — Fastest quiz
  if (d.fastestQuiz) {
    s.push(
      <SlideShell key="speed" bg="bg-gradient-to-br from-cyan-600 via-blue-700 to-indigo-800" shareable label="YOUR FASTEST QUIZ">
        <p className="font-display text-xl font-bold">{d.fastestQuiz.title}</p>
        <p className="mt-3 font-display text-6xl font-black"><StatNumber value={d.fastestQuiz.secondsPerQuestion} />s</p>
        <p className="mt-2 text-sm text-white/80">per question</p>
      </SlideShell>
    );
  }

  // 9 — Streak (zero-state aware)
  if (d.totals.longestStreak === 0) {
    s.push(
      <SlideShell key="streak" bg="bg-gradient-to-br from-orange-600 via-red-600 to-rose-700" shareable label="YOUR STREAK STORY">
        <p className="font-display text-6xl font-black">Day 1</p>
        <p className="mt-2 text-xl font-semibold text-white/90">starts now</p>
        <p className="mt-5 max-w-xs text-sm text-white/80">The best streaks begin with a single decision. Make it today.</p>
      </SlideShell>
    );
  } else {
    s.push(
      <SlideShell key="streak" bg="bg-gradient-to-br from-orange-600 via-red-600 to-rose-700" shareable label="LONGEST STREAK">
        <p className="font-display text-7xl font-black leading-none">🔥<StatNumber value={d.totals.longestStreak} /></p>
        <p className="mt-2 text-xl font-semibold text-white/90">{d.totals.longestStreak === 1 ? "day strong" : "days in a row"}</p>
        <p className="mt-5 max-w-xs text-sm text-white/80">
          {d.totals.longestStreak >= 7 ? "Discipline > motivation. You proved it." : "Every single one of those days, you chose to show up."}
        </p>
      </SlideShell>
    );
  }

  // 10 — VARK radar
  {
    const dominant = [...d.varkRadar].sort((a, b) => b.A - a.A)[0]?.subject ?? "Balanced";
    s.push(
      <SlideShell key="vark" bg="bg-gradient-to-br from-purple-800 via-violet-800 to-indigo-900" shareable label="HOW YOUR MIND LEARNS">
        <p className="font-display text-2xl font-bold">Your VARK signature</p>
        <div className="mt-3 h-[300px] w-[300px] overflow-visible">
          <ResponsiveContainer>
            <RadarChart data={d.varkRadar} outerRadius="62%" margin={{ top: 16, right: 28, bottom: 16, left: 28 }}>
              <PolarGrid stroke="rgba(255,255,255,0.25)" />
              <PolarAngleAxis
                dataKey="subject"
                tick={{ fill: "#fff", fontSize: 11 }}
                tickFormatter={(v: string) => (v?.length > 7 ? v.slice(0, 4) + "." : v)}
              />
              <PolarRadiusAxis tick={false} axisLine={false} />
              <Radar dataKey="A" stroke="#F4A300" fill="#F4A300" fillOpacity={0.55} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-base font-medium text-white">Your dominant style: {dominant}</p>
      </SlideShell>
    );
  }

  // 11 — Rank
  if (d.rank) {
    s.push(
      <SlideShell key="rank" bg="bg-gradient-to-br from-emerald-700 via-green-700 to-teal-800" shareable label="YOU'RE IN THE TOP">
        <p className="font-display text-8xl font-black"><StatNumber value={d.rank.percentile} />%</p>
        <p className="mt-3 text-base text-white/85">of {d.rank.total.toLocaleString()} Klausum learners this week</p>
      </SlideShell>
    );
  }

  // 12 — Outro
  s.push(
    <SlideShell key="outro" bg="bg-gradient-to-br from-primary via-amber-500 to-rose-600" shareable>
      <PilotOrb emoji={pilotEmoji} big />
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80">{d.companionName} says</p>
      <h2 className="mt-3 font-display text-3xl font-black leading-tight">{pilotQuote}</h2>
      <p className="mt-5 text-base font-semibold text-white/90">{closingLine}</p>
      <button
        onClick={() => { window.location.href = "/dashboard"; }}
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-bold text-black hover:bg-white/90"
      >
        <Download className="h-4 w-4" /> Back to dashboard
      </button>
    </SlideShell>
  );

  return s;
}

