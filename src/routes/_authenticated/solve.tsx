import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { snapAndSolve, solveFollowup, type SolveResult } from "@/lib/solve.functions";
import { getAccessToken } from "@/lib/auth-helper";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Camera, Upload, Loader2, Send, Bookmark, RefreshCw, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

export const Route = createFileRoute("/_authenticated/solve")({ component: SolvePage });

function SolvePage() {
  const solveFn = useServerFn(snapAndSolve);
  const followupFn = useServerFn(solveFollowup);
  const { user } = useAuth();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<null | "read" | "solve">(null);
  const [result, setResult] = useState<SolveResult | null>(null);
  const [followupQ, setFollowupQ] = useState("");
  const [followups, setFollowups] = useState<{ q: string; a: string }[]>([]);
  const [followupBusy, setFollowupBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file) return;
    if (file.size > 4.5 * 1024 * 1024) {
      toast.error("Image must be under 4.5 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setPreviewUrl(dataUrl);
      const base64 = dataUrl.split(",")[1];
      setResult(null);
      setFollowups([]);
      setLoading("read");
      try {
        setTimeout(() => setLoading("solve"), 1500);
        const accessToken = await getAccessToken();
        const r = await solveFn({
          data: { accessToken, imageBase64: base64, mimeType: file.type || "image/jpeg" },
        });
        setResult(r);
      } catch (e: any) {
        toast.error(e?.message ?? "Could not read that image");
      } finally {
        setLoading(null);
      }
    };
    reader.readAsDataURL(file);
  }

  async function saveToBank() {
    if (!result || !user) return;
    const stepsText = result.steps
      .map((s) => `${s.step_number}. ${s.explanation}\n${s.work}`)
      .join("\n\n");
    const { error } = await supabase.from("question_bank").insert({
      user_id: user.id,
      question_text: result.problem_identified,
      answer_text: `${stepsText}\n\n**Final answer:** ${result.final_answer}`,
      subject: result.subject,
      source: "snap_solve",
      image_url: previewUrl,
      steps: result.steps,
    });
    if (error) toast.error(error.message);
    else toast.success("Saved to Question Bank");
  }

  async function askFollowup() {
    if (!result || !followupQ.trim()) return;
    setFollowupBusy(true);
    try {
      const accessToken = await getAccessToken();
      const r = await followupFn({
        data: {
          accessToken,
          problem: result.problem_identified,
          finalAnswer: result.final_answer,
          question: followupQ,
        },
      });
      setFollowups((prev) => [...prev, { q: followupQ, a: r.reply }]);
      setFollowupQ("");
    } catch (e: any) {
      toast.error(e?.message ?? "Follow-up failed");
    } finally {
      setFollowupBusy(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <Sparkles className="h-7 w-7 text-primary" /> Snap &amp; Solve
        </h1>
        <p className="text-sm text-muted-foreground">
          Snap a homework question. Get step-by-step working in seconds.
        </p>
      </header>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />

      {!previewUrl && (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => {
              if (fileRef.current) {
                fileRef.current.setAttribute("capture", "environment");
                fileRef.current.click();
              }
            }}
            className="rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 p-8 text-center transition"
          >
            <Camera className="h-10 w-10 mx-auto text-primary mb-2" />
            <div className="font-semibold">Take a photo</div>
            <div className="text-xs text-muted-foreground">Use your camera</div>
          </button>
          <button
            onClick={() => {
              if (fileRef.current) {
                fileRef.current.removeAttribute("capture");
                fileRef.current.click();
              }
            }}
            className="rounded-2xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/5 p-8 text-center transition"
          >
            <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <div className="font-semibold">Upload image</div>
            <div className="text-xs text-muted-foreground">From your device</div>
          </button>
        </div>
      )}

      {previewUrl && (
        <div className="space-y-4">
          <div className="relative rounded-xl overflow-hidden border border-border">
            <img src={previewUrl} alt="Problem" className="w-full max-h-72 object-contain bg-black/40" />
            <button
              onClick={() => {
                setPreviewUrl(null);
                setResult(null);
                setFollowups([]);
              }}
              className="absolute top-2 right-2 text-xs bg-background/90 border border-border rounded-full px-3 py-1 inline-flex items-center gap-1"
            >
              <RefreshCw className="h-3 w-3" /> New problem
            </button>
          </div>

          {loading && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-6 text-center space-y-2">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
              <div className="text-sm font-semibold text-primary">
                {loading === "read" ? "Reading your problem…" : "Solving…"}
              </div>
            </div>
          )}

          {result && !loading && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-card/60 p-4">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                  Problem · {result.subject}
                </div>
                <div className="text-sm font-medium">
                  <MDMath>{result.problem_identified}</MDMath>
                </div>
              </div>

              <ol className="space-y-3">
                {result.steps.map((s) => (
                  <li key={s.step_number} className="rounded-xl border border-border bg-card/40 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                        {s.step_number}
                      </span>
                      <div className="text-sm font-medium"><MDMath>{s.explanation}</MDMath></div>
                    </div>
                    <div className="pl-8 text-sm">
                      <MDMath>{`$$${s.work}$$`}</MDMath>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="rounded-xl border-2 border-amber-500/60 bg-amber-500/10 p-4">
                <div className="text-[10px] uppercase tracking-wide text-amber-500 font-bold mb-1">
                  Final answer · confidence {result.confidence}
                </div>
                <div className="text-lg font-semibold">
                  <MDMath>{`$$${result.final_answer}$$`}</MDMath>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={saveToBank}
                  className="inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                >
                  <Bookmark className="h-4 w-4" /> Save to Question Bank
                </button>
              </div>

              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                <div className="text-sm font-semibold text-primary">Ask a follow-up</div>
                {followups.map((f, i) => (
                  <div key={i} className="space-y-1">
                    <div className="text-xs text-muted-foreground">You: {f.q}</div>
                    <div className="rounded-lg border border-border/40 bg-background/50 p-3 text-sm">
                      <MDMath>{f.a}</MDMath>
                    </div>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input
                    value={followupQ}
                    onChange={(e) => setFollowupQ(e.target.value)}
                    placeholder="Why did we multiply here?"
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    onKeyDown={(e) => e.key === "Enter" && askFollowup()}
                  />
                  <button
                    onClick={askFollowup}
                    disabled={followupBusy || !followupQ.trim()}
                    className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    {followupBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MDMath({ children }: { children: string }) {
  return (
    <div className="prose prose-invert prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
