import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { User, GraduationCap, Sliders, Database, LogOut, ShieldCheck } from "lucide-react";
import { SecurityTab } from "@/components/settings/SecurityTab";

export const Route = createFileRoute("/_authenticated/settings")({ component: SettingsPage });

const TABS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "learning", label: "Learning", icon: GraduationCap },
  { id: "preferences", label: "Preferences", icon: Sliders },
  { id: "security", label: "Security", icon: ShieldCheck },
  { id: "data", label: "Account & Data", icon: Database },
];

function SettingsPage() {
  const [tab, setTab] = useState("profile");
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold">Settings</h1>
      <div className="flex flex-wrap gap-2 border-b border-border/60">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 transition ${active ? "border-primary text-primary font-semibold" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>
      {tab === "profile" && <ProfileTab />}
      {tab === "learning" && <LearningTab />}
      {tab === "preferences" && <PreferencesTab />}
      {tab === "security" && <SecurityTab />}
      {tab === "data" && <DataTab />}
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

function ProfileTab() {
  const { user } = useAuth();
  const { data: profile, refetch } = useProfile();
  const [form, setForm] = useState({ full_name: "", country: "", school: "", level: "", field_of_study: "" });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (profile) setForm({ full_name: profile.full_name ?? "", country: profile.country ?? "", school: profile.school ?? "", level: profile.level ?? "", field_of_study: profile.field_of_study ?? "" });
  }, [profile]);

  async function save() {
    setSaving(true);
    const { error } = await supabase.from("user_profiles").update(form).eq("id", user!.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    refetch();
  }

  return (
    <div className="max-w-lg space-y-3">
      <Field label="Email"><input value={user?.email ?? ""} disabled className="input opacity-60" /></Field>
      <Field label="Full name"><input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="input" /></Field>
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
      <button onClick={save} disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
      <style>{`.input { width:100%; border-radius: 0.5rem; border:1px solid hsl(var(--border)); background: var(--background); padding: 0.5rem 0.75rem; font-size: 0.875rem; outline:none; }`}</style>
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
    await supabase.from("user_profiles").update({ vark_completed: false, onboarding_completed: false }).eq("id", user!.id);
    navigate({ to: "/onboarding" });
  }

  return (
    <div className="max-w-lg space-y-4">
      <div className="rounded-xl border border-border/60 bg-card/60 p-4">
        <div className="text-xs uppercase text-muted-foreground">Your VARK profile</div>
        <div className="mt-1 text-2xl font-bold capitalize">{profile?.primary_style ?? "—"}</div>
        <div className="text-xs text-muted-foreground">Secondary: {profile?.secondary_style ?? "—"}</div>
        <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
          {(["visual", "auditory", "reading", "kinesthetic"] as const).map((k) => (
            <div key={k} className="rounded-lg border border-border/40 p-2">
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
        <button onClick={save} disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
        <button onClick={retake} className="rounded-lg border border-border px-4 py-2 text-sm">Retake VARK quiz</button>
      </div>
      <style>{`.input { width:100%; border-radius: 0.5rem; border:1px solid hsl(var(--border)); background: var(--background); padding: 0.5rem 0.75rem; font-size: 0.875rem; outline:none; }`}</style>
    </div>
  );
}

function PreferencesTab() {
  const { user } = useAuth();
  const { data: profile, refetch } = useProfile();
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
    setSaving(false);
    toast.success("Saved");
    refetch();
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
        <input type="checkbox" checked={form.dark_mode} onChange={(e) => setForm({ ...form, dark_mode: e.target.checked })} />
        Dark mode
      </label>
      <button onClick={save} disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
      <style>{`.input { width:100%; border-radius: 0.5rem; border:1px solid hsl(var(--border)); background: var(--background); padding: 0.5rem 0.75rem; font-size: 0.875rem; outline:none; }`}</style>
    </div>
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
      a.href = url; a.download = `nkyinkyimiq-export-${Date.now()}.json`; a.click();
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
      <div className="rounded-xl border border-border/60 bg-card/60 p-4 space-y-2">
        <div className="font-semibold">Export your data</div>
        <p className="text-sm text-muted-foreground">Download a JSON snapshot of all your study data.</p>
        <button onClick={exportData} disabled={busy} className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary disabled:opacity-50">{busy ? "Exporting…" : "Download export"}</button>
      </div>
      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 space-y-2">
        <div className="font-semibold text-red-400">Sign out</div>
        <p className="text-sm text-muted-foreground">You'll need to sign back in to access your study materials.</p>
        <button onClick={signOut} className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 px-3 py-1.5 text-xs font-semibold text-red-400">
          <LogOut className="h-3.5 w-3.5" /> Sign out
        </button>
      </div>
    </div>
  );
}
