import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { getAccessToken } from "@/lib/auth-helper";
import { generateReference } from "@/lib/research.functions";

const STYLES = ["APA", "MLA", "Chicago", "Harvard", "Vancouver", "IEEE"] as const;
type Style = typeof STYLES[number];

interface Props {
  sourceId: string;
  onClose: () => void;
}

export function GenerateReferencesDialog({ sourceId, onClose }: Props) {
  const genFn = useServerFn(generateReference);
  const [style, setStyle] = useState<Style>("APA");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function generate(s: Style) {
    setStyle(s);
    setBusy(true);
    setReference("");
    try {
      const accessToken = await getAccessToken();
      const { reference } = await genFn({ data: { accessToken, sourceId, style: s } });
      setReference(reference);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to generate");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!reference) return;
    await navigator.clipboard.writeText(reference);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-card border border-border rounded-2xl p-5 w-full max-w-lg space-y-4">
        <h2 className="font-display text-lg font-semibold">Generate reference</h2>
        <div className="flex flex-wrap gap-1.5">
          {STYLES.map((s) => (
            <button
              key={s}
              onClick={() => generate(s)}
              className={`text-xs rounded-md px-3 py-1.5 border transition ${
                style === s
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border hover:bg-accent/10"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="rounded-lg border border-border bg-muted p-3 min-h-[80px] text-sm">
          {busy ? (
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating {style}…
            </span>
          ) : reference ? (
            <p className="leading-relaxed">{reference}</p>
          ) : (
            <p className="text-muted-foreground text-xs">Pick a style to generate.</p>
          )}
        </div>
        <div className="flex justify-between items-center">
          <button
            onClick={copy}
            disabled={!reference}
            className="text-xs inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 hover:bg-accent/10 disabled:opacity-40"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            onClick={onClose}
            className="text-xs rounded-md border border-border px-3 py-1.5 hover:bg-accent/10"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
