import { useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Menu, LogOut, Shield, ChevronDown } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { KlausumMark } from "@/components/klausum-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { StudentBadge } from "@/components/student-badge";
import { StatStrip } from "@/components/stat-strip";
import { PRIMARY_LINKS, MORE_LINKS, MORE_GROUPS, SETTINGS_LINK, BOTTOM_TAB_LINKS } from "@/lib/nav";

export function MobileNav({
  onSignOut,
  userLabel,
  isAdmin,
  level,
  streak,
  gems,
  hearts,
}: {
  onSignOut: () => void;
  userLabel: string;
  isAdmin: boolean;
  level?: string | null;
  streak?: number | null;
  gems?: number | null;
  hearts?: number | null;
}) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const containsActive = MORE_LINKS.some(
    (l) => location.pathname === l.to || location.pathname.startsWith(l.to + "/"),
  );
  const [moreOpen, setMoreOpen] = useState(containsActive);

  const primary = [...PRIMARY_LINKS];
  // Grouped, so the drawer reads as three short lists rather than one scroll of
  // twelve. Settings and Admin get their own trailing group.
  const secondaryGroups = [
    ...MORE_GROUPS,
    {
      title: "Account",
      links: isAdmin
        ? [SETTINGS_LINK, { to: "/admin", label: "Admin", icon: Shield }]
        : [SETTINGS_LINK],
    },
  ];

  const renderLink = ({ to, label, icon: Icon }: { to: string; label: string; icon: any }) => {
    const active = location.pathname === to || location.pathname.startsWith(to + "/");
    return (
      <Link
        key={to}
        to={to as any}
        onClick={() => setOpen(false)}
        className={`flex items-center gap-3 rounded-xl border-2 px-3 py-2 text-sm font-bold transition ${
          active
            ? "border-sky/40 bg-sky/12 text-sky"
            : "border-transparent text-muted-foreground hover:bg-surface-2 hover:text-foreground"
        }`}
      >
        <Icon className="h-4 w-4" />
        {label}
      </Link>
    );
  };

  const tabActive = (to: string) =>
    location.pathname === to || location.pathname.startsWith(to + "/");

  return (
    <>
      {/* Slim top bar — identity only. Navigation lives in the thumb row. */}
      <div className="md:hidden sticky top-0 z-40 flex items-center justify-between border-b-2 border-border px-4 py-2.5 bg-background">
        <Link to="/dashboard" className="flex items-center gap-2">
          <KlausumMark size={22} />
          <span className="font-display text-base font-extrabold text-primary">klausum</span>
        </Link>
        <div className="flex items-center gap-2">
          <StatStrip streak={streak} gems={gems} hearts={hearts} />
          <ThemeToggle />
        </div>
      </div>

      {/* Thumb row. Fixed so it survives long pages; safe-area aware so it
          clears the iOS home indicator instead of hiding under it. */}
      <nav
        className="md:hidden fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t-2 border-border bg-background
                   pb-[env(safe-area-inset-bottom,0px)]"
        aria-label="Primary"
      >
        {BOTTOM_TAB_LINKS.map(({ to, label, icon: Icon }) => {
          const active = tabActive(to);
          return (
            <Link
              key={to}
              to={to as any}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-[3.5rem] flex-col items-center justify-center gap-0.5 px-1 py-1.5 transition ${
                active ? "text-sky" : "text-muted-foreground"
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? "stroke-[2.5]" : ""}`} />
              <span className="text-[10px] font-extrabold leading-none">{label}</span>
            </Link>
          );
        })}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              aria-label="More"
              className={`flex min-h-[3.5rem] flex-col items-center justify-center gap-0.5 px-1 py-1.5 transition ${
                open ? "text-sky" : "text-muted-foreground"
              }`}
            >
              <Menu className="h-5 w-5" />
              <span className="text-[10px] font-extrabold leading-none">More</span>
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72 p-0 flex flex-col">
            <SheetHeader className="px-4 py-4 border-b-2 border-border">
              <SheetTitle className="flex items-center gap-2">
                <KlausumMark size={22} />
                <span className="font-display text-base font-extrabold text-primary">klausum</span>
              </SheetTitle>
            </SheetHeader>
            <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
              {primary.map(renderLink)}
              <button
                onClick={() => setMoreOpen((o) => !o)}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-extrabold uppercase tracking-wide text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
              >
                More tools
                <ChevronDown className={`h-4 w-4 transition-transform ${moreOpen ? "rotate-180" : ""}`} />
              </button>
              {moreOpen && (
                <div className="ml-3 space-y-0.5 border-l-2 border-border pl-2">
                  {secondaryGroups.map((g) => (
                    <div key={g.title}>
                      <div className="px-3 pb-1 pt-2 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/70">
                        {g.title}
                      </div>
                      {g.links.map(renderLink)}
                    </div>
                  ))}
                </div>
              )}
              {!moreOpen && renderLink(SETTINGS_LINK)}
            </nav>
            <div className="border-t-2 border-border px-4 py-3 text-xs font-bold text-muted-foreground space-y-2">
              <div className="truncate">{userLabel}</div>
              <StudentBadge level={level} />
              <button
                onClick={() => {
                  setOpen(false);
                  onSignOut();
                }}
                className="flex items-center gap-2 hover:text-foreground"
              >
                <LogOut className="h-3.5 w-3.5" /> Sign out
              </button>
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </>
  );
}
