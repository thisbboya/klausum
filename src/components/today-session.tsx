// Today's Session — the OnePrep idea (a concrete, timed, adaptive plan with an
// exam countdown) wearing Duolingo's clothes (a ritual you complete, with a
// progress bar and a reward at the end).
//
// The important property: every task is derived from real signals already in
// the database — cards actually due, gaps actually open, a material actually
// part-read. Nothing here is invented filler, and nothing needs a new table:
// a task is "done" when the underlying signal is gone, so the plan re-tunes
// itself as the student works. Refresh mid-session and it stays honest.
import { Link } from "@tanstack/react-router";
import { BookOpen, Brain, Check, ListChecks, Target, Timer } from "lucide-react";

export type SessionTask = {
  key: string;
  kind: "REVIEW" | "DRILL" | "READ" | "QUIZ";
  title: string;
  minutes: number;
  done: boolean;
  to: string;
  params?: Record<string, string>;
  search?: Record<string, unknown>;
};

const KIND_STYLE: Record<SessionTask["kind"], { icon: typeof Brain; ink: string; chip: string }> = {
  REVIEW: { icon: Brain, ink: "text-grape", chip: "bg-grape/12" },
  DRILL: { icon: Target, ink: "text-destructive", chip: "bg-destructive/12" },
  READ: { icon: BookOpen, ink: "text-success", chip: "bg-success/12" },
  QUIZ: { icon: ListChecks, ink: "text-sky", chip: "bg-sky/12" },
};

/**
 * Build the plan from live counts.
 *
 * Order is deliberate and matches what the learning science in this app already
 * claims: due reviews first (spacing decays if you skip them), then the gaps
 * that cost marks, then new reading, then a check that it stuck.
 */
export function buildSessionTasks(input: {
  dueCount: number;
  topGap?: { id: string; topic?: string | null; subject?: string | null } | null;
  material?: { id: string; title: string } | null;
  quizzedToday: boolean;
  /** From onboarding. The plan is trimmed to roughly fit it. */
  dailyMinutes?: number;
}): SessionTask[] {
  const tasks: SessionTask[] = [];

  // ~15s per card is the app's own review pace; floor at 2 min so a single
  // stray card doesn't render as "0m".
  tasks.push({
    key: "review",
    kind: "REVIEW",
    title: input.dueCount > 0 ? `Review ${input.dueCount} card${input.dueCount === 1 ? "" : "s"}` : "Reviews all caught up",
    minutes: Math.max(2, Math.ceil((input.dueCount * 15) / 60)),
    done: input.dueCount === 0,
    to: "/review",
  });

  if (input.topGap) {
    tasks.push({
      key: `gap-${input.topGap.id}`,
      kind: "DRILL",
      title: `Close gap: ${input.topGap.topic || input.topGap.subject || "weak topic"}`,
      minutes: 5,
      done: false,
      to: "/gaps",
    });
  }

  if (input.material) {
    tasks.push({
      key: `read-${input.material.id}`,
      kind: "READ",
      title: `Read ${input.material.title}`,
      minutes: 8,
      done: false,
      to: "/materials/$id",
      params: { id: input.material.id },
    });
  }

  tasks.push({
    key: "quiz",
    kind: "QUIZ",
    title: input.quizzedToday ? "Practice quiz done" : "Take a practice quiz",
    minutes: 4,
    done: input.quizzedToday,
    to: "/quizzes",
  });

  // Honour the daily budget the student set during onboarding. Reviews are
  // never dropped — skipping them is what actually costs retention — so the
  // trim only ever removes optional tasks from the end, and always leaves at
  // least two so the plan doesn't degenerate into a single line.
  const budget = input.dailyMinutes ?? 0;
  if (budget > 0) {
    let spend = 0;
    const kept: SessionTask[] = [];
    for (const t of tasks) {
      const mandatory = t.kind === "REVIEW" || kept.length < 2;
      if (mandatory || t.done || spend + t.minutes <= budget) {
        kept.push(t);
        if (!t.done) spend += t.minutes;
      }
    }
    return kept;
  }

  return tasks;
}

function daysUntil(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((d.getTime() - now.getTime()) / 86_400_000));
}

export function TodaySession({
  tasks,
  exam,
}: {
  tasks: SessionTask[];
  exam?: { exam_name: string; exam_date: string } | null;
}) {
  const doneCount = tasks.filter((t) => t.done).length;
  const remaining = tasks.filter((t) => !t.done);
  const minutesLeft = remaining.reduce((a, t) => a + t.minutes, 0);
  const pct = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;
  const allDone = doneCount === tasks.length;
  const next = remaining[0];

  return (
    <section className="card-chunky bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-base font-extrabold sm:text-lg">Today's session</h2>
        {exam && (
          <Link
            to="/exams"
            className="inline-flex items-center gap-1.5 rounded-full border-2 border-destructive/30 bg-destructive/10 px-2.5 py-1 text-[11px] font-extrabold text-destructive"
          >
            <Timer className="h-3.5 w-3.5" />
            {exam.exam_name} · {daysUntil(exam.exam_date)}d
          </Link>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2.5">
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-3">
          <div
            className="h-full rounded-full bg-success transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="shrink-0 text-[11px] font-extrabold tabular-nums text-muted-foreground">
          {doneCount}/{tasks.length}
          {minutesLeft > 0 && ` · ~${minutesLeft}m`}
        </span>
      </div>

      <ul className="mt-3 divide-y divide-border border-y border-border">
        {tasks.map((t) => {
          const s = KIND_STYLE[t.kind];
          const Icon = s.icon;
          return (
            <li key={t.key}>
              <Link
                to={t.to as any}
                params={t.params as any}
                search={t.search as any}
                className="flex items-center gap-2.5 py-2.5 transition hover:bg-surface-2"
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                    t.done ? "bg-success/15" : s.chip
                  }`}
                >
                  {t.done ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : (
                    <Icon className={`h-4 w-4 ${s.ink}`} />
                  )}
                </span>
                <span
                  className={`min-w-0 flex-1 truncate text-sm font-bold ${
                    t.done ? "text-muted-foreground line-through" : "text-foreground"
                  }`}
                >
                  {t.title}
                </span>
                {!t.done && (
                  <span className="shrink-0 text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">
                    {t.minutes}m
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      {allDone ? (
        <p className="mt-3 text-center text-sm font-extrabold text-success">
          Session complete — come back tomorrow to keep the streak.
        </p>
      ) : (
        <Link
          to={next.to as any}
          params={next.params as any}
          search={next.search as any}
          className="btn-3d btn-3d-success mt-3 block w-full rounded-2xl bg-success py-3 text-center text-sm font-extrabold uppercase tracking-wide text-success-foreground"
        >
          Start today's session
        </Link>
      )}
    </section>
  );
}
