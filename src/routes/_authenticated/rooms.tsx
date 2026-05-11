import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Users, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/rooms")({ component: RoomsPage });

function RoomsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("General");
  const [code, setCode] = useState("");

  const { data: rooms = [] } = useQuery({
    queryKey: ["rooms"],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("study_rooms").select("*").eq("is_active", true).order("created_at", { ascending: false }).limit(30);
      return data ?? [];
    },
  });

  async function create() {
    if (!name.trim()) return toast.error("Name required");
    const join_code = Math.random().toString(36).slice(2, 8).toUpperCase();
    const { error } = await supabase.from("study_rooms").insert({ host_id: user!.id, name, subject, join_code }).select().single();
    if (error) return toast.error(error.message);
    setName("");
    qc.invalidateQueries({ queryKey: ["rooms"] });
    toast.success(`Room created · code ${join_code}`);
  }

  async function joinByCode() {
    if (!code.trim()) return;
    const { data, error } = await supabase.from("study_rooms").select("id").eq("join_code", code.trim().toUpperCase()).maybeSingle();
    if (error || !data) return toast.error("Invalid code");
    window.location.href = `/rooms/${data.id}`;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold">Study Rooms</h1>
        <p className="text-sm text-muted-foreground">Co-study with classmates in real time. Synced Pomodoro, readiness, question board.</p>
      </header>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="flex gap-2 rounded-xl border border-border/60 bg-card/60 p-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Room name" className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="w-32 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <button onClick={create} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
            <Plus className="h-4 w-4" /> Create
          </button>
        </div>
        <div className="flex gap-2 rounded-xl border border-border/60 bg-card/60 p-3">
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Join with code…" className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm uppercase" />
          <button onClick={joinByCode} className="rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:border-primary/40">Join</button>
        </div>
      </div>

      {rooms.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">No active rooms. Create one!</div>
      ) : (
        <ul className="grid md:grid-cols-2 gap-3">
          {rooms.map((r: any) => (
            <li key={r.id} className="rounded-xl border border-border/60 bg-card/60 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{r.name}</div>
                  <div className="text-[11px] uppercase text-muted-foreground">{r.subject}</div>
                </div>
                <Link to="/rooms/$id" params={{ id: r.id }} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
                  Join <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {new Date(r.created_at).toLocaleDateString()}</span>
                {r.join_code && <span className="rounded bg-background/60 px-1.5 py-0.5 font-mono">{r.join_code}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
