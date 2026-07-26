import {
  LayoutDashboard, BookOpen, Brain, MessagesSquare, Settings, NotebookPen, Network,
  ListChecks, Target, TrendingUp, Sigma, CalendarClock, Users,
  GraduationCap, Youtube, Camera, Focus, Gem, Gamepad2, type LucideIcon,
} from "lucide-react";

export type NavLink = { to: string; label: string; icon: LucideIcon };

/**
 * Primary destinations — the daily loop. Everything else lives under "More tools"
 * so the sidebar stays scannable.
 */
export const PRIMARY_LINKS: NavLink[] = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/materials", label: "Materials", icon: BookOpen },
  { to: "/review", label: "Review", icon: Brain },
  { to: "/quizzes", label: "Quizzes", icon: ListChecks },
  { to: "/tutor", label: "AI Tutor", icon: MessagesSquare },
  { to: "/community", label: "Social", icon: Users },
  { to: "/schedule", label: "Planner", icon: CalendarClock },
  { to: "/shop", label: "Gem Shop", icon: Gem },
];

export const MORE_LINKS: NavLink[] = [
  { to: "/games", label: "Games", icon: Gamepad2 },
  { to: "/solve", label: "Snap & Solve", icon: Camera },
  { to: "/notes", label: "Notes", icon: NotebookPen },
  { to: "/mindmaps", label: "Mind Maps", icon: Network },
  { to: "/gaps", label: "Gaps", icon: Target },
  { to: "/progress", label: "Progress", icon: TrendingUp },
  { to: "/formulas", label: "Formulas", icon: Sigma },
  { to: "/videos", label: "Videos", icon: Youtube },
  { to: "/exams", label: "Exams", icon: GraduationCap },
  { to: "/focus", label: "Focus Mode", icon: Focus },
];

export const SETTINGS_LINK: NavLink = { to: "/settings", label: "Settings", icon: Settings };
