// Sharing a duel result.
//
// Chou's "bragging rights": an achievement nobody can see is worth much less
// than one you can show someone. The result is shared as TEXT rather than a
// link, so it survives WhatsApp, works for a friend who has never heard of
// Klausum, and needs no image to be generated or hosted.
//
// Deliberately says the score and nothing else — no invite copy, no referral
// tail. A brag that reads like an advert stops being a brag.
import { Copy, Share2 } from "lucide-react";
import { toast } from "@/lib/notify";

export function ShareResult({ score, total }: { score: number; total: number }) {
  const pct = Math.round((score / total) * 100);
  const text =
    pct === 100
      ? `Perfect duel on Klausum — ${score}/${total}. Come get beaten: ${window.location.origin}`
      : `Just scored ${score}/${total} (${pct}%) in a Klausum duel. Think you can beat that? ${window.location.origin}`;

  async function share() {
    // The native sheet is the right thing on a phone, where nearly all of this
    // happens; the clipboard is the fallback everywhere else.
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        /* the user dismissed the sheet — fall through to copying */
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Result copied — paste it to your friends");
    } catch {
      toast.error("Couldn't copy — select the text and copy manually");
    }
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        onClick={() => void share()}
        className="btn-3d inline-flex items-center justify-center gap-1.5 rounded-xl bg-sky px-3 py-2.5 text-sm font-extrabold uppercase tracking-wide text-sky-foreground"
      >
        <Share2 className="h-4 w-4" /> Share
      </button>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(text)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-border px-3 py-2.5 text-sm font-extrabold transition hover:border-success hover:text-success"
      >
        <Copy className="h-4 w-4" /> WhatsApp
      </a>
    </div>
  );
}
