import { useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Menu, LogOut, Shield, ChevronDown } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { KlausumMark } from "@/components/klausum-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { StudentBadge } from "@/components/student-badge";
import { PRIMARY_LINKS, MORE_LINKS, SETTINGS_LINK } from "@/lib/nav";

export function MobileNav({
  onSignOut,
  userLabel,
  isAdmin,
  level,
}: {
  onSignOut: () => void;
  userLabel: string;
  isAdmin: boolean;
  level?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const containsActive = MORE_LINKS.some(
    (l) => location.pathname === l.to || location.pathname.startsWith(l.to + "/"),
  );
  const [moreOpen, setMoreOpen] = useState(containsActive);

  const primary = [...PRIMARY_LINKS];
  const secondary = isAdmin
    ? [...MORE_LINKS, SETTINGS_LINK, { to: "/admin", label: "Admin", icon: Shield }]
    : [...MORE_LINKS, SETTINGS_LINK];

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

  return (
    <div className="md:hidden flex items-center justify-between border-b-2 border-border px-4 py-3 bg-background">
      <Link to="/dashboard" className="flex items-center gap-2">
        <KlausumMark size={22} />
        <span className="font-display text-base font-extrabold text-primary">klausum</span>
      </Link>
      <div className="flex items-center gap-2">
        <StudentBadge level={level} />
        <ThemeToggle />
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              aria-label="Open menu"
              className="inline-flex items-center justify-center rounded-xl border-2 border-border bg-background p-1.5 text-muted-foreground hover:text-foreground"
            >
              <Menu className="h-5 w-5" />
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
                  {secondary.map(renderLink)}
                </div>
              )}
              {!moreOpen && renderLink(SETTINGS_LINK)}
            </nav>
            <div className="border-t-2 border-border px-4 py-3 text-xs font-bold text-muted-foreground space-y-2">
              <div className="truncate">{userLabel}</div>
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
      </div>
    </div>
  );
}
