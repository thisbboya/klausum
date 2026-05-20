import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { summarizeVoiceNote } from "@/lib/lab.functions";
import { getAccessToken } from "@/lib/auth-helper";
import { toast } from "sonner";
import { Mic, Square, Sparkles, Trash2, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/voice")({ component: VoicePage });

function VoicePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const summarize = useServerFn(summarizeVoiceNote);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("General");
  const [busy, setBusy] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [mode, setMode] = useState<"browser" | "record">("browser");
  const recRef = useRef<any>(null);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const supportsSR = typeof window !== "undefined" && (("webkitSpeechRecognition" in window) || ("SpeechRecognition" in window));

  useEffect(() => { if (!supportsSR) setMode("record"); }, [supportsSR]);

  function startTimer() {
    setSeconds(0);
    timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
  }
  function stopTimer() { if (timerRef.current) clearInterval(timerRef.current); }

  async function startRecord() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "";
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        await uploadForTranscription(blob);
      };
      mr.start();
      mediaRecRef.current = mr;
      setRecording(true);
      startTimer();
    } catch (e: any) {
      toast.error("Mic permission denied or unavailable: " + (e?.message ?? "error"));
    }
  }

  function stopRecord() {
    mediaRecRef.current?.stop();
    setRecording(false);
    stopTimer();
  }

  async function uploadForTranscription(blob: Blob) {
    setTranscribing(true);
    try {
      const ext = (blob.type.includes("mp4") ? "m4a" : "webm");
      const fd = new FormData();
      fd.append("audio", new File([blob], `note.${ext}`, { type: blob.type }));
      const r = await fetch("/api/transcribe", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error ?? "Transcription failed");
      setTranscript((prev) => (prev ? prev + " " : "") + (j.text ?? ""));
      toast.success("Transcribed");
    } catch (e: any) {
      toast.error(e.message ?? "Transcription failed");
    } finally {
      setTranscribing(false);
    }
  }

  function start() {
    if (mode === "record") return startRecord();
    if (!supportsSR) {
      toast.message("Switching to recording mode (browser STT unsupported)");
      setMode("record");
      return startRecord();
    }
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    let final = transcript;
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript + " ";
        else interim += r[0].transcript;
      }
      setTranscript(final + interim);
    };
    rec.onerror = (e: any) => toast.error("Mic: " + (e.error ?? "error"));
    rec.start();
    recRef.current = rec;
    setRecording(true);
    setSeconds(0);
    timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
  }

  function stop() {
    recRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const { data: notes = [] } = useQuery({
    queryKey: ["voice", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("voice_notes").select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  async function save() {
    if (!transcript.trim()) return toast.error("No transcript");
    setBusy(true);
    try {
      const accessToken = await getAccessToken();
      const r = await summarize({ data: { accessToken, transcript, subject } });
      const { error } = await supabase.from("voice_notes").insert({
        user_id: user!.id,
        title: title || transcript.slice(0, 60),
        subject,
        duration_seconds: seconds,
        transcript,
        summary: r.summary,
        key_points: r.key_points,
      });
      if (error) throw error;
      // Optionally create a deck of cards
      const { data: deck } = await supabase.from("flashcard_decks").insert({
        user_id: user!.id, title: `Voice: ${title || subject}`, subject,
      }).select().single();
      if (deck) {
        await supabase.from("flashcards").insert(r.flashcards.map((c) => ({
          deck_id: deck.id, user_id: user!.id, front: c.front, back: c.back, bloom_level: c.bloom_level,
        })));
      }
      toast.success("Saved + flashcards generated");
      setTranscript(""); setTitle(""); setSeconds(0);
      qc.invalidateQueries({ queryKey: ["voice", user?.id] });
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function del(id: string) {
    await supabase.from("voice_notes").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["voice", user?.id] });
  }

  const mm = Math.floor(seconds / 60).toString().padStart(2, "0");
  const ss = (seconds % 60).toString().padStart(2, "0");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold">Voice Notes</h1>
        <p className="text-sm text-muted-foreground">Talk it out. Get a summary, key points, and flashcards.</p>
      </header>

      <div className="rounded-xl border border-border/60 bg-card/60 p-5 space-y-3">
        <div className="flex items-center gap-3">
          <button
            onClick={recording ? stop : start}
            className={`flex h-16 w-16 items-center justify-center rounded-full ${recording ? "bg-red-500 animate-pulse" : "bg-primary"} text-primary-foreground shadow-lg`}
          >
            {recording ? <Square className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
          </button>
          <div>
            <div className="font-mono text-2xl">{mm}:{ss}</div>
            <div className="text-xs text-muted-foreground">
              {transcribing ? "Transcribing audio…" : recording ? "Recording…" : mode === "record" ? "Tap to record (AI transcription)" : "Tap to start (live)"}
            </div>
          </div>
          <div className="ml-auto flex rounded-lg border border-border bg-background p-0.5 text-xs">
            <button onClick={() => setMode("browser")} disabled={!supportsSR || recording} className={`px-2 py-1 rounded ${mode === "browser" ? "bg-primary text-primary-foreground" : ""} disabled:opacity-40`}>Live</button>
            <button onClick={() => setMode("record")} disabled={recording} className={`px-2 py-1 rounded ${mode === "record" ? "bg-primary text-primary-foreground" : ""}`}>Record</button>
          </div>
        </div>
        {transcribing && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Sending audio to AI…</div>}

        <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} className="w-full min-h-32 rounded-lg border border-border bg-background p-3 text-sm" placeholder="Live transcript appears here. You can edit before saving." />

        <div className="grid md:grid-cols-2 gap-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </div>

        <button onClick={save} disabled={busy || !transcript.trim()} className="inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Summarize + Save
        </button>
      </div>

      {notes.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">Past notes</h2>
          <ul className="space-y-2">
            {notes.map((n: any) => (
              <li key={n.id} className="rounded-xl border border-border/60 bg-card/40 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{n.title}</div>
                    <div className="text-[11px] uppercase text-muted-foreground">{n.subject} · {Math.round((n.duration_seconds ?? 0) / 60)} min</div>
                  </div>
                  <button onClick={() => del(n.id)} className="text-muted-foreground hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                </div>
                {n.summary && <p className="mt-2 text-sm text-foreground/80">{n.summary}</p>}
                {Array.isArray(n.key_points) && n.key_points.length > 0 && (
                  <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground space-y-0.5">
                    {n.key_points.map((kp: string, i: number) => <li key={i}>{kp}</li>)}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
