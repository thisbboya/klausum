import { useState, useRef, useEffect, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { chatWithMaterial } from "@/lib/material-chat.functions";
import { getAccessToken } from "@/lib/auth-helper";
import { awardXp } from "@/lib/xp";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Send, X, Clock } from "lucide-react";

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
  /** undefined while the document length is still unknown. */
  totalPages?: number;
  currentPageText: string;
  fullDocumentText: string;
  pageIndex?: Record<number, string>;
  selection?: string | null;
  onClearSelection?: () => void;
  onJumpToPage?: (page: number) => void;
  userId: string;
  userPrimaryStyle?: string;
  overview?: string | null;
  autoSendOnSelection?: boolean;
}

const QUICK_PROMPTS = [
  { label: "Explain key concepts on this page simply", icon: "💡" },
  { label: "What might come up in an exam from here?", icon: "📝" },
  { label: "Summarise the most important points", icon: "📋" },
  { label: "Where is this concept covered?", icon: "🔎" },
];

function formatFocus(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}m ${sec.toString().padStart(2, "0")}s`;
}

// Renders AI markdown with [p.X] / "page X" tokens swapped for jump buttons.
// Also splits off a trailing "Sources: ..." line into a distinct chip row.
function ReplyWithJumps({
  content,
  onJump,
}: {
  content: string;
  onJump?: (p: number) => void;
}) {
  const { body, sources } = useMemo(() => {
    const m = content.match(/\n+Sources?:\s*(.+)\s*$/i);
    if (!m) return { body: content, sources: [] as number[] };
    const pages = Array.from(m[1].matchAll(/\bp(?:age|\.)\s*(\d{1,4})/gi)).map((x) => parseInt(x[1], 10));
    return { body: content.slice(0, m.index).trim(), sources: Array.from(new Set(pages)) };
  }, [content]);

  const segments = useMemo(() => {
    const re = /\[?\bp(?:age|\.)\s*(\d{1,4})\]?/gi;
    const parts: { type: "text" | "jump"; value: string; page?: number }[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body)) !== null) {
      if (m.index > last) parts.push({ type: "text", value: body.slice(last, m.index) });
      parts.push({ type: "jump", value: m[0], page: parseInt(m[1], 10) });
      last = m.index + m[0].length;
    }
    if (last < body.length) parts.push({ type: "text", value: body.slice(last) });
    return parts;
  }, [body]);

  return (
    <>
      <article className="prose dark:prose-invert prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
        {segments.map((seg, i) =>
          seg.type === "text" ? (
            <ReactMarkdown key={i} remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
              {seg.value}
            </ReactMarkdown>
          ) : (
            <button
              key={i}
              onClick={() => seg.page && onJump?.(seg.page)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-full px-2 py-0.5 mx-0.5 align-baseline transition not-prose"
              title={`Jump to page ${seg.page}`}
            >
              📄 p.{seg.page} →
            </button>
          ),
        )}
      </article>
      {sources.length > 0 && (
        <div className="mt-2 pt-2 border-t border-border flex flex-wrap items-center gap-1">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mr-1">Sources</span>
          {sources.map((p) => (
            <button
              key={p}
              onClick={() => onJump?.(p)}
              className="text-[10px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-full px-2 py-0.5 transition"
            >
              p.{p}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

export function MaterialAIChat({
  materialId,
  materialTitle,
  subject,
  level,
  currentPage,
  totalPages,
  currentPageText,
  fullDocumentText,
  pageIndex,
  selection,
  onClearSelection,
  onJumpToPage,
  userId,
  userPrimaryStyle,
  overview,
  autoSendOnSelection,
}: Props) {
  const chatFn = useServerFn(chatWithMaterial);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingStatus, setThinkingStatus] = useState("");
  const [focusSeconds, setFocusSeconds] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Focus timer
  useEffect(() => {
    const t = setInterval(() => setFocusSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

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

  // When selection arrives, focus the input so user can type their question.
  // If autoSendOnSelection, immediately send a default "Explain this passage" question.
  const autoSentRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selection) return;
    inputRef.current?.focus();
    if (autoSendOnSelection && autoSentRef.current !== selection) {
      autoSentRef.current = selection;
      // small delay so React state for selection chip renders first
      setTimeout(() => send("Explain this passage in simple terms."), 30);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, autoSendOnSelection]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || isThinking) return;

    // Build effective question with selection context (kept for AI; user UI keeps it as chip)
    const effective = selection
      ? `Regarding this passage from page ${currentPage}: "${selection.slice(0, 600)}"\n\n${q}`
      : q;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: q,
      page: currentPage,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsThinking(true);

    const statuses = ["Skimming the page…", "Searching the document…", "Putting it together…"];
    let i = 0;
    setThinkingStatus(statuses[0]);
    const statusTimer = setInterval(() => {
      i = (i + 1) % statuses.length;
      setThinkingStatus(statuses[i]);
    }, 1800);

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

      // Compact page index for cross-page search (first 500 chars per page, capped)
      let compactIndex: string | undefined;
      if (pageIndex) {
        const entries = Object.entries(pageIndex)
          .map(([p, txt]) => `[p.${p}] ${(txt || "").slice(0, 500)}`)
          .join("\n");
        compactIndex = entries.slice(0, 30000);
      }

      const { reply } = await chatFn({
        data: {
          accessToken,
          materialTitle,
          subject,
          level,
          currentPage,
          // 0 rather than undefined for the model: the prompt interpolates this
          // and "page 3 of undefined" is worse than "of 0".
          totalPages: totalPages ?? 0,
          currentPageText,
          fullDocumentText,
          pageIndex: compactIndex,
          selection: selection ?? undefined,
          userPrimaryStyle,
          history: recent,
          question: effective,
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

      onClearSelection?.();

      awardXp({
        userId,
        amount: 5,
        action: "tutor_message",
        description: `Asked AI about p.${currentPage} of ${materialTitle}`,
      }).catch(() => {});
    } catch (err: any) {
      const msg = String(err?.message ?? "");
      const friendly = msg.includes("GEMINI_API_DISABLED")
        ? "⚠️ The AI service isn't configured correctly. An admin needs to enable the Generative Language API in Google Cloud."
        : msg.includes("429") || /rate.?limit|quota/i.test(msg)
          ? "⏱ The AI is busy right now. Give me a minute and try again."
          : msg.includes("402")
            ? "AI credits exhausted. Please top up to continue."
            : "I had trouble responding. Please try again. 🙂";
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "ai",
          content: friendly,
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
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-muted-foreground text-xs shrink-0">🤖</span>
          <span className="text-foreground text-sm font-semibold truncate">
            Ask about this page
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="inline-flex items-center gap-1 text-[10px] bg-success/10 text-success px-2 py-0.5 rounded-full font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            <Clock className="h-2.5 w-2.5" /> {formatFocus(focusSeconds)}
          </span>
          <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
            p.{currentPage}/{totalPages ?? "…"}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {overview && (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 px-3.5 py-3 text-sm">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wide text-primary">📄 Document overview</span>
            </div>
            <p className="text-foreground/90 leading-relaxed text-[13px]">{overview}</p>
          </div>
        )}
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
                  className="text-left text-muted-foreground text-xs bg-muted border-2 border-border rounded-xl p-3 hover:border-primary hover:text-foreground transition leading-relaxed active:scale-95"
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
                  : "bg-muted text-foreground border-2 border-border rounded-tl-sm"
              }`}
            >
              {msg.role === "ai" && (
                <button
                  onClick={() => onJumpToPage?.(msg.page)}
                  className="inline-flex items-center gap-1 text-[10px] text-primary font-semibold bg-primary/10 hover:bg-primary/20 px-2 py-0.5 rounded-full mb-2 transition"
                  title={`Jump to page ${msg.page}`}
                >
                  📄 p.{msg.page}
                </button>
              )}
              {msg.role === "ai" ? (
                <ReplyWithJumps content={msg.content} onJump={onJumpToPage} />
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}

        {isThinking && (
          <div className="flex gap-2 items-start">
            <div className="bg-muted border-2 border-border rounded-2xl rounded-tl-sm px-3.5 py-2.5 flex items-center gap-2">
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

      {selection && (
        <div className="px-3 pt-2 shrink-0">
          <div className="flex items-start gap-2 bg-primary/10 border border-primary/30 rounded-lg px-3 py-2">
            <span className="text-[10px] font-semibold text-primary shrink-0 mt-0.5">
              SELECTED p.{currentPage}
            </span>
            <p className="text-xs text-foreground/90 flex-1 line-clamp-2 italic">
              "{selection}"
            </p>
            <button
              onClick={onClearSelection}
              className="text-muted-foreground hover:text-foreground shrink-0"
              aria-label="Clear selection"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <div className="border-t border-border bg-card shrink-0 px-3 py-2 flex items-end gap-2 mt-2">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder={
            selection ? "Ask about the selected passage…" : `Ask anything about page ${currentPage}…`
          }
          rows={2}
          disabled={isThinking}
          className="flex-1 bg-muted border-2 border-border rounded-xl px-3 py-2 text-foreground text-sm placeholder-muted-foreground resize-none outline-none focus:border-primary transition disabled:opacity-40"
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
