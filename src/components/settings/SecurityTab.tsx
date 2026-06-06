import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ShieldCheck, ShieldAlert, KeyRound, Smartphone, LogOut, Loader2, Sparkles, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { checkGeminiKeys } from "@/lib/admin.functions";
import { getAccessToken } from "@/lib/auth-helper";

function inputCls() {
  return "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";
}

export function SecurityTab() {
  const { isAdmin } = useIsAdmin();
  return (
    <div className="max-w-xl space-y-6">
      <TwoFactorSection />
      <PasswordSection />
      <SessionSection />
      {isAdmin && <GeminiKeyHealthSection />}
    </div>
  );
}

// ───────────────────────────── 2FA / TOTP ─────────────────────────────

function TwoFactorSection() {
  const qc = useQueryClient();
  const factorsQ = useQuery({
    queryKey: ["mfa-factors"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      return data;
    },
  });

  const verified = factorsQ.data?.totp?.find((f) => f.status === "verified");
  const [enrolling, setEnrolling] = useState<{
    factorId: string;
    qr: string;
    secret: string;
  } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function startEnroll() {
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `Authenticator ${new Date().toLocaleDateString()}`,
      });
      if (error) throw error;
      setEnrolling({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start 2FA setup");
    } finally {
      setBusy(false);
    }
  }

  async function verifyEnroll() {
    if (!enrolling || code.length < 6) return;
    setBusy(true);
    try {
      const { data: chal, error: cerr } = await supabase.auth.mfa.challenge({
        factorId: enrolling.factorId,
      });
      if (cerr) throw cerr;
      const { error: verr } = await supabase.auth.mfa.verify({
        factorId: enrolling.factorId,
        challengeId: chal.id,
        code,
      });
      if (verr) throw verr;
      toast.success("2FA enabled");
      setEnrolling(null);
      setCode("");
      qc.invalidateQueries({ queryKey: ["mfa-factors"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Invalid code");
    } finally {
      setBusy(false);
    }
  }

  async function cancelEnroll() {
    if (!enrolling) return;
    try {
      await supabase.auth.mfa.unenroll({ factorId: enrolling.factorId });
    } catch {
      /* ignore */
    }
    setEnrolling(null);
    setCode("");
    qc.invalidateQueries({ queryKey: ["mfa-factors"] });
  }

  async function disable() {
    if (!verified) return;
    if (!confirm("Disable two-factor authentication?")) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: verified.id });
      if (error) throw error;
      toast.success("2FA disabled");
      qc.invalidateQueries({ queryKey: ["mfa-factors"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-4">
      <div className="flex items-start gap-3">
        <div
          className={`rounded-lg p-2 ${verified ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"}`}
        >
          {verified ? <ShieldCheck className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
        </div>
        <div className="flex-1">
          <div className="font-semibold">Two-factor authentication</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Add a second step at sign-in using an authenticator app (Google Authenticator, 1Password, Authy).
          </p>

          {factorsQ.isLoading ? (
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Checking status…
            </div>
          ) : verified ? (
            <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2 text-sm">
              <span className="text-emerald-400">
                Enabled · {verified.friendly_name ?? "Authenticator"}
              </span>
              <button
                onClick={disable}
                disabled={busy}
                className="rounded-md border border-red-500/40 px-2 py-1 text-xs font-semibold text-red-400 disabled:opacity-50"
              >
                Disable
              </button>
            </div>
          ) : enrolling ? (
            <div className="mt-3 space-y-3">
              <div className="rounded-lg border border-border/60 bg-background/60 p-3">
                <div className="text-xs text-muted-foreground">
                  Scan this QR code with your authenticator app, then enter the 6-digit code below.
                </div>
                <div className="mx-auto mt-2 flex h-44 w-44 items-center justify-center rounded bg-white p-2">
                  <img src={enrolling.qr} alt="2FA QR code" width={160} height={160} />
                </div>
                <div className="mt-2 break-all text-center font-mono text-[10px] text-muted-foreground">
                  {enrolling.secret}
                </div>
              </div>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                inputMode="numeric"
                className={inputCls()}
              />
              <div className="flex gap-2">
                <button
                  onClick={verifyEnroll}
                  disabled={busy || code.length < 6}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {busy ? "Verifying…" : "Verify & enable"}
                </button>
                <button
                  onClick={cancelEnroll}
                  disabled={busy}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={startEnroll}
              disabled={busy}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary disabled:opacity-50"
            >
              <Smartphone className="h-3.5 w-3.5" /> Set up authenticator app
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────── Password ─────────────────────────────

function PasswordSection() {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  async function update() {
    if (pw.length < 8) return toast.error("Password must be at least 8 characters");
    if (pw !== pw2) return toast.error("Passwords don't match");
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      toast.success("Password updated");
      setPw("");
      setPw2("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/15 p-2 text-primary">
          <KeyRound className="h-5 w-5" />
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <div className="font-semibold">Change password</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Use at least 8 characters. Mix letters, numbers, and symbols.
            </p>
          </div>
          <input
            type="password"
            placeholder="New password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            className={inputCls()}
            autoComplete="new-password"
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            className={inputCls()}
            autoComplete="new-password"
          />
          <button
            onClick={update}
            disabled={busy || !pw}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Updating…" : "Update password"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────── Sessions ─────────────────────────────

function SessionSection() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [device, setDevice] = useState("");

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const ua = navigator.userAgent;
    const browser = /Edg\//.test(ua)
      ? "Edge"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Browser";
    const os = /Windows/.test(ua)
      ? "Windows"
      : /Mac OS X/.test(ua)
        ? "macOS"
        : /Android/.test(ua)
          ? "Android"
          : /iPhone|iPad|iPod/.test(ua)
            ? "iOS"
            : /Linux/.test(ua)
              ? "Linux"
              : "Unknown";
    setDevice(`${browser} on ${os}`);
  }, []);

  const provider =
    (user?.app_metadata?.provider as string | undefined) ??
    (user?.identities?.[0]?.provider as string | undefined) ??
    "email";
  const lastSignIn = user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : "—";

  async function signOutEverywhere() {
    if (!confirm("Sign out of all devices? You'll need to sign back in here too.")) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: "global" });
      if (error) throw error;
      toast.success("Signed out everywhere");
      navigate({ to: "/" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-4 space-y-3">
      <div className="font-semibold">This session</div>
      <dl className="grid grid-cols-[120px_1fr] gap-y-1.5 text-sm">
        <dt className="text-muted-foreground">Device</dt>
        <dd>{device || "—"}</dd>
        <dt className="text-muted-foreground">Sign-in method</dt>
        <dd className="capitalize">{provider}</dd>
        <dt className="text-muted-foreground">Last sign-in</dt>
        <dd>{lastSignIn}</dd>
      </dl>
      <div className="border-t border-border/60 pt-3">
        <button
          onClick={signOutEverywhere}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 px-3 py-1.5 text-xs font-semibold text-red-400 disabled:opacity-50"
        >
          <LogOut className="h-3.5 w-3.5" /> Sign out everywhere
        </button>
      </div>
    </div>
  );
}

// ───────────────────────────── AI Keys (admin) ─────────────────────────────

function GeminiKeyHealthSection() {
  const fn = useServerFn(checkGeminiKeys);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<
    { label: string; suffix: string; ok: boolean; projectId: string | null; error: string | null }[] | null
  >(null);

  async function run() {
    setBusy(true);
    try {
      const accessToken = await getAccessToken();
      const { keys } = await fn({ data: { accessToken } });
      setResults(keys);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Check failed");
    } finally {
      setBusy(false);
    }
  }

  const failing = (results ?? []).filter((r) => !r.ok);

  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/15 p-2 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="font-semibold">AI key health</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Admin-only. Pings the Generative Language API for each pooled Gemini key and flags any
            key whose Google Cloud project has the API disabled.
          </p>
          <button
            onClick={run}
            disabled={busy}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {busy ? "Checking…" : "Check Gemini key health"}
          </button>
        </div>
      </div>

      {results && (
        <div className="space-y-2 text-sm">
          {results.length === 0 && (
            <p className="text-muted-foreground text-xs">No Gemini keys configured.</p>
          )}
          {results.map((r) => (
            <div
              key={r.label}
              className={`rounded-lg border p-3 ${
                r.ok ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs">
                  {r.label} <span className="text-muted-foreground">…{r.suffix}</span>
                </span>
                <span className={`text-xs font-semibold ${r.ok ? "text-emerald-400" : "text-amber-400"}`}>
                  {r.ok ? "OK" : "Disabled"}
                </span>
              </div>
              {!r.ok && (
                <div className="mt-2 space-y-1.5 text-xs">
                  {r.error && <p className="text-muted-foreground break-words">{r.error}</p>}
                  {r.projectId && (
                    <a
                      href={`https://console.developers.google.com/apis/api/generativelanguage.googleapis.com/overview?project=${r.projectId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      Enable API for project {r.projectId} <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              )}
            </div>
          ))}
          {failing.length > 0 && (
            <p className="text-[11px] text-muted-foreground">
              Tip: after enabling the API in Google Cloud, wait 2-3 minutes for propagation, then re-run this check.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

