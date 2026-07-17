import { motion } from "framer-motion";

/**
 * The 10 Ghanaian Pilots of Klausum.
 * IDs are stable (1–10) so existing user.companion_id values keep working.
 * Every mascot is alive: it breathes, blinks, and blushes.
 */
export type Companion = {
  id: number;
  name: string;
  trait: string;
  color: string;
  description: string;
  shape: "blob" | "spiky" | "droopy" | "round" | "fluffy" | "fox" | "bear" | "bird" | "owl" | "eagle";
};

export const COMPANIONS: Companion[] = [
  { id: 1,  name: "ANANSE", trait: "CURIOUS",  color: "#F4A300", description: "Spider — clever trickster",     shape: "blob"   },
  { id: 2,  name: "SUNSUM", trait: "CHILL",    color: "#3B82F6", description: "Spirit glow — calm light",      shape: "spiky"  },
  { id: 3,  name: "ABENA",  trait: "DREAMY",   color: "#FBBF24", description: "Star child — dreamy",           shape: "droopy" },
  { id: 4,  name: "KOFI",   trait: "STEADY",   color: "#10B981", description: "Steady warrior-tortoise",       shape: "round"  },
  { id: 5,  name: "AWO",    trait: "GENTLE",   color: "#94A3B8", description: "Elder moon — gentle",           shape: "fluffy" },
  { id: 6,  name: "AMMA",   trait: "BOLD",     color: "#F97316", description: "Fox — bold, fierce",            shape: "fox"    },
  { id: 7,  name: "KWEKU",  trait: "COZY",     color: "#92400E", description: "Bear — warm, cozy",             shape: "bear"   },
  { id: 8,  name: "KOJO",   trait: "PLAYFUL",  color: "#0D9488", description: "Parrot — playful, bright",      shape: "bird"   },
  { id: 9,  name: "AKUA",   trait: "WISE",     color: "#8B5CF6", description: "Owl — wise, nocturnal",         shape: "owl"    },
  { id: 10, name: "YOOFI",  trait: "FIERCE",   color: "#1D4ED8", description: "Hawk — fierce, sharp",          shape: "eagle"  },
];

export function getCompanion(id?: number | null): Companion {
  return COMPANIONS.find((c) => c.id === id) ?? COMPANIONS[0];
}

/* ── color helpers: light belly / dark accents from the base hue ── */
function mix(hex: string, target: string, amount: number): string {
  const h = (s: string) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
  const [r1, g1, b1] = h(hex);
  const [r2, g2, b2] = h(target);
  const m = (a: number, b: number) => Math.round(a + (b - a) * amount);
  return `#${[m(r1, r2), m(g1, g2), m(b1, b2)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
const lighten = (hex: string, amt: number) => mix(hex, "#ffffff", amt);
const darken = (hex: string, amt: number) => mix(hex, "#000000", amt);

export function CompanionSVG({
  id,
  size = 80,
  animate = true,
}: {
  id: number;
  size?: number;
  animate?: boolean;
}) {
  const c = getCompanion(id);
  const Wrapper: any = animate ? motion.div : "div";
  const animProps = animate
    ? {
        animate: { y: [0, -5, 0] },
        transition: { duration: 3, repeat: Infinity, ease: "easeInOut" },
      }
    : {};
  // desync blink/breathe between mascots on the same screen
  const delay = `${((id * 0.73) % 2.8).toFixed(2)}s`;
  return (
    <Wrapper style={{ width: size, height: size, display: "inline-block" }} {...animProps}>
      <svg
        viewBox="0 0 100 100"
        width="100%"
        height="100%"
        style={{ ["--mascot-delay" as any]: delay, overflow: "visible" }}
      >
        <g className="mascot-body">
          <Body shape={c.shape} color={c.color} />
        </g>
      </svg>
    </Wrapper>
  );
}

/* ── shared face parts ── */
function Eyes({ cy = 48, dx = 12, r = 5.5, lidded = false }: { cy?: number; dx?: number; r?: number; lidded?: boolean }) {
  return (
    <>
      {[50 - dx, 50 + dx].map((cx, i) => (
        <g key={i} className="mascot-eye">
          <circle cx={cx} cy={cy} r={r} fill="#2B2B33" />
          <circle cx={cx + r * 0.3} cy={cy - r * 0.35} r={r * 0.32} fill="#fff" />
          <circle cx={cx - r * 0.25} cy={cy + r * 0.25} r={r * 0.16} fill="#fff" opacity="0.7" />
          {lidded && (
            <rect x={cx - r} y={cy - r} width={r * 2} height={r * 0.7} rx={r * 0.3} fill="#2B2B33" opacity="0.0" />
          )}
        </g>
      ))}
    </>
  );
}

function Blush({ cy = 56, dx = 19 }: { cy?: number; dx?: number }) {
  return (
    <>
      <ellipse cx={50 - dx} cy={cy} rx="4.5" ry="2.6" fill="#FB7185" opacity="0.45" />
      <ellipse cx={50 + dx} cy={cy} rx="4.5" ry="2.6" fill="#FB7185" opacity="0.45" />
    </>
  );
}

function Smile({ y = 58, open = false }: { y?: number; open?: boolean }) {
  return open ? (
    <path d={`M44 ${y} Q50 ${y + 9} 56 ${y} Q50 ${y + 3} 44 ${y}`} fill="#2B2B33" />
  ) : (
    <path d={`M43 ${y} Q50 ${y + 6} 57 ${y}`} stroke="#2B2B33" strokeWidth="2.6" fill="none" strokeLinecap="round" />
  );
}

function Body({ shape, color }: { shape: Companion["shape"]; color: string }) {
  const belly = lighten(color, 0.45);
  const dark = darken(color, 0.25);

  switch (shape) {
    case "blob": // Ananse the spider — blob with little legs + antennae
      return (
        <>
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <ellipse cx={16 - i * 1.5} cy={62 + i * 9} rx="6" ry="3.4" fill={dark} transform={`rotate(${-20 - i * 8} ${16 - i * 1.5} ${62 + i * 9})`} />
              <ellipse cx={84 + i * 1.5} cy={62 + i * 9} rx="6" ry="3.4" fill={dark} transform={`rotate(${20 + i * 8} ${84 + i * 1.5} ${62 + i * 9})`} />
            </g>
          ))}
          <path d="M38 22 Q34 12 26 10" stroke={dark} strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M62 22 Q66 12 74 10" stroke={dark} strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <circle cx="25" cy="9" r="3.2" fill={color} />
          <circle cx="75" cy="9" r="3.2" fill={color} />
          <ellipse cx="50" cy="55" rx="34" ry="32" fill={color} />
          <ellipse cx="50" cy="66" rx="20" ry="14" fill={belly} />
          <Eyes />
          <Blush />
          <Smile open />
        </>
      );
    case "spiky": // Sunsum the spirit — soft flame with inner glow
      return (
        <>
          <path d="M50 8 Q60 24 72 20 Q68 34 82 42 Q68 48 76 62 Q62 62 62 76 Q52 68 44 80 Q40 66 26 70 Q32 56 18 50 Q32 44 26 30 Q40 34 42 20 Q48 26 50 8" fill={color} />
          <ellipse cx="50" cy="52" rx="22" ry="21" fill={belly} />
          <Eyes cy={49} r={5} />
          <Blush cy={57} dx={15} />
          <Smile y={59} />
        </>
      );
    case "droopy": // Abena the star child — sleepy star
      return (
        <>
          <path d="M50 10 L59 32 L82 33 L64 47 L71 70 L50 57 L29 70 L36 47 L18 33 L41 32 Z" fill={color} transform="translate(0 6)" />
          <circle cx="50" cy="50" r="24" fill={color} />
          <ellipse cx="50" cy="60" rx="14" ry="9" fill={belly} />
          {/* sleepy lidded eyes */}
          <g className="mascot-eye">
            <path d="M33 49 Q38 53 43 49" stroke="#2B2B33" strokeWidth="2.8" fill="none" strokeLinecap="round" />
            <path d="M57 49 Q62 53 67 49" stroke="#2B2B33" strokeWidth="2.8" fill="none" strokeLinecap="round" />
          </g>
          <Blush cy={56} dx={16} />
          <Smile y={60} />
          <circle cx="76" cy="22" r="2.4" fill={belly} className="mascot-eye" />
        </>
      );
    case "round": // Kofi the tortoise — shell dome + head + feet
      return (
        <>
          <circle cx="50" cy="34" r="13" fill={lighten(color, 0.25)} />
          <ellipse cx="24" cy="80" rx="7" ry="5" fill={lighten(color, 0.25)} />
          <ellipse cx="76" cy="80" rx="7" ry="5" fill={lighten(color, 0.25)} />
          <path d="M14 66 Q14 30 50 30 Q86 30 86 66 Q86 84 50 84 Q14 84 14 66" fill={color} />
          <path d="M30 52 Q50 42 70 52 M38 38 L36 60 M62 38 L64 60 M24 66 L76 66" stroke={dark} strokeWidth="2" fill="none" opacity="0.5" />
          <Eyes cy={40} dx={5.5} r={3.6} />
          <Blush cy={45} dx={11} />
          <path d="M46 47 Q50 50 54 47" stroke="#2B2B33" strokeWidth="2" fill="none" strokeLinecap="round" />
        </>
      );
    case "fluffy": // Awo the moon elder — cloud fluff + crescent
      return (
        <>
          <circle cx="28" cy="42" r="15" fill={color} />
          <circle cx="72" cy="42" r="15" fill={color} />
          <circle cx="50" cy="32" r="16" fill={color} />
          <ellipse cx="50" cy="60" rx="33" ry="26" fill={color} />
          <ellipse cx="50" cy="68" rx="19" ry="12" fill={belly} />
          {/* gentle closed-arc eyes */}
          <g className="mascot-eye">
            <path d="M34 50 Q39 46 44 50" stroke="#2B2B33" strokeWidth="2.8" fill="none" strokeLinecap="round" />
            <path d="M56 50 Q61 46 66 50" stroke="#2B2B33" strokeWidth="2.8" fill="none" strokeLinecap="round" />
          </g>
          <Blush cy={57} />
          <Smile y={59} />
          <path d="M78 18 A9 9 0 1 0 87 30 A7 7 0 1 1 78 18" fill="#FBBF24" />
        </>
      );
    case "fox": // Amma the fox — ears, muzzle, whisker dots
      return (
        <>
          <polygon points="24,14 36,36 16,42" fill={color} />
          <polygon points="27,20 34,34 22,38" fill={belly} />
          <polygon points="76,14 64,36 84,42" fill={color} />
          <polygon points="73,20 66,34 78,38" fill={belly} />
          <circle cx="50" cy="56" r="32" fill={color} />
          <ellipse cx="50" cy="66" rx="16" ry="12" fill={belly} />
          <Eyes cy={50} />
          <Blush cy={58} />
          <ellipse cx="50" cy="61" rx="3.4" ry="2.6" fill="#2B2B33" />
          <path d="M50 63 Q50 68 46 69 M50 63 Q50 68 54 69" stroke="#2B2B33" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          <circle cx="30" cy="62" r="1" fill={dark} /><circle cx="26" cy="66" r="1" fill={dark} />
          <circle cx="70" cy="62" r="1" fill={dark} /><circle cx="74" cy="66" r="1" fill={dark} />
        </>
      );
    case "bear": // Kweku the bear — round ears, muzzle, honey belly
      return (
        <>
          <circle cx="26" cy="26" r="12" fill={color} />
          <circle cx="26" cy="26" r="6" fill={belly} />
          <circle cx="74" cy="26" r="12" fill={color} />
          <circle cx="74" cy="26" r="6" fill={belly} />
          <circle cx="50" cy="56" r="34" fill={color} />
          <ellipse cx="50" cy="64" rx="14" ry="11" fill={belly} />
          <Eyes cy={48} />
          <Blush cy={56} />
          <ellipse cx="50" cy="61" rx="4" ry="3" fill="#2B2B33" />
          <path d="M50 64 Q50 68 50 68 M45 70 Q50 74 55 70" stroke="#2B2B33" strokeWidth="2" fill="none" strokeLinecap="round" />
        </>
      );
    case "bird": // Kojo the parrot — head curl, beak, wing
      return (
        <>
          <path d="M50 16 Q58 8 64 14 Q58 14 56 22" fill="none" stroke={dark} strokeWidth="3.4" strokeLinecap="round" />
          <ellipse cx="50" cy="56" rx="31" ry="30" fill={color} />
          <ellipse cx="50" cy="68" rx="17" ry="12" fill={belly} />
          <ellipse cx="26" cy="60" rx="9" ry="14" fill={dark} transform="rotate(18 26 60)" />
          <Eyes cy={48} dx={11} r={5} />
          <Blush cy={56} dx={17} />
          <polygon points="44,56 56,56 50,66" fill="#F59E0B" />
          <ellipse cx="47" cy="57.5" rx="2" ry="1" fill={darken("#F59E0B", 0.25)} />
        </>
      );
    case "owl": // Akua the owl — eye discs, brow tufts, belly scallops
      return (
        <>
          <path d="M28 22 Q24 10 34 14 M72 22 Q76 10 66 14" stroke={color} strokeWidth="5" fill="none" strokeLinecap="round" />
          <ellipse cx="50" cy="56" rx="32" ry="33" fill={color} />
          <circle cx="37" cy="47" r="11" fill="#fff" />
          <circle cx="63" cy="47" r="11" fill="#fff" />
          <g className="mascot-eye">
            <circle cx="37" cy="47" r="5" fill="#2B2B33" />
            <circle cx="63" cy="47" r="5" fill="#2B2B33" />
            <circle cx="38.5" cy="45.5" r="1.6" fill="#fff" />
            <circle cx="64.5" cy="45.5" r="1.6" fill="#fff" />
          </g>
          <polygon points="46,57 54,57 50,64" fill="#F59E0B" />
          <path d="M38 72 Q44 66 50 72 Q56 66 62 72" stroke={belly} strokeWidth="3" fill="none" strokeLinecap="round" />
          <Blush cy={60} dx={20} />
        </>
      );
    case "eagle": // Yoofi the hawk — fierce brow, sharp beak
      return (
        <>
          <path d="M20 78 Q14 46 34 26 Q50 12 66 26 Q86 46 80 78 Q66 88 50 88 Q34 88 20 78" fill={color} />
          <ellipse cx="50" cy="72" rx="16" ry="11" fill={belly} />
          <path d="M28 40 L44 46 M72 40 L56 46" stroke={dark} strokeWidth="4" strokeLinecap="round" />
          <Eyes cy={51} r={5} />
          <polygon points="44,60 56,60 50,70" fill="#F59E0B" />
          <Blush cy={60} dx={18} />
        </>
      );
  }
}
