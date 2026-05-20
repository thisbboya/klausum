import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { KlausumMark } from "@/components/klausum-mark";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({ component: SignupPage });

function SignupPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"form" | "otp">("form");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("We sent a 6-digit code to your email");
    setStep("otp");
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length !== 6) return toast.error("Enter the 6-digit code");
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: "signup",
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Email verified — welcome!");
    navigate({ to: "/onboarding" });
  }

  async function handleResend() {
    setResending(true);
    const { error } = await supabase.auth.resend({ type: "signup", email });
    setResending(false);
    if (error) return toast.error(error.message);
    toast.success("New code sent");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2 text-primary">
          <KlausumMark size={32} />
          <span className="font-display text-lg font-semibold">Klausum</span>
        </Link>

        {step === "form" ? (
          <>
            <h1 className="text-center font-display text-2xl font-semibold">Start learning</h1>
            <p className="mt-1 text-center text-sm text-muted-foreground">Free forever for students</p>
            <form onSubmit={handleSignup} className="mt-6 space-y-3">
              <input
                required value={fullName} onChange={(e) => setFullName(e.target.value)}
                placeholder="Full name" maxLength={100}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
              <input
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com" maxLength={255}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
              <input
                type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Password (min 8 chars)" minLength={8} maxLength={72}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
              <button
                type="submit" disabled={loading}
                className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Sending code…" : "Create account"}
              </button>
            </form>
            <p className="mt-5 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="font-medium text-primary hover:underline">Log in</Link>
            </p>
          </>
        ) : (
          <>
            <h1 className="text-center font-display text-2xl font-semibold">Verify your email</h1>
            <p className="mt-1 text-center text-sm text-muted-foreground">
              Enter the 6-digit code sent to <span className="font-medium text-foreground">{email}</span>
            </p>
            <form onSubmit={handleVerify} className="mt-6 space-y-4">
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                  <InputOTPGroup>
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <InputOTPSlot key={i} index={i} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <button
                type="submit" disabled={loading || otp.length !== 6}
                className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Verifying…" : "Verify & continue"}
              </button>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <button type="button" onClick={() => setStep("form")} className="hover:text-foreground">
                  ← Change email
                </button>
                <button type="button" onClick={handleResend} disabled={resending} className="hover:text-foreground disabled:opacity-50">
                  {resending ? "Resending…" : "Resend code"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
