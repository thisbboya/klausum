import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/quizzes")({ component: QuizzesRoute });

function QuizzesRoute() {
  return <Outlet />;
}
