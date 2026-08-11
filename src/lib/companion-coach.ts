// What the companion should say, given where you are and what you have left
// undone.
//
// It used to say the same sentence on every screen — "I'm here whenever you
// need a nudge" — which is another way of saying nothing. A companion that
// doesn't know what page you're on or what you're behind on is decoration.
//
// The rule here is one nudge at a time, and it must be the most useful one.
// Listing five things you are behind on is a guilt trip; naming the single
// next action is help.

export type CoachStats = {
  dueCards: number;
  openGaps: number;
  unclaimedQuests: number;
  streak: number;
  studiedToday: boolean;
  materialCount: number;
  processingCount: number;
  hasCalling: boolean;
};

export type Nudge = {
  /** Short line, spoken as the companion. */
  text: string;
  action?: { label: string; to: string };
  /** Marks the nudge as about something overdue rather than a suggestion. */
  urgent?: boolean;
};

/**
 * Page-specific advice comes first — if you are standing in the review page
 * with cards due, "go and review" is noise, and the useful thing is about the
 * page you are on. Only when the current page has nothing to say do we fall
 * back to what is outstanding elsewhere.
 */
export function coachFor(pathname: string, s: CoachStats): Nudge {
  const on = (p: string) => pathname === p || pathname.startsWith(p + "/");

  // ── Where you are ──────────────────────────────────────────────────────
  if (on("/review")) {
    return s.dueCards > 0
      ? { text: `${s.dueCards} card${s.dueCards === 1 ? "" : "s"} due. Try a tactic or two — the harder the session, the bigger the XP.` }
      : { text: "Nothing due. You can still study ahead if you want to get in front of it." };
  }

  if (on("/materials")) {
    if (s.processingCount > 0)
      return { text: `${s.processingCount} upload${s.processingCount === 1 ? " is" : "s are"} still being read. Flashcards appear the moment it's done.` };
    if (s.materialCount === 0)
      return { text: "Upload anything — a PDF, a photo of your notes — and I'll turn it into cards and quizzes.", action: { label: "Upload", to: "/materials" } };
    return { text: "Open a material and hit Draw this diagram if a section won't sit still in your head." };
  }

  if (on("/quizzes"))
    return { text: "Quizzes refill hearts when you score 70% or more. Worth knowing before a review run." };

  if (on("/gaps"))
    return s.openGaps > 0
      ? { text: `${s.openGaps} gap${s.openGaps === 1 ? "" : "s"} still open. Explain this on the worst one is the fastest way to close it.` }
      : { text: "No open gaps. That is genuinely rare — well done." };

  if (on("/progress"))
    return { text: "Crests are the ones you keep. Earned beats bought, and both show beside your name." };

  if (on("/community"))
    return { text: "The number that matters is the gap to the person just above you, not the person at the top." };

  if (on("/shop"))
    return { text: "Boosts run out by tomorrow. Crests don't — spend accordingly." };

  if (on("/schedule"))
    return { text: "A plan you can actually keep beats an ambitious one you'll abandon by Wednesday." };

  // ── What you're behind on ──────────────────────────────────────────────
  if (s.dueCards > 0)
    return {
      text: `${s.dueCards} card${s.dueCards === 1 ? "" : "s"} due — that's the highest-value thing you could do right now.`,
      action: { label: "Review", to: "/review" },
      urgent: true,
    };

  if (!s.studiedToday && s.streak > 0)
    return {
      text: `Your ${s.streak}-day streak hasn't been fed today. One session keeps it.`,
      action: { label: "Study", to: "/review" },
      urgent: true,
    };

  if (s.unclaimedQuests > 0)
    return {
      text: `${s.unclaimedQuests} finished quest${s.unclaimedQuests === 1 ? "" : "s"} waiting to be claimed. That's free gems.`,
      action: { label: "Claim", to: "/dashboard" },
    };

  if (s.openGaps > 0)
    return {
      text: `${s.openGaps} knowledge gap${s.openGaps === 1 ? "" : "s"} still open.`,
      action: { label: "See gaps", to: "/gaps" },
    };

  if (!s.hasCalling)
    return {
      text: "You haven't told me why you're doing this yet. It helps on the days you don't feel like it.",
      action: { label: "Write it", to: "/dashboard" },
    };

  if (s.materialCount === 0)
    return {
      text: "Nothing in your library yet. Upload one thing and the rest of the app wakes up.",
      action: { label: "Upload", to: "/materials" },
    };

  return { text: "You're genuinely on top of everything. Rest counts too." };
}
