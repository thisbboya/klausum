import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

  const { data: profile, refetch } = useQuery({
    queryKey: ["profile-settings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("user_profiles").select("*").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  const [form, setForm] = useState({ full_name: "", country: "", level: "", primary_style: "", daily_goal_minutes: 60 });

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name ?? "",
        country: profile.country ?? "",
        level: profile.level ?? "",
        primary_style: profile.primary_style ?? "",
        daily_goal_minutes: profile.daily_goal_minutes ?? 60,
      });
    }
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
    <div className="max-w-lg space-y-6">
      <h1 className="font-display text-2xl font-bold">Settings</h1>

      <div className="space-y-3">
        <Field label="Full name">
          <input
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            className="input"
          />
        </Field>
        <Field label="Country">
          <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className="input" />
        </Field>
        <Field label="Level">
          <select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} className="input">
            <option>JHS</option><option>SHS</option><option>University</option><option>Professional</option><option>Other</option>
          </select>
        </Field>
        <Field label="Primary learning style">
          <select value={form.primary_style} onChange={(e) => setForm({ ...form, primary_style: e.target.value })} className="input">
            <option value="visual">Visual</option>
            <option value="auditory">Auditory</option>
            <option value="reading">Reading/Writing</option>
            <option value="kinesthetic">Kinesthetic</option>
          </select>
        </Field>
        <Field label="Daily goal (minutes)">
          <input
            type="number"
            value={form.daily_goal_minutes}
            onChange={(e) => setForm({ ...form, daily_goal_minutes: parseInt(e.target.value) || 0 })}
            className="input"
          />
        </Field>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save"}
      </button>

      <style>{`.input { width:100%; border-radius: 0.5rem; border:1px solid hsl(var(--border)); background: var(--background); padding: 0.625rem 0.75rem; font-size: 0.875rem; outline:none; }`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
