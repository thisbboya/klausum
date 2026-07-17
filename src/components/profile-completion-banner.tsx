import { Link } from "@tanstack/react-router";

export function ProfileCompletionBanner({ level }: { level?: string | null }) {
  if (level) return null;
  return (
    <div className="rounded-xl border-l-4 border-primary bg-primary/10 p-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-2xl">👋</span>
        <div className="min-w-0">
          <div className="font-semibold text-sm">Complete your profile</div>
          <div className="text-xs text-muted-foreground truncate">
            Select your academic year and programme to see personalised content.
          </div>
        </div>
      </div>
      <Link
        to="/settings"
        className="shrink-0 btn-3d rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90"
      >
        SET DETAILS →
      </Link>
    </div>
  );
}
