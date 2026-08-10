// The Duolingo header stat row: streak, gems, hearts — always visible, always
// current. Colours are CEG's (orange brand, indigo, CEG red) rather than
// Duolingo's, but the read-at-a-glance layout is the same.
import { Link } from "@tanstack/react-router";
import { Flame, Gem, Heart } from "lucide-react";

export function StatStrip({
  streak,
  gems,
  hearts,
  heartsMax = 5,
  className = "",
}: {
  streak?: number | null;
  gems?: number | null;
  hearts?: number | null;
  heartsMax?: number;
  className?: string;
}) {
  const items = [
    {
      to: "/progress",
      icon: Flame,
      value: streak ?? 0,
      tone: "text-primary",
      fill: (streak ?? 0) > 0,
      label: "Day streak",
    },
    {
      to: "/shop",
      icon: Gem,
      value: gems ?? 0,
      tone: "text-grape",
      fill: false,
      label: "Gems",
    },
    {
      to: "/shop",
      icon: Heart,
      value: hearts ?? heartsMax,
      tone: "text-destructive",
      fill: (hearts ?? heartsMax) > 0,
      label: "Hearts",
    },
  ];

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {items.map(({ to, icon: Icon, value, tone, fill, label }) => (
        <Link
          key={label}
          to={to as any}
          aria-label={`${label}: ${value}`}
          className="flex items-center gap-1 tabular-nums transition hover:opacity-80"
        >
          <Icon className={`h-[18px] w-[18px] ${tone} ${fill ? "fill-current" : ""}`} />
          <span className={`text-sm font-extrabold ${tone}`}>{value}</span>
        </Link>
      ))}
    </div>
  );
}
