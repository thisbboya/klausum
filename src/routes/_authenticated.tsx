import { Link, Outlet, useNavigate, useLocation, createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { NkyinkyimSymbol } from "@/components/adinkra";
import { LayoutDashboard, BookOpen, Brain, MessagesSquare, Settings, LogOut, NotebookPen, Network, ListChecks, Target, TrendingUp, Sigma, CalendarClock, Code2, Users, Mic } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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
          <NkyinkyimSymbol size={26} />
          <span className="font-display text-base font-semibold">NkyinkyimIQ</span>
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
          <NavItem to="/tutor" icon={MessagesSquare} label="AI Tutor" />
          <NavItem to="/settings" icon={Settings} label="Settings" />
        </nav>
        <div className="mt-auto px-2 text-xs text-muted-foreground">
          <div className="truncate">{profile?.full_name || user.email}</div>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              toast.success("Signed out");
              navigate({ to: "/" });
            }}
            className="mt-2 flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <MobileTopBar onSignOut={async () => { await supabase.auth.signOut(); navigate({ to: "/" }); }} />
        <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-10">
          <Outlet />
        </div>
      </main>
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

function MobileTopBar({ onSignOut }: { onSignOut: () => void }) {
  return (
    <div className="md:hidden flex items-center justify-between border-b border-border/60 px-4 py-3 bg-card/40">
      <Link to="/dashboard" className="flex items-center gap-2 text-primary">
        <NkyinkyimSymbol size={22} />
        <span className="font-display text-sm font-semibold">NkyinkyimIQ</span>
      </Link>
      <div className="flex gap-3 text-xs">
        <Link to="/dashboard">Home</Link>
        <Link to="/materials">Materials</Link>
        <Link to="/review">Review</Link>
        <Link to="/tutor">Tutor</Link>
        <button onClick={onSignOut} className="text-muted-foreground">Out</button>
      </div>
    </div>
  );
}
