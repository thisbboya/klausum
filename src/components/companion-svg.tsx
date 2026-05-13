import { motion } from "framer-motion";

export type Companion = {
  id: number;
  name: string;
  trait: string;
  color: string;
  shape: "blob" | "spiky" | "droopy" | "round" | "fluffy" | "fox" | "bear" | "bird" | "owl" | "eagle";
};

export const COMPANIONS: Companion[] = [
  { id: 1, name: "KOJO", trait: "CURIOUS", color: "#F4A300", shape: "blob" },
  { id: 2, name: "ABENA", trait: "CHILL", color: "#3B82F6", shape: "spiky" },
  { id: 3, name: "KWAME", trait: "DREAMY", color: "#FCD34D", shape: "droopy" },
  { id: 4, name: "AMA", trait: "STEADY", color: "#10B981", shape: "round" },
  { id: 5, name: "YAW", trait: "GENTLE", color: "#F1F5F9", shape: "fluffy" },
  { id: 6, name: "AKUA", trait: "BOLD", color: "#F59E0B", shape: "fox" },
  { id: 7, name: "KOFI", trait: "COZY", color: "#92400E", shape: "bear" },
  { id: 8, name: "EFUA", trait: "PLAYFUL", color: "#84CC16", shape: "bird" },
  { id: 9, name: "NANA", trait: "WISE", color: "#8B5CF6", shape: "owl" },
  { id: 10, name: "KWESI", trait: "FIERCE", color: "#60A5FA", shape: "eagle" },
];

export function getCompanion(id?: number | null): Companion {
  return COMPANIONS.find((c) => c.id === id) ?? COMPANIONS[0];
}

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
        animate: { y: [0, -6, 0] },
        transition: { duration: 3, repeat: Infinity, ease: "easeInOut" },
      }
    : {};
  return (
    <Wrapper style={{ width: size, height: size, display: "inline-block" }} {...animProps}>
      <Body shape={c.shape} color={c.color} />
    </Wrapper>
  );
}

function Body({ shape, color }: { shape: Companion["shape"]; color: string }) {
  const eyes = (
    <>
      <circle cx="38" cy="48" r="4.5" fill="#0F172A" />
      <circle cx="62" cy="48" r="4.5" fill="#0F172A" />
      <circle cx="39" cy="46.5" r="1.4" fill="#fff" />
      <circle cx="63" cy="46.5" r="1.4" fill="#fff" />
    </>
  );
  const smile = (
    <path d="M40 62 Q50 70 60 62" stroke="#0F172A" strokeWidth="2.4" fill="none" strokeLinecap="round" />
  );
  switch (shape) {
    case "blob":
      return (
        <svg viewBox="0 0 100 100" width="100%" height="100%">
          <ellipse cx="50" cy="55" rx="36" ry="34" fill={color} />
          {eyes}{smile}
        </svg>
      );
    case "spiky":
      return (
        <svg viewBox="0 0 100 100" width="100%" height="100%">
          <polygon points="50,8 58,22 74,18 66,34 84,38 70,50 84,62 66,66 74,82 58,78 50,92 42,78 26,82 34,66 16,62 30,50 16,38 34,34 26,18 42,22" fill={color} />
          {eyes}{smile}
        </svg>
      );
    case "droopy":
      return (
        <svg viewBox="0 0 100 100" width="100%" height="100%">
          <path d="M20 50 Q20 20 50 20 Q80 20 80 50 Q80 90 50 84 Q20 90 20 50" fill={color} />
          <circle cx="38" cy="52" r="4.5" fill="#0F172A" />
          <circle cx="62" cy="52" r="4.5" fill="#0F172A" />
          <path d="M40 66 Q50 70 60 66" stroke="#0F172A" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        </svg>
      );
    case "round":
      return (
        <svg viewBox="0 0 100 100" width="100%" height="100%">
          <circle cx="50" cy="52" r="36" fill={color} />
          {eyes}{smile}
        </svg>
      );
    case "fluffy":
      return (
        <svg viewBox="0 0 100 100" width="100%" height="100%">
          <circle cx="30" cy="40" r="14" fill={color} />
          <circle cx="70" cy="40" r="14" fill={color} />
          <circle cx="50" cy="60" r="32" fill={color} />
          {eyes}{smile}
        </svg>
      );
    case "fox":
      return (
        <svg viewBox="0 0 100 100" width="100%" height="100%">
          <polygon points="22,18 32,38 18,46" fill={color} />
          <polygon points="78,18 68,38 82,46" fill={color} />
          <circle cx="50" cy="58" r="32" fill={color} />
          {eyes}{smile}
        </svg>
      );
    case "bear":
      return (
        <svg viewBox="0 0 100 100" width="100%" height="100%">
          <circle cx="26" cy="28" r="11" fill={color} />
          <circle cx="74" cy="28" r="11" fill={color} />
          <circle cx="50" cy="58" r="34" fill={color} />
          <ellipse cx="50" cy="66" rx="12" ry="9" fill="#fde68a" />
          {eyes}
          <circle cx="50" cy="62" r="2.5" fill="#0F172A" />
        </svg>
      );
    case "bird":
      return (
        <svg viewBox="0 0 100 100" width="100%" height="100%">
          <ellipse cx="50" cy="58" rx="30" ry="28" fill={color} />
          <polygon points="30,58 18,62 30,66" fill="#F59E0B" />
          {eyes}
          <polygon points="58,58 70,62 58,66" fill="#F59E0B" />
        </svg>
      );
    case "owl":
      return (
        <svg viewBox="0 0 100 100" width="100%" height="100%">
          <ellipse cx="50" cy="58" rx="32" ry="34" fill={color} />
          <circle cx="38" cy="48" r="9" fill="#fff" />
          <circle cx="62" cy="48" r="9" fill="#fff" />
          <circle cx="38" cy="48" r="4" fill="#0F172A" />
          <circle cx="62" cy="48" r="4" fill="#0F172A" />
          <polygon points="46,58 50,64 54,58" fill="#F59E0B" />
          <line x1="50" y1="20" x2="50" y2="12" stroke={color} strokeWidth="3" />
          <circle cx="50" cy="10" r="3" fill={color} />
        </svg>
      );
    case "eagle":
      return (
        <svg viewBox="0 0 100 100" width="100%" height="100%">
          <polygon points="50,16 84,82 16,82" fill={color} />
          {eyes}
          <polygon points="46,62 50,72 54,62" fill="#F59E0B" />
        </svg>
      );
  }
}
