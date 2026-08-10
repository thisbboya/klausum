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
import { toast } from "@/lib/notify";

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
    onError: (e) => console.error(e),
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

  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (!isLoading) return;
    const id = setInterval(() => setLoadingIdx((i) => (i + 1) % LOADING_MESSAGES.length), 1800);
    return () => clearInterval(id);
  }, [isLoading]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !token) return;
    sendMessage({ text: input.trim() });
    setInput("");
  }

  function quickAction(prompt: string) {
    if (!token || isLoading) return;
    sendMessage({ text: prompt });
  }

  function resetChat() {
    if (isLoading) stop();
    setMessages([]);
    setInput("");
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <header className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <MessagesSquare className="h-5 w-5 text-primary" /> AI Tutor
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {msgsThisMonth} message{msgsThisMonth === 1 ? "" : "s"} this month
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <select
            value={materialId}
            onChange={(e) => setMaterialId(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-xs max-w-[180px]"
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
              className="rounded-md border border-border px-2 py-1.5 hover:bg-accent/10 flex items-center gap-1"
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          )}
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto card-chunky bg-card/30 p-4 space-y-4">
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
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border border-border"
                }`}
              >
                {m.role === "user" ? (
                  <div className="whitespace-pre-wrap">{text}</div>
                ) : (
                  <article className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {text || "…"}
                    </ReactMarkdown>
                  </article>
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
      </div>

      {messages.length > 0 && !isLoading && (
        <div className="mt-3 flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((a) => (
            <button
              key={a.label}
              onClick={() => quickAction(a.prompt)}
              disabled={!token}
              className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs hover:border-primary hover:bg-primary/5 disabled:opacity-50"
            >
              <a.icon className="h-3 w-3 text-primary" />
              {a.label}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={mode === "socratic" ? "Tell the tutor what you're trying to understand…" : "Ask a question…"}
          className="flex-1 rounded-xl border-2 border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
          disabled={isLoading || !token}
        />
        {isLoading ? (
          <button
            type="button"
            onClick={() => stop()}
            className="rounded-lg bg-destructive px-4 py-3 text-sm font-semibold text-destructive-foreground hover:opacity-90"
            title="Stop generating"
          >
            <Square className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim() || !token}
            className="btn-3d rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        )}
      </form>
    </div>
  );
}

function ModePill({ mode, setMode }: { mode: "standard" | "socratic"; setMode: (m: any) => void }) {
  return (
    <div className="flex rounded-md border border-border overflow-hidden">
      {(["standard", "socratic"] as const).map((m) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          className={`px-3 py-1.5 capitalize ${mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          {m}
        </button>
      ))}
    </div>
  );
}
