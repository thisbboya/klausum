import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { generateWrapped, saveWrappedSnapshot, type WrappedData } from "@/lib/wrapped";
import { X, Download, Share2 } from "lucide-react";
import html2canvas from "html2canvas";
import { toast } from "sonner";
import { CompanionSVG, getCompanion } from "@/components/companion-svg";
import { VarkRadar } from "@/components/wrapped/VarkRadar";

export const Route = createFileRoute("/_authenticated/wrapped")({ component: WrappedPage });

const STORY_MS = 7000;

/** Spotify-style loud duotone palettes, one per story. */
const THEMES = [
  { bg: "linear-gradient(160deg,#1a0533 0%,#3d0a6b 55%,#7a1fa2 100%)", accent: "#E9FF6A", ink: "#ffffff" },
  { bg: "linear-gradient(160deg,#FF3D77 0%,#B4004E 60%,#5c0027 100%)", accent: "#FFE45C", ink: "#ffffff" },
  { bg: "linear-gradient(160deg,#052e1f 0%,#0a6b45 55%,#13c06f 100%)", accent: "#FDA4FF", ink: "#ffffff" },
  { bg: "linear-gradient(160deg,#101094 0%,#2d2dd8 55%,#4f6bff 100%)", accent: "#8DFCBF", ink: "#ffffff" },
  { bg: "linear-gradient(160deg,#4a1500 0%,#a33200 55%,#ff6a00 100%)", accent: "#9BF0FF", ink: "#ffffff" },
  { bg: "linear-gradient(160deg,#31054d 0%,#8317ad 55%,#d05ce8 100%)", accent: "#C6FF4F", ink: "#ffffff" },
  { bg: "linear-gradient(160deg,#003b3b 0%,#008080 55%,#00c2b8 100%)", accent: "#FFD34F", ink: "#ffffff" },
  { bg: "linear-gradient(160deg,#3d0518 0%,#8f0e3c 55%,#e81f63 100%)", accent: "#7CFCD0", ink: "#ffffff" },
];

function useCountUp(target: number, active: boolean, duration = 1400) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) { setVal(0); return; }
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      setVal(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, active]);
  return val;
}

/** Slowly drifting decorative shapes behind each story. */
function Shapes({ accent }: { accent: string }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        className="absolute -left-24 -top-24 h-72 w-72 rounded-full opacity-25"
        style={{ backgroundColor: accent }}
        animate={{ scale: [1, 1.15, 1], rotate: [0, 25, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-32 -right-16 h-96 w-96 opacity-20"
        style={{ backgroundColor: accent, borderRadius: "38% 62% 55% 45% / 45% 40% 60% 55%" }}
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="absolute right-10 top-24 h-16 w-16 rounded-2xl opacity-30"
        style={{ backgroundColor: accent }}
        animate={{ rotate: [12, -8, 12], y: [0, 14, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

type Story = {
  key: string;
  theme: (typeof THEMES)[number];
  setup: string;
  render: (active: boolean, accent: string) => React.ReactNode;
};

function Big({ children, accent }: { children: React.ReactNode; accent: string }) {
  return (
    <motion.div
      initial={{ scale: 0.3, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.9 }}
      className="font-display text-[5.5rem] leading-none font-extrabold tracking-tight md:text-[7rem]"
      style={{ color: accent }}
    >
      {children}
    </motion.div>
  );
}

function Caption({ children, delay = 1.6 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.p
      initial={{ y: 18, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay, duration: 0.5 }}
      className="mt-4 max-w-xs text-base font-bold text-white/85"
    >
      {children}
    </motion.p>
  );
}

function WrappedPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<WrappedData | null>(null);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);
  const savedRef = useRef(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const d = await generateWrapped(u.user.id);
      setData(d);
      if (!savedRef.current) {
        savedRef.current = true;
        saveWrappedSnapshot(u.user.id, d).catch(() => {});
      }
    })();
  }, []);

  const stories: Story[] = useMemo(() => {
    if (!data) return [];
    const t = data.totals;
    const s: Story[] = [];
    const firstName = data.fullName.split(/[@\s]/)[0];

    const pilot = data.companionId ? getCompanion(data.companionId) : null;

    s.push({
      key: "intro", theme: THEMES[0],
      setup: "",
      render: (active, accent) => (
        <>
          {pilot && (
            <motion.div initial={{ scale: 0, rotate: -15 }} animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 14, delay: 0.5 }} className="mb-4">
              <CompanionSVG id={pilot.id} size={110} />
            </motion.div>
          )}
          <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
            className="font-display text-xl font-extrabold uppercase tracking-[0.3em]" style={{ color: accent }}>
            Klausum Wrapped
          </motion.div>
          <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 16, delay: 0.7 }}
            className="mt-4 font-display text-5xl font-extrabold text-white md:text-6xl">
            {firstName}, your semester in numbers.
          </motion.div>
          <Caption delay={1.4}>Tap to move forward. Hold to pause. Go on.</Caption>
        </>
      ),
    });

    s.push({
      key: "hours", theme: THEMES[1],
      setup: "You put in real time this semester…",
      render: (active, accent) => (
        <>
          <Big accent={accent}>{useCountUp(t.studyHours > 0 ? t.studyHours : t.studyMinutes, active)}{t.studyHours > 0 ? "h" : "m"}</Big>
          <Caption>of focused studying across {t.sessions} session{t.sessions === 1 ? "" : "s"}.
            {data.peakHour ? ` Your brain shows up strongest ${data.peakHour.hourLabel}.` : ""}</Caption>
        </>
      ),
    });

    s.push({
      key: "cards", theme: THEMES[2],
      setup: "Your flashcards took a beating…",
      render: (active, accent) => (
        <>
          <Big accent={accent}>{useCountUp(t.cardsReviewed, active)}</Big>
          <Caption>cards reviewed — {t.cardsAcedFirstTry} nailed on the first try.
            {data.toughestCard ? ` One card fought back ${data.toughestCard.lapses} times.` : ""}</Caption>
        </>
      ),
    });

    s.push({
      key: "quizzes", theme: THEMES[3],
      setup: "Then came the quizzes…",
      render: (active, accent) => (
        <>
          <Big accent={accent}>{useCountUp(Math.round(t.quizAccuracy * 100), active)}%</Big>
          <Caption>average accuracy over {t.quizzesTaken} quiz{t.quizzesTaken === 1 ? "" : "zes"}.
            {data.fastestQuiz ? ` Fastest: ~${data.fastestQuiz.secondsPerQuestion}s a question on “${data.fastestQuiz.title}”.` : ""}</Caption>
        </>
      ),
    });

    const topSubject = data.topSubject;
    if (topSubject) {
      s.push({
        key: "subject", theme: THEMES[4],
        setup: "One subject owned your calendar…",
        render: (_a, accent) => (
          <>
            <motion.div initial={{ rotate: -6, scale: 0.4, opacity: 0 }} animate={{ rotate: 0, scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 220, damping: 15, delay: 0.9 }}
              className="font-display text-6xl font-extrabold md:text-7xl" style={{ color: accent }}>
              {topSubject.name}
            </motion.div>
            <Caption>{Math.round(topSubject.minutes)} minutes deep. That's commitment.</Caption>
          </>
        ),
      });
    }

    s.push({
      key: "streak", theme: THEMES[5],
      setup: "Consistency check…",
      render: (active, accent) => (
        <>
          <Big accent={accent}>{useCountUp(Math.max(t.longestStreak, t.currentStreak), active)} days</Big>
          <Caption>your longest streak. Currently riding {t.currentStreak}. Streaks are how legends are built.</Caption>
        </>
      ),
    });

    s.push({
      key: "xp", theme: THEMES[6],
      setup: "All of it added up…",
      render: (active, accent) => (
        <>
          <Big accent={accent}>{useCountUp(t.xpEarned, active).toLocaleString()} XP</Big>
          <Caption>
            earned this semester{data.bestDay ? ` — your biggest day was ${new Date(data.bestDay.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })} with ${data.bestDay.xp} XP` : ""}.
            {data.rank ? ` That puts you in the top ${data.rank.percentile}% of Klausum.` : ""}
          </Caption>
        </>
      ),
    });

    // Learning personality — the VARK radar as a visual slide
    if (data.varkRadar.some((v) => v.A > 0)) {
      s.push({
        key: "vark", theme: THEMES[0],
        setup: "Your learning personality…",
        render: (_a, accent) => (
          <>
            <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 180, damping: 16, delay: 0.6 }}
              className="h-64 w-full max-w-sm">
              <VarkRadar data={data.varkRadar} />
            </motion.div>
            <Caption delay={1.2}>
              Strongest: {[...data.varkRadar].sort((a, b) => b.A - a.A)[0].subject}. Klausum rewrites every material to match.
            </Caption>
          </>
        ),
      });
    }

    s.push({
      key: "finale", theme: THEMES[7],
      setup: "",
      render: (_a, accent) => (
        <>
          {pilot && (
            <motion.div initial={{ y: -20, scale: 0 }} animate={{ y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 13, delay: 0.15 }} className="mb-3">
              <CompanionSVG id={pilot.id} size={96} />
            </motion.div>
          )}
          <motion.div initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}
            className="font-display text-4xl font-extrabold text-white md:text-5xl">
            That's your semester, {firstName}.
          </motion.div>
          <Caption delay={0.9}>{data.companionName} was with you the whole way. Share it or start the next chapter.</Caption>
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 1.3 }}
            className="mt-8 flex gap-3">
            <button
              onClick={(e) => { e.stopPropagation(); void shareCard(true); }}
              className="btn-3d inline-flex items-center gap-2 rounded-2xl px-6 py-3 font-display text-sm font-extrabold uppercase tracking-wide text-black"
              style={{ backgroundColor: accent }}
            >
              <Share2 className="h-4 w-4" /> Share
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); void shareCard(false); }}
              className="inline-flex items-center gap-2 rounded-2xl border-2 border-white/40 px-6 py-3 font-display text-sm font-extrabold uppercase tracking-wide text-white"
            >
              <Download className="h-4 w-4" /> Save image
            </button>
          </motion.div>
        </>
      ),
    });

    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const next = useCallback(() => {
    setIdx((i) => Math.min(i + 1, stories.length - 1));
  }, [stories.length]);
  const prev = useCallback(() => setIdx((i) => Math.max(i - 1, 0)), []);

  // Auto-advance timer (except on the finale)
  useEffect(() => {
    if (!data || paused || idx >= stories.length - 1) return;
    const id = setTimeout(next, STORY_MS);
    return () => clearTimeout(id);
  }, [idx, paused, data, next, stories.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "Escape") navigate({ to: "/dashboard" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, navigate]);

  async function shareCard(useShareSheet: boolean) {
    if (!shareRef.current || !data) return;
    try {
      const canvas = await html2canvas(shareRef.current, { backgroundColor: null, scale: 2 });
      const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/png"));
      if (!blob) throw new Error("Could not render image");
      const file = new File([blob], "klausum-wrapped.png", { type: "image/png" });
      if (useShareSheet && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "My Klausum Wrapped" });
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "klausum-wrapped.png";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Wrapped image saved");
    } catch (e: any) {
      if (e?.name !== "AbortError") toast.error(e?.message ?? "Could not share");
    }
  }

  if (!data) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: THEMES[0].bg }}>
        <motion.div
          animate={{ scale: [1, 1.12, 1] }}
          transition={{ duration: 1.2, repeat: Infinity }}
          className="font-display text-2xl font-extrabold text-white"
        >
          Rolling up your semester…
        </motion.div>
      </div>
    );
  }

  const story = stories[idx];

  return (
    <div
      className="fixed inset-0 z-50 select-none overflow-hidden"
      style={{ background: story.theme.bg }}
      onPointerDown={() => setPaused(true)}
      onPointerUp={(e) => {
        setPaused(false);
        const x = (e as React.PointerEvent).clientX;
        if (x < window.innerWidth / 3) prev();
        else next();
      }}
    >
      <Shapes accent={story.theme.accent} />

      {/* Segmented story progress */}
      <div className="absolute left-0 right-0 top-0 z-10 flex gap-1.5 p-3">
        {stories.map((st, i) => (
          <div key={st.key} className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
            {i < idx && <div className="h-full w-full bg-white" />}
            {i === idx && (
              <motion.div
                key={`${idx}-${paused}`}
                className="h-full bg-white"
                initial={{ width: "0%" }}
                animate={{ width: paused || idx === stories.length - 1 ? "0%" : "100%" }}
                transition={{ duration: STORY_MS / 1000, ease: "linear" }}
              />
            )}
          </div>
        ))}
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); navigate({ to: "/dashboard" }); }}
        onPointerUp={(e) => e.stopPropagation()}
        className="absolute right-3 top-6 z-20 rounded-full bg-black/25 p-2 text-white hover:bg-black/40"
        aria-label="Close Wrapped"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Hard cut between stories (like Spotify); each element animates itself in */}
        <div
          key={story.key}
          className="relative z-[5] flex h-full flex-col items-center justify-center px-8 text-center"
        >
          {story.setup && (
            <motion.p
              initial={{ y: -14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.45 }}
              className="mb-6 font-display text-lg font-extrabold uppercase tracking-widest text-white/80"
            >
              {story.setup}
            </motion.p>
          )}
          <StoryBody story={story} accent={story.theme.accent} />
        </div>

      {/* Hidden share card — Spotify-style framed story (9:16), captured
          with the CURRENT slide's theme so every share looks distinct. */}
      <div className="pointer-events-none fixed -left-[9999px] top-0">
        <div
          ref={shareRef}
          className="flex h-[910px] w-[512px] flex-col p-6"
          style={{ background: story.theme.bg }}
        >
          {/* The frame: thick accent border in the slide's color, like
              Spotify's story frames */}
          <div
            className="flex flex-1 flex-col justify-between rounded-[2rem] p-8"
            style={{ border: `6px solid ${story.theme.accent}` }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-display text-2xl font-extrabold lowercase text-white">klausum</div>
                <div className="font-display text-[11px] font-extrabold uppercase tracking-[0.35em]" style={{ color: story.theme.accent }}>
                  Wrapped 2026
                </div>
              </div>
              <CompanionSVG id={data.companionId} size={84} animate={false} />
            </div>

            <div className="text-center">
              <div className="font-display text-3xl font-extrabold text-white">
                {data.fullName.split(/[@\s]/)[0]}'s semester
              </div>
              <div className="mt-8 space-y-5">
                {[
                  [`${data.totals.studyHours > 0 ? `${data.totals.studyHours}h` : `${data.totals.studyMinutes}m`}`, "focused study"],
                  [`${data.totals.cardsReviewed}`, "flashcards reviewed"],
                  [`${Math.round(data.totals.quizAccuracy * 100)}%`, "quiz accuracy"],
                  [`${data.totals.xpEarned.toLocaleString()}`, "XP earned"],
                  ...(data.rank ? [[`Top ${data.rank.percentile}%`, "of all students"]] : []),
                ].map(([big, small]) => (
                  <div key={small as string}>
                    <div className="font-display text-5xl font-extrabold leading-none" style={{ color: story.theme.accent }}>
                      {big}
                    </div>
                    <div className="mt-1 text-sm font-extrabold uppercase tracking-widest text-white/75">{small}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-xs font-extrabold uppercase tracking-widest text-white/60">
                {data.companionName} was my pilot
              </div>
              <div className="rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-wide"
                style={{ backgroundColor: story.theme.accent, color: "#111" }}>
                klausum.app
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Rendered as a child component so hooks inside `render` (count-ups) get a
 *  fresh mount per story — the AnimatePresence key guarantees it. */
function StoryBody({ story, accent }: { story: Story; accent: string }) {
  return <>{story.render(true, accent)}</>;
}
