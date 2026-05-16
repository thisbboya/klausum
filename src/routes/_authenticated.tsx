import { Link, Outlet, useNavigate, useLocation, createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { KlausumMark } from "@/components/klausum-mark";
import { LayoutDashboard, BookOpen, Brain, MessagesSquare, Settings, LogOut, NotebookPen, Network, ListChecks, Target, TrendingUp, Sigma, CalendarClock, Code2, Users, Mic, GraduationCap, Youtube, Shield } from "lucide-react";
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

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside className="hidden md:flex w-60 flex-col border-r border-border/60 bg-card/40 px-3 py-5">
        <Link to="/dashboard" className="mb-8 flex items-center gap-2 px-2 text-primary">
          <KlausumMark size={26} />
          <span className="font-display text-base font-semibold">Klausum</span>
        </Link>
        <nav className="flex flex-col gap-1 text-sm">
          <NavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" />
          <NavItem to="/materials" icon={BookOpen} label="Materials" />
          <NavItem to="/notes" icon={NotebookPen} label="Notes" />
          <NavItem to="/mindmaps" icon={Network} label="Mind Maps" />
          <NavItem to="/quizzes" icon={ListChecks} label="Quizzes" />
          <NavItem to="/review" icon={Brain} label="Review" />
          <NavItem to="/gaps" icon={Target} label="Gaps" />
          <NavItem to="/progress" icon={TrendingUp} label="Progress" />
          <NavItem to="/formulas" icon={Sigma} label="Formulas" />
          <NavItem to="/schedule" icon={CalendarClock} label="Schedule" />
          <NavItem to="/codelab" icon={Code2} label="Code Lab" />
          <NavItem to="/rooms" icon={Users} label="Rooms" />
          <NavItem to="/voice" icon={Mic} label="Voice" />
          <NavItem to="/videos" icon={Youtube} label="Videos" />
          <NavItem to="/exams" icon={GraduationCap} label="Exams" />
          <NavItem to="/tutor" icon={MessagesSquare} label="AI Tutor" />
          <NavItem to="/settings" icon={Settings} label="Settings" />
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

function NavItem({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  const location = useLocation();
  const active = location.pathname === to || location.pathname.startsWith(to + "/");
  return (
    <Link
      to={to as any}
      className={`flex items-center gap-3 rounded-md px-3 py-2 transition ${
        active ? "bg-primary/15 text-primary font-medium" : "text-muted-foreground hover:bg-accent/10 hover:text-foreground"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}
