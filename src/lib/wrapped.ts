import { supabase } from "@/integrations/supabase/client";

export type WrappedData = {
  fullName: string;
  companionName: string;
  companionId: number;
  semesterStart: string | null;
  generatedAt: string;
  totals: {
    studyMinutes: number;
    studyHours: number;
    sessions: number;
    cardsReviewed: number;
    cardsAcedFirstTry: number;
    quizzesTaken: number;
    quizAccuracy: number; // 0..1
    xpEarned: number;
    materialsUploaded: number;
    longestStreak: number;
    currentStreak: number;
  };
  varkRadar: { subject: string; A: number; fullMark: number }[];
  topSubject: { name: string; minutes: number } | null;
  toughestCard: { front: string; lapses: number } | null;
  peakHour: { hourLabel: string; sessions: number } | null;
  fastestQuiz: { title: string; secondsPerQuestion: number } | null;
  rank: { percentile: number; total: number } | null;
  bestDay: { date: string; xp: number } | null;
};

function bucketHour(h: number) {
  if (h < 6) return "12AM–6AM";
  if (h < 12) return "6AM–12PM";
  if (h < 18) return "12PM–6PM";
  if (h < 22) return "6PM–10PM";
  return "10PM–12AM";
}

export async function generateWrapped(userId: string): Promise<WrappedData> {
  const [
    { data: profile },
    { data: focus },
    { data: reviews },
    { data: quizzes },
    { data: materials },
    { data: xpEvents },
    { data: cards },
    { data: leaderboard },
  ] = await Promise.all([
    supabase.from("user_profiles").select("*").eq("id", userId).single(),
    supabase.from("focus_sessions").select("actual_minutes,session_type,material_id,started_at").eq("user_id", userId).eq("completed", true),
    supabase.from("flashcard_reviews").select("rating,card_id,reviewed_at").eq("user_id", userId),
    supabase.from("quiz_attempts").select("score,total,duration_seconds,quiz_id,completed_at").eq("user_id", userId),
    supabase.from("study_materials").select("id,subject,title").eq("user_id", userId),
    supabase.from("xp_events").select("xp_amount,created_at").eq("user_id", userId),
    supabase.from("flashcards").select("front,fsrs_lapses,deck_id").eq("user_id", userId).order("fsrs_lapses", { ascending: false }).limit(1),
    supabase.from("leaderboard_weekly").select("user_id,xp_this_week").order("xp_this_week", { ascending: false }).limit(1000),
  ]);

  const studyMinutes = (focus ?? []).reduce((s, f) => s + (f.actual_minutes ?? 0), 0);
  const sessions = focus?.length ?? 0;
  const cardsReviewed = reviews?.length ?? 0;
  const cardsAcedFirstTry = (reviews ?? []).filter((r) => r.rating >= 3).length;

  const quizzesTaken = quizzes?.length ?? 0;
  const totalQ = (quizzes ?? []).reduce((s, q) => s + (q.total ?? 0), 0);
  const correctQ = (quizzes ?? []).reduce((s, q) => s + (q.score ?? 0), 0);
  const quizAccuracy = totalQ > 0 ? correctQ / totalQ : 0;

  const xpEarned = (xpEvents ?? []).reduce((s, e) => s + (e.xp_amount ?? 0), 0);

  // Top subject by minutes (join focus → material → subject)
  const matMap = new Map((materials ?? []).map((m) => [m.id, m]));
  const subjectMinutes = new Map<string, number>();
  (focus ?? []).forEach((f) => {
    const subj = f.material_id ? matMap.get(f.material_id)?.subject ?? "General" : "General";
    subjectMinutes.set(subj, (subjectMinutes.get(subj) ?? 0) + (f.actual_minutes ?? 0));
  });
  const topSubject = [...subjectMinutes.entries()].sort((a, b) => b[1] - a[1])[0];

  // Peak hour bucket
  const hourBuckets = new Map<string, number>();
  (focus ?? []).forEach((f) => {
    if (!f.started_at) return;
    const h = new Date(f.started_at).getHours();
    const b = bucketHour(h);
    hourBuckets.set(b, (hourBuckets.get(b) ?? 0) + 1);
  });
  const peakHour = [...hourBuckets.entries()].sort((a, b) => b[1] - a[1])[0];

  // Fastest quiz (lowest seconds per question, min 5 questions)
  const fastest = (quizzes ?? [])
    .filter((q) => (q.total ?? 0) >= 5 && (q.duration_seconds ?? 0) > 0)
    .map((q) => ({
      duration_seconds: q.duration_seconds!,
      total: q.total!,
      quiz_id: q.quiz_id,
      sec: q.duration_seconds! / q.total!,
    }))
    .sort((a, b) => a.sec - b.sec)[0];

  // Best XP day
  const xpByDay = new Map<string, number>();
  (xpEvents ?? []).forEach((e) => {
    if (!e.created_at) return;
    const d = e.created_at.slice(0, 10);
    xpByDay.set(d, (xpByDay.get(d) ?? 0) + (e.xp_amount ?? 0));
  });
  const bestDayEntry = [...xpByDay.entries()].sort((a, b) => b[1] - a[1])[0];

  // Rank vs other users (leaderboard_weekly)
  let rank: WrappedData["rank"] = null;
  if (leaderboard && leaderboard.length > 0) {
    const sorted = leaderboard.map((r) => r.xp_this_week ?? 0).sort((a, b) => b - a);
    const myWeek = sorted.length > 0 ? sorted[0] : 0;
    const total = leaderboard.length;
    const myIdx = leaderboard.findIndex((r) => r.user_id === userId);
    if (myIdx >= 0) {
      const percentile = Math.max(1, Math.round(((total - myIdx) / total) * 100));
      rank = { percentile, total };
    }
    void myWeek;
  }

  let fastestTitle = "your fastest quiz";
  if (fastest) {
    const { data: q } = await supabase.from("quizzes").select("title").eq("id", fastest.quiz_id).single();
    if (q?.title) fastestTitle = q.title;
  }

  return {
    fullName: profile?.full_name ?? "Student",
    companionName: profile?.companion_name ?? "KOJO",
    companionId: profile?.companion_id ?? 8,
    semesterStart: profile?.semester_start_date ?? null,
    generatedAt: new Date().toISOString(),
    totals: {
      studyMinutes,
      studyHours: Math.round(studyMinutes / 60),
      sessions,
      cardsReviewed,
      cardsAcedFirstTry,
      quizzesTaken,
      quizAccuracy,
      xpEarned,
      materialsUploaded: materials?.length ?? 0,
      longestStreak: profile?.longest_streak ?? 0,
      currentStreak: profile?.streak_days ?? 0,
    },
    varkRadar: [
      { subject: "Visual", A: profile?.visual_score ?? 0, fullMark: 16 },
      { subject: "Auditory", A: profile?.auditory_score ?? 0, fullMark: 16 },
      { subject: "Reading", A: profile?.reading_score ?? 0, fullMark: 16 },
      { subject: "Kinesthetic", A: profile?.kinesthetic_score ?? 0, fullMark: 16 },
    ],
    topSubject: topSubject ? { name: topSubject[0], minutes: topSubject[1] } : null,
    toughestCard: cards?.[0] && (cards[0].fsrs_lapses ?? 0) > 0
      ? { front: cards[0].front, lapses: cards[0].fsrs_lapses ?? 0 }
      : null,
    peakHour: peakHour ? { hourLabel: peakHour[0], sessions: peakHour[1] } : null,
    fastestQuiz: fastest ? { title: fastestTitle, secondsPerQuestion: Math.round(fastest.sec) } : null,
    rank,
    bestDay: bestDayEntry ? { date: bestDayEntry[0], xp: bestDayEntry[1] } : null,
  };
}

export async function saveWrappedSnapshot(userId: string, data: WrappedData) {
  await supabase.from("wrapped_snapshots").insert({
    user_id: userId,
    period: "all_time",
    data: JSON.parse(JSON.stringify(data)),
  });
}
