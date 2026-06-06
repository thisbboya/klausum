import { FileText, Globe, Type, Youtube, StickyNote, Plus, Trash2, Loader2, AlertTriangle, CheckCircle2, RotateCcw, AlertCircle } from "lucide-react";

export interface SourceItem {
  id: string;
  title: string;
  source_type: "pdf" | "url" | "text" | "youtube" | "note";
  processing_done: boolean;
  processing_error?: string | null;
  file_url?: string | null;
  file_path?: string | null;
  page_count?: number | null;
  raw_url?: string | null;
}

interface Props {
  sources: SourceItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onRetry?: (id: string) => void;
}

const ICONS: Record<SourceItem["source_type"], any> = {
  pdf: FileText,
  url: Globe,
  text: Type,
  youtube: Youtube,
  note: StickyNote,
};

function uploadFailed(s: SourceItem): boolean {
  return s.source_type === "pdf" && !s.file_path && !s.file_url;
}

export function SourcesPanel({ sources, activeId, onSelect, onAdd, onDelete, onRetry }: Props) {
  return (
    <div className="flex flex-col h-full bg-card border-r border-border">
      <div className="p-3 border-b border-border">
        <button
          onClick={onAdd}
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold py-2 hover:opacity-90 active:scale-95 transition"
        >
          <Plus className="h-3.5 w-3.5" /> Add Source
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {sources.length === 0 && (
          <p className="text-xs text-muted-foreground text-center px-3 py-6">
            No sources yet. Add a PDF, URL, YouTube video, or paste text to begin.
          </p>
        )}
        {sources.map((s) => {
          const Icon = ICONS[s.source_type] ?? FileText;
          const active = s.id === activeId;
          const isUploadFail = uploadFailed(s);
          const isProcessing = !isUploadFail && !s.processing_done && !s.processing_error;
          const isAiError = !isUploadFail && !!s.processing_error;
          return (
            <div
              key={s.id}
              className={`group flex items-start gap-2 rounded-lg px-2.5 py-2 cursor-pointer transition ${
                active
                  ? "bg-primary/15 border border-primary/40"
                  : "border border-transparent hover:bg-accent/10"
              }`}
              onClick={() => onSelect(s.id)}
            >
              <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className={`text-sm leading-tight truncate ${active ? "text-foreground font-medium" : "text-foreground"}`}>
                  {s.title}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  {isUploadFail ? (
                    <span className="inline-flex items-center gap-1 text-[10px] text-destructive">
                      <AlertCircle className="h-2.5 w-2.5" /> Upload failed
                    </span>
                  ) : isProcessing ? (
                    <span className="inline-flex items-center gap-1 text-[10px] text-amber-500">
                      <Loader2 className="h-2.5 w-2.5 animate-spin" /> Processing
                    </span>
                  ) : isAiError ? (
                    <>
                      <span
                        className="inline-flex items-center gap-1 text-[10px] text-amber-500"
                        title={s.processing_error ?? ""}
                      >
                        <AlertTriangle className="h-2.5 w-2.5" /> AI Error
                      </span>
                      {onRetry && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRetry(s.id);
                          }}
                          className="inline-flex items-center gap-0.5 text-[10px] text-primary hover:underline"
                        >
                          <RotateCcw className="h-2.5 w-2.5" /> Retry
                        </button>
                      )}
                    </>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-500">
                      <CheckCircle2 className="h-2.5 w-2.5" /> Ready
                    </span>
                  )}
                  {s.page_count ? (
                    <span className="text-[10px] text-muted-foreground">· {s.page_count}p</span>
                  ) : null}
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Delete "${s.title}"?`)) onDelete(s.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-destructive transition shrink-0"
                aria-label="Delete source"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
