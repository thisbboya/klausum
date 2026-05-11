import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Upload, FileText, Loader2 } from "lucide-react";
import { processMaterial } from "@/lib/materials.functions";
import { useServerFn } from "@tanstack/react-start";
import { getAccessToken } from "@/lib/auth-helper";

export const Route = createFileRoute("/_authenticated/materials")({
  component: MaterialsPage,
});

function MaterialsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const processFn = useServerFn(processMaterial);
  const [uploading, setUploading] = useState(false);

  const { data: materials } = useQuery({
    queryKey: ["materials", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("study_materials")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function handleFile(file: File) {
    if (!user) return;
    if (file.size > 20 * 1024 * 1024) return toast.error("Max 20MB");
    setUploading(true);
    try {
      const isText = file.type.startsWith("text/") || /\.(txt|md)$/i.test(file.name);
      let text: string | undefined;
      let fileBase64: string | undefined;
      let mimeType: string | undefined;

      if (isText) {
        text = await file.text();
      } else {
        fileBase64 = await fileToBase64(file);
        mimeType = file.type || "application/pdf";
      }

      // Insert pending row first
      const { data: row, error: insertErr } = await supabase
        .from("study_materials")
        .insert({
          user_id: user.id,
          title: file.name.replace(/\.[^.]+$/, ""),
          subject: "General",
          original_content: text ?? `[binary file: ${file.name}]`,
          file_name: file.name,
          file_type: file.type,
          processing_status: "processing",
        })
        .select()
        .single();
      if (insertErr) throw insertErr;

      qc.invalidateQueries({ queryKey: ["materials"] });

      const accessToken = await getAccessToken();
      const result = await processFn({
        data: { accessToken, title: row.title, text, fileBase64, mimeType },
      });

      const { error: updateErr } = await supabase
        .from("study_materials")
        .update({
          ai_summary: result.summary,
          key_concepts: result.key_concepts,
          adapted_visual: result.visual,
          adapted_auditory: result.auditory,
          adapted_reading: result.reading,
          adapted_kinesthetic: result.kinesthetic,
          word_count: result.word_count,
          estimated_read_minutes: result.estimated_read_minutes,
          processing_status: "ready",
        })
        .eq("id", row.id);
      if (updateErr) throw updateErr;

      await supabase.rpc("increment_xp", { _amount: 25 });
      toast.success("Material ready");
      qc.invalidateQueries({ queryKey: ["materials"] });
      navigate({ to: "/materials/$id", params: { id: row.id } });
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Materials</h1>
          <p className="text-sm text-muted-foreground mt-1">Upload anything — we adapt it to your learning style.</p>
        </div>
      </header>

      <label className={`block rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition ${
        uploading ? "border-primary/40 bg-primary/5" : "border-border hover:border-primary/40 hover:bg-accent/5"
      }`}>
        <input
          type="file"
          className="hidden"
          accept=".pdf,.txt,.md,.doc,.docx,image/*"
          disabled={uploading}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
        {uploading ? (
          <>
            <Loader2 className="h-7 w-7 mx-auto text-primary animate-spin" />
            <p className="mt-3 text-sm">Processing with Gemini…</p>
            <p className="text-xs text-muted-foreground">This can take 20–60s for large PDFs.</p>
          </>
        ) : (
          <>
            <Upload className="h-7 w-7 mx-auto text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">Drop or click to upload</p>
            <p className="text-xs text-muted-foreground">PDF, TXT, MD, or images. Max 20MB.</p>
          </>
        )}
      </label>

      {materials && materials.length > 0 ? (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {materials.map((m) => (
            <li key={m.id}>
              <Link
                to="/materials/$id"
                params={{ id: m.id }}
                className="flex items-center gap-4 px-4 py-3 hover:bg-accent/10 transition"
              >
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{m.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {m.subject} · {new Date(m.created_at!).toLocaleDateString()}
                  </div>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">
                  {m.processing_status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-center text-sm text-muted-foreground py-8">No materials yet.</p>
      )}
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]); // strip data:...;base64,
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
