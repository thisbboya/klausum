import { Link, Outlet, useNavigate, useLocation, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { KlausumLogo } from "@/components/klausum-mark";
import { KlausumLoading } from "@/components/loading";
import { getCompanion } from "@/components/companion-svg";
import { LogOut, Shield, ChevronDown } from "lucide-react";
import { PRIMARY_LINKS, MORE_LINKS, MORE_GROUPS, SETTINGS_LINK } from "@/lib/nav";
import { hasUnseenUpdates } from "@/lib/updates";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileNav } from "@/components/mobile-nav";
import { StudentBadge } from "@/components/student-badge";
import { FloatingCompanion } from "@/components/floating-companion";
import { ProfileCompletionBanner } from "@/components/profile-completion-banner";
import { toast } from "@/lib/notify";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin } = useIsAdmin();
  const isTutor = location.pathname === "/tutor";

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

  // Onboarding redirect — self-healing so a lost DB write can never bounce a
  // finished user back into pilot selection / VARK from pages like the shop.
  useEffect(() => {
    if (!profile) return;
    if (profile.onboarding_completed) {
      try { localStorage.setItem("klausum:onboarded", "1"); } catch {}
      return;
    }
    let doneLocally = false;
    try { doneLocally = localStorage.getItem("klausum:onboarded") === "1"; } catch {}
    // A returning user who already picked a pilot AND set a level has clearly
    // finished before — never re-run VARK/pilot just because the flag write was
    // lost. Treat either signal (local flag OR existing profile data) as done.
    const looksOnboarded = doneLocally || (!!profile.companion_id && !!profile.level);
    if (looksOnboarded) {
      // Repair the missing flag instead of re-running onboarding
      try { localStorage.setItem("klausum:onboarded", "1"); } catch {}
      supabase.from("user_profiles").update({ onboarding_completed: true }).eq("id", profile.id).then(() => {});
      return;
    }
    if (location.pathname !== "/onboarding") navigate({ to: "/onboarding" });
  }, [profile, location.pathname, navigate]);

  // Pilot theming: the companion's color becomes the app's primary color
  // (CourieX-style full re-theme), plus --pilot for targeted tinting.
  useEffect(() => {
    const root = document.documentElement;
    if (!profile?.companion_id) {
      root.style.removeProperty("--pilot");
      root.style.removeProperty("--pilot-foreground");
      return;
    }
    const c = getCompanion(profile.companion_id);
    // The pilot tints its own surfaces via --pilot, but no longer overwrites
    // --primary. It used to, which meant the brand colour was whatever mascot
    // you happened to pick and the app never looked like one product twice.
    root.style.setProperty("--pilot", c.color);
    // Perceived luminance decides whether text on the pilot colour is dark or white
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.color.slice(i, i + 2), 16) / 255);
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    root.style.setProperty("--pilot-foreground", lum > 0.6 ? "oklch(0.25 0.02 80)" : "#ffffff");
  }, [profile?.companion_id]);

  if (loading || !user) {
    // Full interactive Kumi loader (poke-able mascot, tips, progress) instead
    // of a bare "Loading…" string.
    return <KlausumLoading label="Warming up your vault…" />;
  }

  return (
    // On the tutor the shell is pinned to the viewport and cannot scroll at
    // all. min-h-screen lets the page grow past the window, which is how a
    // long answer — a big fenced code block especially — ended up scrolling
    // the entire layout, sidebar included, and leaving a lake of dead space
    // under the composer. Only the message list is allowed to scroll here.
    <div
      className={`flex bg-background text-foreground ${
        // dvh, not vh: on a phone 100vh is measured against the browser with
        // its toolbars retracted, so a vh-tall page is always taller than what
        // you can actually see and anything pinned to its bottom sits below
        // the fold.
        isTutor ? "h-[100dvh] overflow-hidden" : "min-h-[100dvh]"
      }`}
    >
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r-2 border-border bg-background px-3 py-5">
        <Link to="/dashboard" className="mb-8 flex items-center gap-2 px-2">
          <KlausumLogo size={24} />
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
      {/* The tutor is a workspace, not a document: it gets the entire pane,
          edge to edge and floor to ceiling. Making main itself the flex column
          is what lets the chat panel size to the real remaining space instead
          of guessing at a viewport calculation and leaving dead air below the
          composer. */}
      <main
        className={`flex-1 min-w-0 ${
          // h-full, not h-[100dvh]: the shell above is already exactly the
          // viewport, and pinning a second element to the viewport height
          // inside it is how you get a pane that is taller than the space it
          // was given.
          isTutor ? "flex h-full min-h-0 flex-col overflow-hidden" : ""
        }`}
      >
        <MobileNav
          userLabel={profile?.full_name || user.email || ""}
          level={profile?.level}
          isAdmin={isAdmin}
          streak={(profile as any)?.streak_days}
          gems={(profile as any)?.gems}
          hearts={(profile as any)?.hearts}
          immersive={isTutor}
          onSignOut={async () => {
            await supabase.auth.signOut();
            toast.success("Signed out");
            navigate({ to: "/" });
          }}
        />
        <div
          // pb-* clears the fixed mobile thumb row; md: resets it since the bar
          // is hidden there.
          className={
            isTutor
              ? // Full bleed, and this time actually full bleed: no max-width,
                // no centring, and no page padding at all. The leftover px-3
                // pt-3 was what still floated the panel off the sidebar and
                // left a gap in the bottom-left corner. The only reserved space
                // is the fixed mobile thumb row, which would otherwise sit on
                // top of the composer. min-h-0 is the part that matters —
                // without it a flex child refuses to shrink and the panel
                // overflows instead of scrolling inside itself.
                // No thumb-row allowance any more: on the tutor the bar is
                // hidden, so reserving 4.75rem for it was simply a strip of
                // dead space under the composer on every phone.
                "flex min-h-0 flex-1 flex-col pb-[env(safe-area-inset-bottom,0px)] md:pb-0"
              : `mx-auto space-y-4 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+4.75rem)] md:pb-0 ${
                  // Wide canvas for the split-pane screens (reader + video/AI
                  // panel); max-w-5xl squeezes those two columns far too narrow.
                  /^\/materials\/[^/]+$/.test(location.pathname) ||
                  location.pathname === "/videos"
                    ? "max-w-[1500px] py-4 md:px-5 md:py-5" // CourieX-wide reading canvas
                    : "max-w-5xl py-6 md:px-8 md:py-10"
                }`
          }
        >
          {profile && !profile.level && location.pathname !== "/settings" && (
            <ProfileCompletionBanner level={profile?.level} />
          )}
          <Outlet />
        </div>
      </main>
      {/* Not on the tutor: it is pinned bottom-right, which is exactly where
          the composer's send button lives, so it sat on top of the one control
          that screen exists for. The tutor is also the one page where a second
          thing offering to talk to you is redundant. */}
      {!isTutor && (
        <FloatingCompanion companionId={profile?.companion_id} companionName={profile?.companion_name} />
      )}
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
          {MORE_GROUPS.map((g) => (
            <div key={g.title}>
              <div className="px-3 pb-1 pt-2 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/70">
                {g.title}
              </div>
              {g.links.map((l) => (
                <NavItem key={l.to} to={l.to} icon={l.icon} label={l.label} />
              ))}
            </div>
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
