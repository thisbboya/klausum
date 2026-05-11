import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement> & { size?: number };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 64 64",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
});

export function NkyinkyimSymbol({ size = 32, ...props }: Props) {
  // adaptability — twisting zigzag
  return (
    <svg {...base(size)} {...props}>
      <path
        d="M10 32 Q20 12 32 32 T54 32"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M10 44 Q20 24 32 44 T54 44"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
      />
    </svg>
  );
}

export function SankofaSymbol({ size = 32, ...props }: Props) {
  return (
    <svg {...base(size)} {...props}>
      <path
        d="M32 12 C 18 12 12 22 12 32 C 12 44 22 52 32 52"
        stroke="currentColor"
        strokeWidth="3.5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M32 18 L26 12 L32 6"
        stroke="currentColor"
        strokeWidth="3.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="46" r="3" fill="currentColor" />
    </svg>
  );
}

export function DwennimmenSymbol({ size = 32, ...props }: Props) {
  return (
    <svg {...base(size)} {...props}>
      <path
        d="M22 14 Q14 22 14 32 Q14 42 22 50"
        stroke="currentColor"
        strokeWidth="3.5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M42 14 Q50 22 50 32 Q50 42 42 50"
        stroke="currentColor"
        strokeWidth="3.5"
        fill="none"
        strokeLinecap="round"
      />
      <line x1="22" y1="32" x2="42" y2="32" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

export function GyeNyameSymbol({ size = 32, ...props }: Props) {
  return (
    <svg {...base(size)} {...props}>
      <circle cx="32" cy="32" r="20" stroke="currentColor" strokeWidth="3" fill="none" />
      <path
        d="M22 32 L42 32 M32 22 L32 42"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="32" cy="32" r="4" fill="currentColor" />
    </svg>
  );
}

export function AyaSymbol({ size = 32, ...props }: Props) {
  // fern frond — endurance
  return (
    <svg {...base(size)} {...props}>
      <path
        d="M32 8 C 32 24 32 48 32 56"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      {[14, 22, 30, 38, 46].map((y, i) => (
        <g key={i}>
          <path
            d={`M32 ${y} Q ${20 - i} ${y - 4} ${14 - i} ${y + 4}`}
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d={`M32 ${y} Q ${44 + i} ${y - 4} ${50 + i} ${y + 4}`}
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
          />
        </g>
      ))}
    </svg>
  );
}

export function DuafeSymbol({ size = 32, ...props }: Props) {
  // wooden comb — beauty / cleanliness
  return (
    <svg {...base(size)} {...props}>
      <rect x="14" y="14" width="36" height="10" rx="3" stroke="currentColor" strokeWidth="3" fill="none" />
      {[20, 28, 36, 44].map((x) => (
        <line key={x} x1={x} y1="24" x2={x} y2="50" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      ))}
    </svg>
  );
}
