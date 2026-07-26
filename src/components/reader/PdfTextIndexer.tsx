import { useEffect, useRef } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/**
 * Headless PDF text extraction — renders nothing.
 *
 * "Reader" mode shows the PDF inside a cross-origin <iframe>, so the app can't
 * see any of its text. Without this, `currentPageText` stays empty and the AI
 * chat is told the page has "no extractable text" even for text-rich pages.
 * Mounting this alongside the iframe keeps the AI fed with the real page text.
 */
export function PdfTextIndexer({
  pdfUrl,
  page,
  onPageText,
  onTotalPages,
  onAllPagesIndexed,
}: {
  pdfUrl: string;
  page: number;
  onPageText: (pageNum: number, text: string) => void;
  onTotalPages?: (total: number) => void;
  onAllPagesIndexed?: (index: Record<number, string>) => void;
}) {
  const docRef = useRef<any>(null);
  const cacheRef = useRef<Record<number, string>>({});
  const indexedRef = useRef(false);

  // Load the document once per URL
  useEffect(() => {
    if (!pdfUrl) return;
    let cancelled = false;
    docRef.current = null;
    cacheRef.current = {};
    indexedRef.current = false;

    (async () => {
      try {
        const doc = await pdfjsLib.getDocument({ url: pdfUrl }).promise;
        if (cancelled) return;
        docRef.current = doc;
        onTotalPages?.(doc.numPages);

        // Extract the visible page first so the AI is usable immediately.
        await extract(doc, page);

        // Then index the rest in the background, yielding between pages.
        for (let p = 1; p <= doc.numPages && !cancelled; p++) {
          if (cacheRef.current[p] === undefined) await extract(doc, p);
          await new Promise((r) => setTimeout(r, 0));
        }
        if (!cancelled && !indexedRef.current) {
          indexedRef.current = true;
          onAllPagesIndexed?.({ ...cacheRef.current });
        }
      } catch {
        /* Reader still works without extraction — stay silent. */
      }
    })();

    async function extract(doc: any, p: number) {
      if (cacheRef.current[p] !== undefined) return;
      try {
        const pageObj = await doc.getPage(p);
        const content = await pageObj.getTextContent();
        const text = content.items
          .map((it: any) => it.str)
          .filter(Boolean)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        cacheRef.current[p] = text;
        if (p === page) onPageText(p, text);
      } catch {
        cacheRef.current[p] = "";
      }
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfUrl]);

  // Re-emit whenever the reader moves to a different page
  useEffect(() => {
    const doc = docRef.current;
    if (!doc) return;
    const cached = cacheRef.current[page];
    if (cached !== undefined) {
      onPageText(page, cached);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const pageObj = await doc.getPage(page);
        const content = await pageObj.getTextContent();
        const text = content.items
          .map((it: any) => it.str)
          .filter(Boolean)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        if (cancelled) return;
        cacheRef.current[page] = text;
        onPageText(page, text);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  return null;
}
