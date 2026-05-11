import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, ArrowLeft, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/rooms/$id")({ component: RoomPage });

type Msg = { id: string; user_id: string; display_name: string | null; body: string; created_at: string };

function RoomPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const [room, setRoom] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: r }, { data: ms }, { data: mems }, { data: prof }] = await Promise.all([
        supabase.from("study_rooms").select("*").eq("id", id).maybeSingle(),
        supabase.from("room_messages").select("*").eq("room_id", id).order("created_at").limit(200),
        supabase.from("room_members").select("*").eq("room_id", id),
        supabase.from("user_profiles").select("full_name").eq("id", user.id).maybeSingle(),
      ]);
      setRoom(r);
      setMessages((ms ?? []) as Msg[]);
      setMembers(mems ?? []);
      const dn = prof?.full_name ?? "Student";
      setName(dn);
      // Join (idempotent)
      await supabase.from("room_members").upsert({ room_id: id, user_id: user.id, display_name: dn }, { onConflict: "room_id,user_id" });
      const { data: refreshed } = await supabase.from("room_members").select("*").eq("room_id", id);
      setMembers(refreshed ?? []);
    })();

    const ch = supabase
      .channel(`room-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "room_messages", filter: `room_id=eq.${id}` }, (p) => {
        setMessages((m) => [...m, p.new as Msg]);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "room_members", filter: `room_id=eq.${id}` }, async () => {
        const { data } = await supabase.from("room_members").select("*").eq("room_id", id);
        setMembers(data ?? []);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    if (!text.trim()) return;
    const body = text.trim();
    setText("");
    const { error } = await supabase.from("room_messages").insert({ room_id: id, user_id: user!.id, display_name: name, body });
    if (error) toast.error(error.message);
  }

  async function leave() {
    await supabase.from("room_members").delete().eq("room_id", id).eq("user_id", user!.id);
  }

  if (!room) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link to="/rooms" onClick={leave} className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /></Link>
          <div>
            <h1 className="font-display text-2xl font-bold">{room.name}</h1>
            <div className="text-xs uppercase text-muted-foreground">{room.subject}</div>
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground"><Users className="h-3.5 w-3.5" /> {members.length} online</div>
      </header>

      <div className="grid md:grid-cols-[1fr_180px] gap-4">
        <div className="rounded-xl border border-border/60 bg-card/40 flex flex-col h-[60vh]">
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
        </div>
        <aside className="rounded-xl border border-border/60 bg-card/40 p-3">
          <div className="text-xs uppercase text-muted-foreground mb-2">Members</div>
          <ul className="space-y-1 text-sm">
            {members.map((m) => (
              <li key={m.id} className="truncate">{m.display_name ?? "Anon"}</li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
