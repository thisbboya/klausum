import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Plus, Network, ArrowLeft, Sparkles, Loader2, Wand2, LayoutGrid, Download } from "lucide-react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  MarkerType,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
} from "reactflow";
import "reactflow/dist/style.css";
import dagre from "dagre";
import { toPng } from "html-to-image";
import { generateMindMap, expandMindMapNode } from "@/lib/study.functions";

type Search = { id?: string };

export const Route = createFileRoute("/_authenticated/mindmaps")({
  validateSearch: (s: Record<string, unknown>): Search => ({ id: typeof s.id === "string" ? s.id : undefined }),
  component: MindMapsPage,
});

function MindMapsPage() {
  const { id } = Route.useSearch();
  return id ? <MapEditor id={id} /> : <MapList />;
}

function MapList() {
  const { user } = useAuth();
  const navigate = Route.useNavigate();
  const qc = useQueryClient();

  const { data: maps } = useQuery({
    queryKey: ["mind_maps", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mind_maps")
        .select("id,title,subject,updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function createMap() {
    if (!user) return;
    const { data, error } = await supabase
      .from("mind_maps")
      .insert({
        user_id: user.id,
        title: "New mind map",
        subject: "General",
        nodes: [{ id: "n1", label: "Main concept", type: "main" }],
        edges: [],
      })
      .select("id")
      .single();
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["mind_maps", user.id] });
    navigate({ search: { id: data.id } });
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-2">
            <Network className="h-7 w-7 text-primary" /> Mind Maps
          </h1>
          <p className="text-sm text-muted-foreground mt-1">See how concepts connect. Click the canvas to add. Drag node-to-node to link.</p>
        </div>
        <button onClick={createMap} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
          <Plus className="h-4 w-4" /> New map
        </button>
      </header>

      {(maps ?? []).length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <Network className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">No mind maps yet. Build your first one.</p>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {(maps ?? []).map((m) => (
            <li key={m.id}>
              <Link to="/mindmaps" search={{ id: m.id }} className="block rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition">
                <h3 className="font-display font-semibold truncate">{m.title}</h3>
                <div className="mt-1 text-xs text-primary">{m.subject}</div>
                <div className="mt-2 text-xs text-muted-foreground">{new Date(m.updated_at!).toLocaleDateString()}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const NODE_STYLE: Record<string, React.CSSProperties> = {
  main: { background: "oklch(0.78 0.16 78 / 0.20)", border: "2px solid oklch(0.78 0.16 78)", color: "white", padding: 12, borderRadius: 12, fontWeight: 600, minWidth: 140 },
  sub: { background: "oklch(0.25 0.05 260)", border: "1px solid oklch(0.45 0.08 260)", color: "white", padding: 10, borderRadius: 10, minWidth: 120 },
  example: { background: "oklch(0.35 0.12 150 / 0.4)", border: "1px solid oklch(0.6 0.18 150)", color: "white", padding: 10, borderRadius: 10, minWidth: 120 },
  warning: { background: "oklch(0.35 0.18 25 / 0.4)", border: "1px solid oklch(0.65 0.22 25)", color: "white", padding: 10, borderRadius: 10, minWidth: 120 },
};

function MapEditor({ id }: { id: string }) {
  const { user, session } = useAuth();
  const navigate = Route.useNavigate();
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"gen" | "expand" | null>(null);
  const [topic, setTopic] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const genFn = useServerFn(generateMindMap);
  const expandFn = useServerFn(expandMindMapNode);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("mind_maps").select("*").eq("id", id).maybeSingle();
      if (error) toast.error(error.message);
      if (data) {
        setTitle(data.title);
        setSubject(data.subject ?? "General");
        const rawNodes = (data.nodes as any[]) ?? [];
        const rawEdges = (data.edges as any[]) ?? [];
        setNodes(rawNodes.map((n, i) => toFlowNode(n, n.position ?? autoPos(i, rawNodes.length))));
        setEdges(rawEdges.map((e, i) => ({ id: e.id ?? `e${i}`, source: e.source, target: e.target, label: e.label, animated: false })));
      }
      setLoading(false);
    })();
  }, [id]);

  function toFlowNode(n: any, position: { x: number; y: number }): Node {
    return {
      id: n.id,
      data: { label: n.label, type: n.type ?? "sub" },
      position,
      style: NODE_STYLE[n.type ?? "sub"],
    };
  }
  function autoPos(i: number, total: number) {
    const angle = (i / Math.max(1, total)) * 2 * Math.PI;
    const r = 220;
    return { x: 400 + r * Math.cos(angle), y: 280 + r * Math.sin(angle) };
  }

  // Save debounced
  useEffect(() => {
    if (loading) return;
    const t = window.setTimeout(async () => {
      const nodesPayload = nodes.map((n) => ({ id: n.id, label: (n.data as any).label, type: (n.data as any).type, position: { x: n.position.x, y: n.position.y } }));
      const edgesPayload = edges.map((e) => ({ id: e.id, source: e.source, target: e.target, label: typeof e.label === "string" ? e.label : "" }));
      await supabase
        .from("mind_maps")
        .update({ title, subject, nodes: nodesPayload as any, edges: edgesPayload as any, updated_at: new Date().toISOString() })
        .eq("id", id);
    }, 1500);
    return () => window.clearTimeout(t);
  }, [nodes, edges, title, subject, loading, id]);

  const onNodesChange = useCallback((c: NodeChange[]) => setNodes((n) => applyNodeChanges(c, n)), []);
  const onEdgesChange = useCallback((c: EdgeChange[]) => setEdges((e) => applyEdgeChanges(c, e)), []);
  const onConnect = useCallback((c: Connection) => setEdges((e) => addEdge({ ...c, id: `e${Date.now()}` }, e)), []);

  function onNodeDoubleClick(_: any, node: Node) {
    const fresh = window.prompt("Edit label", (node.data as any).label);
    if (fresh) {
      setNodes((ns) => ns.map((n) => (n.id === node.id ? { ...n, data: { ...n.data, label: fresh } } : n)));
    }
  }

  function addNode(type: "sub" | "example" | "warning" = "sub") {
    const id = `n${Date.now()}`;
    setNodes((n) => [
      ...n,
      { id, data: { label: "New", type }, position: { x: 400 + Math.random() * 200, y: 200 + Math.random() * 200 }, style: NODE_STYLE[type] },
    ]);
  }

  async function aiGenerate() {
    if (!session) return;
    if (!topic.trim()) return toast.error("Enter a topic to generate");
    setBusy("gen");
    try {
      const r = await genFn({ data: { accessToken: session.access_token, topic } });
      const newNodes: Node[] = r.nodes.map((n, i) => toFlowNode(n, autoPos(i, r.nodes.length)));
      const newEdges: Edge[] = r.edges.map((e, i) => ({ id: `e${i}`, source: e.source, target: e.target, label: e.label }));
      setNodes(newNodes);
      setEdges(newEdges);
      toast.success(`Generated ${r.nodes.length} concepts`);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to generate");
    } finally {
      setBusy(null);
    }
  }

  async function aiExpand() {
    if (!session || !selected) return;
    const node = nodes.find((n) => n.id === selected);
    if (!node) return;
    setBusy("expand");
    try {
      const r = await expandFn({ data: { accessToken: session.access_token, parentLabel: (node.data as any).label } });
      const newNodes = r.children.map((label, i) => {
        const cid = `n${Date.now()}_${i}`;
        return {
          id: cid,
          data: { label, type: "sub" },
          position: { x: node.position.x + Math.cos((i / 3) * 2 * Math.PI) * 200, y: node.position.y + Math.sin((i / 3) * 2 * Math.PI) * 160 },
          style: NODE_STYLE.sub,
        } as Node;
      });
      const newEdges = newNodes.map((n) => ({ id: `e${n.id}`, source: node.id, target: n.id }));
      setNodes((ns) => [...ns, ...newNodes]);
      setEdges((es) => [...es, ...newEdges]);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to expand");
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <div className="text-sm text-muted-foreground">Loading map…</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <button onClick={() => navigate({ search: {} })} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All maps
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_180px]">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-lg font-display font-semibold outline-none focus:border-primary"
        />
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Generate from topic…"
          className="flex-1 min-w-[200px] rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <ToolBtn onClick={aiGenerate} busy={busy === "gen"} icon={Sparkles}>AI Generate</ToolBtn>
        <ToolBtn onClick={aiExpand} busy={busy === "expand"} icon={Wand2} disabled={!selected}>Expand selected</ToolBtn>
        <button onClick={() => addNode("sub")} className="rounded-lg border border-border px-3 py-2 text-xs hover:border-primary/40">+ Sub</button>
        <button onClick={() => addNode("example")} className="rounded-lg border border-border px-3 py-2 text-xs hover:border-primary/40">+ Example</button>
        <button onClick={() => addNode("warning")} className="rounded-lg border border-border px-3 py-2 text-xs hover:border-primary/40">+ Warning</button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden" style={{ height: 560 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDoubleClick={onNodeDoubleClick}
          onNodeClick={(_, n) => setSelected(n.id)}
          fitView
        >
          <Background gap={16} color="oklch(0.3 0.02 260)" />
          <MiniMap pannable zoomable />
          <Controls />
        </ReactFlow>
      </div>

      <p className="text-xs text-muted-foreground">Click canvas controls to zoom. Double-click a node to rename. Click a node, then “Expand selected” to grow new branches with AI.</p>
    </div>
  );
}

function ToolBtn({ onClick, busy, icon: Icon, children, disabled }: any) {
  return (
    <button
      onClick={onClick}
      disabled={busy || disabled}
      className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium hover:border-primary/40 disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5 text-primary" />}
      {children}
    </button>
  );
}
