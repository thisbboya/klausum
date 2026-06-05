import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Upload, Link2, Type, Youtube } from "lucide-react";
import { getAccessToken } from "@/lib/auth-helper";
import {
  addPdfSource,
  addUrlSource,
  addTextSource,
  addYoutubeSource,
} from "@/lib/research.functions";

type Tab = "pdf" | "url" | "text" | "youtube";

interface Props {
  projectId: string;
  onClose: () => void;
  onAdded: () => void;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const result = String(r.result);
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export function AddSourceDialog({ projectId, onClose, onAdded }: Props) {
  const [tab, setTab] = useState<Tab>("pdf");
  const [busy, setBusy] = useState(false);

  // PDF
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfTitle, setPdfTitle] = useState("");
  // URL
  const [urlValue, setUrlValue] = useState("");
  // Text
  const [textTitle, setTextTitle] = useState("");
  const [textBody, setTextBody] = useState("");
  // YouTube
  const [ytUrl, setYtUrl] = useState("");

  const addPdfFn = useServerFn(addPdfSource);
  const addUrlFn = useServerFn(addUrlSource);
  const addTextFn = useServerFn(addTextSource);
  const addYtFn = useServerFn(addYoutubeSource);

  async function submit() {
    setBusy(true);
    try {
      const accessToken = await getAccessToken();
      if (tab === "pdf") {
        if (!pdfFile) return toast.error("Pick a PDF first");
        if (pdfFile.size > 20 * 1024 * 1024) return toast.error("Max 20MB");
        const b64 = await fileToBase64(pdfFile);
        const title = pdfTitle.trim() || pdfFile.name.replace(/\.pdf$/i, "");
        toast.info("Uploading & processing…");
        await addPdfFn({
          data: {
            accessToken,
            projectId,
            title,
            fileBase64: b64,
            mimeType: "application/pdf",
          },
        });
      } else if (tab === "url") {
        if (!urlValue.trim()) return toast.error("URL required");
        toast.info("Fetching & summarising…");
        await addUrlFn({
          data: { accessToken, projectId, url: urlValue.trim() },
        });
      } else if (tab === "text") {
        if (!textTitle.trim() || textBody.trim().length < 10)
          return toast.error("Title + content required");
        await addTextFn({
          data: {
            accessToken,
            projectId,
            title: textTitle.trim(),
            text: textBody,
            kind: "text",
          },
        });
      } else if (tab === "youtube") {
        if (!ytUrl.trim()) return toast.error("YouTube URL required");
        toast.info("Fetching transcript…");
        await addYtFn({
          data: { accessToken, projectId, url: ytUrl.trim() },
        });
      }
      toast.success("Source added");
      onAdded();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to add source");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-card border border-border rounded-2xl p-5 w-full max-w-lg space-y-4">
        <h2 className="font-display text-lg font-semibold">Add a source</h2>

        <div className="grid grid-cols-4 gap-1 bg-muted p-1 rounded-lg">
          {(
            [
              { k: "pdf", label: "PDF", Icon: Upload },
              { k: "url", label: "URL", Icon: Link2 },
              { k: "text", label: "Text", Icon: Type },
              { k: "youtube", label: "YouTube", Icon: Youtube },
            ] as const
          ).map(({ k, label, Icon }) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition ${
                tab === k
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {tab === "pdf" && (
          <div className="space-y-2">
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
              className="block w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground file:text-xs file:font-semibold"
            />
            <input
              value={pdfTitle}
              onChange={(e) => setPdfTitle(e.target.value)}
              placeholder={pdfFile ? pdfFile.name.replace(/\.pdf$/i, "") : "Title (optional)"}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <p className="text-[11px] text-muted-foreground">Max 20MB. Text + page summary auto-extracted.</p>
          </div>
        )}

        {tab === "url" && (
          <div className="space-y-2">
            <input
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
              placeholder="https://example.com/article"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <p className="text-[11px] text-muted-foreground">We'll fetch the page, strip nav/scripts, and summarise it.</p>
          </div>
        )}

        {tab === "text" && (
          <div className="space-y-2">
            <input
              value={textTitle}
              onChange={(e) => setTextTitle(e.target.value)}
              placeholder="Title"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <textarea
              value={textBody}
              onChange={(e) => setTextBody(e.target.value)}
              rows={8}
              placeholder="Paste lecture notes, an excerpt, or any plain text…"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary resize-none"
            />
          </div>
        )}

        {tab === "youtube" && (
          <div className="space-y-2">
            <input
              value={ytUrl}
              onChange={(e) => setYtUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=…"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <p className="text-[11px] text-muted-foreground">Public transcript used when available.</p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent/10"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Add source
          </button>
        </div>
      </div>
    </div>
  );
}
