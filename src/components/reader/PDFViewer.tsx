import { useState, useEffect, useRef, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
// Vite-native worker URL — resolves to a hashed asset URL that always works in dev + prod.
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { AlignLeft, FileText, Search, StickyNote } from "lucide-react";
import { reflowPage, type ReflowBlock } from "./reflow";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// Highlighter palette — value is the stored id, bg is the painted colour.
const HIGHLIGHT_COLORS: { id: string; bg: string; ring: string }[] = [
  { id: "yellow", bg: "rgba(250,204,21,0.45)", ring: "#eab308" },
  { id: "green", bg: "rgba(74,222,128,0.42)", ring: "#22c55e" },
  { id: "blue", bg: "rgba(96,165,250,0.42)", ring: "#3b82f6" },
  { id: "pink", bg: "rgba(244,114,182,0.42)", ring: "#ec4899" },
  { id: "orange", bg: "rgba(251,146,60,0.45)", ring: "#f97316" },
];
type NRect = { x: number; y: number; w: number; h: number };
type Highlight = { id: string; page_number: number; text: string; color: string; rects: NRect[] };

interface PDFViewerProps {
  pdfUrl: string;
  page: number;
  onPageChange: (pageNum: number, pageText: string) => void;
  onTotalPages: (total: number) => void;
  onAllPagesIndexed?: (index: Record<number, string>) => void;
  onAskAboutSelection?: (text: string) => void;
  onAddNote?: (text: string, page: number) => void;
  materialId?: string;
}

export function PDFViewer({
  pdfUrl,
  page,
  onPageChange,
  onTotalPages,
  onAllPagesIndexed,
  onAskAboutSelection,
  onAddNote,
  materialId,
}: PDFViewerProps) {
  const { user } = useAuth();
  const [highlights, setHighlights] = useState<Highlight[]>([]);

  // Load saved highlights for this material
  useEffect(() => {
    if (!materialId || !user) return;
    let alive = true;
    (supabase as any)
      .from("material_highlights")
      .select("id, page_number, text, color, rects")
      .eq("material_id", materialId)
      .then(({ data }: { data: any }) => {
        if (alive && data) setHighlights(data as any);
      });
    return () => { alive = false; };
  }, [materialId, user]);
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

  // ── Reflow ("Text") mode ──────────────────────────────────────────────────
  // The real rendered page is the default on every screen size, phones
  // included. This used to flip to reflowed text below 640px on the theory
  // that an A4 page at 375px is unreadable — but that theory traded away the
  // thing people opened the document for. A student checking a past paper
  // needs the diagram, the table and the marking scheme laid out as printed;
  // stripped text is a different document that happens to share the words.
  // Every real phone PDF reader shows the page and lets you pinch, which this
  // viewer already supports, so it does the same. Text mode is still one tap
  // away in the toggle for anyone who prefers it or is reading a scan.
  const [viewMode, setViewMode] = useState<"page" | "text">("page");
  const [blocks, setBlocks] = useState<ReflowBlock[] | null>(null);
  const [reflowing, setReflowing] = useState(false);

  useEffect(() => {
    if (viewMode !== "text" || !pdf) return;
    let cancelled = false;
    setReflowing(true);
    (async () => {
      try {
        const p = await pdf.getPage(page);
        const tc = await p.getTextContent();
        if (cancelled) return;
        setBlocks(reflowPage(tc.items as any));
      } catch {
        if (!cancelled) setBlocks([]);
      } finally {
        if (!cancelled) setReflowing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdf, page, viewMode]);

  // ── Pinch to zoom ─────────────────────────────────────────────────────────
  // The reader had zoom buttons but no pinch, which is the gesture everyone
  // actually reaches for on a phone — and the main reason this felt unusable
  // next to Adobe. Re-rendering the PDF on every touchmove would be far too
  // slow, so the live gesture scales the canvas with a CSS transform and the
  // real re-render happens once, on release, at the final scale.
  const pinch = useRef<{ startDist: number; startScale: number } | null>(null);
  const [pinchScale, setPinchScale] = useState(1);

  const touchDistance = (t: React.TouchList) =>
    Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

  function onPinchStart(e: React.TouchEvent) {
    if (e.touches.length !== 2) return;
    // Freeze whatever the fit-to-width pass computed, so pinching starts from
    // what the reader is actually showing rather than the stored manual scale.
    const shown = canvasRef.current && wrapRef.current
      ? canvasRef.current.width / (wrapRef.current.clientWidth || 1)
      : 1;
    pinch.current = {
      startDist: touchDistance(e.touches),
      startScale: fitMode === "width" ? Math.max(0.6, shown) * scale : scale,
    };
  }

  function onPinchMove(e: React.TouchEvent) {
    if (e.touches.length !== 2 || !pinch.current) return;
    e.preventDefault();
    const ratio = touchDistance(e.touches) / pinch.current.startDist;
    setPinchScale(Math.min(4, Math.max(0.4, ratio)));
  }

  function onPinchEnd() {
    if (!pinch.current) return;
    const next = Math.min(4, Math.max(0.5, pinch.current.startScale * pinchScale));
    pinch.current = null;
    setPinchScale(1);
    setFitMode("manual");
    setScale(next);
    try {
      localStorage.setItem("klausum:pdfScale", String(next));
    } catch {}
  }

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
          // Let pdf.js stream + range-request against signed URLs — that's the whole
          // point of the storage signed URL. We only disable this in the fetch-bytes
          // fallback below, where we already have the full ArrayBuffer.
          
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
        // Fallback: fetch as ArrayBuffer and hand raw bytes to pdf.js (works around
        // range-request / CORS quirks on some CDNs).
        try {
          const res = await fetch(pdfUrl, { credentials: "omit", cache: "no-store" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const buf = await res.arrayBuffer();
          if (cancelled) return;
          const task = pdfjsLib.getDocument({
            data: new Uint8Array(buf),
            
            disableRange: true,
            disableStream: true,
          });
          const doc = await task.promise;
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
          // Phones get the full width; only desktop keeps the 32px reading gutter.
        // Losing 32 of 375px to padding was a meaningful chunk of the reason the
        // page rendered too small to read.
        const gutter = wrapRef.current.clientWidth < 640 ? 4 : 32;
        const containerWidth = wrapRef.current.clientWidth - gutter;
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

  // Persist the current text selection as a colour highlight. Rects are stored
  // normalised (fractions of the canvas) so they repaint correctly at any zoom.
  async function saveHighlight(color: string) {
    const sel = window.getSelection();
    const canvas = canvasRef.current;
    if (!sel || sel.rangeCount === 0 || !canvas) return;
    const text = sel.toString().replace(/\s+/g, " ").trim();
    if (text.length < 2) return;
    const cRect = canvas.getBoundingClientRect();
    if (!cRect.width || !cRect.height) return;
    const rects: NRect[] = Array.from(sel.getRangeAt(0).getClientRects())
      .filter((r) => r.width > 1 && r.height > 1)
      .map((r) => ({
        x: (r.left - cRect.left) / cRect.width,
        y: (r.top - cRect.top) / cRect.height,
        w: r.width / cRect.width,
        h: r.height / cRect.height,
      }));
    if (rects.length === 0) return;
    window.getSelection()?.removeAllRanges();
    setSelection(null);
    if (!materialId || !user) return;
    // optimistic paint
    const tempId = `tmp-${Date.now()}`;
    const optimistic: Highlight = { id: tempId, page_number: page, text, color, rects };
    setHighlights((h) => [...h, optimistic]);
    const { data, error } = await (supabase as any)
      .from("material_highlights")
      .insert({ user_id: user.id, material_id: materialId, page_number: page, text, color, rects })
      .select("id")
      .single();
    if (error) {
      setHighlights((h) => h.filter((x) => x.id !== tempId)); // roll back
      return;
    }
    setHighlights((h) => h.map((x) => (x.id === tempId ? { ...x, id: data.id } : x)));
  }

  async function deleteHighlight(id: string) {
    setHighlights((h) => h.filter((x) => x.id !== id));
    if (!id.startsWith("tmp-")) await (supabase as any).from("material_highlights").delete().eq("id", id);
  }

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
        onTouchStart={onPinchStart}
        onTouchMove={onPinchMove}
        onTouchEnd={onPinchEnd}
        // touch-action pan-x pan-y: keep one-finger scroll native, but stop the
        // browser swallowing two-finger gestures so pinch-to-zoom reaches us.
        style={{ touchAction: "pan-x pan-y" }}
        className={`flex-1 overflow-auto relative ${
          viewMode === "text" ? "block" : "flex justify-center items-start p-1 sm:p-4"
        }`}
      >
        {viewMode === "text" && !isLoading && !loadError ? (
          // Reflowed reading view. Measure capped at ~64 characters and set at
          // 18px/1.7 — the same typography rules the rest of the app's prose
          // uses, applied to text pulled out of the page geometry. Selection
          // still works, so highlight-to-ask keeps functioning here.
          <div className="mx-auto w-full max-w-[68ch] px-4 py-5 sm:px-6">
            {reflowing && !blocks ? (
              <div className="space-y-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-4 w-full animate-pulse rounded bg-surface-2" />
                ))}
              </div>
            ) : blocks && blocks.length > 0 ? (
              <article className="space-y-4">
                {blocks.map((b, i) =>
                  b.type === "heading" ? (
                    <h3
                      key={i}
                      className="font-display text-[1.35rem] font-extrabold leading-snug text-foreground"
                    >
                      {b.text}
                    </h3>
                  ) : (
                    <p
                      key={i}
                      className="text-[1.05rem] leading-[1.7] text-foreground/90"
                    >
                      {b.text}
                    </p>
                  ),
                )}
              </article>
            ) : (
              <div className="py-10 text-center text-sm font-semibold text-muted-foreground">
                <p>This page has no selectable text.</p>
                <p className="mt-1">It's probably a scan or a diagram —</p>
                <button
                  onClick={() => setViewMode("page")}
                  className="mt-3 btn-3d rounded-xl bg-primary px-4 py-2 text-xs font-extrabold uppercase tracking-wide text-primary-foreground"
                >
                  Show the page
                </button>
              </div>
            )}
          </div>
        ) : isLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-muted-foreground text-sm">Loading document…</p>
          </div>
        ) : (
          loadError ? (
            <div className="max-w-md card-chunky bg-card p-6 text-center text-sm text-muted-foreground space-y-4">
              <p>{loadError}</p>
              <div className="flex items-center justify-center gap-2">
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 btn-3d rounded-full bg-primary text-primary-foreground text-xs font-semibold px-4 py-2 hover:opacity-90 transition"
                >
                  Open in new tab ↗
                </a>
                <a
                  href={pdfUrl}
                  download
                  className="inline-flex items-center gap-1.5 rounded-full bg-muted text-foreground text-xs font-semibold px-4 py-2 hover:bg-accent transition border-2 border-border"
                >
                  Download PDF
                </a>
              </div>
            </div>
          ) : <div
              className="relative"
              style={
                pinchScale === 1
                  ? undefined
                  : { transform: `scale(${pinchScale})`, transformOrigin: "center top" }
              }
            >

            <canvas
              ref={canvasRef}
              className="rounded-lg shadow-2xl max-w-full block bg-white"
              style={{ opacity: isRendering ? 0.6 : 1, transition: "opacity 0.15s" }}
            />
            {/* Colour highlight overlay — sits between canvas and text layer.
                pointer-events-none so it never blocks text selection. */}
            <div className="absolute inset-0 pointer-events-none">
              {highlights
                .filter((h) => h.page_number === page)
                .flatMap((h) => {
                  const c = HIGHLIGHT_COLORS.find((x) => x.id === h.color) ?? HIGHLIGHT_COLORS[0];
                  return h.rects.map((r, i) => (
                    <div
                      key={`${h.id}-${i}`}
                      className="absolute rounded-[2px]"
                      style={{
                        left: `${r.x * 100}%`,
                        top: `${r.y * 100}%`,
                        width: `${r.w * 100}%`,
                        height: `${r.h * 100}%`,
                        background: c.bg,
                        mixBlendMode: "multiply",
                      }}
                    />
                  ));
                })}
            </div>
            {/* Per-page highlight manager */}
            {highlights.some((h) => h.page_number === page) && (
              <div className="absolute right-2 top-2 z-30 flex flex-wrap justify-end gap-1 max-w-[60%]">
                {highlights
                  .filter((h) => h.page_number === page)
                  .map((h) => {
                    const c = HIGHLIGHT_COLORS.find((x) => x.id === h.color) ?? HIGHLIGHT_COLORS[0];
                    return (
                      <button
                        key={h.id}
                        onClick={() => deleteHighlight(h.id)}
                        title={`Remove: ${h.text.slice(0, 60)}`}
                        className="inline-flex max-w-[160px] items-center gap-1 rounded-full border border-black/10 bg-card/90 px-2 py-0.5 text-[10px] font-semibold shadow-sm hover:bg-destructive/10"
                      >
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.ring }} />
                        <span className="truncate">{h.text}</span>
                        <span className="text-destructive">✕</span>
                      </button>
                    );
                  })}
              </div>
            )}
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
            className="z-20 flex items-center gap-1.5 rounded-2xl bg-card border-2 border-border shadow-xl p-1.5"
          >
            {onAskAboutSelection && (
              <button
                onClick={() => {
                  onAskAboutSelection(selection.text);
                  window.getSelection()?.removeAllRanges();
                  setSelection(null);
                }}
                className="inline-flex items-center gap-1.5 btn-3d rounded-xl bg-primary text-primary-foreground text-sm font-bold px-4 py-2 hover:opacity-90 active:scale-95 transition"
              >
                <Search className="h-4 w-4" /> Explain this
              </button>
            )}
            {onAddNote && (
              <button
                onClick={() => {
                  onAddNote(selection.text, page);
                  window.getSelection()?.removeAllRanges();
                  setSelection(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-muted text-foreground text-sm font-bold px-4 py-2 hover:bg-accent active:scale-95 transition border-2 border-border"
              >
                <StickyNote className="h-4 w-4" /> Add to notes
              </button>
            )}
            {/* Colour highlighter swatches */}
            {materialId && (
              <div className="flex items-center gap-1 pl-1 ml-1 border-l-2 border-border">
                {HIGHLIGHT_COLORS.map((c) => (
                  <button
                    key={c.id}
                    onMouseDown={(e) => { e.preventDefault(); saveHighlight(c.id); }}
                    title={`Highlight ${c.id}`}
                    aria-label={`Highlight ${c.id}`}
                    className="h-6 w-6 rounded-full border-2 border-white shadow ring-1 ring-black/10 active:scale-90 transition"
                    style={{ background: c.ring }}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-2 py-2 bg-card border-t border-border gap-1.5 sm:px-3 sm:gap-2">
        {/* Text / Page. On a phone Text is the readable one; Page is there for
            diagrams, formulae and scanned pages where layout carries meaning. */}
        <div className="flex shrink-0 overflow-hidden rounded-lg border-2 border-border">
          {([
            ["text", "Text", AlignLeft],
            ["page", "Page", FileText],
          ] as const).map(([m, label, Icon]) => (
            <button
              key={m}
              onClick={() => setViewMode(m)}
              aria-pressed={viewMode === m}
              title={m === "text" ? "Reflow to fit the screen" : "Show the original page"}
              className={`inline-flex items-center gap-1 px-2 py-1.5 text-[10px] font-extrabold uppercase tracking-wide transition ${
                viewMode === m
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <button
          onClick={() => goTo(page - 1)}
          disabled={page <= 1 || isLoading}
          className="w-9 h-9 rounded-lg bg-muted border-2 border-border text-muted-foreground font-bold text-lg hover:border-primary hover:text-primary disabled:opacity-25 transition active:scale-95"
          aria-label="Previous page"
        >
          ‹
        </button>

        <div className="flex items-center gap-2 bg-muted border-2 border-border rounded-lg px-3 py-1.5">
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
          className="w-9 h-9 rounded-lg bg-muted border-2 border-border text-muted-foreground font-bold text-lg hover:border-primary hover:text-primary disabled:opacity-25 transition active:scale-95"
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
          className="w-8 h-8 rounded-xl bg-muted border-2 border-border text-muted-foreground text-xs hover:text-foreground transition active:scale-95"
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          onClick={() => setFitMode((m) => (m === "width" ? "manual" : "width"))}
          className={`px-2 h-8 rounded-xl border text-[10px] font-semibold transition active:scale-95 ${
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
          className="w-8 h-8 rounded-xl bg-muted border-2 border-border text-muted-foreground text-xs hover:text-foreground transition active:scale-95"
          aria-label="Zoom in"
        >
          +
        </button>
      </div>
    </div>
  );
}
