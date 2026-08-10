// The landing backdrop.
//
// What was here before: three 460-500px circles at 20-30% opacity under an
// 80-90px blur. On an off-white page that is, optically, nothing — which is
// exactly why it kept reading as "plain". Heavy blur plus low opacity always
// collapses toward the page colour.
//
// Duolingo and OnePrep don't use haze; they use flat vector scenes with
// confident, unblurred colour. So this is a real illustration: a sky wash, a
// sun, drifting clouds, three layered hills, and a few study props sitting in
// the landscape. Pure SVG + CSS keyframes — no framer-motion, no blur filters,
// and it scales to any viewport without going soft.
export function LandingScene() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background"
    >
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMax slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="ks-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--sky)" stopOpacity="0.16" />
            <stop offset="55%" stopColor="var(--sky)" stopOpacity="0.05" />
            <stop offset="100%" stopColor="var(--background)" stopOpacity="0" />
          </linearGradient>
          <pattern id="ks-dots" width="26" height="26" patternUnits="userSpaceOnUse">
            <circle cx="1.6" cy="1.6" r="1.6" fill="var(--border)" opacity="0.55" />
          </pattern>
        </defs>

        {/* sky + paper texture */}
        <rect width="1440" height="900" fill="url(#ks-sky)" />
        <rect width="1440" height="620" fill="url(#ks-dots)" opacity="0.5" />

        {/* sun */}
        <g className="ks-drift-slow">
          <circle cx="1180" cy="150" r="62" fill="var(--primary)" opacity="0.18" />
          <circle cx="1180" cy="150" r="40" fill="var(--primary)" opacity="0.9" />
        </g>

        {/* clouds — flat lozenges, the Duolingo way */}
        <g fill="var(--card)" opacity="0.9">
          <g className="ks-cloud-a">
            <rect x="140" y="120" width="150" height="44" rx="22" />
            <rect x="180" y="96" width="90" height="44" rx="22" />
          </g>
          <g className="ks-cloud-b">
            <rect x="880" y="230" width="120" height="36" rx="18" />
            <rect x="912" y="210" width="70" height="36" rx="18" />
          </g>
          <g className="ks-cloud-a" style={{ animationDelay: "-9s" }}>
            <rect x="520" y="70" width="110" height="34" rx="17" />
            <rect x="548" y="52" width="64" height="34" rx="17" />
          </g>
        </g>

        {/* hills — three flat bands, back to front, CEG greens */}
        <path
          d="M0 660 C 220 560, 420 700, 640 620 S 1060 520, 1440 640 L1440 900 L0 900 Z"
          fill="var(--sky)"
          opacity="0.16"
        />
        <path
          d="M0 730 C 260 640, 500 780, 760 700 S 1180 620, 1440 720 L1440 900 L0 900 Z"
          fill="var(--success)"
          opacity="0.20"
        />
        <path
          d="M0 800 C 300 740, 560 850, 880 790 S 1240 730, 1440 800 L1440 900 L0 900 Z"
          fill="var(--success)"
          opacity="0.34"
        />

        {/* signpost — the goal at the top of the hill */}
        <g className="ks-bob">
          <rect x="1042" y="596" width="9" height="86" rx="4" fill="var(--muted-foreground)" opacity="0.55" />
          <rect x="1006" y="566" width="96" height="46" rx="12" fill="var(--primary)" />
          <text
            x="1054"
            y="596"
            textAnchor="middle"
            fontSize="24"
            fontWeight="800"
            fill="var(--primary-foreground)"
            fontFamily="var(--font-display), sans-serif"
          >
            A+
          </text>
        </g>

        {/* study props in the landscape */}
        <g className="ks-bob" style={{ animationDelay: "-1.4s" }}>
          {/* stacked books */}
          <rect x="232" y="690" width="118" height="22" rx="7" fill="var(--grape)" opacity="0.85" />
          <rect x="246" y="666" width="118" height="22" rx="7" fill="var(--sky)" opacity="0.85" />
          <rect x="238" y="642" width="118" height="22" rx="7" fill="var(--primary)" opacity="0.9" />
        </g>

        <g className="ks-bob" style={{ animationDelay: "-2.6s" }}>
          {/* pencil */}
          <rect
            x="628" y="620" width="20" height="104" rx="8"
            fill="var(--primary)" transform="rotate(18 638 672)"
          />
          <path d="M642 726 L664 736 L648 750 Z" fill="var(--muted-foreground)" opacity="0.7" />
        </g>

        <g className="ks-bob" style={{ animationDelay: "-3.8s" }}>
          {/* flask */}
          <path
            d="M470 636 h30 v34 l30 58 a14 14 0 0 1 -12 22 h-66 a14 14 0 0 1 -12 -22 l30 -58 z"
            fill="var(--success)"
            opacity="0.85"
          />
          <rect x="464" y="628" width="42" height="12" rx="6" fill="var(--success)" />
        </g>
      </svg>
    </div>
  );
}
