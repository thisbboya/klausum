import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { chatWithLibrary } from "@/lib/library-chat.functions";
import { toast } from "sonner";
import { Send, Loader2, Library, BookOpen } from "lucide-react";

export const Route = createFileRoute("/_authenticated/library-chat")({ component: LibraryChat });

type Msg = { role: "user" | "ai"; content: string; sources?: { title: string; page: number | null }[] };

function LibraryChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const chat = useServerFn(chatWithLibrary);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    if (!input.trim() || busy) return;
    const q = input.trim();
    setInput("");
    const next: Msg[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setBusy(true);
    try {
      const history = next.slice(0, -1).slice(-8).map((m) => ({ role: m.role, content: m.content }));
      const r = await chat({ data: { question: q, history } });
      setMessages([...next, { role: "ai", content: r.reply, sources: r.sources }]);
    } catch (e: any) {
      toast.error(e.message ?? "Chat failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <Library className="h-7 w-7 text-primary" /> Library Chat
        </h1>
        <p className="text-sm text-muted-foreground">Ask questions across every material you've uploaded. Answers cite the source and page.</p>
      </header>

      <div className="rounded-xl border border-border/60 bg-card/60 p-4 min-h-[400px] max-h-[70vh] overflow-y-auto space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Ask something like "Where do my notes explain gradient descent?" or "Summarize what I've studied about thermodynamics."</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted/60 border border-border/40"}`}>
              {m.content}
              {m.sources && m.sources.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border/30 flex flex-wrap gap-1">
                  {m.sources.map((s, j) => (
                    <span key={j} className="text-[11px] rounded-full bg-primary/10 text-primary px-2 py-0.5">
                      {s.title}{s.page ? ` · p.${s.page}` : ""}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && <div className="flex justify-start"><div className="bg-muted/60 rounded-2xl px-4 py-2.5"><Loader2 className="h-4 w-4 animate-spin" /></div></div>}
        <div ref={endRef} />
      </div>

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
          placeholder="Ask about anything in your library…"
          className="flex-1 rounded-lg border border-border bg-background px-4 py-2.5 text-sm"
        />
        <button onClick={send} disabled={busy || !input.trim()} className="inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send
        </button>
      </div>
    </div>
  );
}
