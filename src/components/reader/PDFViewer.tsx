import { useState, useEffect, useRef, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { Search } from "lucide-react";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface PDFViewerProps {
  pdfUrl: string;
  page: number;
  onPageChange: (pageNum: number, pageText: string) => void;
  onTotalPages: (total: number) => void;
  onAllPagesIndexed?: (index: Record<number, string>) => void;
  onAskAboutSelection?: (text: string) => void;
}

export function PDFViewer({
  pdfUrl,
  page,
  onPageChange,
  onTotalPages,
  onAllPagesIndexed,
  onAskAboutSelection,
}: PDFViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<any>(null);
  const [pdf, setPdf] = useState<any>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.3);
  const [isLoading, setIsLoading] = useState(true);
  const [isRendering, setIsRendering] = useState(false);
  const [pageInput, setPageInput] = useState(String(page));
  const [indexProgress, setIndexProgress] = useState({ done: 0, total: 0 });
  const [selection, setSelection] = useState<{ text: string; x: number; y: number } | null>(null);
  const pageTextCache = useRef<Record<number, string>>({});

  // Load PDF
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    pdfjsLib
      .getDocument({ url: pdfUrl, withCredentials: false })
      .promise.then((doc: any) => {
        if (cancelled) return;
        setPdf(doc);
        setTotalPages(doc.numPages);
        onTotalPages(doc.numPages);
        setIsLoading(false);
      })
      .catch((err: any) => {
        if (!cancelled) {
          console.error("PDF load error:", err);
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfUrl]);

  // Background index of all pages (so AI can search across the doc)
  useEffect(() => {
    if (!pdf || !onAllPagesIndexed) return;
    let cancelled = false;
    const total: number = pdf.numPages;
    setIndexProgress({ done: 0, total });
    const map: Record<number, string> = {};
    (async () => {
      for (let i = 1; i <= total; i++) {
        if (cancelled) return;
        try {
          if (pageTextCache.current[i]) {
            map[i] = pageTextCache.current[i];
          } else {
            const p = await pdf.getPage(i);
            const tc = await p.getTextContent();
            const txt = tc.items
              .map((it: any) => it.str)
              .filter(Boolean)
              .join(" ")
              .replace(/\s+/g, " ")
              .trim();
            pageTextCache.current[i] = txt;
            map[i] = txt;
          }
        } catch {
          map[i] = "";
        }
        setIndexProgress({ done: i, total });
      }
      if (!cancelled) onAllPagesIndexed({ ...map });
    })();
    return () => {
      cancelled = true;
    };
  }, [pdf, onAllPagesIndexed]);

  // Render page + text layer
  useEffect(() => {
    if (!pdf || !canvasRef.current) return;
    let cancelled = false;
    setSelection(null);

    async function renderPage() {
      setIsRendering(true);
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {}
        renderTaskRef.current = null;
      }
      try {
        const pageObj = await pdf.getPage(page);
        if (cancelled) return;
        const viewport = pageObj.getViewport({ scale });
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext("2d")!;
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const task = pageObj.render({ canvasContext: ctx, viewport, canvas });
        renderTaskRef.current = task;
        await task.promise;
        if (cancelled) return;

        // Text layer for selection
        const tlEl = textLayerRef.current;
        if (tlEl) {
          tlEl.innerHTML = "";
          tlEl.style.width = `${viewport.width}px`;
          tlEl.style.height = `${viewport.height}px`;
          tlEl.style.setProperty("--scale-factor", String(viewport.scale));
          try {
            const TL = (pdfjsLib as any).TextLayer;
            if (TL) {
              const tl = new TL({
                textContentSource: pageObj.streamTextContent({ includeMarkedContent: true }),
                container: tlEl,
                viewport,
              });
              await tl.render();
            }
          } catch (e) {
            // Selection won't work, viewer still does — fall through silently
          }
        }

        if (!pageTextCache.current[page]) {
          const textContent = await pageObj.getTextContent();
          pageTextCache.current[page] = textContent.items
            .map((it: any) => it.str)
            .filter(Boolean)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();
        }
        onPageChange(page, pageTextCache.current[page] || "");
        setPageInput(String(page));
      } catch (err: any) {
        if (err?.name !== "RenderingCancelledException") {
          console.error("PDF render error:", err);
        }
      } finally {
        if (!cancelled) setIsRendering(false);
      }
    }
    renderPage();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdf, page, scale]);

  // Selection tracking — works for mouse AND touch (mobile)
  const checkSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      setSelection(null);
      return;
    }
    const text = sel.toString().replace(/\s+/g, " ").trim();
    if (text.length < 3) {
      setSelection(null);
      return;
    }
    const tlEl = textLayerRef.current;
    if (!tlEl) return;
    const range = sel.getRangeAt(0);
    if (!tlEl.contains(range.commonAncestorContainer)) {
      setSelection(null);
      return;
    }
    const rect = range.getBoundingClientRect();
    const wrapRect = wrapRef.current?.getBoundingClientRect();
    if (!wrapRect) return;
    setSelection({
      text,
      x: rect.left - wrapRect.left + rect.width / 2,
      y: rect.top - wrapRect.top - 8,
    });
  }, []);

  // Listen for selection changes globally (covers desktop, mobile, keyboard)
  useEffect(() => {
    const handler = () => {
      // Debounce a tick so mobile long-press finalises
      setTimeout(checkSelection, 50);
    };
    document.addEventListener("selectionchange", handler);
    return () => document.removeEventListener("selectionchange", handler);
  }, [checkSelection]);

  const goTo = useCallback(
    (n: number) => {
      const target = Math.max(1, Math.min(n, totalPages || 1));
      onPageChange(target, pageTextCache.current[target] || "");
    },
    [totalPages, onPageChange],
  );

  const handlePageInputBlur = () => {
    const n = parseInt(pageInput, 10);
    if (!Number.isNaN(n)) goTo(n);
    else setPageInput(String(page));
  };

  return (
    <div className="flex flex-col h-full bg-background select-none">
      <div
        ref={wrapRef}
        className="flex-1 overflow-auto flex justify-center items-start p-4 relative"
        onMouseUp={handleMouseUp}
      >
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-muted-foreground text-sm">Loading document…</p>
          </div>
        ) : (
          <div className="relative">
            <canvas
              ref={canvasRef}
              className="rounded-lg shadow-2xl max-w-full block bg-white"
              style={{ opacity: isRendering ? 0.6 : 1, transition: "opacity 0.15s" }}
            />
            <div
              ref={textLayerRef}
              className="textLayer"
              style={{ position: "absolute", left: 0, top: 0 }}
            />
            {isRendering && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        )}

        {selection && onAskAboutSelection && (
          <button
            onClick={() => {
              onAskAboutSelection(selection.text);
              window.getSelection()?.removeAllRanges();
              setSelection(null);
            }}
            style={{
              position: "absolute",
              left: `${selection.x}px`,
              top: `${Math.max(8, selection.y)}px`,
              transform: "translate(-50%, -100%)",
            }}
            className="z-20 inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold px-3 py-1.5 shadow-lg hover:scale-105 transition active:scale-95"
          >
            <Search className="h-3 w-3" /> Ask AI about this
          </button>
        )}
      </div>

      <div className="flex items-center justify-between px-3 py-2 bg-card border-t border-border gap-2">
        <button
          onClick={() => goTo(page - 1)}
          disabled={page <= 1 || isLoading}
          className="w-9 h-9 rounded-lg bg-muted border border-border text-muted-foreground font-bold text-lg hover:border-primary hover:text-primary disabled:opacity-25 transition active:scale-95"
          aria-label="Previous page"
        >
          ‹
        </button>

        <div className="flex items-center gap-2 bg-muted border border-border rounded-lg px-3 py-1.5">
          <span className="text-muted-foreground text-xs font-medium">Page</span>
          <input
            type="number"
            value={pageInput}
            min={1}
            max={totalPages}
            onChange={(e) => setPageInput(e.target.value)}
            onBlur={handlePageInputBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className="w-10 bg-transparent text-foreground text-sm text-center font-semibold border-none outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-muted-foreground text-xs">/ {totalPages}</span>
        </div>

        <button
          onClick={() => goTo(page + 1)}
          disabled={page >= totalPages || isLoading}
          className="w-9 h-9 rounded-lg bg-muted border border-border text-muted-foreground font-bold text-lg hover:border-primary hover:text-primary disabled:opacity-25 transition active:scale-95"
          aria-label="Next page"
        >
          ›
        </button>

        <div className="flex-1" />

        {indexProgress.total > 0 && indexProgress.done < indexProgress.total && (
          <span className="text-[10px] text-muted-foreground hidden sm:inline">
            Indexing {indexProgress.done}/{indexProgress.total}…
          </span>
        )}

        <button
          onClick={() => setScale((s) => Math.max(0.5, parseFloat((s - 0.15).toFixed(2))))}
          className="w-8 h-8 rounded-md bg-muted border border-border text-muted-foreground text-xs hover:text-foreground transition active:scale-95"
          aria-label="Zoom out"
        >
          −
        </button>
        <span className="text-muted-foreground text-xs w-10 text-center font-mono">
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={() => setScale((s) => Math.min(3, parseFloat((s + 0.15).toFixed(2))))}
          className="w-8 h-8 rounded-md bg-muted border border-border text-muted-foreground text-xs hover:text-foreground transition active:scale-95"
          aria-label="Zoom in"
        >
          +
        </button>
      </div>
    </div>
  );
}
