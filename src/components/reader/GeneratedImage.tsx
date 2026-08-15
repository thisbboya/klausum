// Renders an ```image fenced block as a generated picture.
//
// Gemini writes text. Asked for "a real picture of an apple" it can only
// apologise, which is what a student saw. Pollinations turns a prompt into an
// image through a plain URL — no API key, no quota, no request from us at all,
// because the browser simply loads an <img>. That is the entire integration,
// and it is why this costs nothing to run.
//
// Deliberately NOT used for anything that has to be correct. A diffusion model
// will happily draw benzene with five bonds or an axis with invented numbers.
// Diagrams stay with mermaid, graphs with the plotter, and simulations with the
// scene engine; this is for the things where a picture is atmosphere rather
// than information — what an apple looks like, what a Viking village felt like.
import { useState } from "react";
import { ImageOff, Loader2 } from "lucide-react";

const MAX_PROMPT = 300;

export function GeneratedImage({ code }: { code: string }) {
  const prompt = code.trim().replace(/\s+/g, " ").slice(0, MAX_PROMPT);
  const [state, setState] = useState<"loading" | "ok" | "failed">("loading");

  if (!prompt) return null;

  // A fixed seed per prompt so the picture does not change on every re-render
  // of the conversation — a student scrolling up should find the same apple.
  let seed = 0;
  for (let i = 0; i < prompt.length; i++) seed = (seed * 31 + prompt.charCodeAt(i)) % 100000;

  // turbo, and 512 wide rather than 768: measured at roughly 0.9s against 1.3s,
  // for a picture that is decorative anyway and is displayed at well under its
  // natural size in a chat bubble.
  const src =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
    `?width=512&height=384&seed=${seed}&nologo=true&model=turbo`;

  // If the service is down the answer's text still stands on its own, so the
  // block removes itself rather than showing the student a broken frame.
  if (state === "failed") return null;

  return (
    <figure className="not-prose my-3 overflow-hidden rounded-xl border-2 border-border bg-card">
      {/* The image is ALWAYS laid out; only its opacity changes.
          It previously carried loading="lazy" while being hidden with
          `display:none` until it loaded — and a display:none image is never in
          the viewport, so the browser never started the download, onLoad never
          fired, and "Painting it…" span forever. The picture itself takes
          about a second. */}
      <div className="relative min-h-[12rem] bg-surface-2">
        {state === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-xs font-extrabold text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Painting it…
          </div>
        )}
        <img
          src={src}
          alt={prompt}
          onLoad={() => setState("ok")}
          onError={() => setState("failed")}
          className={`w-full transition-opacity duration-300 ${
            state === "ok" ? "opacity-100" : "opacity-0"
          }`}
        />
      </div>
      <figcaption className="flex items-center gap-1.5 border-t-2 border-border px-3 py-2 text-[11px] font-semibold text-muted-foreground">
        <ImageOff className="h-3 w-3 shrink-0" />
        AI illustration — for a feel of it, not for facts. Check diagrams and
        numbers against your notes.
      </figcaption>
    </figure>
  );
}
