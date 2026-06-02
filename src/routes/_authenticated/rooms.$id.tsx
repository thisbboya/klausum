import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, ArrowLeft, Users, Play, Pause, RotateCcw, Check, ThumbsUp, MessageCircleQuestion, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/rooms/$id")({ component: RoomPage });

type Msg = { id: string; user_id: string; display_name: string | null; body: string; created_at: string };
type Question = { id: string; user_id: string; display_name: string | null; body: string; upvotes: number; resolved: boolean; created_at: string };
type Pomo = { running: boolean; mode: "focus" | "break"; ends_at: string | null; duration: number };

const DEFAULT_POMO: Pomo = { running: false, mode: "focus", ends_at: null, duration: 25 * 60 };

function RoomPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const [room, setRoom] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [text, setText] = useState("");
  const [qText, setQText] = useState("");
  const [name, setName] = useState("");
  const [tab, setTab] = useState<"chat" | "questions">("chat");
  const [now, setNow] = useState(Date.now());
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const isHost = user?.id === room?.host_id;
  const pomo: Pomo = useMemo(() => ({ ...DEFAULT_POMO, ...(room?.pomodoro_state || {}) }), [room]);
  const remaining = pomo.running && pomo.ends_at ? Math.max(0, Math.floor((new Date(pomo.ends_at).getTime() - now) / 1000)) : pomo.duration;

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      // Profile fetch + ensure room membership BEFORE reading restricted tables
      const { data: prof } = await supabase
        .from("user_profiles").select("full_name").eq("id", user.id).maybeSingle();
      const dn = prof?.full_name ?? "Student";
      setName(dn);
      await supabase.from("room_members").upsert(
        { room_id: id, user_id: user.id, display_name: dn },
        { onConflict: "room_id,user_id" },
      );

      const [{ data: r }, { data: ms }, { data: mems }, { data: qs }] = await Promise.all([
        supabase.from("study_rooms").select("*").eq("id", id).maybeSingle(),
        supabase.from("room_messages").select("*").eq("room_id", id).order("created_at").limit(200),
        supabase.from("room_members").select("*").eq("room_id", id),
        supabase.from("room_questions").select("*").eq("room_id", id).order("upvotes", { ascending: false }).order("created_at", { ascending: false }),
      ]);
      setRoom(r);
      setMessages((ms ?? []) as Msg[]);
      setQuestions((qs ?? []) as Question[]);
      setMembers(mems ?? []);
    })();

    const ch = supabase
      .channel(`room-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "room_messages", filter: `room_id=eq.${id}` }, (p) => setMessages((m) => [...m, p.new as Msg]))
      .on("postgres_changes", { event: "*", schema: "public", table: "room_members", filter: `room_id=eq.${id}` }, async () => {
        const { data } = await supabase.from("room_members").select("*").eq("room_id", id);
        setMembers(data ?? []);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "room_questions", filter: `room_id=eq.${id}` }, async () => {
        const { data } = await supabase.from("room_questions").select("*").eq("room_id", id).order("upvotes", { ascending: false }).order("created_at", { ascending: false });
        setQuestions((data ?? []) as Question[]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "study_rooms", filter: `id=eq.${id}` }, (p) => setRoom(p.new))
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [id, user]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages.length]);

  async function send() {
    if (!text.trim()) return;
    const body = text.trim();
    setText("");
    const { error } = await supabase.from("room_messages").insert({ room_id: id, user_id: user!.id, display_name: name, body });
    if (error) toast.error(error.message);
  }

  async function postQuestion() {
    if (!qText.trim()) return;
    const body = qText.trim();
    setQText("");
    const { error } = await supabase.from("room_questions").insert({ room_id: id, user_id: user!.id, display_name: name, body });
    if (error) toast.error(error.message);
  }

  async function upvote(q: Question) {
    await supabase.from("room_questions").update({ upvotes: q.upvotes + 1 }).eq("id", q.id);
  }
  async function resolveQ(q: Question) {
    await supabase.from("room_questions").update({ resolved: !q.resolved }).eq("id", q.id);
  }
  async function deleteQ(q: Question) {
    await supabase.from("room_questions").delete().eq("id", q.id);
  }

  async function toggleReady() {
    const me = members.find((m) => m.user_id === user!.id);
    if (!me) return;
    await supabase.from("room_members").update({ is_ready: !me.is_ready }).eq("id", me.id);
  }

  async function setPomo(next: Partial<Pomo>) {
    if (!isHost) return toast.error("Host controls timer");
    const merged: Pomo = { ...pomo, ...next };
    await supabase.from("study_rooms").update({ pomodoro_state: merged as any }).eq("id", id);
  }
  function startPomo(mode: "focus" | "break") {
    const minutes = mode === "focus" ? 25 : 5;
    setPomo({ running: true, mode, duration: minutes * 60, ends_at: new Date(Date.now() + minutes * 60_000).toISOString() });
  }
  function pausePomo() { setPomo({ running: false, ends_at: null, duration: remaining }); }
  function resetPomo() { setPomo(DEFAULT_POMO); }

  async function leave() {
    await supabase.from("room_members").delete().eq("room_id", id).eq("user_id", user!.id);
  }

  if (!room) return <div className="text-sm text-muted-foreground">Loading…</div>;

  const mins = Math.floor(remaining / 60).toString().padStart(2, "0");
  const secs = (remaining % 60).toString().padStart(2, "0");
  const me = members.find((m) => m.user_id === user?.id);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link to="/rooms" onClick={leave} className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /></Link>
          <div>
            <h1 className="font-display text-2xl font-bold">{room.name}</h1>
            <div className="text-xs uppercase text-muted-foreground flex items-center gap-2">
              <span>{room.subject}</span>
              {room.join_code && <span className="font-mono rounded bg-background/60 px-1.5 py-0.5">code {room.join_code}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground"><Users className="h-3.5 w-3.5" /> {members.length} online</div>
      </header>

      {/* Pomodoro */}
      <div className={`rounded-xl border p-4 flex items-center justify-between gap-3 ${pomo.mode === "focus" ? "border-primary/40 bg-primary/5" : "border-emerald-500/40 bg-emerald-500/5"}`}>
        <div>
          <div className="text-[11px] uppercase text-muted-foreground">{pomo.mode === "focus" ? "Focus" : "Break"} · synced</div>
          <div className="font-display text-4xl font-bold tabular-nums">{mins}:{secs}</div>
        </div>
        <div className="flex items-center gap-2">
          {isHost ? (
            <>
              {!pomo.running ? (
                <>
                  <button onClick={() => startPomo("focus")} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"><Play className="h-3.5 w-3.5" /> Focus 25</button>
                  <button onClick={() => startPomo("break")} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold"><Play className="h-3.5 w-3.5" /> Break 5</button>
                </>
              ) : (
                <button onClick={pausePomo} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold"><Pause className="h-3.5 w-3.5" /> Pause</button>
              )}
              <button onClick={resetPomo} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs"><RotateCcw className="h-3.5 w-3.5" /> Reset</button>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">Host controls</span>
          )}
          <button onClick={toggleReady} className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold ${me?.is_ready ? "bg-emerald-500 text-white" : "border border-border"}`}>
            <Check className="h-3.5 w-3.5" /> {me?.is_ready ? "Ready" : "Mark ready"}
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-[1fr_220px] gap-4">
        <div className="rounded-xl border border-border/60 bg-card/40 flex flex-col h-[55vh]">
          <div className="flex border-b border-border/60 text-xs">
            <button onClick={() => setTab("chat")} className={`flex-1 px-3 py-2 ${tab === "chat" ? "bg-background font-semibold" : "text-muted-foreground"}`}>Chat</button>
            <button onClick={() => setTab("questions")} className={`flex-1 px-3 py-2 inline-flex items-center justify-center gap-1 ${tab === "questions" ? "bg-background font-semibold" : "text-muted-foreground"}`}>
              <MessageCircleQuestion className="h-3.5 w-3.5" /> Questions {questions.length > 0 && <span className="text-[10px] opacity-70">({questions.filter((q) => !q.resolved).length})</span>}
            </button>
          </div>

          {tab === "chat" ? (
            <>
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
                {messages.length === 0 && <div className="text-sm text-muted-foreground text-center py-8">No messages yet — say hi 👋</div>}
                {messages.map((m) => {
                  const mine = m.user_id === user?.id;
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-background border border-border"}`}>
                        {!mine && <div className="text-[10px] uppercase opacity-60 mb-0.5">{m.display_name ?? "Anon"}</div>}
                        <div className="whitespace-pre-wrap">{m.body}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-border/60 p-2 flex gap-2">
                <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Message…" className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                <button onClick={send} className="rounded-lg bg-primary p-2 text-primary-foreground"><Send className="h-4 w-4" /></button>
              </div>
            </>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {questions.length === 0 && <div className="text-sm text-muted-foreground text-center py-8">No questions yet. Ask something the room can help with.</div>}
                {questions.map((q) => (
                  <div key={q.id} className={`rounded-lg border border-border bg-background p-3 ${q.resolved ? "opacity-60" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase text-muted-foreground">{q.display_name ?? "Anon"}</div>
                        <div className={`text-sm whitespace-pre-wrap ${q.resolved ? "line-through" : ""}`}>{q.body}</div>
                      </div>
                      <div className="flex flex-col items-center gap-1 shrink-0">
                        <button onClick={() => upvote(q)} className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-xs hover:border-primary/40">
                          <ThumbsUp className="h-3 w-3" /> {q.upvotes}
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 flex gap-2 text-[11px]">
                      <button onClick={() => resolveQ(q)} className="rounded border border-border px-2 py-0.5 hover:border-primary/40">{q.resolved ? "Reopen" : "Mark resolved"}</button>
                      {q.user_id === user?.id && (
                        <button onClick={() => deleteQ(q)} className="rounded border border-border px-2 py-0.5 hover:border-destructive/40 text-muted-foreground">
                          <Trash2 className="inline h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-border/60 p-2 flex gap-2">
                <input value={qText} onChange={(e) => setQText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && postQuestion()} placeholder="Ask a question…" className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                <button onClick={postQuestion} className="rounded-lg bg-primary px-3 py-2 text-xs text-primary-foreground font-semibold">Ask</button>
              </div>
            </>
          )}
        </div>

        <aside className="rounded-xl border border-border/60 bg-card/40 p-3">
          <div className="text-xs uppercase text-muted-foreground mb-2">Members ({members.filter((m) => m.is_ready).length}/{members.length} ready)</div>
          <ul className="space-y-1.5 text-sm">
            {members.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 truncate">
                <span className="truncate flex items-center gap-1">
                  {m.user_id === room.host_id && <span className="text-[9px] uppercase text-primary">Host</span>}
                  {m.display_name ?? "Anon"}
                </span>
                {m.is_ready && <span className="text-emerald-400"><Check className="h-3.5 w-3.5" /></span>}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
