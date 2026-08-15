// Listen to a material as a two-person conversation.
//
// The closest thing to NotebookLM's audio overview, built entirely out of
// things that cost nothing: the model writes the dialogue, and the browser
// speaks it with two different system voices. No TTS bill, no API key, no
// audio file to generate or store.
//
// It also solves a real problem rather than being a gimmick — a document you
// can listen to is a document you can revise on a bus, and that is time most
// students currently spend not revising at all.
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Headphones, Loader2, Pause, Play, Square } from "lucide-react";
import { generatePodcast } from "@/lib/materials.functions";
import { getAccessToken } from "@/lib/auth-helper";
import { toast } from "@/lib/notify";
import { reportError } from "@/lib/report-error";
import {
  loadVoices, pickPair, speak, stopSpeaking, ttsSupported, type Voice,
} from "@/lib/speech";

type Line = { speaker: "host" | "guest"; text: string };

export function PodcastMode({ materialId }: { materialId: string }) {
  const podcastFn = useServerFn(generatePodcast);
  const [lines, setLines] = useState<Line[] | null>(null);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [idx, setIdx] = useState(0);
  const [voices, setVoices] = useState<{ host: Voice | null; guest: Voice | null }>({ host: null, guest: null });

  // Cancels a run when the student stops or leaves, so a queued conversation
  // does not keep talking over the next page.
  const runRef = useRef(0);

  useEffect(() => {
    void loadVoices().then((v) => setVoices(pickPair(v)));
    return () => {
      runRef.current++;
      stopSpeaking();
    };
  }, []);

  if (!ttsSupported()) return null;

  async function generate() {
    setLoading(true);
    try {
      const accessToken = await getAccessToken();
      const res = await podcastFn({ data: { accessToken, materialId } });
      setLines(res.lines as Line[]);
      setTitle(res.title);
      setIdx(0);
    } catch (e) {
      toast.error(reportError("podcast", e));
    } finally {
      setLoading(false);
    }
  }

  async function play(from = 0) {
    if (!lines) return;
    const run = ++runRef.current;
    setPlaying(true);
    for (let i = from; i < lines.length; i++) {
      if (runRef.current !== run) return; // superseded by stop or a restart
      setIdx(i);
      const l = lines[i];
      await speak(l.text, {
        voice: l.speaker === "host" ? voices.host : voices.guest,
        // A small pitch split so the two voices stay distinguishable even on a
        // device that only has one installed.
        pitch: l.speaker === "host" ? 1.08 : 0.92,
        rate: 1.02,
      });
    }
    if (runRef.current === run) {
      setPlaying(false);
      setIdx(0);
    }
  }

  function stop() {
    runRef.current++;
    stopSpeaking();
    setPlaying(false);
  }

  if (!lines) {
    return (
      <div className="card-chunky bg-card p-5 text-center">
        <Headphones className="mx-auto h-8 w-8 text-primary" />
        <h3 className="mt-2 font-display text-base font-extrabold">Listen instead</h3>
        <p className="mx-auto mt-1 max-w-sm text-xs font-semibold text-muted-foreground">
          Turn this material into a short conversation between two people — one asking
          the questions you'd ask, one answering them. Good for a walk or a bus.
        </p>
        <button
          onClick={() => void generate()}
          disabled={loading}
          className="btn-3d mt-3 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-extrabold uppercase tracking-wide text-primary-foreground disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Headphones className="h-4 w-4" />}
          {loading ? "Writing it…" : "Make the audio"}
        </button>
      </div>
    );
  }

  return (
    <div className="card-chunky bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-display text-sm font-extrabold">{title}</h3>
          <p className="text-[11px] font-semibold text-muted-foreground">
            {lines.length} lines · line {idx + 1}
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          {playing ? (
            <button
              onClick={stop}
              className="rounded-xl border-2 border-border p-2 text-muted-foreground transition hover:border-destructive hover:text-destructive"
              aria-label="Stop"
            >
              <Square className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={() => void play(idx)}
              className="btn-3d rounded-xl bg-primary p-2 text-primary-foreground"
              aria-label="Play"
            >
              <Play className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* The transcript scrolls with the audio, so it can be read as well as
          heard — and a line you missed is right there to re-read. */}
      <ol className="mt-3 max-h-64 space-y-1.5 overflow-y-auto">
        {lines.map((l, i) => (
          <li key={i}>
            <button
              onClick={() => void play(i)}
              className={`w-full rounded-xl border-2 px-3 py-2 text-left text-xs font-semibold transition ${
                i === idx
                  ? "border-primary bg-primary/10"
                  : "border-transparent hover:bg-surface-2"
              }`}
            >
              <span className={`mr-1.5 font-extrabold ${l.speaker === "host" ? "text-sky" : "text-success"}`}>
                {l.speaker === "host" ? "Q" : "A"}
              </span>
              {l.text}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
