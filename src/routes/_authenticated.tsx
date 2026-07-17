import { Link, Outlet, useNavigate, useLocation, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { KlausumMark } from "@/components/klausum-mark";
import { getCompanion } from "@/components/companion-svg";
import { LogOut, Shield, ChevronDown } from "lucide-react";
import { PRIMARY_LINKS, MORE_LINKS, SETTINGS_LINK } from "@/lib/nav";
import { hasUnseenUpdates } from "@/lib/updates";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileNav } from "@/components/mobile-nav";
import { StudentBadge } from "@/components/student-badge";
import { FloatingCompanion } from "@/components/floating-companion";
import { ProfileCompletionBanner } from "@/components/profile-completion-banner";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin } = useIsAdmin();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Onboarding redirect
  useEffect(() => {
    if (profile && !profile.onboarding_completed && location.pathname !== "/onboarding") {
      navigate({ to: "/onboarding" });
    }
  }, [profile, location.pathname, navigate]);

  // Pilot theming: expose the companion's color app-wide as --pilot
  useEffect(() => {
    const c = getCompanion(profile?.companion_id);
    document.documentElement.style.setProperty("--pilot", c.color);
  }, [profile?.companion_id]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside className="hidden md:flex w-60 flex-col border-r-2 border-border bg-background px-3 py-5">
        <Link to="/dashboard" className="mb-8 flex items-center gap-2 px-2">
          <KlausumMark size={26} />
          <span className="font-display text-lg font-extrabold text-primary">klausum</span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto text-sm">
          {PRIMARY_LINKS.map((l) => (
            <NavItem key={l.to} to={l.to} icon={l.icon} label={l.label} />
          ))}
          <MoreTools />
          <NavItem to={SETTINGS_LINK.to} icon={SETTINGS_LINK.icon} label={SETTINGS_LINK.label} showDot={hasUnseenUpdates()} />
          {isAdmin && <NavItem to="/admin" icon={Shield} label="Admin" />}
        </nav>
        <div className="mt-auto px-2 text-xs text-muted-foreground space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="truncate flex items-center gap-2">
              <span className="truncate">{profile?.full_name || user.email}</span>
            </div>
            <ThemeToggle />
          </div>
          <StudentBadge level={profile?.level} />
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              toast.success("Signed out");
              navigate({ to: "/" });
            }}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <MobileNav
          userLabel={profile?.full_name || user.email || ""}
          level={profile?.level}
          isAdmin={isAdmin}
          onSignOut={async () => {
            await supabase.auth.signOut();
            toast.success("Signed out");
            navigate({ to: "/" });
          }}
        />
        <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-10 space-y-4">
          {profile && !profile.level && location.pathname !== "/settings" && (
            <ProfileCompletionBanner level={profile?.level} />
          )}
          <Outlet />
        </div>
      </main>
      <FloatingCompanion companionId={profile?.companion_id} companionName={profile?.companion_name} />
    </div>
  );
}

function MoreTools() {
  const location = useLocation();
  const containsActive = MORE_LINKS.some(
    (l) => location.pathname === l.to || location.pathname.startsWith(l.to + "/"),
  );
  const [open, setOpen] = useState(containsActive);

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-xl border-2 border-transparent px-3 py-2 font-bold text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
      >
        <span className="text-xs font-extrabold uppercase tracking-wide">More tools</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-1 flex flex-col gap-1 border-l-2 border-border pl-2 ml-3">
          {MORE_LINKS.map((l) => (
            <NavItem key={l.to} to={l.to} icon={l.icon} label={l.label} />
          ))}
        </div>
      )}
    </div>
  );
}

function NavItem({ to, icon: Icon, label, showDot }: { to: string; icon: any; label: string; showDot?: boolean }) {
  const location = useLocation();
  const active = location.pathname === to || location.pathname.startsWith(to + "/");
  return (
    <Link
      to={to as any}
      className={`relative flex items-center gap-3 rounded-xl border-2 px-3 py-2 font-bold transition ${
        active
          ? "border-sky/40 bg-sky/12 text-sky"
          : "border-transparent text-muted-foreground hover:bg-surface-2 hover:text-foreground"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
      {showDot && <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-destructive" />}
    </Link>
  );
}
