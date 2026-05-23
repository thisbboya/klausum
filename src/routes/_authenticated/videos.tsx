import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Compass, Library, PlayCircle } from "lucide-react";
import { DiscoverTab, LibraryTab, WatchStudy, type Video } from "@/components/video/WatchStudy";
import { getAccessToken } from "@/lib/auth-helper";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/videos")({ component: VideosPage });

type Tab = "discover" | "library" | "watch";

function VideosPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("discover");
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
