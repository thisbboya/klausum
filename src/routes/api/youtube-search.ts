import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { getUserIdFromToken } from "@/lib/server-auth";

type Body = { q?: string; maxResults?: number; accessToken?: string };

export const Route = createFileRoute("/api/youtube-search")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const { q, maxResults = 12, accessToken } = (await request.json()) as Body;
        if (!accessToken) return new Response("Unauthorized", { status: 401 });
        try {
          await getUserIdFromToken(accessToken);
        } catch {
          return new Response("Unauthorized", { status: 401 });
        }
        if (!q || typeof q !== "string" || q.length > 200) {
          return new Response("Invalid query", { status: 400 });
        }
        const key = process.env.YOUTUBE_API_KEY;
        if (!key) return new Response("Missing YOUTUBE_API_KEY", { status: 500 });

        const url = new URL("https://www.googleapis.com/youtube/v3/search");
        url.searchParams.set("part", "snippet");
        url.searchParams.set("type", "video");
        url.searchParams.set("safeSearch", "strict");
        url.searchParams.set("videoEmbeddable", "true");
        url.searchParams.set("relevanceLanguage", "en");
        url.searchParams.set("maxResults", String(Math.min(Math.max(maxResults, 1), 25)));
        url.searchParams.set("q", `${q} tutorial educational`);
        url.searchParams.set("key", key);

        const res = await fetch(url.toString());
        if (!res.ok) {
          const text = await res.text();
          return new Response(`YouTube API error [${res.status}]: ${text}`, { status: 502 });
        }
        const data = (await res.json()) as {
          items?: Array<{
            id: { videoId: string };
            snippet: {
              title: string;
              description: string;
              channelTitle: string;
              publishedAt: string;
              thumbnails: { medium?: { url: string }; high?: { url: string } };
            };
          }>;
        };
        const videos =
          data.items?.map((it) => ({
            id: it.id.videoId,
            title: it.snippet.title,
            description: it.snippet.description,
            channel: it.snippet.channelTitle,
            publishedAt: it.snippet.publishedAt,
            thumbnail: it.snippet.thumbnails.high?.url ?? it.snippet.thumbnails.medium?.url,
          })) ?? [];
        return Response.json({ videos });
      },
    },
  },
});
