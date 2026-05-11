import jsPDF from "jspdf";
import html2canvas from "html2canvas";

/**
 * Render an offscreen DOM node to a multi-page A4 PDF.
 * The node should have an explicit width (e.g. 800px) and white background.
 */
export async function exportNodeToPdf(node: HTMLElement, filename: string) {
  const canvas = await html2canvas(node, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
    logging: false,
  });

  const imgData = canvas.toDataURL("image/jpeg", 0.92);
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 24;
  const usableW = pageW - margin * 2;
  const ratio = usableW / canvas.width;
  const imgFullH = canvas.height * ratio;

  if (imgFullH <= pageH - margin * 2) {
    pdf.addImage(imgData, "JPEG", margin, margin, usableW, imgFullH);
  } else {
    // Slice the canvas vertically into pages
    const pageCanvasH = (pageH - margin * 2) / ratio; // px in source canvas per page
    let yOffset = 0;
    let first = true;
    while (yOffset < canvas.height) {
      const sliceH = Math.min(pageCanvasH, canvas.height - yOffset);
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = sliceH;
      const ctx = slice.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, yOffset, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
      const sliceData = slice.toDataURL("image/jpeg", 0.92);
      if (!first) pdf.addPage();
      pdf.addImage(sliceData, "JPEG", margin, margin, usableW, sliceH * ratio);
      yOffset += sliceH;
      first = false;
    }
  }

  pdf.save(filename);
}

/**
 * Mount a printable React tree offscreen, run a callback that returns its DOM node,
 * export it, then clean up.
 */
export async function withPrintableContainer<T>(
  build: (root: HTMLDivElement) => Promise<T> | T,
): Promise<T> {
  const root = document.createElement("div");
  root.style.position = "fixed";
  root.style.left = "-10000px";
  root.style.top = "0";
  root.style.width = "800px";
  root.style.background = "#ffffff";
  root.style.color = "#0f172a";
  root.style.padding = "32px";
  root.style.fontFamily = "Inter, system-ui, sans-serif";
  document.body.appendChild(root);
  try {
    return await build(root);
  } finally {
    document.body.removeChild(root);
  }
}
