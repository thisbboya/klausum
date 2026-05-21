import { useState, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { chatWithMaterial } from "@/lib/material-chat.functions";
import { getAccessToken } from "@/lib/auth-helper";
import { awardXp } from "@/lib/xp";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Send, Mic } from "lucide-react";

interface ChatMessage {
  id: string;
  role: "user" | "ai";
  content: string;
  page: number;
}

interface Props {
  materialId: string;
  materialTitle: string;
  subject: string;
  level?: string;
  currentPage: number;
  totalPages: number;
  currentPageText: string;
  fullDocumentText: string;
  userId: string;
  userPrimaryStyle?: string;
}

const QUICK_PROMPTS = [
  { label: "Explain key concepts on this page simply", icon: "💡" },
  { label: "What might come up in an exam from here?", icon: "📝" },
  { label: "Summarise the most important points", icon: "📋" },
  { label: "Give me a practical example", icon: "🔬" },
];

export function MaterialAIChat({
  materialId,
  materialTitle,
  subject,
  level,
  currentPage,
  totalPages,
  currentPageText,
  fullDocumentText,
  userId,
  userPrimaryStyle,
}: Props) {
  const chatFn = useServerFn(chatWithMaterial);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingStatus, setThinkingStatus] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load history
  useEffect(() => {
    supabase
      .from("material_chat_messages")
      .select("*")
      .eq("user_id", userId)
      .eq("material_id", materialId)
      .order("created_at", { ascending: true })
      .limit(40)
      .then(({ data }) => {
        if (data?.length) {
          setMessages(
            data.map((m: any) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              page: m.page_number ?? 1,
            })),
          );
        }
      });
  }, [materialId, userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || isThinking) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: q,
      page: currentPage,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsThinking(true);

    const statuses = ["Skimming the page…", "Cross-referencing the document…", "Putting it together…"];
    let i = 0;
    setThinkingStatus(statuses[0]);
    const statusTimer = setInterval(() => {
      i = (i + 1) % statuses.length;
      setThinkingStatus(statuses[i]);
    }, 1800);

    // Persist user message (fire-and-forget)
    supabase.from("material_chat_messages").insert({
      user_id: userId,
      material_id: materialId,
      role: "user",
      content: q,
      page_number: currentPage,
    });

    try {
      const accessToken = await getAccessToken();
      const recent = messages.slice(-8).map((m) => ({
        role: m.role,
        content: m.content,
        page: m.page,
      }));
      const { reply } = await chatFn({
        data: {
          accessToken,
          materialTitle,
          subject,
          level,
          currentPage,
          totalPages,
          currentPageText,
          fullDocumentText,
          userPrimaryStyle,
          history: recent,
          question: q,
        },
      });

      const aiMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "ai",
        content: reply,
        page: currentPage,
      };
      setMessages((prev) => [...prev, aiMsg]);

      supabase.from("material_chat_messages").insert({
        user_id: userId,
        material_id: materialId,
        role: "ai",
        content: reply,
        page_number: currentPage,
      });

      awardXp({
        userId,
        amount: 5,
        action: "tutor_message",
        description: `Asked AI about p.${currentPage} of ${materialTitle}`,
      }).catch(() => {});
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "ai",
          content:
            err?.message?.includes("429")
              ? "Rate limit reached — give me a moment and try again. 🙂"
              : err?.message?.includes("402")
                ? "AI credits exhausted. Please top up to continue."
                : "I had trouble responding. Please try again. 🙂",
          page: currentPage,
        },
      ]);
    } finally {
      clearInterval(statusTimer);
      setIsThinking(false);
      setThinkingStatus("");
    }
  }

  return (
    <div className="flex flex-col h-full bg-card">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-muted-foreground text-xs shrink-0">🤖</span>
          <span className="text-foreground text-sm font-semibold truncate">
            Ask about this page
          </span>
        </div>
        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full shrink-0">
          📄 p.{currentPage}/{totalPages}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-muted-foreground text-xs text-center pt-2">
              Try one of these to get started:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => send(p.label)}
                  className="text-left text-muted-foreground text-xs bg-muted border border-border rounded-xl p-3 hover:border-primary hover:text-foreground transition leading-relaxed active:scale-95"
                >
                  <span className="block text-base mb-1">{p.icon}</span>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground font-medium rounded-tr-sm"
                  : "bg-muted text-foreground border border-border rounded-tl-sm"
              }`}
            >
              {msg.role === "ai" && (
                <span className="inline-flex items-center gap-1 text-[10px] text-primary font-semibold bg-primary/10 px-2 py-0.5 rounded-full mb-2">
                  📄 p.{msg.page}
                </span>
              )}
              {msg.role === "ai" ? (
                <article className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </article>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}

        {isThinking && (
          <div className="flex gap-2 items-start">
            <div className="bg-muted border border-border rounded-2xl rounded-tl-sm px-3.5 py-2.5 flex items-center gap-2">
              <span className="text-muted-foreground text-xs italic">{thinkingStatus}</span>
              <span className="flex gap-0.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border bg-card shrink-0 px-3 py-2 flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder={`Ask anything about page ${currentPage}…`}
          rows={2}
          disabled={isThinking}
          className="flex-1 bg-muted border border-border rounded-xl px-3 py-2 text-foreground text-sm placeholder-muted-foreground resize-none outline-none focus:border-primary transition disabled:opacity-40"
        />
        <button
          onClick={() => send(input)}
          disabled={!input.trim() || isThinking}
          className="h-9 w-9 rounded-xl bg-primary text-primary-foreground font-bold hover:opacity-90 disabled:opacity-30 transition active:scale-95 flex items-center justify-center"
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
