import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { getUserIdFromToken } from "@/lib/server-auth";
import { createClient } from "@supabase/supabase-js";

type Body = { q?: string; maxResults?: number; accessToken?: string };

/** Every YouTube Data API key: env YOUTUBE_API_KEY[_2..5] + admin-pasted
 *  api_providers rows (provider='youtube'), de-duped. */
async function collectYoutubeKeys(): Promise<string[]> {
  const keys: string[] = [];
  const push = (k?: string | null) => {
    const v = (k ?? "").trim();
    if (v && !keys.includes(v)) keys.push(v);
  };
  push(process.env.YOUTUBE_API_KEY);
  push(process.env.YOUTUBE_API_KEY_2);
  push(process.env.YOUTUBE_API_KEY_3);
  push(process.env.YOUTUBE_API_KEY_4);
  push(process.env.YOUTUBE_API_KEY_5);
  const url = process.env.SUPABASE_URL;
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && svc) {
    try {
      const supa = createClient(url, svc, { auth: { persistSession: false } });
      const { data } = await supa
        .from("api_providers")
        .select("api_key, enabled, provider")
        .eq("provider", "youtube")
        .eq("enabled", true);
      for (const row of data ?? []) push((row as any).api_key);
    } catch { /* env keys still apply */ }
  }
  return keys;
}

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
        // Rotate across every configured YouTube key so one exhausted quota
        // doesn't kill search: env YOUTUBE_API_KEY[_2..5] + admin api_providers.
        const keys = await collectYoutubeKeys();
        if (keys.length === 0) return new Response("Missing YOUTUBE_API_KEY", { status: 500 });

        const buildUrl = (key: string) => {
          const url = new URL("https://www.googleapis.com/youtube/v3/search");
          url.searchParams.set("part", "snippet");
          url.searchParams.set("type", "video");
          url.searchParams.set("safeSearch", "strict");
          url.searchParams.set("videoEmbeddable", "true");
          url.searchParams.set("relevanceLanguage", "en");
          url.searchParams.set("maxResults", String(Math.min(Math.max(maxResults, 1), 25)));
          url.searchParams.set("q", `${q} tutorial educational`);
          url.searchParams.set("key", key);
          return url.toString();
        };

        let res: Response | null = null;
        for (const key of keys) {
          res = await fetch(buildUrl(key));
          if (res.ok) break;
          const status = res.status;
          const text = await res.text();
          console.error(`[youtube-search] key failed ${status}: ${text.slice(0, 200)}`);
          // 403/429 = quota/forbidden → try the next key; other errors → stop
          if (status !== 403 && status !== 429) break;
        }
        if (!res || !res.ok) {
          return new Response("Service temporarily unavailable", { status: 502 });
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
