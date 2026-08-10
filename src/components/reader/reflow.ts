// Reflow a PDF page into readable blocks.
//
// Why this exists: a PDF page is a fixed A4 canvas. On a 375px phone that is
// ~1/3 scale, and no amount of styling the frame around it makes 8pt body text
// legible — you are stuck pinching and panning. Adobe solved this on mobile
// with Liquid Mode: throw away the page geometry and re-set the text at screen
// width. This is that, built on the text layer pdf.js already gives us.
//
// The existing indexer joined every run with a space, which is fine for feeding
// an AI and useless for reading — no lines, no paragraphs, no headings. Here we
// keep the geometry long enough to rebuild that structure, then discard it.

export type ReflowBlock =
  | { type: "heading"; text: string }
  | { type: "para"; text: string };

type Item = { str: string; transform: number[]; height: number };

/** Group runs sharing a baseline into one line, top of page first. */
function toLines(items: Item[]): { y: number; size: number; text: string }[] {
  const lines: { y: number; size: number; parts: string[] }[] = [];
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue;
    const y = it.transform[5];
    const size = it.height || 10;
    // Same line if the baseline is within half a line-height. PDFs rarely place
    // runs on exactly equal baselines, so an epsilon is required.
    const line = lines.find((l) => Math.abs(l.y - y) < Math.max(2, size * 0.5));
    if (line) {
      line.parts.push(it.str);
      line.size = Math.max(line.size, size);
    } else {
      lines.push({ y, size, parts: [it.str] });
    }
  }
  return lines
    .sort((a, b) => b.y - a.y) // PDF origin is bottom-left, so descending y is reading order
    .map((l) => ({
      y: l.y,
      size: l.size,
      text: l.parts.join(" ").replace(/\s+/g, " ").trim(),
    }))
    .filter((l) => l.text.length > 0);
}

function median(nums: number[]): number {
  if (!nums.length) return 10;
  const s = [...nums].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

export function reflowPage(items: Item[]): ReflowBlock[] {
  const lines = toLines(items);
  if (!lines.length) return [];

  const bodySize = median(lines.map((l) => l.size));
  const blocks: ReflowBlock[] = [];
  let buffer: string[] = [];

  const flush = () => {
    if (!buffer.length) return;
    blocks.push({ type: "para", text: buffer.join(" ").replace(/\s+/g, " ").trim() });
    buffer = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const prev = lines[i - 1];

    // Noticeably larger than the body text, and short enough to be a title
    // rather than a run of emphasised prose.
    const isHeading = line.size > bodySize * 1.25 && line.text.length < 120;
    if (isHeading) {
      flush();
      blocks.push({ type: "heading", text: line.text });
      continue;
    }

    // A vertical gap well beyond normal leading means a new paragraph. Without
    // this every page collapses into one endless block.
    if (prev) {
      const gap = prev.y - line.y;
      if (gap > line.size * 1.8) flush();
    }

    buffer.push(line.text);

    // A line ending in sentence punctuation that is also short (well short of
    // the page's typical measure) usually ends a paragraph.
    const isShort = line.text.length < 45;
    if (isShort && /[.!?:]$/.test(line.text)) flush();
  }

  flush();
  return blocks.filter((b) => b.text.length > 1);
}
