import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getAccessToken } from "@/lib/auth-helper";
import {
  getResearchProject,
  listResearchSources,
  deleteResearchSource,
} from "@/lib/research.functions";
import { SourcesPanel } from "@/components/research/SourcesPanel";
import { SourceViewer } from "@/components/research/SourceViewer";
import { ResearchChatPanel } from "@/components/research/ResearchChatPanel";
import { AddSourceDialog } from "@/components/research/AddSourceDialog";
import { useIsMobile } from "@/hooks/use-mobile";

export const Route = createFileRoute("/_authenticated/research/$projectId")({
  component: ResearchProject,
});

function ResearchProject() {
  const { projectId } = Route.useParams();
  const qc = useQueryClient();
  const isMobile = useIsMobile();

  const getProjFn = useServerFn(getResearchProject);
  const listSrcFn = useServerFn(listResearchSources);
  const delSrcFn = useServerFn(deleteResearchSource);

  const { data: project, isLoading: pLoading } = useQuery({
    queryKey: ["research-project", projectId],
    queryFn: async () =>
      getProjFn({ data: { accessToken: await getAccessToken(), id: projectId } }),
  });

  const { data: sources = [], isLoading: sLoading, refetch: refetchSources } = useQuery({
    queryKey: ["research-sources", projectId],
    queryFn: async () =>
      listSrcFn({ data: { accessToken: await getAccessToken(), projectId } }),
    refetchInterval: (q) => {
      const arr = (q.state.data as any[]) ?? [];
      return arr.some((s) => !s.processing_done) ? 2500 : false;
    },
  });

  const [activeId, setActiveId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [, setTotalPages] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [mobileTab, setMobileTab] = useState<"sources" | "doc" | "chat">("sources");

  // Pick first source by default once loaded
  if (!activeId && sources.length > 0) {
    setActiveId(sources[0].id);
  }

  async function handleDelete(id: string) {
    try {
      await delSrcFn({ data: { accessToken: await getAccessToken(), id } });
      if (activeId === id) setActiveId(null);
      qc.invalidateQueries({ queryKey: ["research-sources", projectId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  }

  function handleJump(sourceId: string, page?: number) {
    if (sourceId) setActiveId(sourceId);
    if (page) setCurrentPage(page);
    if (isMobile) setMobileTab("doc");
  }

  function handleAsk(text: string) {
    if (isMobile) setMobileTab("chat");
    // Push the selection into the chat input through window event — simplest cross-component pass.
    setTimeout(() => {
      const ev = new CustomEvent("research:askSelection", { detail: text });
      window.dispatchEvent(ev);
    }, 50);
  }

  if (pLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!project) {
    return <p className="text-muted-foreground">Project not found.</p>;
  }

  const sourcesMini = sources.map((s: any, i: number) => ({
    id: s.id,
    title: s.title,
    index: i + 1,
  }));

  if (isMobile) {
    return (
      <div className="flex flex-col h-[calc(100vh-64px)]">
        <header className="px-3 py-2 border-b border-border bg-card flex items-center gap-2">
          <Link to="/research" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="font-display font-semibold text-sm truncate flex-1">{project.title}</h1>
        </header>
        <div className="grid grid-cols-3 bg-muted/40 border-b border-border">
          {(["sources", "doc", "chat"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setMobileTab(t)}
              className={`py-2 text-xs font-semibold transition ${
                mobileTab === t ? "text-primary border-b-2 border-primary" : "text-muted-foreground"
              }`}
            >
              {t === "sources" ? "Sources" : t === "doc" ? "Document" : "Chat"}
            </button>
          ))}
        </div>
        <div className="flex-1 min-h-0">
          {mobileTab === "sources" && (
            <SourcesPanel
              sources={sources as any}
              activeId={activeId}
              onSelect={(id) => {
                setActiveId(id);
                setMobileTab("doc");
              }}
              onAdd={() => setShowAdd(true)}
              onDelete={handleDelete}
            />
          )}
          {mobileTab === "doc" && (
            <SourceViewer
              sourceId={activeId}
              currentPage={currentPage}
              onPageChange={(p) => setCurrentPage(p)}
              onTotalPages={setTotalPages}
              onAskAboutSelection={handleAsk}
            />
          )}
          {mobileTab === "chat" && (
            <ResearchChatPanel
              projectId={projectId}
              projectTitle={project.title}
              subject={project.subject}
              sources={sourcesMini}
              activeSourceId={activeId}
              currentPage={currentPage}
              onJump={handleJump}
            />
          )}
        </div>
        {showAdd && (
          <AddSourceDialog
            projectId={projectId}
            onClose={() => setShowAdd(false)}
            onAdded={() => refetchSources()}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <header className="px-4 py-2.5 border-b border-border bg-card flex items-center gap-3 shrink-0">
        <Link to="/research" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs">
          <ArrowLeft className="h-3.5 w-3.5" /> All projects
        </Link>
        <div className="h-4 w-px bg-border" />
        <h1 className="font-display font-semibold text-sm truncate flex-1" style={{ color: project.color }}>
          {project.title}
        </h1>
        {project.subject && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            {project.subject}
          </span>
        )}
      </header>
      <div className="grid grid-cols-[240px_1fr_380px] flex-1 min-h-0">
        <SourcesPanel
          sources={sources as any}
          activeId={activeId}
          onSelect={setActiveId}
          onAdd={() => setShowAdd(true)}
          onDelete={handleDelete}
        />
        <div className="border-r border-border min-w-0">
          {sLoading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="animate-spin text-muted-foreground" />
            </div>
          ) : (
            <SourceViewer
              sourceId={activeId}
              currentPage={currentPage}
              onPageChange={(p) => setCurrentPage(p)}
              onTotalPages={setTotalPages}
              onAskAboutSelection={handleAsk}
            />
          )}
        </div>
        <ResearchChatPanel
          projectId={projectId}
          projectTitle={project.title}
          subject={project.subject}
          sources={sourcesMini}
          activeSourceId={activeId}
          currentPage={currentPage}
          onJump={handleJump}
        />
      </div>
      {showAdd && (
        <AddSourceDialog
          projectId={projectId}
          onClose={() => setShowAdd(false)}
          onAdded={() => refetchSources()}
        />
      )}
    </div>
  );
}
