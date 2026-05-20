import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Youtube, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/videos")({ component: VideosPage });

const CHANNELS = [
  { name: "Khan Academy", q: "khan+academy" },
  { name: "Crash Course", q: "crash+course" },
  { name: "3Blue1Brown", q: "3blue1brown" },
  { name: "Organic Chemistry Tutor", q: "organic+chemistry+tutor" },
  { name: "Veritasium", q: "veritasium" },
  { name: "TED-Ed", q: "ted+ed" },
];

type Video = {
  id: string;
  title: string;
  description: string;
  channel: string;
  publishedAt: string;
  thumbnail?: string;
};

function VideosPage() {
  const [q, setQ] = useState("");
  const [videos, setVideos] = useState<Video[]>([]);
  const [active, setActive] = useState<Video | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    if (!query) return;
    setLoading(true);
    setErr(null);
    setActive(null);
    try {
      const res = await fetch("/api/youtube-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: query, maxResults: 12 }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { videos: Video[] };
      setVideos(data.videos);
      setActive(data.videos[0] ?? null);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Search failed");
      setVideos([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Video learning</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Search educational videos curated for visual learners.
        </p>
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
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
        </button>
      </form>

      {err && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {err}
        </div>
      )}

      {active ? (
        <div className="rounded-xl overflow-hidden border border-border bg-black aspect-video">
          <iframe
            src={`https://www.youtube.com/embed/${active.id}?autoplay=0`}
            title={active.title}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : !loading && videos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Enter a topic above to find videos.
        </div>
      ) : null}

      {videos.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((v) => (
            <button
              key={v.id}
              onClick={() => setActive(v)}
              className={`text-left rounded-lg border bg-card overflow-hidden transition hover:border-primary/40 ${
                active?.id === v.id ? "border-primary" : "border-border"
              }`}
            >
              {v.thumbnail && (
                <img src={v.thumbnail} alt={v.title} className="w-full aspect-video object-cover" />
              )}
              <div className="p-3 space-y-1">
                <p className="text-sm font-semibold line-clamp-2">{v.title}</p>
                <p className="text-xs text-muted-foreground">{v.channel}</p>
              </div>
            </button>
          ))}
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
