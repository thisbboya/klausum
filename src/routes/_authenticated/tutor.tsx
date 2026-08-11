import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { getAccessToken } from "@/lib/auth-helper";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { Send, MessagesSquare, Sparkles, Square, RotateCcw, Lightbulb, ListOrdered, HelpCircle, Baby } from "lucide-react";
import { CompanionSVG } from "@/components/companion-svg";
import { awardXp } from "@/lib/xp";
import { MarkdownMath } from "@/components/notes/MarkdownMath";

/** First thing the student actually typed — used to title a saved session. */
function firstUserLine(messages: any[]): string {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "";
  const text = (first.parts ?? [])
    .map((p: any) => (p.type === "text" ? p.text : ""))
    .join("")
    .trim();
  return text.slice(0, 80);
}
import { toast } from "@/lib/notify";
import { reportError } from "@/lib/report-error";

export const Route = createFileRoute("/_authenticated/tutor")({
  component: Tutor,
});

const LOADING_MESSAGES = [
  "Thinking…",
  "Connecting the dots…",
  "Looking that up…",
  "Working through it…",
  "Building your answer…",
  "Almost there…",
];

const QUICK_ACTIONS = [
  { icon: Baby, label: "Explain like I'm 12", prompt: "Explain this like I'm 12 years old, using a simple analogy." },
  { icon: Lightbulb, label: "Give an example", prompt: "Give me a concrete worked example of this." },
  { icon: ListOrdered, label: "Step by step", prompt: "Walk me through this step by step." },
  { icon: HelpCircle, label: "Quiz me", prompt: "Ask me 3 short questions to test my understanding of this topic." },
];

function Tutor() {
  const { user } = useAuth();
  // The chosen pilot fronts the tutor, so the page feels like talking to
  // someone rather than to a text box.
  const [profile, setProfile] = useState<{ companion_id: number | null; companion_name: string | null } | null>(null);
  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_profiles")
      .select("companion_id, companion_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data as any));
  }, [user]);
  const tutorName = profile?.companion_name || "your pilot";
  const [mode, setMode] = useState<"standard" | "socratic">("standard");
  const [input, setInput] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [materialContext, setMaterialContext] = useState<string>("");
  const [materialId, setMaterialId] = useState<string>("");
  const [materials, setMaterials] = useState<{ id: string; title: string; ai_summary: string | null; adapted_reading: string | null }[]>([]);
  const [loadingIdx, setLoadingIdx] = useState(0);
  const [msgsThisMonth, setMsgsThisMonth] = useState<number>(0);
  // The question whose answer failed, kept so the student can retry it without
  // retyping — a failed request should never cost them their question.
  const [failed, setFailed] = useState<string | null>(null);
  const lastSentRef = useRef<string>("");

  useEffect(() => {
    getAccessToken().then(setToken).catch(() => {});
  }, []);

  const refreshUsage = async () => {
    if (!user) return;
    const { data } = await supabase.rpc("get_monthly_usage", { p_user_id: user.id });
    const row = Array.isArray(data) ? data[0] : data;
    setMsgsThisMonth(row?.ai_messages_used ?? 0);
  };

  useEffect(() => { refreshUsage(); }, [user]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("study_materials")
      .select("id,title,ai_summary,adapted_reading")
      .eq("processing_status", "ready")
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => setMaterials(data ?? []));
  }, [user]);

  useEffect(() => {
    if (!materialId) return setMaterialContext("");
    const m = materials.find((x) => x.id === materialId);
    setMaterialContext(m?.adapted_reading || m?.ai_summary || "");
  }, [materialId, materials]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({ mode, materialContext, accessToken: token }),
      }),
    [mode, materialContext, token]
  );

  const { messages, sendMessage, status, stop, setMessages } = useChat({
    transport,
    // This used to be console.error only. When the request failed — a rate
    // limit, a 500, a dropped connection — the answer simply never appeared,
    // with nothing shown to the student and nothing recorded for admins. That
    // is the whole of "the AI sometimes doesn't respond": it failed silently
    // every time. Now the real error goes to the admin log and the student
    // gets plain language plus a way to try again.
    onError: (e) => {
      setFailed(lastSentRef.current || null);
      toast.error(reportError("tutor", e));
    },
    onFinish: () => {
      if (!user) return;
      supabase.rpc("increment_ai_messages", { p_user_id: user.id }).then(() => refreshUsage());
      // Asking your tutor a question is studying, so it earns XP like every
      // other study action. Once per day only — this rewards showing up, not
      // spamming the send button, and it keeps the daily quest honest.
      const today = new Date().toISOString().slice(0, 10);
      let claimed = "";
      try { claimed = localStorage.getItem("klausum:tutorXpDate") ?? ""; } catch {}
      if (claimed !== today) {
        try { localStorage.setItem("klausum:tutorXpDate", today); } catch {}
        void awardXp({
          userId: user.id,
          amount: 10,
          action: "tutor_session",
          description: "Asked the AI tutor a question",
        });
        toast.success("+10 XP — good question", { description: "First tutor session today" });
      }
    },
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // ── Conversation persistence ──────────────────────────────────────────────
  // useChat holds messages in memory only, so navigating away threw the whole
  // conversation on the floor. A tutor you cannot re-read is a tutor you cannot
  // revise from. The tutor_sessions table already existed with a messages jsonb
  // column and had never received a single row — it was built for this and
  // never wired up.
  const sessionIdRef = useRef<string | null>(null);
  const restoredRef = useRef(false);

  useEffect(() => {
    if (!user || restoredRef.current) return;
    restoredRef.current = true;
    (async () => {
      const { data } = await supabase
        .from("tutor_sessions")
        .select("id, messages")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!data) return;
      sessionIdRef.current = (data as any).id;
      const saved = (data as any).messages;
      if (Array.isArray(saved) && saved.length > 0) setMessages(saved as any);
    })();
  }, [user, setMessages]);

  // Save after each exchange settles. Guarded on !isLoading so a streaming
  // reply isn't written half-finished.
  useEffect(() => {
    if (!user || messages.length === 0) return;
    if (status === "submitted" || status === "streaming") return;
    const row = {
      user_id: user.id,
      title: firstUserLine(messages) || "Tutor session",
      mode,
      messages: messages as any,
      message_count: messages.length,
      updated_at: new Date().toISOString(),
    };
    void (async () => {
      if (sessionIdRef.current) {
        await supabase.from("tutor_sessions").update(row).eq("id", sessionIdRef.current);
      } else {
        const { data } = await supabase
          .from("tutor_sessions")
          .insert(row)
          .select("id")
          .maybeSingle();
        if (data) sessionIdRef.current = (data as any).id;
      }
    })();
  }, [messages, status, user, mode]);

  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (!isLoading) return;
    const id = setInterval(() => setLoadingIdx((i) => (i + 1) % LOADING_MESSAGES.length), 1800);
    return () => clearInterval(id);
  }, [isLoading]);

  // One send path for the composer, the quick actions and retry, so none of
  // them can drift back into failing quietly.
  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    if (!token) {
      // Previously this returned silently, so pressing send before the access
      // token had loaded looked exactly like the tutor ignoring you.
      toast.error("Still signing you in — try again in a second.");
      return;
    }
    setFailed(null);
    lastSentRef.current = trimmed;
    sendMessage({ text: trimmed });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    send(input);
    setInput("");
  }

  function quickAction(prompt: string) {
    send(prompt);
  }

  function resetChat() {
    if (isLoading) stop();
    setMessages([]);
    setInput("");
    // Start a genuinely new session rather than overwriting the old one, so
    // "New chat" never destroys a conversation the student may want back.
    sessionIdRef.current = null;
  }

  return (
    // The old height here was calc(100dvh - var(--tutor-chrome, 10rem)) — a
    // guess at how much chrome sat above, which is why there was dead white
    // space below the composer on a tall screen and a cramped panel on a short
    // one. The shell is now a flex column, so this just claims what is actually
    // left. min-h-0 lets it shrink so the message list scrolls internally.
    <div className="flex min-h-0 flex-1 flex-col">
      {/* A toolbar, not a page heading: it spans the full width and is separated
          from the conversation by a rule rather than by whitespace, so the
          workspace reads as one continuous surface. */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b-2 border-border bg-card px-4 py-2.5">
        <div className="flex items-center gap-2">
          <MessagesSquare className="h-5 w-5 shrink-0 text-primary" />
          <h1 className="font-display text-lg font-extrabold leading-none">AI Tutor</h1>
          <span className="hidden text-xs font-bold text-muted-foreground sm:inline">
            {msgsThisMonth} message{msgsThisMonth === 1 ? "" : "s"} this month
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <select
            value={materialId}
            onChange={(e) => setMaterialId(e.target.value)}
            className="max-w-[180px] rounded-xl border-2 border-border bg-background px-2.5 py-1.5 text-xs font-bold transition hover:border-primary/50 focus:border-primary focus:outline-none"
          >
            <option value="">No material context</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>{m.title}</option>
            ))}
          </select>
          <ModePill mode={mode} setMode={setMode} />
          {messages.length > 0 && (
            <button
              onClick={resetChat}
              title="Reset chat"
              className="flex items-center gap-1 rounded-xl border-2 border-border px-2.5 py-1.5 font-extrabold transition hover:border-primary hover:bg-primary/10 hover:text-primary"
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          )}
        </div>
      </header>

      {/* min-h-0 is required for a scrollable flex child: without it the panel
          grows to fit its content and pushes the composer off-screen instead
          of scrolling. */}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-surface-2/40 p-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground py-12">
            {/* The pilot the student already chose is the tutor's face. A
                generic sparkle icon made this the one screen in the app with no
                personality at all. */}
            <div className="pilot-float">
              <CompanionSVG id={profile?.companion_id ?? 1} size={84} />
            </div>
            <div className="relative mt-3 max-w-xs rounded-2xl border-2 border-border bg-card px-4 py-2.5">
              <p className="text-sm font-extrabold text-foreground">
                {mode === "socratic"
                  ? `${tutorName} will only ask questions back — you do the thinking.`
                  : `Ask ${tutorName} anything. No question is too small.`}
              </p>
            </div>
            <p className="mt-2 text-xs font-bold text-primary">+10 XP for your first question today</p>
            <div className="mt-6 grid grid-cols-2 gap-2 max-w-md w-full px-4">
              {QUICK_ACTIONS.map((a) => (
                <button
                  key={a.label}
                  onClick={() => quickAction(a.prompt)}
                  disabled={!token}
                  className="flex items-center gap-2 rounded-xl border-2 border-border bg-card px-3 py-2 text-xs text-left hover:border-primary hover:bg-primary/5 transition disabled:opacity-50"
                >
                  <a.icon className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span>{a.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => {
          const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
          return (
            <div key={m.id} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.role !== "user" && (
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-grape/15 text-grape">
                  <Sparkles className="h-4 w-4" />
                </span>
              )}
              <div
                className={
                  m.role === "user"
                    ? "max-w-[85%] sm:max-w-[36rem] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm text-primary-foreground"
                    : // The tutor gets its own colour identity — a grape-tinted
                      // surface with a left rule — so a glance tells you who is
                      // talking without reading a word.
                      // The panel is now full-width, but a 1500px line of prose
                      // is unreadable — so the bubble grows to a comfortable
                      // measure and stops, while diagrams and plots inside it
                      // get the extra room they actually benefit from.
                      "w-full max-w-[85%] sm:max-w-[58rem] rounded-2xl rounded-bl-md border-2 border-grape/25 border-l-4 border-l-grape bg-grape/[0.06] px-4 py-3 text-sm"
                }
              >
                {m.role === "user" ? (
                  <div className="whitespace-pre-wrap">{text}</div>
                ) : (
                  // NOT dark:prose-invert. That is Tailwind Typography's DARK-mode
                  // variant: it forces near-white body text, which on this
                  // light-first theme rendered the tutor's answers white-on-
                  // white — the reason the conversation looked empty.
                  <MarkdownMath source={text || "…"} />
                )}
              </div>
            </div>
          );
        })}
        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground italic px-2">
            <div className="flex gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse [animation-delay:120ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse [animation-delay:240ms]" />
            </div>
            {LOADING_MESSAGES[loadingIdx]}
          </div>
        )}
        {failed && !isLoading && (
          // A toast disappears; a failed question should stay on screen with a
          // way to recover it, because the student's own words are in it.
          <div className="flex flex-wrap items-center gap-2 rounded-xl border-2 border-border bg-surface-2 px-3 py-2 text-xs">
            <span className="font-bold text-muted-foreground">
              That answer didn't come through.
            </span>
            <button
              type="button"
              onClick={() => send(failed)}
              className="flex items-center gap-1 rounded-lg border-2 border-primary px-2 py-1 font-extrabold text-primary transition hover:bg-primary/10"
            >
              <RotateCcw className="h-3 w-3" /> Try again
            </button>
          </div>
        )}
      </div>

      {/* Follow-ups and composer are one docked bar at the foot of the pane —
          bordered rather than floated, so nothing hangs off a corner. */}
      <div className="shrink-0 border-t-2 border-border bg-card">
        {messages.length > 0 && !isLoading && (
          <div className="flex flex-wrap gap-2 px-4 pt-3">
            {QUICK_ACTIONS.map((a) => (
              <button
                key={a.label}
                onClick={() => quickAction(a.prompt)}
                disabled={!token}
                className="flex items-center gap-1.5 rounded-full border-2 border-border bg-card px-3 py-1 text-xs font-bold transition hover:border-primary hover:bg-primary/10 hover:text-primary disabled:opacity-50"
              >
                <a.icon className="h-3 w-3 text-primary" />
                {a.label}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={submit} className="flex gap-2 p-4">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={mode === "socratic" ? "Tell the tutor what you're trying to understand…" : "Ask a question…"}
          className="flex-1 rounded-xl border-2 border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary"
          disabled={isLoading || !token}
        />
        {isLoading ? (
          <button
            type="button"
            onClick={() => stop()}
            className="btn-3d rounded-xl bg-destructive px-4 py-3 text-sm font-extrabold text-destructive-foreground transition hover:opacity-90"
            title="Stop generating"
          >
            <Square className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim() || !token}
            className="btn-3d rounded-xl bg-primary px-4 py-3 text-sm font-extrabold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        )}
        </form>
      </div>
    </div>
  );
}

function ModePill({ mode, setMode }: { mode: "standard" | "socratic"; setMode: (m: any) => void }) {
  return (
    // A segmented control on the same 2px border language as every other
    // control in the app, with the selected half carried on a padded track so
    // the active pill has room to breathe instead of butting into the frame.
    <div className="flex gap-0.5 rounded-xl border-2 border-border bg-surface-2 p-0.5">
      {(["standard", "socratic"] as const).map((m) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          className={`rounded-lg px-3 py-1 font-extrabold capitalize transition ${
            mode === m
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {m}
        </button>
      ))}
    </div>
  );
}
