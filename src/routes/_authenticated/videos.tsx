import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Compass, Library, PlayCircle } from "lucide-react";
import { DiscoverTab, LibraryTab, WatchStudy, type Video } from "@/components/video/WatchStudy";
import { getAccessToken } from "@/lib/auth-helper";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/videos")({
  // ?v=<youtubeId>&t=<seconds> lets the dashboard's "Continue watching" card
  // deep-link straight back into Watch & study.
  validateSearch: (s: Record<string, unknown>): { v?: string; t?: number } => ({
    v: typeof s.v === "string" && /^[a-zA-Z0-9_-]{6,20}$/.test(s.v) ? s.v : undefined,
    t: Number.isFinite(Number(s.t)) && Number(s.t) > 0 ? Math.floor(Number(s.t)) : undefined,
  }),
  component: VideosPage,
});

type Tab = "discover" | "library" | "watch";

function VideosPage() {
  const { user } = useAuth();
  const { v: deepLinkId } = Route.useSearch();
  const [tab, setTab] = useState<Tab>(deepLinkId ? "watch" : "discover");
  const [active, setActive] = useState<Video | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [primaryStyle, setPrimaryStyle] = useState<string>("Reading");

  useEffect(() => {
    getAccessToken().then((t) => setToken(t)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_profiles")
      .select("primary_style")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.primary_style) setPrimaryStyle(data.primary_style);
      });
  }, [user]);

  // Resume a deep-linked video (?v=…), pulling its saved title/thumbnail when
  // we have them so the header isn't blank.
  useEffect(() => {
    if (!deepLinkId || !user || active?.id === deepLinkId) return;
    let alive = true;
    (supabase as any)
      .from("saved_videos")
      .select("title,channel,thumbnail_url")
      .eq("user_id", user.id)
      .eq("youtube_video_id", deepLinkId)
      .maybeSingle()
      .then(({ data }: { data: any }) => {
        if (!alive) return;
        setActive({
          id: deepLinkId,
          title: data?.title ?? "Your video",
          channel: data?.channel ?? "",
          thumbnail: data?.thumbnail_url ?? `https://i.ytimg.com/vi/${deepLinkId}/hqdefault.jpg`,
        });
        setTab("watch");
      });
    return () => { alive = false; };
  }, [deepLinkId, user, active?.id]);

  function pick(v: Video) {
    setActive(v);
    setTab("watch");
  }

  const tabs: { k: Tab; label: string; Icon: typeof Compass; disabled?: boolean }[] = [
    { k: "discover", label: "Discover", Icon: Compass },
    { k: "library", label: "My library", Icon: Library },
    { k: "watch", label: "Watch & study", Icon: PlayCircle, disabled: !active },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-bold">Video learning</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Watch any educational video — Klausum studies along with you.
        </p>
      </div>

      <div className="flex gap-1.5 p-1 rounded-lg bg-card border border-border w-fit">
        {tabs.map(({ k, label, Icon, disabled }) => (
          <button
            key={k}
            onClick={() => !disabled && setTab(k)}
            disabled={disabled}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
              tab === k
                ? "bg-primary text-primary-foreground"
                : disabled
                ? "opacity-40 cursor-not-allowed"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Picking up where you stopped is the single most common thing anyone
          wants from a video page, and until now it only existed on the
          dashboard — so arriving here directly meant hunting for the video
          again and scrubbing back to where you were. */}
      {tab !== "watch" && <ContinueWatching onResume={pick} />}

      {tab === "discover" && <DiscoverTab onPick={pick} />}
      {tab === "library" && <LibraryTab onPick={pick} />}
      {tab === "watch" && active && token && (
        <WatchStudy
          video={active}
          primaryStyle={primaryStyle}
          accessToken={token}
          onBack={() => setTab("discover")}
        />
      )}
    </div>
  );
}

/**
 * The most recently watched, not-yet-finished video. Renders nothing at all
 * when there is no such video — an empty "Continue watching" shelf is worse
 * than no shelf, because it reads as something broken rather than something
 * you haven't started.
 */
function ContinueWatching({ onResume }: { onResume: (v: Video) => void }) {
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ["continue-video", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: p } = await (supabase as any)
        .from("video_watch_progress")
        .select("youtube_video_id,watch_seconds,total_seconds,percent_watched")
        .eq("user_id", user!.id)
        // 95% and over is finished; offering to resume it would be noise.
        .lt("percent_watched", 95)
        .order("last_watched_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!p?.youtube_video_id) return null;
      // saved_videos is a separate opt-in table, so the title may be missing.
      // YouTube always has a thumbnail at a predictable URL, which is enough
      // to make the card recognisable even when the metadata isn't there.
      const { data: sv } = await (supabase as any)
        .from("saved_videos")
        .select("title,channel,thumbnail_url")
        .eq("user_id", user!.id)
        .eq("youtube_video_id", p.youtube_video_id)
        .maybeSingle();
      return {
        video: {
          id: p.youtube_video_id as string,
          title: (sv?.title as string) ?? "Your last video",
          channel: (sv?.channel as string) ?? "",
          thumbnail:
            (sv?.thumbnail_url as string) ??
            `https://i.ytimg.com/vi/${p.youtube_video_id}/hqdefault.jpg`,
        } satisfies Video,
        percent: Math.min(100, Math.max(0, Math.round(Number(p.percent_watched) || 0))),
        left: Math.max(
          0,
          Math.floor((Number(p.total_seconds) || 0) - (Number(p.watch_seconds) || 0)),
        ),
      };
    },
  });

  if (!data) return null;
  const mins = Math.round(data.left / 60);

  return (
    <button
      onClick={() => onResume(data.video)}
      className="flex w-full items-center gap-3 rounded-2xl border-2 border-border bg-card p-3 text-left transition hover:border-primary"
    >
      <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-xl bg-surface-2">
        <img src={data.video.thumbnail} alt="" className="h-full w-full object-cover" />
        <span className="absolute inset-0 flex items-center justify-center bg-black/35 text-white">
          <PlayCircle className="h-6 w-6" />
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-extrabold uppercase tracking-wide text-primary">
          Continue watching
        </div>
        <div className="truncate text-sm font-extrabold">{data.video.title}</div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-primary" style={{ width: `${data.percent}%` }} />
        </div>
        <div className="mt-1 text-[11px] font-bold text-muted-foreground">
          {data.percent}% watched{mins > 0 ? ` · about ${mins} min left` : ""}
        </div>
      </div>
    </button>
  );
}
