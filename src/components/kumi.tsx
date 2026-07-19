/**
 * Kumi — Klausum's own mascot. A round amber glow-bug whose antennae end in
 * sparks (the same spark that lives in the logo). Original design: not an owl,
 * not an octopus — a firefly of ideas. Breathes and blinks via the existing
 * .mascot-body / .mascot-eye CSS animations.
 */
export function Kumi({ size = 96, animate = true }: { size?: number; animate?: boolean }) {
  const cls = (base: string) => (animate ? base : "");
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g className={cls("mascot-body")}>
        {/* antennae with spark tips */}
        <path d="M38 22 C34 12 26 10 22 12" stroke="#B45309" strokeWidth="3" strokeLinecap="round" fill="none" />
        <path d="M58 22 C62 12 70 10 74 12" stroke="#B45309" strokeWidth="3" strokeLinecap="round" fill="none" />
        <path d="M22 12 l1.8 3.6 3.8 1.5 -3.8 1.5 -1.8 3.6 -1.8 -3.6 -3.8 -1.5 3.8 -1.5 Z" fill="#FFC800" />
        <path d="M74 12 l1.8 3.6 3.8 1.5 -3.8 1.5 -1.8 3.6 -1.8 -3.6 -3.8 -1.5 3.8 -1.5 Z" fill="#FFC800" />
        {/* wings — flutter when animated */}
        <g className={cls("kumi-wing-l")} style={{ transformOrigin: "26px 44px" }}>
          <ellipse cx="18" cy="52" rx="10" ry="16" fill="#FFE9A8" opacity="0.9" transform="rotate(-18 18 52)" />
        </g>
        <g className={cls("kumi-wing-r")} style={{ transformOrigin: "70px 44px" }}>
          <ellipse cx="78" cy="52" rx="10" ry="16" fill="#FFE9A8" opacity="0.9" transform="rotate(18 78 52)" />
        </g>
        {/* body */}
        <circle cx="48" cy="54" r="30" fill="#FFC800" />
        <circle cx="48" cy="54" r="30" stroke="#B45309" strokeWidth="2.5" opacity="0.35" />
        {/* glow belly */}
        <ellipse cx="48" cy="66" rx="16" ry="12" fill="#FFF3C4" />
        {/* face */}
        <g className={cls("mascot-eye")}>
          <circle cx="38" cy="48" r="6.5" fill="#2A1B00" />
          <circle cx="58" cy="48" r="6.5" fill="#2A1B00" />
          <circle cx="40" cy="46" r="2.2" fill="#fff" />
          <circle cx="60" cy="46" r="2.2" fill="#fff" />
        </g>
        {/* blush + smile */}
        <circle cx="30" cy="57" r="3.5" fill="#FF9B54" opacity="0.55" />
        <circle cx="66" cy="57" r="3.5" fill="#FF9B54" opacity="0.55" />
        <path d="M42 59 Q48 64 54 59" stroke="#2A1B00" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      </g>
    </svg>
  );
}
