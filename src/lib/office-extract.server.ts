// Server-only: pull readable text out of Office documents.
//
// Office files render in a cross-origin viewer iframe, so the browser can never
// read their text. Without this, such materials stay stored as a placeholder
// ("[large file: deck.pptx]") and every AI feature — quizzes, flashcards, the
// page chat — ends up describing the FILENAME instead of the content.
//
// PPTX/DOCX/XLSX are OOXML: a ZIP of XML parts, so we can read them directly
// with no external service.
import { unzipSync, strFromU8 } from "fflate";

/** Decode XML entities and strip tags from an OOXML fragment. */
function xmlText(fragment: string): string {
  return fragment
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** Collect the inner text of every occurrence of a tag (e.g. `a:t`). */
function collectTag(xml: string, tag: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const t = xmlText(m[1]);
    if (t) out.push(t);
  }
  return out;
}

/** Numeric sort for slide1.xml, slide2.xml … slide10.xml. */
function byNumber(a: string, b: string): number {
  const n = (s: string) => Number(s.match(/(\d+)\.xml$/)?.[1] ?? 0);
  return n(a) - n(b);
}

export type OfficeExtraction = { text: string; kind: string; parts: number };

/**
 * Extract text from a PPTX / DOCX / XLSX buffer.
 * Returns null when the format isn't supported (e.g. legacy binary .ppt/.doc).
 */
export async function extractOfficeText(
  bytes: Uint8Array,
  fileName: string,
): Promise<OfficeExtraction | null> {
  const ext = (fileName.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "");

  // Legacy binary formats are not ZIP archives — nothing we can do here.
  if (["ppt", "doc", "xls"].includes(ext)) return null;

  if (ext === "docx") {
    // mammoth handles Word structure (headings, lists) far better than raw XML.
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({
      buffer: Buffer.from(bytes),
    } as any);
    const text = (value ?? "").replace(/\n{3,}/g, "\n\n").trim();
    return text ? { text, kind: "docx", parts: 1 } : null;
  }

  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    return null; // not a valid OOXML archive
  }

  if (ext === "pptx") {
    const slides = Object.keys(files)
      .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      .sort(byNumber);
    const notes = Object.keys(files)
      .filter((n) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(n))
      .sort(byNumber);

    const chunks: string[] = [];
    slides.forEach((name, i) => {
      const xml = strFromU8(files[name]);
      // <a:t> holds every run of visible text on a slide.
      const lines = collectTag(xml, "a:t");
      if (!lines.length) return;
      let block = `## Slide ${i + 1}\n${lines.join("\n")}`;
      const note = notes[i] ? collectTag(strFromU8(files[notes[i]]), "a:t").join(" ") : "";
      if (note) block += `\n(Speaker notes: ${note})`;
      chunks.push(block);
    });
    const text = chunks.join("\n\n").trim();
    return text ? { text, kind: "pptx", parts: chunks.length } : null;
  }

  if (ext === "xlsx") {
    // Cell values live in sharedStrings; that alone is the readable content.
    const shared = files["xl/sharedStrings.xml"];
    const text = shared ? collectTag(strFromU8(shared), "t").join("\n").trim() : "";
    return text ? { text, kind: "xlsx", parts: 1 } : null;
  }

  return null;
}
