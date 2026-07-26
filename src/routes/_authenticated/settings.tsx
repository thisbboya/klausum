import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { reportError } from "@/lib/report-error";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { User, GraduationCap, Sliders, Database, LogOut, ShieldCheck, Bell, Sparkles, Crown, Users, Megaphone, LifeBuoy, Mail } from "lucide-react";
import { SecurityTab } from "@/components/settings/SecurityTab";
import { useTheme } from "@/components/theme-provider";
import { CompanionSVG, getCompanion } from "@/components/companion-svg";
import { UPDATES, hasUnseenUpdates, markUpdatesSeen } from "@/lib/updates";

export const Route = createFileRoute("/_authenticated/settings")({ component: SettingsPage });

const TABS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "learning", label: "Learning", icon: GraduationCap },
  { id: "preferences", label: "Preferences", icon: Sliders },
  { id: "security", label: "Security", icon: ShieldCheck },
  { id: "data", label: "Account & Data", icon: Database },
  { id: "updates", label: "Updates", icon: Megaphone },
  { id: "support", label: "Support", icon: LifeBuoy },
];

function SettingsPage() {
  const [tab, setTab] = useState("profile");
  const [unseen, setUnseen] = useState(false);
  useEffect(() => { setUnseen(hasUnseenUpdates()); }, []);

  function selectTab(id: string) {
    setTab(id);
    if (id === "updates") {
      markUpdatesSeen();
      setUnseen(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-extrabold">Settings</h1>
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => selectTab(t.id)}
              className={`relative inline-flex items-center gap-1.5 rounded-full border-2 px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-wide transition ${
                active ? "border-sky/40 bg-sky/12 text-sky" : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {t.label}
              {t.id === "updates" && unseen && (
                <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-destructive" />
              )}
            </button>
          );
        })}
      </div>
      {tab === "profile" && <ProfileTab />}
      {tab === "learning" && <LearningTab />}
      {tab === "preferences" && <PreferencesTab />}
      {tab === "security" && <SecurityTab />}
      {tab === "data" && <DataTab />}
      {tab === "updates" && <UpdatesTab />}
      {tab === "support" && <SupportTab />}
    </div>
  );
}

function UpdatesTab() {
  // Admin-published updates from the DB, with the static changelog as the base
  const { data: dbUpdates = [] } = useQuery({
    queryKey: ["app_updates"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("app_updates")
        .select("id,title,body,created_at")
        .eq("published", true)
        .order("created_at", { ascending: false });
      return (data ?? []).map((u: any) => ({ id: u.id, title: u.title, body: u.body, date: u.created_at }));
    },
  });
  const all = [...dbUpdates, ...UPDATES];

  return (
    <div className="max-w-xl space-y-3">
      {all.map((u) => (
        <div key={u.id} className="card-chunky bg-card p-4">
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-primary" />
            <h3 className="font-display text-base font-extrabold">{u.title}</h3>
          </div>
          <p className="mt-1.5 text-sm font-semibold text-muted-foreground">{u.body}</p>
          <div className="mt-2 text-xs font-extrabold uppercase tracking-wide text-muted-foreground/70">
            {new Date(u.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
          </div>
        </div>
      ))}
    </div>
  );
}

function SupportTab() {
  const email = "hello@klausum.app";
  return (
    <div className="max-w-xl space-y-3">
      <a
        href={`mailto:${email}`}
        className="card-chunky card-chunky-hover flex items-center gap-4 bg-card p-4"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky/15">
          <Mail className="h-5 w-5 text-sky" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">Email</div>
          <div className="truncate text-sm font-extrabold">{email}</div>
          <div className="text-xs font-semibold text-muted-foreground">For questions, bugs, or feedback</div>
        </div>
      </a>
      <div className="card-chunky bg-card p-4">
        <div className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">Response time</div>
        <div className="mt-1 flex items-center justify-between text-sm font-bold">
          <span>Email</span>
          <span className="text-muted-foreground">Within 24 hours</span>
        </div>
      </div>
    </div>
  );
}

function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["profile-settings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("user_profiles").select("*").eq("id", user!.id).maybeSingle();
      return data;
    },
  });
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

// CourieX-style "Share profile" dialog: link opens the public /u/handle page.
function ShareProfileModal({ name, handle, onClose }: { name: string; handle: string; onClose: () => void }) {
  const url = `${window.location.origin}/u/${handle}`;
  const text = `Study with me on Klausum! ${url}`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Copy blocked — select the link and copy manually");
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="card-chunky w-full max-w-sm bg-card p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-lg font-extrabold">Share profile</h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          Send a link that opens your public Klausum profile.
        </p>
        <div className="mt-4 rounded-2xl border-2 border-border bg-surface-2 p-4">
          <div className="font-display font-extrabold">{name}</div>
          <div className="text-sm font-bold text-sky">@{handle}</div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button onClick={copy} className="rounded-xl border-2 border-border bg-card px-3 py-2.5 text-sm font-bold hover:border-primary/50">
            Copy link
          </button>
          <button
            onClick={async () => {
              if (navigator.share) {
                try { await navigator.share({ title: "My Klausum profile", url }); } catch {}
              } else copy();
            }}
            className="btn-3d rounded-xl bg-primary px-3 py-2.5 text-sm font-extrabold text-primary-foreground"
          >
            Share via…
          </button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(text)}`}
            target="_blank" rel="noreferrer"
            className="rounded-xl border-2 border-border bg-card px-3 py-2.5 text-center text-sm font-bold hover:border-primary/50"
          >
            WhatsApp
          </a>
          <a
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`}
            target="_blank" rel="noreferrer"
            className="rounded-xl border-2 border-border bg-card px-3 py-2.5 text-center text-sm font-bold hover:border-primary/50"
          >
            Post to X
          </a>
        </div>
        <div className="mt-4 rounded-xl bg-surface-2 px-3 py-2">
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Invite link</div>
          <div className="break-all text-xs font-semibold">{url}</div>
        </div>
      </div>
    </div>
  );
}

function ProfileTab() {
  const { user } = useAuth();
  const { data: profile, refetch } = useProfile();
  const [form, setForm] = useState({ full_name: "", handle: "", country: "", school: "", level: "", field_of_study: "" });
  const [saving, setSaving] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  useEffect(() => {
    if (profile) setForm({
      full_name: profile.full_name ?? "",
      handle: profile.handle ?? "",
      country: profile.country ?? "",
      school: profile.school ?? "",
      level: profile.level ?? "",
      field_of_study: profile.field_of_study ?? "",
    });
  }, [profile]);

  async function save() {
    setSaving(true);
    const cleanHandle = form.handle.replace(/^@/, "").toLowerCase().replace(/[^a-z0-9_]/g, "");
    const payload = { ...form, handle: cleanHandle || null };
    const { error } = await supabase.from("user_profiles").update(payload).eq("id", user!.id);
    setSaving(false);
    if (error) return toast.error(reportError("settings", error));
    toast.success("Saved");
    refetch();
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Identity card */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Identity</h2>
        <Field label="Email"><input value={user?.email ?? ""} disabled className="input opacity-60" /></Field>
        <Field label="Full name"><input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="input" /></Field>
        <Field label="@handle (unique, lowercase a-z, 0-9, _)">
          <div className="flex items-center rounded-xl border-2 border-border bg-background pl-2">
            <span className="text-muted-foreground text-sm">@</span>
            <input
              value={form.handle}
              onChange={(e) => setForm({ ...form, handle: e.target.value.replace(/^@/, "") })}
              placeholder="kojo_studies"
              className="flex-1 bg-transparent px-1 py-2 text-sm outline-none"
            />
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Country"><input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className="input" /></Field>
          <Field label="School"><input value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value })} className="input" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Level">
            <select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} className="input">
              <option value="">—</option><option>JHS</option><option>SHS</option><option>University</option><option>Professional</option><option>Other</option>
            </select>
          </Field>
          <Field label="Field of study"><input value={form.field_of_study} onChange={(e) => setForm({ ...form, field_of_study: e.target.value })} className="input" /></Field>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={save} disabled={saving} className="btn-3d rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
          <button
            onClick={() => {
              if (!profile?.handle) return toast.error("Set a @handle first, then share your profile");
              setShareOpen(true);
            }}
            className="rounded-xl border-2 border-border bg-card px-4 py-2 text-sm font-bold text-muted-foreground hover:text-foreground"
          >
            ⤴ Share profile
          </button>
        </div>
      </div>

      {shareOpen && profile?.handle && (
        <ShareProfileModal
          name={profile.full_name ?? "Klausum learner"}
          handle={profile.handle}
          onClose={() => setShareOpen(false)}
        />
      )}

      <CompanionCard profile={profile} />
      <PlanCard userId={user?.id} />
      <CohortCard profile={profile} />
      <NotificationsCard />

      <style>{`.input { width:100%; border-radius: 0.5rem; border:1px solid hsl(var(--border)); background: var(--background); padding: 0.5rem 0.75rem; font-size: 0.875rem; outline:none; }`}</style>
    </div>
  );
}

function CompanionCard({ profile }: { profile: any }) {
  const c = getCompanion(profile?.companion_id ?? 1);
  return (
    <div className="card-chunky/60 bg-card/60 p-4 flex items-center gap-4">
      <CompanionSVG id={c.id} size={56} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">Your pilot</div>
        <div className="font-display font-extrabold">{profile?.companion_name ?? c.name}</div>
        <span
          className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide"
          style={{
            color: c.color,
            backgroundColor: `color-mix(in srgb, ${c.color} 16%, transparent)`,
          }}
        >
          {c.trait}
        </span>
      </div>
      <Link to="/companion-select" className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary inline-flex items-center gap-1">
        <Sparkles className="h-3 w-3" /> Change
      </Link>
    </div>
  );
}

function PlanCard({ userId }: { userId?: string }) {
  const { data: usage } = useQuery({
    queryKey: ["usage", userId],
    enabled: !!userId,
    queryFn: async () => {
      const month = new Date().toISOString().slice(0, 7);
      const { data } = await supabase.from("monthly_usage").select("*").eq("user_id", userId!).eq("month_year", month).maybeSingle();
      return data;
    },
  });
  return (
    <div className="card-chunky/60 bg-card/60 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Crown className="h-4 w-4 text-primary" />
          <span className="font-semibold">Free plan</span>
        </div>
        <span className="text-xs text-muted-foreground">This month</span>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl border-2 border-border/40 p-3">
          <div className="text-xs text-muted-foreground">AI messages</div>
          <div className="font-mono text-lg">{usage?.ai_messages_used ?? 0}</div>
        </div>
        <div className="rounded-xl border-2 border-border/40 p-3">
          <div className="text-xs text-muted-foreground">YouTube videos</div>
          <div className="font-mono text-lg">{usage?.youtube_videos_used ?? 0}</div>
        </div>
      </div>
    </div>
  );
}

function CohortCard({ profile }: { profile: any }) {
  if (!profile) return null;
  const memberSince = profile.created_at ? new Date(profile.created_at).toLocaleDateString() : "—";
  return (
    <div className="card-chunky/60 bg-card/60 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Users className="h-4 w-4 text-primary" />
        <span className="font-semibold">Klausum cohort</span>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-xs text-muted-foreground">Member since</div>
          <div className="font-medium">{memberSince}</div>
          {profile.is_day1_pioneer && <div className="text-xs text-primary mt-0.5">Day 1 pioneer ⭐</div>}
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Cohort units</div>
          <div className="font-mono text-lg">{profile.cohort_units ?? 0}</div>
        </div>
      </div>
    </div>
  );
}

function NotificationsCard() {
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  useEffect(() => {
    if (typeof Notification === "undefined") setPerm("unsupported");
    else setPerm(Notification.permission);
  }, []);

  async function enable() {
    if (typeof Notification === "undefined") return toast.error("Notifications not supported on this device");
    const result = await Notification.requestPermission();
    setPerm(result);
    if (result === "granted") toast.success("Notifications enabled");
    else if (result === "denied") toast.error("Permission denied — enable in browser settings");
  }

  const labels: Record<string, string> = {
    granted: "Enabled",
    denied: "Blocked by browser",
    default: "Not enabled",
    unsupported: "Not supported on this device",
  };

  return (
    <div className="card-chunky/60 bg-card/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          <div>
            <div className="font-semibold">Notifications</div>
            <div className="text-xs text-muted-foreground">{labels[perm]}</div>
          </div>
        </div>
        {perm !== "granted" && perm !== "unsupported" && (
          <button onClick={enable} className="btn-3d rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
            Enable
          </button>
        )}
      </div>
    </div>
  );
}

function LearningTab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: profile, refetch } = useProfile();
  const [primary, setPrimary] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (profile) setPrimary(profile.primary_style ?? "visual"); }, [profile]);

  async function save() {
    setSaving(true);
    await supabase.from("user_profiles").update({ primary_style: primary }).eq("id", user!.id);
    setSaving(false);
    toast.success("Saved");
    refetch();
  }

  async function retake() {
    try { localStorage.removeItem("klausum:onboarded"); } catch {}
    await supabase.from("user_profiles").update({ vark_completed: false, onboarding_completed: false }).eq("id", user!.id);
    navigate({ to: "/onboarding" });
  }

  return (
    <div className="max-w-lg space-y-4">
      <div className="card-chunky/60 bg-card/60 p-4">
        <div className="text-xs uppercase text-muted-foreground">Your VARK profile</div>
        <div className="mt-1 text-2xl font-bold capitalize">{profile?.primary_style ?? "—"}</div>
        <div className="text-xs text-muted-foreground">Secondary: {profile?.secondary_style ?? "—"}</div>
        <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
          {(["visual", "auditory", "reading", "kinesthetic"] as const).map((k) => (
            <div key={k} className="rounded-xl border-2 border-border/40 p-2">
              <div className="capitalize text-muted-foreground">{k}</div>
              <div className="font-mono">{(profile as any)?.[`${k}_score`] ?? 0}</div>
            </div>
          ))}
        </div>
      </div>
      <Field label="Override primary style">
        <select value={primary} onChange={(e) => setPrimary(e.target.value)} className="input">
          <option value="visual">Visual</option><option value="auditory">Auditory</option><option value="reading">Reading/Writing</option><option value="kinesthetic">Kinesthetic</option>
        </select>
      </Field>
      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className="btn-3d rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
        <button onClick={retake} className="rounded-xl border-2 border-border px-4 py-2 text-sm">Retake VARK quiz</button>
      </div>
      <style>{`.input { width:100%; border-radius: 0.5rem; border:1px solid hsl(var(--border)); background: var(--background); padding: 0.5rem 0.75rem; font-size: 0.875rem; outline:none; }`}</style>
    </div>
  );
}

function PreferencesTab() {
  const { user } = useAuth();
  const { data: profile, refetch } = useProfile();
  const { theme, setTheme } = useTheme();
  const [form, setForm] = useState({ daily_goal_minutes: 60, preferred_session_minutes: 25, dark_mode: true });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (profile) setForm({
      daily_goal_minutes: profile.daily_goal_minutes ?? 60,
      preferred_session_minutes: profile.preferred_session_minutes ?? 25,
      dark_mode: profile.dark_mode ?? true,
    });
  }, [profile]);

  async function save() {
    setSaving(true);
    await supabase.from("user_profiles").update(form).eq("id", user!.id);
    // Apply theme immediately so the toggle takes effect on this device
    setTheme(form.dark_mode ? "dark" : "light");
    setSaving(false);
    toast.success("Saved");
    refetch();
  }

  function onToggleDark(checked: boolean) {
    setForm({ ...form, dark_mode: checked });
    // Live-preview the theme change without waiting for Save
    setTheme(checked ? "dark" : "light");
  }

  return (
    <div className="max-w-lg space-y-3">
      <Field label="Daily goal (minutes)">
        <input type="number" min={5} max={480} value={form.daily_goal_minutes} onChange={(e) => setForm({ ...form, daily_goal_minutes: parseInt(e.target.value) || 60 })} className="input" />
      </Field>
      <Field label="Pomodoro session length (minutes)">
        <input type="number" min={5} max={120} value={form.preferred_session_minutes} onChange={(e) => setForm({ ...form, preferred_session_minutes: parseInt(e.target.value) || 25 })} className="input" />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.dark_mode} onChange={(e) => onToggleDark(e.target.checked)} />
        Dark mode <span className="text-xs text-muted-foreground">(currently {theme})</span>
      </label>
      <SoundsToggle />
      <button onClick={save} disabled={saving} className="btn-3d rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
      <style>{`.input { width:100%; border-radius: 0.5rem; border:1px solid hsl(var(--border)); background: var(--background); padding: 0.5rem 0.75rem; font-size: 0.875rem; outline:none; }`}</style>
    </div>
  );
}

function SoundsToggle() {
  const [on, setOn] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const v = localStorage.getItem("sounds_enabled");
    return v === null ? true : v === "true";
  });
  function toggle(checked: boolean) {
    setOn(checked);
    if (typeof window !== "undefined") localStorage.setItem("sounds_enabled", checked ? "true" : "false");
  }
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={on} onChange={(e) => toggle(e.target.checked)} />
      🔊 Sound effects
    </label>
  );
}

function DataTab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function exportData() {
    setBusy(true);
    try {
      const tables = ["user_profiles", "study_materials", "flashcard_decks", "flashcards", "quizzes", "quiz_attempts", "cornell_notes", "mind_maps", "knowledge_gaps", "voice_notes", "formulas", "schedule_blocks", "tutor_sessions"];
      const out: Record<string, any[]> = {};
      for (const t of tables) {
        const { data } = await supabase.from(t as any).select("*");
        out[t] = data ?? [];
      }
      const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `klausum-export-${Date.now()}.json`; a.click();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded");
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  return (
    <div className="max-w-lg space-y-4">
      <div className="card-chunky/60 bg-card/60 p-4 space-y-2">
        <div className="font-semibold">Export your data</div>
        <p className="text-sm text-muted-foreground">Download a JSON snapshot of all your study data.</p>
        <button onClick={exportData} disabled={busy} className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary disabled:opacity-50">{busy ? "Exporting…" : "Download export"}</button>
      </div>
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-2">
        <div className="font-semibold text-destructive">Sign out</div>
        <p className="text-sm text-muted-foreground">You'll need to sign back in to access your study materials.</p>
        <button onClick={signOut} className="inline-flex items-center gap-1 rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-semibold text-destructive">
          <LogOut className="h-3.5 w-3.5" /> Sign out
        </button>
      </div>
    </div>
  );
}
