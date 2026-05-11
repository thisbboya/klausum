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
import { Send, MessagesSquare, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tutor")({
  component: Tutor,
});

function Tutor() {
  const { user } = useAuth();
  const [mode, setMode] = useState<"standard" | "socratic">("standard");
  const [input, setInput] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [materialContext, setMaterialContext] = useState<string>("");
  const [materialId, setMaterialId] = useState<string>("");
  const [materials, setMaterials] = useState<{ id: string; title: string; ai_summary: string | null; adapted_reading: string | null }[]>([]);

  useEffect(() => {
    getAccessToken().then(setToken).catch(() => {});
  }, []);

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

  const { messages, sendMessage, status } = useChat({
    transport,
    onError: (e) => console.error(e),
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const isLoading = status === "submitted" || status === "streaming";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !token) return;
    sendMessage({ text: input.trim() });
    setInput("");
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <header className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <MessagesSquare className="h-5 w-5 text-primary" /> AI Tutor
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Ask anything. Math & code rendered.</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <select
            value={materialId}
            onChange={(e) => setMaterialId(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
          >
            <option value="">No material context</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>{m.title}</option>
            ))}
          </select>
          <ModePill mode={mode} setMode={setMode} />
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto rounded-xl border border-border bg-card/30 p-4 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground py-20">
            <Sparkles className="h-8 w-8 text-primary mb-2" />
            <p className="text-sm">Ask a question to begin.</p>
            {mode === "socratic" && (
              <p className="text-xs mt-1">Socratic mode: I'll only ask questions back.</p>
            )}
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
      </div>

      <form onSubmit={submit} className="mt-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={mode === "socratic" ? "Tell the tutor what you're trying to understand…" : "Ask a question…"}
          className="flex-1 rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
          disabled={isLoading || !token}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim() || !token}
          className="rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
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
