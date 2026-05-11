import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Youtube } from "lucide-react";

export const Route = createFileRoute("/_authenticated/videos")({ component: VideosPage });

const CHANNELS = [
  { name: "Khan Academy", q: "khan+academy" },
  { name: "Crash Course", q: "crash+course" },
  { name: "3Blue1Brown", q: "3blue1brown" },
  { name: "Organic Chemistry Tutor", q: "organic+chemistry+tutor" },
  { name: "Veritasium", q: "veritasium" },
  { name: "TED-Ed", q: "ted+ed" },
];

function VideosPage() {
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState("");

  function search(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(q.trim());
  }

  const embedUrl = submitted
    ? `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(submitted + " tutorial")}`
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Video learning</h1>
        <p className="text-sm text-muted-foreground mt-1">Search educational videos curated for visual learners.</p>
      </div>

      <form onSubmit={search} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search a topic, e.g. 'photosynthesis', 'quadratic equations'…"
            className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2.5 text-sm outline-none focus:border-primary"
          />
        </div>
        <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Search</button>
      </form>

      {embedUrl ? (
        <div className="rounded-xl overflow-hidden border border-border bg-black aspect-video">
          <iframe src={embedUrl} title="YouTube search" className="w-full h-full" allowFullScreen />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Enter a topic above to play a curated playlist.
        </div>
      )}

      <div>
        <h2 className="font-display text-lg font-semibold mb-3">Trusted channels</h2>
        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
          {CHANNELS.map((c) => (
            <a
              key={c.name}
              href={`https://www.youtube.com/results?search_query=${c.q}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm hover:border-primary/40 transition"
            >
              <Youtube className="h-4 w-4 text-red-500" />
              <span>{c.name}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
