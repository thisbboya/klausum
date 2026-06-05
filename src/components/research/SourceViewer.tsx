import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ExternalLink } from "lucide-react";
import { PDFViewer } from "@/components/reader/PDFViewer";
import { getAccessToken } from "@/lib/auth-helper";
import { getResearchSource } from "@/lib/research.functions";

interface Props {
  sourceId: string | null;
  currentPage: number;
  onPageChange: (page: number, text: string) => void;
  onTotalPages: (n: number) => void;
  onAskAboutSelection: (text: string) => void;
}

export function SourceViewer({
  sourceId,
  currentPage,
  onPageChange,
  onTotalPages,
  onAskAboutSelection,
}: Props) {
  const fn = useServerFn(getResearchSource);
  const [source, setSource] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!sourceId) {
      setSource(null);
      return;
    }
    setLoading(true);
    (async () => {
      try {
        const accessToken = await getAccessToken();
        const result = await fn({ data: { accessToken, id: sourceId } });
        if (!cancelled) setSource(result);
      } catch {
        if (!cancelled) setSource(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceId]);

  if (!sourceId) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground bg-background">
        Select a source from the left to view it.
      </div>
    );
  }

  if (loading || !source) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (source.source_type === "pdf" && source.signedPdfUrl) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-4 py-2 border-b border-border bg-card text-xs text-muted-foreground truncate">
          📄 {source.title}
        </div>
        <div className="flex-1 min-h-0">
          <PDFViewer
            pdfUrl={source.signedPdfUrl}
            page={currentPage}
            onPageChange={onPageChange}
            onTotalPages={onTotalPages}
            onAskAboutSelection={onAskAboutSelection}
          />
        </div>
      </div>
    );
  }

  const text = source.extracted_text || "";
  return (
    <div className="flex flex-col h-full bg-background">
      <div className="px-4 py-2 border-b border-border bg-card flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground truncate">{source.title}</p>
        {source.raw_url && (
          <a
            href={source.raw_url}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-primary hover:underline inline-flex items-center gap-1 shrink-0"
          >
            Open original <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
      <div className="flex-1 overflow-auto p-5 md:p-6">
        {source.summary && (
          <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-primary mb-1">
              Summary
            </p>
            <p className="text-sm text-foreground/90 leading-relaxed">{source.summary}</p>
          </div>
        )}
        {text ? (
          <article className="prose prose-invert prose-sm md:prose-base max-w-none whitespace-pre-wrap">
            <SelectableText text={text} onAsk={onAskAboutSelection} />
          </article>
        ) : (
          <p className="text-muted-foreground text-sm">No extracted text available.</p>
        )}
      </div>
    </div>
  );
}

function SelectableText({ text, onAsk }: { text: string; onAsk: (s: string) => void }) {
  // Capture text-selection within this scrollable area and show a small button.
  const [pos, setPos] = useState<{ x: number; y: number; text: string } | null>(null);
  useEffect(() => {
    function handler() {
      setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
          setPos(null);
          return;
        }
        const t = sel.toString().replace(/\s+/g, " ").trim();
        if (t.length < 3) {
          setPos(null);
          return;
        }
        const r = sel.getRangeAt(0).getBoundingClientRect();
        setPos({ x: r.left + r.width / 2, y: r.top - 8, text: t });
      }, 50);
    }
    document.addEventListener("selectionchange", handler);
    return () => document.removeEventListener("selectionchange", handler);
  }, []);
  return (
    <>
      {text}
      {pos && (
        <button
          style={{ position: "fixed", left: pos.x, top: Math.max(8, pos.y), transform: "translate(-50%, -100%)" }}
          onClick={() => {
            onAsk(pos.text);
            window.getSelection()?.removeAllRanges();
            setPos(null);
          }}
          className="z-50 rounded-full bg-primary text-primary-foreground text-xs font-semibold px-3 py-1.5 shadow-lg hover:opacity-90 not-prose"
        >
          💡 Explain this
        </button>
      )}
    </>
  );
}
