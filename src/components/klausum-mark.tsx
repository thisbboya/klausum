import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement> & { size?: number };

/**
 * Klausum mark — a sealed ring containing a geometric K monogram.
 * Inspired by the Latin "clausum" (sealed / closed / protected) — a vault for
 * the knowledge you've made your own.
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
      <defs>
        <linearGradient id="klausumStroke" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="currentColor" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.7" />
        </linearGradient>
      </defs>
      {/* outer seal ring */}
      <circle cx="32" cy="32" r="26" stroke="url(#klausumStroke)" strokeWidth="3.5" fill="none" />
      {/* inner concentric ring */}
      <circle cx="32" cy="32" r="20" stroke="currentColor" strokeWidth="1.25" opacity="0.4" fill="none" />
      {/* K monogram — sharp geometric */}
      <path
        d="M24 18 V46"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path
        d="M24 32 L40 18"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path
        d="M24 32 L40 46"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
