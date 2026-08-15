import {
  LayoutDashboard, BookOpen, Brain, MessagesSquare, Settings, NotebookPen, Network,
  ListChecks, Target, TrendingUp, Sigma, CalendarClock, Users,
  GraduationCap, Youtube, Camera, Gem, Gamepad2, FlaskConical, type LucideIcon,
} from "lucide-react";

/**
 * `art` is the coloured pictogram shown in the sidebar; `icon` is the flat
 * line version still used by the phone's thumb row, where a 20px emoji reads
 * as a smudge.
 *
 * CourieX uses illustrations rather than a column of identical grey strokes,
 * and it is the single biggest reason its sidebar looks like a product instead
 * of a settings menu. Emoji rather than image files on purpose: they are
 * already on every device, cost no requests, and cannot 404.
 */
export type NavLink = { to: string; label: string; icon: LucideIcon; art?: string };

/**
 * Primary destinations — the daily loop. Everything else lives under "More tools"
 * so the sidebar stays scannable.
 */
export const PRIMARY_LINKS: NavLink[] = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard, art: "🏠" },
  { to: "/materials", label: "Materials", icon: BookOpen, art: "📚" },
  { to: "/review", label: "Review", icon: Brain, art: "🧠" },
  { to: "/quizzes", label: "Quizzes", icon: ListChecks, art: "✅" },
  { to: "/tutor", label: "AI Tutor", icon: MessagesSquare, art: "💬" },
  { to: "/community", label: "Social", icon: Users, art: "👥" },
  { to: "/schedule", label: "Planner", icon: CalendarClock, art: "🗓️" },
  // Gem Shop moved out of the daily loop. It sells three consumables and is
  // somewhere you go after earning, not a place you work — a permanent slot in
  // the primary list made the sidebar one item longer than the thing it was
  // being compared against, for a page most sessions never open.
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
      { to: "/gaps", label: "Gaps", icon: Target, art: "🎯" },
      { to: "/formulas", label: "Formulas", icon: Sigma, art: "➗" },
      { to: "/videos", label: "Videos", icon: Youtube, art: "📺" },
      { to: "/solve", label: "Snap & Solve", icon: Camera, art: "📸" },
      { to: "/lab", label: "Lab", icon: FlaskConical, art: "🧪" },
      { to: "/notes", label: "Notes", icon: NotebookPen, art: "📝" },
      { to: "/mindmaps", label: "Mind Maps", icon: Network, art: "🕸️" },
    ],
  },
  {
    title: "Progress & rewards",
    links: [
      { to: "/progress", label: "Progress", icon: TrendingUp, art: "📈" },
      { to: "/exams", label: "Exams", icon: GraduationCap, art: "🎓" },
      { to: "/shop", label: "Gem Shop", icon: Gem, art: "💎" },
    ],
  },
  {
    title: "Fun",
    links: [
      // Focus Mode used to sit here and was removed: production recorded zero
      // focus_sessions rows in the app's lifetime, and the timer people do use
      // is the one embedded in the material reader, which writes to the same
      // table. A standalone page for it was a nav slot spent on nothing.
      { to: "/games", label: "Games", icon: Gamepad2, art: "🎮" },
    ],
  },
];

/** Flat list, kept for callers that just need every secondary destination. */
export const MORE_LINKS: NavLink[] = MORE_GROUPS.flatMap((g) => g.links);

export const SETTINGS_LINK: NavLink = { to: "/settings", label: "Settings", icon: Settings, art: "⚙️" };

/**
 * The phone's thumb row. Four destinations plus a "More" button — any more and
 * the labels stop being readable at 375px. These are the four screens the daily
 * loop actually needs; everything else is one tap away behind More.
 */
export const BOTTOM_TAB_LINKS: NavLink[] = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard, art: "🏠" },
  { to: "/materials", label: "Study", icon: BookOpen, art: "📚" },
  { to: "/review", label: "Review", icon: Brain, art: "🧠" },
  { to: "/quizzes", label: "Quiz", icon: ListChecks, art: "✅" },
];
