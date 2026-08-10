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

/**
 * Ten undifferentiated links in one "More tools" list is what made the app feel
 * sprawling — not the number of features, which are individually cheap. Grouped
 * under headings they read as three short lists instead of one long one.
 *
 * Order within each group follows measured usage on production rather than
 * taste: gaps (93 rows) and formulas (14) sit above mind maps (3) and notes (0).
 */
export type NavGroup = { title: string; links: NavLink[] };

export const MORE_GROUPS: NavGroup[] = [
  {
    title: "Study tools",
    links: [
      { to: "/gaps", label: "Gaps", icon: Target },
      { to: "/formulas", label: "Formulas", icon: Sigma },
      { to: "/videos", label: "Videos", icon: Youtube },
      { to: "/solve", label: "Snap & Solve", icon: Camera },
      { to: "/notes", label: "Notes", icon: NotebookPen },
      { to: "/mindmaps", label: "Mind Maps", icon: Network },
    ],
  },
  {
    title: "Progress",
    links: [
      { to: "/progress", label: "Progress", icon: TrendingUp },
      { to: "/exams", label: "Exams", icon: GraduationCap },
    ],
  },
  {
    title: "Focus & fun",
    links: [
      { to: "/focus", label: "Focus Mode", icon: Focus },
      { to: "/games", label: "Games", icon: Gamepad2 },
    ],
  },
];

/** Flat list, kept for callers that just need every secondary destination. */
export const MORE_LINKS: NavLink[] = MORE_GROUPS.flatMap((g) => g.links);

export const SETTINGS_LINK: NavLink = { to: "/settings", label: "Settings", icon: Settings };

/**
 * The phone's thumb row. Four destinations plus a "More" button — any more and
 * the labels stop being readable at 375px. These are the four screens the daily
 * loop actually needs; everything else is one tap away behind More.
 */
export const BOTTOM_TAB_LINKS: NavLink[] = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/materials", label: "Study", icon: BookOpen },
  { to: "/review", label: "Review", icon: Brain },
  { to: "/quizzes", label: "Quiz", icon: ListChecks },
];
