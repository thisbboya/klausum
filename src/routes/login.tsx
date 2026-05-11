import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { NkyinkyimSymbol } from "@/components/adinkra";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back");
    navigate({ to: "/dashboard" });
  }

  async function handleGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) return toast.error(String(result.error));
    if (!result.redirected) navigate({ to: "/" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2 text-primary">
          <NkyinkyimSymbol size={32} />
          <span className="font-display text-lg font-semibold">Klausum</span>
        </Link>
        <h1 className="text-center font-display text-2xl font-semibold">Welcome back</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">Log in to keep learning</p>

        <button
          onClick={handleGoogle}
          className="mt-6 w-full rounded-lg border border-border bg-background py-2.5 text-sm font-medium hover:bg-accent/10"
        >
          Continue with Google
        </button>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />or<div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleEmail} className="space-y-3">
          <input
            type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
          <input
            type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Password" minLength={6}
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
          <button
            type="submit" disabled={loading}
            className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Log in"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link to="/signup" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
