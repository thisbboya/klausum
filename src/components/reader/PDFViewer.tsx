import { useState, useEffect, useRef, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { Search, StickyNote } from "lucide-react";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

interface PDFViewerProps {
  pdfUrl: string;
  page: number;
  onPageChange: (pageNum: number, pageText: string) => void;
  onTotalPages: (total: number) => void;
  onAllPagesIndexed?: (index: Record<number, string>) => void;
  onAskAboutSelection?: (text: string) => void;
  onAddNote?: (text: string, page: number) => void;
}

export function PDFViewer({
  pdfUrl,
  page,
  onPageChange,
  onTotalPages,
  onAllPagesIndexed,
  onAskAboutSelection,
  onAddNote,
}: PDFViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<any>(null);
  const [pdf, setPdf] = useState<any>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(() => {
    try {
      const saved = parseFloat(localStorage.getItem("klausum:pdfScale") || "");
      if (!Number.isNaN(saved) && saved >= 0.5 && saved <= 3) return saved;
    } catch {}
    return 1.6;
  });
  const [fitMode, setFitMode] = useState<"manual" | "width">("width");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isRendering, setIsRendering] = useState(false);
  const [pageInput, setPageInput] = useState(String(page));
  const [indexProgress, setIndexProgress] = useState({ done: 0, total: 0 });
  const [selection, setSelection] = useState<{ text: string; x: number; y: number } | null>(null);
  const pageTextCache = useRef<Record<number, string>>({});

  // Load PDF (try direct URL, then fall back to fetch → blob for CORS / range-request issues)
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError("");

    async function load() {
      const tryLoad = async (src: any) => {
        const task = pdfjsLib.getDocument({
          ...src,
          withCredentials: false,
          disableRange: true,
          disableStream: true,
        });
        return await task.promise;
      };

      try {
        const doc = await tryLoad({ url: pdfUrl });
        if (cancelled) return;
        setPdf(doc);
        setTotalPages(doc.numPages);
        onTotalPages(doc.numPages);
        setIsLoading(false);
      } catch (err) {
        // Fallback: fetch as ArrayBuffer and hand raw bytes to pdf.js
        try {
          const res = await fetch(pdfUrl, { credentials: "omit", cache: "no-store" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const buf = await res.arrayBuffer();
          if (cancelled) return;
          const doc = await tryLoad({ data: new Uint8Array(buf) });
          if (cancelled) return;
          setPdf(doc);
          setTotalPages(doc.numPages);
          onTotalPages(doc.numPages);
          setIsLoading(false);
        } catch (err2) {
          if (!cancelled) {
            console.error("PDF load error:", err, err2);
            setLoadError("This PDF could not be rendered inline. Use the buttons below to open or download it — the extracted text and AI study view still work.");
            setIsLoading(false);
          }
        }
      }
    }

    load();
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
        let effectiveScale = scale;
        if (fitMode === "width" && wrapRef.current) {
          const baseViewport = pageObj.getViewport({ scale: 1 });
          const containerWidth = wrapRef.current.clientWidth - 32; // padding
          if (containerWidth > 0) {
            effectiveScale = Math.min(3, Math.max(0.6, containerWidth / baseViewport.width));
          }
        }
        const viewport = pageObj.getViewport({ scale: effectiveScale });
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
  }, [pdf, page, scale, fitMode]);

  // Re-render on window resize when in fit-width mode
  useEffect(() => {
    if (fitMode !== "width") return;
    const onResize = () => setScale((s) => s + 0.0001); // nudge to re-trigger
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [fitMode]);

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
    <div className="flex flex-col h-full bg-background">
      <div
        ref={wrapRef}
        className="flex-1 overflow-auto flex justify-center items-start p-4 relative"
      >
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-muted-foreground text-sm">Loading document…</p>
          </div>
        ) : (
          loadError ? (
            <div className="max-w-md rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground space-y-4">
              <p>{loadError}</p>
              <div className="flex items-center justify-center gap-2">
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold px-4 py-2 hover:opacity-90 transition"
                >
                  Open in new tab ↗
                </a>
                <a
                  href={pdfUrl}
                  download
                  className="inline-flex items-center gap-1.5 rounded-full bg-muted text-foreground text-xs font-semibold px-4 py-2 hover:bg-accent transition border border-border"
                >
                  Download PDF
                </a>
              </div>
            </div>
          ) : <div className="relative">

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

        {selection && (onAskAboutSelection || onAddNote) && (
          <div
            style={{
              position: "absolute",
              left: `${selection.x}px`,
              top: `${Math.max(8, selection.y)}px`,
              transform: "translate(-50%, -100%)",
            }}
            className="z-20 flex items-center gap-1 rounded-full bg-card border border-border shadow-lg p-1"
          >
            {onAskAboutSelection && (
              <button
                onClick={() => {
                  onAskAboutSelection(selection.text);
                  window.getSelection()?.removeAllRanges();
                  setSelection(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold px-3 py-1.5 hover:opacity-90 active:scale-95 transition"
              >
                <Search className="h-3 w-3" /> Explain this
              </button>
            )}
            {onAddNote && (
              <button
                onClick={() => {
                  onAddNote(selection.text, page);
                  window.getSelection()?.removeAllRanges();
                  setSelection(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-muted text-foreground text-xs font-semibold px-3 py-1.5 hover:bg-accent active:scale-95 transition border border-border"
              >
                <StickyNote className="h-3 w-3" /> Add to notes
              </button>
            )}
          </div>
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
          onClick={() => {
            setFitMode("manual");
            setScale((s) => {
              const next = Math.max(0.5, parseFloat((s - 0.15).toFixed(2)));
              try { localStorage.setItem("klausum:pdfScale", String(next)); } catch {}
              return next;
            });
          }}
          className="w-8 h-8 rounded-md bg-muted border border-border text-muted-foreground text-xs hover:text-foreground transition active:scale-95"
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          onClick={() => setFitMode((m) => (m === "width" ? "manual" : "width"))}
          className={`px-2 h-8 rounded-md border text-[10px] font-semibold transition active:scale-95 ${
            fitMode === "width"
              ? "bg-primary/15 border-primary/40 text-primary"
              : "bg-muted border-border text-muted-foreground hover:text-foreground"
          }`}
          aria-label="Fit to width"
          title="Fit to width"
        >
          {fitMode === "width" ? "FIT" : `${Math.round(scale * 100)}%`}
        </button>
        <button
          onClick={() => {
            setFitMode("manual");
            setScale((s) => {
              const next = Math.min(3, parseFloat((s + 0.15).toFixed(2)));
              try { localStorage.setItem("klausum:pdfScale", String(next)); } catch {}
              return next;
            });
          }}
          className="w-8 h-8 rounded-md bg-muted border border-border text-muted-foreground text-xs hover:text-foreground transition active:scale-95"
          aria-label="Zoom in"
        >
          +
        </button>
      </div>
    </div>
  );
}
