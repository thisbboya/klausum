import { useEffect, useRef } from "react";
import type { SVGProps } from "react";
import { animate, createTimeline, stagger } from "animejs";
import { Kumi } from "@/components/kumi";

type Props = SVGProps<SVGSVGElement> & { size?: number };

/**
 * Klausum mark v2 — the "spark badge".
 *
 * A chunky rounded badge (Duolingo-grade fill, reads at 16px) carrying a bold
 * K whose upper arm launches a four-point spark: knowledge catching fire.
 * The badge fills with currentColor so it inherits the pilot-driven primary;
 * the glyph uses the primary-foreground token for guaranteed contrast.
 */
export function KlausumMark({ size = 32, ...props }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {/* badge */}
      <rect className="km-badge" x="3" y="3" width="58" height="58" rx="17" fill="currentColor" />
      {/* K — two bold strokes, rounded terminals */}
      <path
        className="km-stroke"
        d="M23 17 V47"
        stroke="var(--primary-foreground, #fff)"
        strokeWidth="7.5"
        strokeLinecap="round"
      />
      <path
        className="km-stroke"
        d="M23 35 L37 20 M26.5 31.5 L39 47"
        stroke="var(--primary-foreground, #fff)"
        strokeWidth="7.5"
        strokeLinecap="round"
      />
      {/* the spark leaving the K's upper arm */}
      <path
        className="km-spark"
        d="M46 12 L48 17 L53 19 L48 21 L46 26 L44 21 L39 19 L44 17 Z"
        fill="var(--primary-foreground, #fff)"
      />
    </svg>
  );
}

/**
 * The full Duolingo-style lockup: Kumi the mascot beside the lowercase
 * wordmark. Use this everywhere the brand name appears — mascot IS the logo.
 */
export function KlausumLogo({
  size = 28,
  animate: animateMascot = true,
  className = "",
  wordmarkClassName = "",
}: {
  size?: number;
  animate?: boolean;
  className?: string;
  wordmarkClassName?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <Kumi size={Math.round(size * 1.3)} animate={animateMascot} />
      <span
        className={`font-display font-extrabold leading-none text-primary ${wordmarkClassName}`}
        style={{ fontSize: Math.round(size * 0.82), letterSpacing: "-0.02em" }}
      >
        klausum
      </span>
    </span>
  );
}

/**
 * Auth-page hero version: the badge springs in, the K draws itself, and the
 * spark pops with a spin — powered by anime.js.
 */
export function AnimatedKlausumMark({ size = 72 }: { size?: number }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const badge = root.querySelector(".km-badge");
    const strokes = root.querySelectorAll(".km-stroke");
    const spark = root.querySelector(".km-spark");
    if (!badge || !spark) return;

    const tl = createTimeline();
    tl.add(badge, {
      scale: [0, 1],
      rotate: [-14, 0],
      duration: 650,
      ease: "outElastic(1, .6)",
      transformOrigin: "32px 32px",
    })
      .add(strokes, {
        opacity: [0, 1],
        scale: [0.6, 1],
        duration: 380,
        delay: stagger(90),
        ease: "outBack(2)",
        transformOrigin: "32px 32px",
      }, "-=280")
      .add(spark, {
        scale: [0, 1.25, 1],
        rotate: [0, 180],
        duration: 620,
        ease: "outBack(3)",
        transformOrigin: "46px 19px",
      }, "-=120");

    // Gentle perpetual twinkle on the spark after the intro
    const twinkle = animate(spark, {
      scale: [1, 1.18, 1],
      duration: 2200,
      delay: 1400,
      loop: true,
      ease: "inOutSine",
      transformOrigin: "46px 19px",
    });

    return () => {
      tl.pause();
      twinkle.pause();
    };
  }, []);

  return <KlausumMark ref={ref as any} size={size} className="text-primary" />;
}
