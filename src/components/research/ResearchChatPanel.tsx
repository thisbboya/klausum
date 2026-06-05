import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Send, Loader2, BookText, FileDown } from "lucide-react";
import { toast } from "sonner";
import { getAccessToken } from "@/lib/auth-helper";
import {
  chatResearch,
  getResearchChat,
  exportProjectMarkdown,
} from "@/lib/research.functions";
import { GenerateReferencesDialog } from "./GenerateReferencesDialog";

interface SourceMini {
  id: string;
  title: string;
}

interface Props {
  projectId: string;
  projectTitle: string;
  subject?: string | null;
  sources: SourceMini[];
  activeSourceId: string | null;
  currentPage: number;
  onJump: (sourceId: string, page?: number) => void;
}

interface Msg {
  id: string;
  role: "user" | "ai";
  content: string;
}

const QUICK_PROJECT = [
  "What are the 3 key arguments across all sources?",
  "Where do these sources agree or disagree?",
  "Generate a literature review introduction",
  "Create study flashcards from all sources",
  "What questions do these sources NOT answer?",
  "Write a 200-word summary of this source",
];

export function ResearchChatPanel({
  projectId,
  projectTitle,
  subject,
  sources,
  activeSourceId,
  currentPage,
  onJump,
}: Props) {
  const chatFn = useServerFn(chatResearch);
  const loadFn = useServerFn(getResearchChat);
  const exportFn = useServerFn(exportProjectMarkdown);

  const [scope, setScope] = useState<"source" | "project">("source");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [showRefs, setShowRefs] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const accessToken = await getAccessToken();
        const r = await loadFn({ data: { accessToken, projectId } });
        const m = (r?.messages ?? []).map((x: any) => ({
          id: crypto.randomUUID(),
          role: x.role,
          content: x.content,
        }));
        setMessages(m);
      } catch {
        // ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  // Default to project scope if no active source yet.
  useEffect(() => {
    if (!activeSourceId) setScope("project");
  }, [activeSourceId]);

  async function send(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    if (scope === "source" && !activeSourceId) {
      toast.error("Pick a source first or switch to All Sources");
      return;
    }
    setMessages((p) => [...p, { id: crypto.randomUUID(), role: "user", content: q }]);
    setInput("");
    setBusy(true);
    try {
      const accessToken = await getAccessToken();
      const recent = messages.slice(-8).map((m) => ({ role: m.role, content: m.content }));
      const { reply } = await chatFn({
        data: {
          accessToken,
          projectId,
          scope,
          sourceId: scope === "source" ? activeSourceId ?? undefined : undefined,
          currentPage: scope === "source" ? currentPage : undefined,
          question: q,
          history: recent,
          subject: subject ?? undefined,
        },
      });
      setMessages((p) => [...p, { id: crypto.randomUUID(), role: "ai", content: reply }]);
    } catch (e: any) {
      setMessages((p) => [
        ...p,
        { id: crypto.randomUUID(), role: "ai", content: e?.message ?? "Sorry, I had trouble responding." },
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function handleExport() {
    try {
      const accessToken = await getAccessToken();
      const { markdown } = await exportFn({ data: { accessToken, projectId } });
      const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${projectTitle.replace(/[^a-z0-9-_]+/gi, "_")}.md`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success("Project exported");
    } catch (e: any) {
      toast.error(e?.message ?? "Export failed");
    }
  }

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border space-y-2 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-foreground">🔬 Research Chat</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => activeSourceId ? setShowRefs(true) : toast.error("Pick a source first")}
              className="text-[10px] inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:bg-accent/10"
              title="Generate formatted reference"
            >
              <BookText className="h-3 w-3" /> Cite
            </button>
            <button
              onClick={handleExport}
              className="text-[10px] inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:bg-accent/10"
              title="Export project as Markdown"
            >
              <FileDown className="h-3 w-3" /> Export
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1 bg-muted p-0.5 rounded-md">
          <button
            onClick={() => setScope("source")}
            disabled={!activeSourceId}
            className={`text-[11px] font-semibold py-1 rounded transition ${
              scope === "source" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            } disabled:opacity-40`}
          >
            📄 This source
          </button>
          <button
            onClick={() => setScope("project")}
            className={`text-[11px] font-semibold py-1 rounded transition ${
              scope === "project" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            📚 All sources ({sources.length})
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground text-center">
              {scope === "source"
                ? "Ask anything about the active source."
                : "Synthesise across every source in this project."}
            </p>
            <div className="grid grid-cols-1 gap-1.5">
              {QUICK_PROJECT.map((p) => (
                <button
                  key={p}
                  onClick={() => send(p)}
                  className="text-left text-[12px] text-muted-foreground border border-border bg-muted rounded-lg px-3 py-2 hover:border-primary hover:text-foreground transition"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground font-medium rounded-tr-sm"
                  : "bg-muted text-foreground border border-border rounded-tl-sm"
              }`}
            >
              {m.role === "ai" ? (
                <ResearchReply content={m.content} sources={sources} onJump={onJump} />
              ) : (
                m.content
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="bg-muted border border-border rounded-2xl rounded-tl-sm px-3.5 py-2.5 flex items-center gap-2 max-w-[60%]">
            <Loader2 className="h-3 w-3 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">Thinking…</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border shrink-0 p-2 flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={2}
          placeholder={
            scope === "source" ? "Ask about this source…" : "Ask across all sources…"
          }
          disabled={busy}
          className="flex-1 bg-muted border border-border rounded-xl px-3 py-2 text-sm placeholder-muted-foreground resize-none outline-none focus:border-primary"
        />
        <button
          onClick={() => send(input)}
          disabled={!input.trim() || busy}
          className="h-9 w-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 disabled:opacity-30 active:scale-95"
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>

      {showRefs && activeSourceId && (
        <GenerateReferencesDialog
          sourceId={activeSourceId}
          onClose={() => setShowRefs(false)}
        />
      )}
    </div>
  );
}

// Parses [Source N, p.X] and [p.X] chips into clickable buttons.
function ResearchReply({
  content,
  sources,
  onJump,
}: {
  content: string;
  sources: SourceMini[];
  onJump: (sourceId: string, page?: number) => void;
}) {
  const { body, sourcesLine } = useMemo(() => {
    const m = content.match(/\n+Sources?:\s*(.+)\s*$/i);
    if (!m) return { body: content, sourcesLine: "" };
    return { body: content.slice(0, m.index).trim(), sourcesLine: m[1] };
  }, [content]);

  // Token regex: [Source N, p.X] or [Source N] or [p.X]
  const segments = useMemo(() => {
    const re = /\[(?:Source\s+(\d+)(?:\s*,\s*p\.?\s*(\d+))?|p\.?\s*(\d+))\]/gi;
    const parts: { type: "text" | "chip"; value: string; sourceIdx?: number; page?: number }[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body)) !== null) {
      if (m.index > last) parts.push({ type: "text", value: body.slice(last, m.index) });
      const sourceIdx = m[1] ? parseInt(m[1], 10) : undefined;
      const page = m[2] ? parseInt(m[2], 10) : m[3] ? parseInt(m[3], 10) : undefined;
      parts.push({ type: "chip", value: m[0], sourceIdx, page });
      last = m.index + m[0].length;
    }
    if (last < body.length) parts.push({ type: "text", value: body.slice(last) });
    return parts;
  }, [body]);

  function handleChipClick(sourceIdx?: number, page?: number) {
    if (sourceIdx && sources[sourceIdx - 1]) {
      onJump(sources[sourceIdx - 1].id, page);
    } else if (page) {
      // No source index: jump current source
      onJump("", page);
    }
  }

  return (
    <>
      <article className="prose prose-invert prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
        {segments.map((seg, i) =>
          seg.type === "text" ? (
            <ReactMarkdown key={i} remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
              {seg.value}
            </ReactMarkdown>
          ) : (
            <button
              key={i}
              onClick={() => handleChipClick(seg.sourceIdx, seg.page)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-full px-2 py-0.5 mx-0.5 align-baseline transition not-prose"
              title={
                seg.sourceIdx
                  ? `${sources[seg.sourceIdx - 1]?.title ?? `Source ${seg.sourceIdx}`}${seg.page ? `, p.${seg.page}` : ""}`
                  : `Jump to page ${seg.page}`
              }
            >
              {seg.sourceIdx ? `📚 S${seg.sourceIdx}${seg.page ? `·p.${seg.page}` : ""}` : `📄 p.${seg.page}`}
            </button>
          ),
        )}
      </article>
      {sourcesLine && (
        <div className="mt-2 pt-2 border-t border-border/50 text-[10px] text-muted-foreground">
          <span className="font-semibold uppercase tracking-wide mr-1">Sources:</span>
          {sourcesLine}
        </div>
      )}
    </>
  );
}
