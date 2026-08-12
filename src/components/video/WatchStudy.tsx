import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import {
  Play, MessagesSquare, NotebookPen, ListChecks, Send, Square, Search,
  Bookmark, BookmarkCheck, Loader2, Sparkles, ArrowLeft, Trash2, Clock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { reportError } from "@/lib/report-error";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/lib/notify";

// Types
export type Video = {
  id: string;
  title: string;
  channel: string;
  description?: string;
  publishedAt?: string;
  thumbnail?: string;
};

/** Turn a failed Response into a short human message. Never dumps raw HTML
 *  error pages into the UI (which is what produced the wall-of-markup bug). */
/** Reads a failed response, logs the real detail for admins, and returns a
 *  calm user-facing sentence. Raw provider/server text is never surfaced. */
async function readError(res: Response, context = "video"): Promise<string> {
  let body = "";
  try {
    body = await res.text();
  } catch {}
  return reportError(context, body || `HTTP ${res.status}`, res.status);
}
type Chapter = { title: string; startSeconds: number; summary: string };
type TranscriptLine = { start: number; text: string };
type Question = {
  question: string;
  options: { A: string; B: string; C: string; D: string };
  correct: "A" | "B" | "C" | "D";
  explanation: string;
  timestamp_seconds: number;
  bloom_level: number;
};

function fmt(seconds: number) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

// Global YT loader (singleton)
let ytReadyPromise: Promise<void> | null = null;
function loadYouTubeAPI(): Promise<void> {
  if (ytReadyPromise) return ytReadyPromise;
  ytReadyPromise = new Promise<void>((resolve) => {
    if (typeof window === "undefined") return resolve();
    const w = window as unknown as { YT?: { Player: unknown }; onYouTubeIframeAPIReady?: () => void };
    if (w.YT && w.YT.Player) return resolve();
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
    w.onYouTubeIframeAPIReady = () => resolve();
  });
  return ytReadyPromise;
}

// ─── WATCH & STUDY ────────────────────────────────────────────────────────────
export function WatchStudy({
  video,
  primaryStyle,
  accessToken,
  onBack,
}: {
  video: Video;
  primaryStyle: string;
  accessToken: string;
  onBack: () => void;
}) {
  const { user } = useAuth();
  const playerRef = useRef<{
    seekTo: (s: number, allow: boolean) => void;
    playVideo: () => void;
    pauseVideo: () => void;
    getCurrentTime: () => number;
    getDuration: () => number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [analyzing, setAnalyzing] = useState(true);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [tab, setTab] = useState<"chat" | "notes" | "quiz">("chat");
  const [mobileTab, setMobileTab] = useState<"video" | "ai">("video");
  const [showTranscript, setShowTranscript] = useState(false);
  const [transcriptSearch, setTranscriptSearch] = useState("");
  const [saved, setSaved] = useState(false);

  // Init YT player
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;
    (async () => {
      await loadYouTubeAPI();
      if (cancelled || !containerRef.current) return;
      const w = window as unknown as {
        YT: { Player: new (el: HTMLElement, opts: unknown) => typeof playerRef.current };
      };
      const player = new w.YT.Player(containerRef.current, {
        videoId: video.id,
        playerVars: { rel: 0, modestbranding: 1, cc_load_policy: 1, playsinline: 1 },
        events: {
          onReady: () => {
            playerRef.current = player as unknown as typeof playerRef.current;
            const d = playerRef.current?.getDuration() ?? 0;
            setDuration(d);
          },
        },
      });
      timer = setInterval(() => {
        try {
          const t = playerRef.current?.getCurrentTime() ?? 0;
          const d = playerRef.current?.getDuration() ?? 0;
          // Set unconditionally rather than guarding on `duration`: this
          // closure captured `duration` from the render that started the
          // player and the effect only re-runs when the video changes, so the
          // guard was reading a value frozen at 0 forever. React drops a set
          // to an identical number, so this costs nothing after the first.
          if (d) setDuration(d);
          setCurrentTime(t);
        } catch {
          // ignore
        }
      }, 1000);
    })();
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.id]);

  // Resume + save progress
  useEffect(() => {
    if (!user) return;
    supabase
      .from("video_watch_progress")
      .select("watch_seconds")
      .eq("user_id", user.id)
      .eq("youtube_video_id", video.id)
      .maybeSingle()
      .then(({ data }) => {
        const s = Number(data?.watch_seconds ?? 0);
        if (s > 5 && playerRef.current) {
          playerRef.current.seekTo(s, true);
        } else if (s > 5) {
          // store and seek when player ready
          const wait = setInterval(() => {
            if (playerRef.current) {
              playerRef.current.seekTo(s, true);
              clearInterval(wait);
            }
          }, 300);
          setTimeout(() => clearInterval(wait), 5000);
        }
      });
  }, [user, video.id]);

  // Persist progress every 5s
  useEffect(() => {
    if (!user) return;
    const id = setInterval(() => {
      if (!playerRef.current || duration <= 0) return;
      const t = playerRef.current.getCurrentTime();
      // The result used to be discarded with `void`, so a failing write left no
      // trace anywhere — which is exactly the state this table was found in:
      // people were plainly watching videos (chapters and chat rows exist) and
      // yet not one progress row had ever been recorded. A silent write is a
      // feature that can never be debugged, so failures are reported now.
      void supabase
        .from("video_watch_progress")
        .upsert(
          {
            user_id: user.id,
            youtube_video_id: video.id,
            watch_seconds: Math.floor(t),
            total_seconds: Math.floor(duration),
            percent_watched: Math.min(100, Math.round((t / duration) * 100)),
            last_watched_at: new Date().toISOString(),
          },
          { onConflict: "user_id,youtube_video_id" },
        )
        .then(({ error }) => {
          if (error) reportError("video-progress", error);
        });
    }, 5000);
    return () => clearInterval(id);
  }, [user, video.id, duration]);

  // Saved status
  useEffect(() => {
    if (!user) return;
    supabase
      .from("saved_videos")
      .select("id")
      .eq("user_id", user.id)
      .eq("youtube_video_id", video.id)
      .maybeSingle()
      .then(({ data }) => setSaved(!!data));
  }, [user, video.id]);

  // Analyze video
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setAnalyzing(true);
      setAnalyzeError(null);
      try {
        const res = await fetch("/api/video-analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accessToken,
            videoId: video.id,
            title: video.title,
            channel: video.channel,
          }),
        });
        if (!res.ok) throw new Error(await readError(res));
        const data = (await res.json()) as {
          chapters: Chapter[];
          transcript: TranscriptLine[];
          durationSeconds: number;
        };
        if (cancelled) return;
        setChapters(data.chapters ?? []);
        setTranscript(data.transcript ?? []);
        if (!duration && data.durationSeconds) setDuration(data.durationSeconds);
      } catch (e) {
        if (!cancelled) setAnalyzeError(e instanceof Error ? e.message : "Analysis failed");
      } finally {
        if (!cancelled) setAnalyzing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [video.id, accessToken, video.title, video.channel]);

  const currentChapterIdx = useMemo(() => {
    let idx = 0;
    for (let i = 0; i < chapters.length; i++) {
      if (chapters[i].startSeconds <= currentTime) idx = i;
      else break;
    }
    return idx;
  }, [chapters, currentTime]);

  const seekTo = useCallback((s: number) => {
    if (!playerRef.current) return;
    playerRef.current.seekTo(Math.max(0, s), true);
    playerRef.current.playVideo();
  }, []);

  async function toggleSave() {
    if (!user) return;
    if (saved) {
      await supabase
        .from("saved_videos")
        .delete()
        .eq("user_id", user.id)
        .eq("youtube_video_id", video.id);
      setSaved(false);
      toast("Removed from library");
    } else {
      await supabase.from("saved_videos").insert({
        user_id: user.id,
        youtube_video_id: video.id,
        title: video.title,
        channel: video.channel,
        thumbnail_url: video.thumbnail,
      });
      setSaved(true);
      toast.success("Saved to library");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="h-4 w-4" /> Back to discover
        </button>
        <button
          onClick={toggleSave}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
            saved
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border bg-card hover:border-primary/40"
          }`}
        >
          {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
          {saved ? "Saved" : "Save to library"}
        </button>
      </div>

      {/* Mobile tabs */}
      <div className="lg:hidden flex gap-2">
        <button
          onClick={() => setMobileTab("video")}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
            mobileTab === "video"
              ? "bg-primary text-primary-foreground"
              : "bg-card border-2 border-border"
          }`}
        >
          <Play className="h-4 w-4 inline mr-1" /> Video
        </button>
        <button
          onClick={() => setMobileTab("ai")}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
            mobileTab === "ai"
              ? "bg-primary text-primary-foreground"
              : "bg-card border-2 border-border"
          }`}
        >
          <Sparkles className="h-4 w-4 inline mr-1" /> AI study
        </button>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.85fr)_minmax(340px,1fr)]">
        {/* LEFT: Video + chapters + transcript */}
        <div className={`min-w-0 space-y-3 ${mobileTab === "ai" ? "hidden lg:block" : ""}`}>
          <div className="overflow-hidden rounded-2xl border-2 border-border bg-black shadow-lg aspect-video">
            <div ref={containerRef} className="w-full h-full" />
          </div>
          {/* Title + channel + progress meta */}
          <div className="card-chunky bg-card p-4">
            <h2 className="font-display text-xl font-extrabold leading-snug">{video.title}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold text-muted-foreground">
              {video.channel && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-3 px-2.5 py-1">
                  <Play className="h-3 w-3" /> {video.channel}
                </span>
              )}
              {duration > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-3 px-2.5 py-1">
                  <Clock className="h-3 w-3" /> {fmt(currentTime)} / {fmt(duration)}
                </span>
              )}
              {duration > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/12 px-2.5 py-1 text-primary">
                  {Math.min(100, Math.round((currentTime / duration) * 100))}% watched
                </span>
              )}
            </div>
            {duration > 0 && (
              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-500"
                  style={{ width: `${Math.min(100, (currentTime / duration) * 100)}%` }}
                />
              </div>
            )}
          </div>

          {/* Chapter row */}
          <div className="card-chunky bg-card p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Chapters {analyzing && <Loader2 className="inline h-3 w-3 animate-spin ml-1" />}
            </p>
            {analyzing ? (
              <p className="text-xs text-muted-foreground">Analyzing video with AI…</p>
            ) : chapters.length === 0 ? (
              <p className="text-xs text-muted-foreground">No chapters available.</p>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {chapters.map((c, i) => (
                  <button
                    key={i}
                    ref={(el) => {
                      if (el && i === currentChapterIdx) {
                        el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
                      }
                    }}
                    onClick={() => seekTo(c.startSeconds)}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs whitespace-nowrap transition ${
                      i === currentChapterIdx
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "bg-muted text-muted-foreground hover:bg-muted/70"
                    }`}
                  >
                    {(i + 1).toString().padStart(2, "0")} {c.title} · {fmt(c.startSeconds)}
                  </button>
                ))}
              </div>
            )}
            {analyzeError && !analyzing && (
              <div className="mt-2 flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/10 p-2">
                <span className="text-primary text-xs shrink-0">⚠️</span>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  This video is long — automatic chapter detection was limited.
                  The AI chat and quiz still work. Ask the AI anything about what you're watching.
                </p>
              </div>
            )}
          </div>

          {/* Transcript */}
          {transcript.length > 0 && (
            <div className="card-chunky bg-card">
              <button
                onClick={() => setShowTranscript((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm font-semibold"
              >
                <span>Transcript ({transcript.length} lines)</span>
                <span className="text-xs text-muted-foreground">
                  {showTranscript ? "Hide" : "Show"}
                </span>
              </button>
              {showTranscript && (
                <div className="border-t border-border">
                  <div className="px-3 py-2 border-b border-border">
                    <input
                      value={transcriptSearch}
                      onChange={(e) => setTranscriptSearch(e.target.value)}
                      placeholder="Search transcript…"
                      className="w-full rounded-xl border-2 border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
                    />
                  </div>
                  <div className="max-h-64 overflow-y-auto text-xs">
                    {transcript
                      .filter((l) =>
                        transcriptSearch
                          ? l.text.toLowerCase().includes(transcriptSearch.toLowerCase())
                          : true,
                      )
                      .map((l, i) => {
                        const isActive =
                          l.start <= currentTime && currentTime - l.start < 8;
                        return (
                          <button
                            key={i}
                            onClick={() => seekTo(l.start)}
                            className={`w-full text-left px-3 py-1.5 border-l-2 transition ${
                              isActive
                                ? "border-primary bg-primary/5 text-foreground"
                                : "border-transparent text-muted-foreground hover:bg-muted/40"
                            }`}
                          >
                            <span className="text-primary font-mono mr-2">{fmt(l.start)}</span>
                            {l.text}
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT: AI panel */}
        <div className={`${mobileTab === "video" ? "hidden lg:block" : ""}`}>
          <div className="card-chunky bg-card overflow-hidden flex flex-col h-[calc(100dvh-140px)] min-h-[520px] sticky top-4">
            <div className="flex border-b border-border">
              {(
                [
                  { k: "chat", label: "Chat", Icon: MessagesSquare },
                  { k: "notes", label: "Notes", Icon: NotebookPen },
                  { k: "quiz", label: "Quiz", Icon: ListChecks },
                ] as const
              ).map(({ k, label, Icon }) => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  className={`flex-1 px-3 py-2.5 text-sm font-medium transition border-b-2 ${
                    tab === k
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4 inline mr-1" />
                  {label}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-hidden">
              {tab === "chat" && (
                <VideoChat
                  videoId={video.id}
                  videoTitle={video.title}
                  channel={video.channel}
                  currentTime={currentTime}
                  duration={duration}
                  primaryStyle={primaryStyle}
                  accessToken={accessToken}
                  seekTo={seekTo}
                  analyzing={analyzing}
                />
              )}
              {tab === "notes" && (
                <VideoNotes
                  videoId={video.id}
                  currentTime={currentTime}
                  currentChapter={chapters[currentChapterIdx]?.title ?? null}
                  seekTo={seekTo}
                  videoTitle={video.title}
                />
              )}
              {tab === "quiz" && (
                <VideoQuiz
                  videoId={video.id}
                  videoTitle={video.title}
                  accessToken={accessToken}
                  seekTo={seekTo}
                  analyzeReady={!analyzing}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CHAT TAB ─────────────────────────────────────────────────────────────────
function VideoChat({
  videoId, videoTitle, channel, currentTime, duration, primaryStyle, accessToken, seekTo, analyzing,
}: {
  videoId: string;
  videoTitle: string;
  channel: string;
  currentTime: number;
  duration: number;
  primaryStyle: string;
  accessToken: string;
  seekTo: (s: number) => void;
  analyzing: boolean;
}) {
  const [input, setInput] = useState("");
  const ctRef = useRef(currentTime);
  ctRef.current = currentTime;
  const durRef = useRef(duration);
  durRef.current = duration;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/video-chat",
        body: () => ({
          accessToken,
          videoId,
          videoTitle,
          channel,
          primaryStyle,
          currentTime: ctRef.current,
          duration: durRef.current,
        }),
      }),
    [accessToken, videoId, videoTitle, channel, primaryStyle],
  );

  const { messages, sendMessage, status, stop } = useChat({
    transport,
    onError: (e) => toast.error(e.message || "Chat failed"),
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const isLoading = status === "submitted" || status === "streaming";

  const quick = [
    "Explain what they just said in simpler terms",
    "What are the key concepts in this video?",
    "What's likely to be on an exam from this?",
    "Give me a real-world example",
  ];

  function ask(text: string) {
    if (!text.trim() || analyzing) return;
    sendMessage({ text });
    setInput("");
  }

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {analyzing && (
          <div className="text-center py-6 text-xs text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
            Analyzing video with AI… chat will be ready soon.
          </div>
        )}
        {!analyzing && messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground px-1">
              I'm watching with you. Ask me anything about this video.
            </p>
            <div className="grid gap-1.5">
              {quick.map((q) => (
                <button
                  key={q}
                  onClick={() => ask(q)}
                  className="text-left text-xs rounded-xl border-2 border-border bg-muted/30 px-2.5 py-2 hover:border-primary/40 hover:bg-muted/50 transition"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => {
          const content = m.parts
            .filter((p) => p.type === "text")
            .map((p) => ("text" in p ? p.text : ""))
            .join("\n");
          // Find [MM:SS] timestamps in AI responses
          const timestamps =
            m.role === "assistant"
              ? Array.from(content.matchAll(/\[(\d{1,2}):(\d{2})\]/g)).map(([, mm, ss]) => ({
                  label: `${mm}:${ss}`,
                  seconds: parseInt(mm, 10) * 60 + parseInt(ss, 10),
                }))
              : [];
          const unique = Array.from(new Map(timestamps.map((t) => [t.seconds, t])).values());
          return (
            <div
              key={m.id}
              className={`rounded-lg px-3 py-2 text-sm ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground ml-6"
                  : "bg-muted/40 mr-6"
              }`}
            >
              <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-1.5 [&_ul]:my-1.5">
                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {content}
                </ReactMarkdown>
              </div>
              {unique.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {unique.map((t) => (
                    <button
                      key={t.seconds}
                      onClick={() => seekTo(t.seconds)}
                      className="text-[10px] rounded-full bg-primary/15 text-primary px-2 py-0.5 hover:bg-primary/25 transition"
                    >
                      <Clock className="h-2.5 w-2.5 inline mr-0.5" /> Jump to {t.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="text-xs text-muted-foreground italic">Thinking…</div>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="border-t border-border p-2 flex gap-1.5"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={analyzing}
          placeholder={analyzing ? "Analyzing…" : `Ask about ${fmt(currentTime)}…`}
          className="flex-1 rounded-xl border-2 border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary disabled:opacity-50"
        />
        {isLoading ? (
          <button
            type="button"
            onClick={() => stop()}
            className="rounded-xl bg-destructive px-2.5 text-destructive-foreground"
          >
            <Square className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim() || analyzing}
            className="btn-3d rounded-xl bg-primary px-2.5 text-primary-foreground disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        )}
      </form>
    </div>
  );
}

// ─── NOTES TAB ────────────────────────────────────────────────────────────────
type VideoNote = {
  id: string;
  timestamp_seconds: number;
  note_text: string;
  chapter_title: string | null;
};

function VideoNotes({
  videoId, currentTime, currentChapter, seekTo, videoTitle,
}: {
  videoId: string;
  currentTime: number;
  currentChapter: string | null;
  seekTo: (s: number) => void;
  videoTitle: string;
}) {
  const { user } = useAuth();
  const [notes, setNotes] = useState<VideoNote[]>([]);
  const [text, setText] = useState("");

  const reload = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("video_notes")
      .select("id, timestamp_seconds, note_text, chapter_title")
      .eq("user_id", user.id)
      .eq("youtube_video_id", videoId)
      .order("timestamp_seconds", { ascending: true });
    setNotes(
      (data ?? []).map((n) => ({
        id: n.id,
        timestamp_seconds: Number(n.timestamp_seconds),
        note_text: n.note_text,
        chapter_title: n.chapter_title,
      })),
    );
  }, [user, videoId]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function addNote() {
    if (!user || !text.trim()) return;
    await supabase.from("video_notes").insert({
      user_id: user.id,
      youtube_video_id: videoId,
      timestamp_seconds: Math.floor(currentTime),
      note_text: text.trim().slice(0, 2000),
      chapter_title: currentChapter,
    });
    setText("");
    toast.success(`Note saved at ${fmt(currentTime)}`);
    reload();
  }

  async function removeNote(id: string) {
    await supabase.from("video_notes").delete().eq("id", id);
    reload();
  }

  function exportNotes() {
    const lines = [
      `# Notes — ${videoTitle}`,
      `https://youtu.be/${videoId}`,
      "",
      ...notes.map(
        (n) =>
          `[${fmt(n.timestamp_seconds)}] ${n.chapter_title ? `(${n.chapter_title}) ` : ""}${n.note_text}\nhttps://youtu.be/${videoId}?t=${Math.floor(n.timestamp_seconds)}`,
      ),
    ].join("\n\n");
    const blob = new Blob([lines], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${videoTitle.slice(0, 40)}-notes.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-2 border-b border-border space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            Note at <span className="text-primary font-mono">{fmt(currentTime)}</span>
            {currentChapter && <span className="ml-1">· {currentChapter}</span>}
          </span>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="Type your note for this moment…"
          className="w-full rounded-xl border-2 border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary resize-none"
        />
        <button
          onClick={addNote}
          disabled={!text.trim()}
          className="w-full btn-3d rounded-xl bg-primary py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          Save note at {fmt(currentTime)}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {notes.length === 0 && (
          <p className="text-center text-xs text-muted-foreground py-6">
            No notes yet. Capture key moments as you watch.
          </p>
        )}
        {notes.map((n) => (
          <div
            key={n.id}
            className="rounded-xl border-2 border-border bg-muted/30 p-2 text-xs"
          >
            <div className="flex items-center justify-between mb-1">
              <button
                onClick={() => seekTo(n.timestamp_seconds)}
                className="font-mono text-primary text-[11px] hover:underline"
              >
                <Clock className="h-3 w-3 inline mr-0.5" /> {fmt(n.timestamp_seconds)}
              </button>
              <button
                onClick={() => removeNote(n.id)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
            {n.chapter_title && (
              <p className="text-[10px] text-muted-foreground mb-0.5">{n.chapter_title}</p>
            )}
            <p className="whitespace-pre-wrap">{n.note_text}</p>
          </div>
        ))}
      </div>
      {notes.length > 0 && (
        <div className="p-2 border-t border-border">
          <button
            onClick={exportNotes}
            className="w-full rounded-xl border-2 border-border bg-card py-1.5 text-xs font-medium hover:border-primary/40 transition"
          >
            Export {notes.length} notes
          </button>
        </div>
      )}
    </div>
  );
}

// ─── QUIZ TAB ─────────────────────────────────────────────────────────────────
function VideoQuiz({
  videoId, videoTitle, accessToken, seekTo, analyzeReady,
}: {
  videoId: string;
  videoTitle: string;
  accessToken: string;
  seekTo: (s: number) => void;
  analyzeReady: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, "A" | "B" | "C" | "D">>({});
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [err, setErr] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/video-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken, videoId, videoTitle }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as { questions: Question[] };
      setQuestions(data.questions);
      setAnswers({});
      setRevealed({});
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Quiz failed");
    } finally {
      setLoading(false);
    }
  }

  function answer(i: number, opt: "A" | "B" | "C" | "D") {
    if (revealed[i]) return;
    setAnswers((a) => ({ ...a, [i]: opt }));
    setRevealed((r) => ({ ...r, [i]: true }));
  }

  return (
    <div className="flex flex-col h-full p-3 overflow-y-auto">
      {questions.length === 0 ? (
        <div className="text-center py-6">
          <Sparkles className="h-8 w-8 text-primary mx-auto mb-2" />
          <p className="text-sm mb-3">Generate a quiz from this video</p>
          <button
            onClick={generate}
            disabled={loading || !analyzeReady}
            className="btn-3d rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : !analyzeReady ? (
              "Waiting for analysis…"
            ) : (
              "Generate quiz"
            )}
          </button>
          {err && <p className="text-xs text-destructive mt-2">{err}</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map((q, i) => {
            const picked = answers[i];
            const shown = revealed[i];
            return (
              <div key={i} className="rounded-xl border-2 border-border bg-card p-2.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Q{i + 1} · Bloom L{q.bloom_level}
                  </span>
                  <button
                    onClick={() => seekTo(Math.max(0, q.timestamp_seconds - 5))}
                    className="text-[10px] text-primary hover:underline"
                  >
                    <Clock className="h-3 w-3 inline mr-0.5" />
                    {fmt(q.timestamp_seconds)}
                  </button>
                </div>
                <p className="text-sm font-medium mb-2">{q.question}</p>
                <div className="space-y-1">
                  {(["A", "B", "C", "D"] as const).map((opt) => {
                    const isCorrect = q.correct === opt;
                    const isPicked = picked === opt;
                    const cls = shown
                      ? isCorrect
                        ? "border-success/60 bg-success/10 text-success"
                        : isPicked
                        ? "border-destructive/60 bg-destructive/10 text-destructive"
                        : "border-border opacity-50"
                      : "border-border hover:border-primary/40";
                    return (
                      <button
                        key={opt}
                        onClick={() => answer(i, opt)}
                        disabled={shown}
                        className={`w-full text-left rounded-xl border px-2.5 py-1.5 text-xs transition ${cls}`}
                      >
                        <span className="font-semibold mr-1.5">{opt}.</span>
                        {q.options[opt]}
                      </button>
                    );
                  })}
                </div>
                {shown && (
                  <div className="mt-2 rounded-xl bg-muted/40 p-2 text-xs">
                    <p className="mb-1">{q.explanation}</p>
                    <button
                      onClick={() => seekTo(Math.max(0, q.timestamp_seconds - 10))}
                      className="text-primary hover:underline text-[11px]"
                    >
                      ▶ Watch that section
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          <button
            onClick={generate}
            disabled={loading}
            className="w-full rounded-xl border-2 border-border py-1.5 text-xs hover:border-primary/40 transition"
          >
            {loading ? "Generating…" : "Generate a fresh quiz"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── LIBRARY TAB ──────────────────────────────────────────────────────────────
type SavedVideo = {
  id: string;
  youtube_video_id: string;
  title: string;
  channel: string | null;
  thumbnail_url: string | null;
  subject: string | null;
  percent_watched?: number;
};

export function LibraryTab({ onPick }: { onPick: (v: Video) => void }) {
  const { user } = useAuth();
  const [items, setItems] = useState<SavedVideo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("saved_videos")
        .select("id, youtube_video_id, title, channel, thumbnail_url, subject")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      const saved: SavedVideo[] = (data ?? []).map((s) => ({
        id: s.id,
        youtube_video_id: s.youtube_video_id,
        title: s.title,
        channel: s.channel,
        thumbnail_url: s.thumbnail_url,
        subject: s.subject,
      }));
      // fetch watch progress
      if (saved.length > 0) {
        const { data: prog } = await supabase
          .from("video_watch_progress")
          .select("youtube_video_id, percent_watched")
          .eq("user_id", user.id)
          .in("youtube_video_id", saved.map((s) => s.youtube_video_id));
        const map = new Map((prog ?? []).map((p) => [p.youtube_video_id, Number(p.percent_watched)]));
        saved.forEach((s) => (s.percent_watched = map.get(s.youtube_video_id) ?? 0));
      }
      setItems(saved);
      setLoading(false);
    })();
  }, [user]);

  if (loading) return <div className="py-8 text-center text-sm text-muted-foreground">Loading library…</div>;
  if (items.length === 0)
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Save videos from the Discover tab to build your library.
      </div>
    );

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((s) => (
        <button
          key={s.id}
          onClick={() =>
            onPick({
              id: s.youtube_video_id,
              title: s.title,
              channel: s.channel ?? "",
              thumbnail: s.thumbnail_url ?? undefined,
            })
          }
          className="text-left rounded-xl border-2 border-border bg-card overflow-hidden hover:border-primary/40 transition"
        >
          {s.thumbnail_url && (
            <div className="relative">
              <img src={s.thumbnail_url} alt={s.title} className="w-full aspect-video object-cover" />
              {(s.percent_watched ?? 0) > 0 && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
                  <div className="h-full bg-primary" style={{ width: `${s.percent_watched}%` }} />
                </div>
              )}
            </div>
          )}
          <div className="p-2.5">
            <p className="text-xs font-semibold line-clamp-2">{s.title}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{s.channel}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── DISCOVER (search + channels) ─────────────────────────────────────────────
const CHANNELS = [
  "Khan Academy", "Crash Course", "3Blue1Brown", "Organic Chemistry Tutor",
  "Veritasium", "TED-Ed", "Numberphile", "MIT OpenCourseWare", "Professor Leonard",
];

/** Pull the 11-char video id out of any YouTube URL/ID the user pastes. */
function parseYoutubeId(input: string): string | null {
  const s = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s; // bare id
  const patterns = [
    /(?:youtube\.com\/watch\?[^ ]*[?&]v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/(?:embed|shorts|live)\/)([a-zA-Z0-9_-]{11})/,
    /[?&]v=([a-zA-Z0-9_-]{11})/,
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m) return m[1];
  }
  return null;
}

export function DiscoverTab({ onPick }: { onPick: (v: Video) => void }) {
  const [q, setQ] = useState("");
  const [link, setLink] = useState("");
  const [linkErr, setLinkErr] = useState<string | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function openLink() {
    const id = parseYoutubeId(link);
    if (!id) {
      setLinkErr("That doesn't look like a YouTube link. Paste a full youtube.com or youtu.be URL.");
      return;
    }
    setLinkErr(null);
    setLink("");
    onPick({
      id,
      title: "Pasted video",
      description: "",
      channel: "",
      publishedAt: "",
      thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    });
  }

  async function search(query: string) {
    if (!query.trim()) return;
    setLoading(true);
    setErr(null);
    try {
      const { getAccessToken } = await import("@/lib/auth-helper");
      const accessToken = await getAccessToken();
      const res = await fetch("/api/youtube-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: query, maxResults: 12, accessToken }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as { videos: Video[] };
      setVideos(data.videos);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          search(q);
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search any topic — e.g. 'Newton's laws', 'quadratic equations'…"
            className="w-full rounded-xl border-2 border-border bg-background pl-9 pr-3 py-2.5 text-sm outline-none focus:border-primary"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="btn-3d rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
        </button>
      </form>

      {/* Paste a YouTube link directly */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          openLink();
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Play className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={link}
            onChange={(e) => { setLink(e.target.value); setLinkErr(null); }}
            placeholder="…or paste a YouTube link (youtube.com/watch?v=… or youtu.be/…)"
            className="w-full rounded-xl border-2 border-border bg-background pl-9 pr-3 py-2.5 text-sm outline-none focus:border-primary"
          />
        </div>
        <button
          type="submit"
          disabled={!link.trim()}
          className="btn-3d rounded-xl bg-success px-4 py-2 text-sm font-semibold text-success-foreground disabled:opacity-40"
        >
          Open
        </button>
      </form>

      {linkErr && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {linkErr}
        </div>
      )}

      {err && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {err}
        </div>
      )}

      {videos.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((v) => (
            <div
              key={v.id}
              className="rounded-xl border-2 border-border bg-card overflow-hidden hover:border-primary/40 transition"
            >
              {v.thumbnail && (
                <img src={v.thumbnail} alt={v.title} className="w-full aspect-video object-cover" />
              )}
              <div className="p-2.5 space-y-1.5">
                <p className="text-xs font-semibold line-clamp-2">{v.title}</p>
                <p className="text-[10px] text-muted-foreground">{v.channel}</p>
                <button
                  onClick={() => onPick(v)}
                  className="w-full btn-3d rounded-xl bg-primary py-1.5 text-xs font-semibold text-primary-foreground"
                >
                  <Play className="h-3 w-3 inline mr-1" /> Watch & study
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div>
        <h2 className="font-display text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
          Trusted channels
        </h2>
        <div className="grid gap-2 grid-cols-2 sm:grid-cols-3">
          {CHANNELS.map((c) => (
            <button
              key={c}
              onClick={() => {
                setQ(c);
                search(c);
              }}
              className="text-left rounded-xl border-2 border-border bg-card px-2.5 py-2 text-xs font-medium hover:border-primary/40 transition"
            >
              {c}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
