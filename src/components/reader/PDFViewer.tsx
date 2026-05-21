import { useState, useEffect, useRef, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";

// Use CDN worker to avoid Vite bundling issues
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface PDFViewerProps {
  pdfUrl: string;
  onPageChange: (pageNum: number, pageText: string) => void;
  onTotalPages: (total: number) => void;
  initialPage?: number;
}

export function PDFViewer({ pdfUrl, onPageChange, onTotalPages, initialPage = 1 }: PDFViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<any>(null);
  const [pdf, setPdf] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.3);
  const [isLoading, setIsLoading] = useState(true);
  const [isRendering, setIsRendering] = useState(false);
  const [pageInput, setPageInput] = useState(String(initialPage));
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

  // Render page + extract text
  useEffect(() => {
    if (!pdf || !canvasRef.current) return;
    let cancelled = false;

    async function renderPage() {
      setIsRendering(true);
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {}
        renderTaskRef.current = null;
      }
      try {
        const page = await pdf.getPage(currentPage);
        if (cancelled) return;
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext("2d")!;
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const task = page.render({ canvasContext: ctx, viewport, canvas });
        renderTaskRef.current = task;
        await task.promise;
        if (cancelled) return;

        if (!pageTextCache.current[currentPage]) {
          const textContent = await page.getTextContent();
          const text = textContent.items
            .map((item: any) => item.str)
            .filter(Boolean)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();
          pageTextCache.current[currentPage] = text;
        }
        onPageChange(currentPage, pageTextCache.current[currentPage] || "");
        setPageInput(String(currentPage));
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
  }, [pdf, currentPage, scale]);

  const goTo = useCallback(
    (n: number) => {
      const page = Math.max(1, Math.min(n, totalPages || 1));
      setCurrentPage(page);
    },
    [totalPages],
  );

  const handlePageInputBlur = () => {
    const n = parseInt(pageInput, 10);
    if (!Number.isNaN(n)) goTo(n);
    else setPageInput(String(currentPage));
  };

  return (
    <div className="flex flex-col h-full bg-background select-none">
      <div className="flex-1 overflow-auto flex justify-center items-start p-4">
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
            {isRendering && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-3 py-2 bg-card border-t border-border gap-2">
        <button
          onClick={() => goTo(currentPage - 1)}
          disabled={currentPage <= 1 || isLoading}
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
          onClick={() => goTo(currentPage + 1)}
          disabled={currentPage >= totalPages || isLoading}
          className="w-9 h-9 rounded-lg bg-muted border border-border text-muted-foreground font-bold text-lg hover:border-primary hover:text-primary disabled:opacity-25 transition active:scale-95"
          aria-label="Next page"
        >
          ›
        </button>

        <div className="flex-1" />

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
