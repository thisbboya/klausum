import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion, MotionConfig } from "framer-motion";
import confetti from "canvas-confetti";
import { supabase } from "@/integrations/supabase/client";
import { KlausumLogo, AnimatedKlausumMark } from "@/components/klausum-mark";
import { AuthBg } from "@/components/auth-bg";
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
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Simple email signup — no OTP, no verification step. Requires "Confirm
  // email" to be OFF in Supabase (Auth → Sign In/Up), otherwise signUp returns
  // no session and we fall back to pointing the user at login.
  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    if (!data.session) {
      // Confirmations still enabled server-side — don't strand the user.
      toast.success("Account created — you can log in now");
      navigate({ to: "/login" });
      return;
    }
    const reduce = typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduce) {
      confetti({ particleCount: 90, spread: 75, origin: { y: 0.6 } });
    }
    toast.success("Welcome to Klausum!");
    setTimeout(() => navigate({ to: "/onboarding" }), reduce ? 0 : 650);
  }

  async function handleGoogle() {
    // Land on /dashboard and let the _authenticated guard decide: brand-new
    // users get sent to /onboarding, returning users never re-run it.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/dashboard" },
    });
    if (error) return toast.error(error.message ?? "Google sign-in failed");
  }

  return (
    <MotionConfig reducedMotion="user">
    <div className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-background">
      <AuthBg />
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

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">
          <div className="mb-5 flex justify-center">
            <AnimatedKlausumMark size={72} />
          </div>
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
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
                        {loading ? "Creating account…" : "Create account"}
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
        </div>
      </main>

      <footer className="px-4 py-4 text-center text-xs font-bold text-muted-foreground">
        Free forever for students · Built in Ghana
      </footer>
    </div>
    </MotionConfig>
  );
}
