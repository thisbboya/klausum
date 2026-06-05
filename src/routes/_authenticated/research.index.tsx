import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, FlaskConical, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getAccessToken } from "@/lib/auth-helper";
import {
  listResearchProjects,
  createResearchProject,
  deleteResearchProject,
} from "@/lib/research.functions";

export const Route = createFileRoute("/_authenticated/research/")({
  component: ResearchIndex,
});

const COLORS = [
  "#F4A300",
  "#E94560",
  "#0EA5E9",
  "#10B981",
  "#A855F7",
  "#F472B6",
  "#FACC15",
  "#94A3B8",
];

const SUBJECTS = [
  "General",
  "Mathematics",
  "Physics",
  "Chemistry",
  "Biology",
  "Computer Science",
  "Economics",
  "History",
  "Literature",
  "Law",
  "Medicine",
  "Engineering",
];

function ResearchIndex() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const listFn = useServerFn(listResearchProjects);
  const createFn = useServerFn(createResearchProject);
  const deleteFn = useServerFn(deleteResearchProject);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["research-projects"],
    queryFn: async () => listFn({ data: { accessToken: await getAccessToken() } }),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("General");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    if (!title.trim()) return toast.error("Title required");
    setCreating(true);
    try {
      const project = await createFn({
        data: {
          accessToken: await getAccessToken(),
          title: title.trim(),
          subject,
          description: description.trim() || undefined,
          color,
        },
      });
      toast.success("Project created");
      setShowCreate(false);
      setTitle("");
      setDescription("");
      qc.invalidateQueries({ queryKey: ["research-projects"] });
      navigate({ to: "/research/$projectId", params: { projectId: (project as any).id } });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to create project");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}" and all its sources?`)) return;
    try {
      await deleteFn({ data: { accessToken: await getAccessToken(), id } });
      toast.success("Project deleted");
      qc.invalidateQueries({ queryKey: ["research-projects"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <FlaskConical className="h-6 w-6 text-primary" /> Research Workspace
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Collect multiple sources into a project and chat with all of them at once.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 active:scale-95 transition inline-flex items-center gap-2"
        >
          <Plus className="h-4 w-4" /> New Project
        </button>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-12 text-center">
          <div className="text-5xl mb-3">🗂️</div>
          <p className="text-foreground font-semibold">No research projects yet.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Create one to start synthesising across multiple sources.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Create your first project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {projects.map((p: any) => (
            <div
              key={p.id}
              className="group relative rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition"
              style={{ borderLeftWidth: 4, borderLeftColor: p.color }}
            >
              <Link
                to="/research/$projectId"
                params={{ projectId: p.id }}
                className="block"
              >
                <h3 className="font-display font-semibold text-base text-foreground truncate">
                  {p.title}
                </h3>
                {p.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {p.description}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2 mt-3 text-[11px]">
                  <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {p.source_count} source{p.source_count === 1 ? "" : "s"}
                  </span>
                  {p.subject && (
                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      {p.subject}
                    </span>
                  )}
                  <span className="text-muted-foreground ml-auto">
                    {new Date(p.updated_at).toLocaleDateString()}
                  </span>
                </div>
              </Link>
              <button
                onClick={() => handleDelete(p.id, p.title)}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                aria-label="Delete project"
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCreate(false);
          }}
        >
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md space-y-4">
            <h2 className="font-display text-lg font-semibold">New Research Project</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                  Title *
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. CRISPR delivery mechanisms"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                  Subject
                </label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  {SUBJECTS.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="What are you researching?"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary resize-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                  Colour
                </label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={`h-7 w-7 rounded-full border-2 transition ${
                        color === c ? "border-foreground scale-110" : "border-transparent"
                      }`}
                      style={{ background: c }}
                      aria-label={`Color ${c}`}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowCreate(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent/10"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !title.trim()}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
              >
                {creating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
