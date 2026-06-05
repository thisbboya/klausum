import { useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Menu, LogOut } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { KlausumMark } from "@/components/klausum-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { StudentBadge } from "@/components/student-badge";
import {
  LayoutDashboard, BookOpen, Brain, MessagesSquare, Settings, NotebookPen, Network,
  ListChecks, Target, TrendingUp, Sigma, CalendarClock, Code2, Users, Mic,
  GraduationCap, Youtube, Shield, Trophy, FlaskConical,
} from "lucide-react";

type NavLink = { to: string; label: string; icon: any };

const LINKS: NavLink[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/materials", label: "Materials", icon: BookOpen },
  { to: "/notes", label: "Notes", icon: NotebookPen },
  { to: "/mindmaps", label: "Mind Maps", icon: Network },
  { to: "/quizzes", label: "Quizzes", icon: ListChecks },
  { to: "/review", label: "Review", icon: Brain },
  { to: "/gaps", label: "Gaps", icon: Target },
  { to: "/progress", label: "Progress", icon: TrendingUp },
  { to: "/formulas", label: "Formulas", icon: Sigma },
  { to: "/schedule", label: "Schedule", icon: CalendarClock },
  { to: "/timetable", label: "Timetable", icon: CalendarClock },
  { to: "/codelab", label: "Code Lab", icon: Code2 },
  { to: "/rooms", label: "Rooms", icon: Users },
  { to: "/community", label: "Community", icon: Trophy },
  { to: "/voice", label: "Voice", icon: Mic },
  { to: "/videos", label: "Videos", icon: Youtube },
  { to: "/exams", label: "Exams", icon: GraduationCap },
  { to: "/tutor", label: "AI Tutor", icon: MessagesSquare },
  { to: "/research", label: "Research", icon: FlaskConical },
  { to: "/settings", label: "Settings", icon: Settings },
];

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

  const all = isAdmin ? [...LINKS, { to: "/admin", label: "Admin", icon: Shield }] : LINKS;

  return (
    <div className="md:hidden flex items-center justify-between border-b border-border/60 px-4 py-3 bg-card/40">
      <Link to="/dashboard" className="flex items-center gap-2 text-primary">
        <KlausumMark size={22} />
        <span className="font-display text-sm font-semibold">Klausum</span>
      </Link>
      <div className="flex items-center gap-2">
        <StudentBadge level={level} />
        <ThemeToggle />
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              aria-label="Open menu"
              className="inline-flex items-center justify-center rounded-md border border-border/60 bg-background/40 p-1.5 text-muted-foreground hover:text-foreground"
            >
              <Menu className="h-5 w-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72 p-0 flex flex-col">
            <SheetHeader className="px-4 py-4 border-b border-border/60">
              <SheetTitle className="flex items-center gap-2 text-primary">
                <KlausumMark size={22} />
                <span className="font-display text-base font-semibold">Klausum</span>
              </SheetTitle>
            </SheetHeader>
            <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
              {all.map(({ to, label, icon: Icon }) => {
                const active = location.pathname === to || location.pathname.startsWith(to + "/");
                return (
                  <Link
                    key={to}
                    to={to as any}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
                      active
                        ? "bg-primary/15 text-primary font-medium"
                        : "text-muted-foreground hover:bg-accent/10 hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                );
              })}
            </nav>
            <div className="border-t border-border/60 px-4 py-3 text-xs text-muted-foreground space-y-2">
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
