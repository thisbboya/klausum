import { Kumi } from "@/components/kumi";

const SPARKS = [
  { left: "8%", top: "18%", size: 14, delay: "0s", dur: "7s" },
  { left: "16%", top: "68%", size: 10, delay: "1.2s", dur: "9s" },
  { left: "82%", top: "22%", size: 12, delay: "0.6s", dur: "8s" },
  { left: "88%", top: "62%", size: 16, delay: "2s", dur: "10s" },
  { left: "70%", top: "82%", size: 9, delay: "0.3s", dur: "7.5s" },
  { left: "28%", top: "10%", size: 9, delay: "1.7s", dur: "8.5s" },
];

/**
 * Playful Duolingo-grade backdrop for the auth pages: soft amber/sky blobs,
 * floating four-point sparks, a faint dotted arc, and Kumi peeking from the
 * corner. Pure CSS motion, all pointer-events-none.
 */
export function AuthBg() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
      {/* Big soft color blobs */}
      <div
        className="absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(255,200,0,0.16) 0%, transparent 65%)" }}
      />
      <div
        className="absolute -bottom-48 -right-40 h-[560px] w-[560px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(28,176,246,0.13) 0%, transparent 65%)" }}
      />
      <div
        className="absolute left-1/2 top-1/2 h-[640px] w-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(255,200,0,0.07) 0%, transparent 70%)" }}
      />

      {/* Floating sparks — the same spark that tips Kumi's antennae */}
      {SPARKS.map((s, i) => (
        <svg
          key={i}
          className="absolute klausum-spark-float"
          style={{ left: s.left, top: s.top, animationDelay: s.delay, animationDuration: s.dur }}
          width={s.size}
          height={s.size}
          viewBox="0 0 20 20"
        >
          <path
            d="M10 0 l2.4 7.6 L20 10 l-7.6 2.4 L10 20 l-2.4-7.6 L0 10 l7.6-2.4 Z"
            fill="#FFC800"
            opacity="0.5"
          />
        </svg>
      ))}

      {/* Slowly rotating dotted ring */}
      <div
        className="absolute -right-24 -top-24 h-[340px] w-[340px] rounded-full border-2 border-dashed"
        style={{ borderColor: "rgba(255,200,0,0.18)", animation: "klausumSlowRotate 40s linear infinite" }}
      />
      <div
        className="absolute -left-20 bottom-16 h-[220px] w-[220px] rounded-full border-2 border-dashed"
        style={{ borderColor: "rgba(28,176,246,0.15)", animation: "klausumSlowRotate 55s linear infinite reverse" }}
      />

      {/* Kumi peeking from the bottom corner */}
      <div className="absolute -bottom-7 right-6 rotate-[-8deg] opacity-90 md:right-16">
        <Kumi size={120} />
      </div>
    </div>
  );
}
