import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import confetti from "canvas-confetti";
import { supabase } from "@/integrations/supabase/client";
import { KlausumLogo, AnimatedKlausumMark } from "@/components/klausum-mark";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({ component: SignupPage });

const inputClass =
  "w-full rounded-xl border-2 border-border bg-surface-2 px-4 py-3 text-sm font-semibold outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-sky focus:bg-background";

const spring = { type: "spring", stiffness: 260, damping: 22 } as const;

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.2 6.2 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.2 6.2 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.3 0 10.1-2 13.7-5.3l-6.3-5.3C29.3 35 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.4l6.3 5.3c-.4.4 6.4-4.7 6.4-14.2 0-1.3-.1-2.6-.4-4z"/>
    </svg>
  );
}

/** Staggered entrance wrapper — children rise in one after another. */
function Stagger({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.07 } },
      }}
    >
      {children}
    </motion.div>
  );
}

function Item({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 14 },
        show: { opacity: 1, y: 0, transition: spring },
      }}
    >
      {children}
    </motion.div>
  );
}

function SignupPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"form" | "otp">("form");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [shake, setShake] = useState(0);

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
    if (error) {
      setShake((s) => s + 1); // wrong code — shake the OTP row
      setOtp("");
      return toast.error(error.message);
    }
    const reduce = typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduce) {
      confetti({ particleCount: 90, spread: 75, origin: { y: 0.6 } });
    }
    toast.success("Email verified — welcome!");
    setTimeout(() => navigate({ to: "/onboarding" }), reduce ? 0 : 650);
  }

  async function handleResend() {
    setResending(true);
    const { error } = await supabase.auth.resend({ type: "signup", email });
    setResending(false);
    if (error) return toast.error(error.message);
    toast.success("New code sent");
  }

  async function handleGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/onboarding" },
    });
    if (error) return toast.error(error.message ?? "Google sign-in failed");
  }

  return (
    <MotionConfig reducedMotion="user">
    <div className="flex min-h-[100dvh] flex-col bg-background">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-4 md:px-8">
        <Link to="/" className="flex items-center gap-2">
          <motion.span
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={spring}
            className="inline-flex"
          >
            <KlausumLogo size={26} />
          </motion.span>
        </Link>
        <Link
          to="/login"
          className="btn-3d btn-3d-secondary rounded-xl border-2 border-border bg-card px-4 py-2 text-sm font-extrabold uppercase tracking-wide text-sky"
        >
          Log in
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">
          <div className="mb-5 flex justify-center">
            <AnimatedKlausumMark size={72} />
          </div>
          {/* Step progress — fills as you move form → otp */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={spring}
            className="mb-8 h-2.5 overflow-hidden rounded-full bg-surface-3"
          >
            <motion.div
              className="h-full rounded-full bg-success"
              initial={false}
              animate={{ width: step === "form" ? "50%" : "100%" }}
              transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
            />
          </motion.div>

          <AnimatePresence mode="wait" initial={false}>
            {step === "form" ? (
              <motion.div
                key="form"
                initial={{ opacity: 0, x: -32 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -32, transition: { duration: 0.18 } }}
                transition={spring}
              >
                <Stagger>
                  <Item>
                    <h1 className="text-center font-display text-2xl font-extrabold tracking-tight">
                      Create your account
                    </h1>
                    <p className="mt-1 text-center text-sm font-semibold text-muted-foreground">
                      Free forever for students
                    </p>
                  </Item>

                  <form onSubmit={handleSignup} className="mt-8 space-y-3">
                    <Item className="flex flex-col gap-2">
                      <label htmlFor="name" className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
                        Full name
                      </label>
                      <input
                        id="name" required value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Ama Serwaa" maxLength={100}
                        className={inputClass}
                      />
                    </Item>
                    <Item className="flex flex-col gap-2">
                      <label htmlFor="email" className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
                        Email
                      </label>
                      <input
                        id="email" type="email" required value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com" maxLength={255}
                        className={inputClass}
                      />
                    </Item>
                    <Item className="flex flex-col gap-2">
                      <label htmlFor="password" className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
                        Password
                      </label>
                      <input
                        id="password" type="password" required value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="At least 8 characters" minLength={8} maxLength={72}
                        className={inputClass}
                      />
                    </Item>
                    <Item>
                      <button
                        type="submit" disabled={loading}
                        className="btn-3d btn-3d-success mt-2 w-full rounded-2xl bg-success py-3 text-sm font-extrabold uppercase tracking-wide text-success-foreground"
                      >
                        {loading ? "Sending code…" : "Create account"}
                      </button>
                    </Item>
                  </form>

                  <Item>
                    <div className="my-6 flex items-center gap-3 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
                      <div className="h-0.5 flex-1 rounded bg-border" /> or <div className="h-0.5 flex-1 rounded bg-border" />
                    </div>

                    <button
                      type="button" onClick={handleGoogle}
                      className="btn-3d btn-3d-secondary flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-border bg-card py-3 text-sm font-extrabold text-foreground"
                    >
                      <GoogleIcon />
                      Continue with Google
                    </button>

                    <p className="mt-8 text-center text-sm font-semibold text-muted-foreground">
                      Already have an account?{" "}
                      <Link to="/login" className="font-extrabold text-sky hover:underline">
                        Log in
                      </Link>
                    </p>
                  </Item>
                </Stagger>
              </motion.div>
            ) : (
              <motion.div
                key="otp"
                initial={{ opacity: 0, x: 32 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 32, transition: { duration: 0.18 } }}
                transition={spring}
              >
                <Stagger>
                  <Item>
                    <motion.div
                      className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky/15"
                      animate={{ y: [0, -6, 0] }}
                      transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="text-sky" aria-hidden>
                        <rect x="2" y="4" width="20" height="16" rx="3" />
                        <path d="m2 7 10 6 10-6" />
                      </svg>
                    </motion.div>
                    <h1 className="mt-4 text-center font-display text-2xl font-extrabold tracking-tight">
                      Check your email
                    </h1>
                    <p className="mt-2 text-center text-sm font-semibold text-muted-foreground">
                      Enter the 6-digit code we sent to{" "}
                      <span className="font-extrabold text-foreground">{email}</span>
                    </p>
                  </Item>
                  <form onSubmit={handleVerify} className="mt-8 space-y-4">
                    <Item>
                      {/* key bump re-triggers the shake on each wrong code */}
                      <motion.div
                        key={shake}
                        initial={false}
                        animate={shake > 0 ? { x: [0, -10, 10, -7, 7, 0] } : {}}
                        transition={{ duration: 0.4 }}
                        className="flex justify-center"
                      >
                        <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                          <InputOTPGroup>
                            {[0, 1, 2, 3, 4, 5].map((i) => (
                              <InputOTPSlot key={i} index={i} />
                            ))}
                          </InputOTPGroup>
                        </InputOTP>
                      </motion.div>
                    </Item>
                    <Item>
                      <button
                        type="submit" disabled={loading || otp.length !== 6}
                        className="btn-3d btn-3d-success w-full rounded-2xl bg-success py-3 text-sm font-extrabold uppercase tracking-wide text-success-foreground"
                      >
                        {loading ? "Verifying…" : "Verify & continue"}
                      </button>
                      <div className="mt-4 flex items-center justify-between text-xs font-extrabold text-muted-foreground">
                        <button type="button" onClick={() => setStep("form")} className="hover:text-foreground">
                          Change email
                        </button>
                        <button type="button" onClick={handleResend} disabled={resending} className="text-sky hover:underline disabled:opacity-50">
                          {resending ? "Resending…" : "Resend code"}
                        </button>
                      </div>
                    </Item>
                  </form>
                </Stagger>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <footer className="px-4 py-4 text-center text-xs font-bold text-muted-foreground">
        Free forever for students · Built in Ghana
      </footer>
    </div>
    </MotionConfig>
  );
}
