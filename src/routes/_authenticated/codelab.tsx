import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import { useServerFn } from "@tanstack/react-start";
import { debugCode, generateTests, explainCode } from "@/lib/lab.functions";
import { getAccessToken } from "@/lib/auth-helper";
import { toast } from "sonner";
import { Play, Sparkles, Loader2, FlaskConical, BookOpen, Copy, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { SnippetsRail, type Snippet } from "@/components/codelab/SnippetsRail";
import { EngineeringCalculators } from "@/components/codelab/EngineeringCalculators";
import { parseErrorLine } from "@/lib/parseErrorLine";

export const Route = createFileRoute("/_authenticated/codelab")({ component: CodeLab });

const LANGS = [
  { id: "python", piston: "python", version: "3.10.0", sample: 'print("Hello, Klausum")\n' },
  { id: "javascript", piston: "javascript", version: "18.15.0", sample: 'console.log("Hello, Klausum")\n' },
  { id: "typescript", piston: "typescript", version: "5.0.3", sample: 'const x: string = "Hello"; console.log(x);\n' },
  { id: "java", piston: "java", version: "15.0.2", sample: 'public class Main { public static void main(String[] a) { System.out.println("Hello"); } }\n' },
  { id: "cpp", piston: "c++", version: "10.2.0", sample: '#include <iostream>\nint main(){ std::cout << "Hello"; }\n' },
  { id: "c", piston: "c", version: "10.2.0", sample: '#include <stdio.h>\nint main(){ printf("Hello"); return 0; }\n' },
  { id: "go", piston: "go", version: "1.16.2", sample: 'package main\nimport "fmt"\nfunc main(){ fmt.Println("Hello") }\n' },
  { id: "rust", piston: "rust", version: "1.68.2", sample: 'fn main(){ println!("Hello"); }\n' },
  { id: "octave", piston: "octave", version: "5.1.0", sample: '% GNU Octave (MATLAB-compatible)\nA = [1 2; 3 4];\nB = [5 6; 7 8];\ndisp(A * B)\ndisp("Eigenvalues:")\ndisp(eig(A))\n' },
];

type ExecutionResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  method: "piston" | "judge0" | "gemini-simulation";
  executionTimeMs?: number;
};

type AIResult =
  | { kind: "debug"; reply: string }
  | { kind: "tests"; framework: string; tests: string; notes: string }
  | { kind: "explain"; summary: string; line_by_line: { lines: string; explanation: string }[]; complexity: string; suggestions: string[] };

function CodeLab() {
  const [lang, setLang] = useState(LANGS[0]);
  const [code, setCode] = useState(LANGS[0].sample);
  const [stdin, setStdin] = useState("");
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [running, setRunning] = useState(false);
  const [aiBusy, setAiBusy] = useState<null | "debug" | "tests" | "explain">(null);
  const [ai, setAi] = useState<AIResult | null>(null);
  const [question, setQuestion] = useState("");
  const [proactiveHelp, setProactiveHelp] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const lastAnalyzedError = useRef<string | null>(null);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);

  const debug = useServerFn(debugCode);
  const tests = useServerFn(generateTests);
  const explain = useServerFn(explainCode);

  function changeLang(id: string) {
    const l = LANGS.find((x) => x.id === id)!;
    setLang(l);
    setCode(l.sample);
    setResult(null);
    setAi(null);
    setProactiveHelp(null);
    clearMarkers();
  }

  function loadSnippet(s: Snippet) {
    const l = LANGS.find((x) => x.id === s.language) ?? LANGS[0];
    setLang(l);
    setCode(s.code);
    setResult(null);
    setAi(null);
    setProactiveHelp(null);
    clearMarkers();
    toast.success(`Loaded "${s.title}"`);
  }

  function clearMarkers() {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    const model = editor.getModel();
    if (model) monaco.editor.setModelMarkers(model, "klausum-runtime", []);
  }

  function applyErrorMarker(stderr: string, langId: string) {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    const model = editor.getModel();
    if (!model) return;
    const parsed = parseErrorLine(stderr, langId);
    if (parsed.line === null) {
      monaco.editor.setModelMarkers(model, "klausum-runtime", []);
      return;
    }
    monaco.editor.setModelMarkers(model, "klausum-runtime", [{
      startLineNumber: parsed.line,
      endLineNumber: parsed.line,
      startColumn: 1,
      endColumn: model.getLineMaxColumn(parsed.line),
      message: parsed.message,
      severity: monaco.MarkerSeverity.Error,
    }]);
    editor.revealLineInCenter(parsed.line);
  }

  async function run() {
    setRunning(true);
    setResult(null);
    setProactiveHelp(null);
    clearMarkers();
    try {
      const accessToken = await getAccessToken();
      const r = await fetch("/api/run-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: lang.piston, version: lang.version, code, stdin, accessToken }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error ?? `Sandbox ${r.status}`);
      const res: ExecutionResult = {
        stdout: j.stdout ?? "",
        stderr: j.stderr ?? "",
        exitCode: j.exitCode ?? 0,
        method: j.method ?? j.engine ?? "piston",
        executionTimeMs: j.executionTimeMs,
      };
      setResult(res);
      if (res.stderr) applyErrorMarker(res.stderr, lang.id);
    } catch (e: any) {
      setResult({ stdout: "", stderr: e?.message ?? "Execution failed", exitCode: 1, method: "piston" });
      toast.error("Sandbox busy — try again or use the AI tools");
    } finally {
      setRunning(false);
    }
  }

  // Proactive AI tutor: auto-explain any stderr, once per unique error
  useEffect(() => {
    if (!result?.stderr) {
      setProactiveHelp(null);
      return;
    }
    if (result.stderr === lastAnalyzedError.current) return;
    lastAnalyzedError.current = result.stderr;

    (async () => {
      setAnalyzing(true);
      setProactiveHelp(null);
      try {
        const accessToken = await getAccessToken();
        const r = await debug({
          data: {
            accessToken,
            language: lang.id,
            code,
            output: result.stderr,
            question:
              "Explain this error in ONE short, friendly paragraph (max 40 words). Identify the exact bug and give the corrected line if it's a simple fix. Format: \"Looks like a [ErrorType] — [plain explanation]. Try: `[fix]`\"",
          },
        });
        setProactiveHelp(r.reply.trim());
      } catch {
        setProactiveHelp("I couldn't analyze this error automatically, but you can ask me about it below.");
      } finally {
        setAnalyzing(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result?.stderr]);

  async function runDebug() {
    setAiBusy("debug");
    try {
      const accessToken = await getAccessToken();
      const combinedOutput = [result?.stdout, result?.stderr].filter(Boolean).join("\n");
      const r = await debug({ data: { accessToken, language: lang.id, code, output: combinedOutput, question } });
      setAi({ kind: "debug", reply: r.reply });
      setQuestion("");
    } catch (e: any) { toast.error(e.message ?? "AI failed"); }
    finally { setAiBusy(null); }
  }
  async function runTests() {
    setAiBusy("tests");
    try {
      const accessToken = await getAccessToken();
      const r = await tests({ data: { accessToken, language: lang.id, code } });
      setAi({ kind: "tests", ...r });
    } catch (e: any) { toast.error(e.message ?? "AI failed"); }
    finally { setAiBusy(null); }
  }
  async function runExplain() {
    setAiBusy("explain");
    try {
      const accessToken = await getAccessToken();
      const r = await explain({ data: { accessToken, language: lang.id, code } });
      setAi({ kind: "explain", ...r });
    } catch (e: any) { toast.error(e.message ?? "AI failed"); }
    finally { setAiBusy(null); }
  }

  const hasError = !!result && (result.exitCode !== 0 || result.stderr.length > 0);
  const busy = running || !!aiBusy;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Code Lab</h1>
          <p className="text-sm text-muted-foreground">Run code · save snippets · AI tests, explain &amp; debug · engineering tools.</p>
        </div>
        <select value={lang.id} onChange={(e) => changeLang(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
          {LANGS.map((l) => <option key={l.id} value={l.id}>{l.id}</option>)}
        </select>
      </header>

      <div className="flex flex-col md:flex-row gap-4">
        <SnippetsRail currentLang={lang.id} currentCode={code} onLoad={loadSnippet} />

        <div className="flex-1 min-w-0 space-y-4">
          <div className="rounded-xl border border-border/60 overflow-hidden">
            <Editor
              height="380px"
              language={lang.id === "cpp" ? "cpp" : lang.id}
              value={code}
              onChange={(v) => { setCode(v ?? ""); clearMarkers(); }}
              onMount={(editor, monaco) => { editorRef.current = editor; monacoRef.current = monaco; }}
              theme="vs-dark"
              options={{ fontSize: 13, minimap: { enabled: false }, scrollBeyondLastLine: false, tabSize: 2 }}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={run} disabled={busy} className="inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              {running ? <><Loader2 className="h-4 w-4 animate-spin" /> Running…</> : <><Play className="h-4 w-4" /> Run</>}
            </button>
            <button onClick={runExplain} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary disabled:opacity-50">
              {aiBusy === "explain" ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />} Explain
            </button>
            <button onClick={runTests} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary disabled:opacity-50">
              {aiBusy === "tests" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />} Generate tests
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase text-muted-foreground">stdin</label>
              <textarea value={stdin} onChange={(e) => setStdin(e.target.value)} className="mt-1 w-full min-h-20 rounded-lg border border-border bg-background p-2 font-mono text-xs" placeholder="(optional input)" />
            </div>
            <div>
              <label className="text-xs uppercase text-muted-foreground">Output</label>
              <OutputPanel result={result} isRunning={running} />
            </div>
          </div>

          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Sparkles className="h-4 w-4" /> AI Tutor
            </div>

            {analyzing && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground animate-in fade-in">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Looking at your error…
              </div>
            )}
            {proactiveHelp && !analyzing && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 flex gap-2 animate-in fade-in slide-in-from-top-1">
                <span className="text-lg leading-none">💡</span>
                <p className="text-sm whitespace-pre-wrap">{proactiveHelp}</p>
              </div>
            )}

            <div className="flex gap-2">
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !aiBusy && question.trim()) runDebug(); }}
                placeholder={hasError ? "Ask about this error…" : "What's wrong? Or: explain my output…"}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
              <button onClick={runDebug} disabled={busy || !question.trim()} className="inline-flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary disabled:opacity-50 shrink-0">
                {aiBusy === "debug" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Ask
              </button>
            </div>

            {ai?.kind === "debug" && (
              <div className="rounded-lg border border-border/40 bg-background/40 p-3 text-sm whitespace-pre-wrap">{ai.reply}</div>
            )}
            {ai?.kind === "explain" && (
              <div className="space-y-3">
                <div className="rounded-lg border border-border/40 bg-background/40 p-3">
                  <div className="text-xs uppercase text-muted-foreground mb-1">Summary</div>
                  <p className="text-sm">{ai.summary}</p>
                  <div className="mt-2 text-xs"><span className="text-muted-foreground">Complexity:</span> <span className="font-mono text-primary">{ai.complexity}</span></div>
                </div>
                <div className="rounded-lg border border-border/40 bg-background/40 p-3 space-y-2">
                  <div className="text-xs uppercase text-muted-foreground">Walkthrough</div>
                  {ai.line_by_line.map((s, i) => (
                    <div key={i} className="border-l-2 border-primary/40 pl-3">
                      <div className="text-[11px] font-mono text-primary">Lines {s.lines}</div>
                      <p className="text-sm">{s.explanation}</p>
                    </div>
                  ))}
                </div>
                {ai.suggestions.length > 0 && (
                  <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
                    <div className="text-xs uppercase text-amber-400 mb-1">Suggestions</div>
                    <ul className="text-sm space-y-1 list-disc pl-5">{ai.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul>
                  </div>
                )}
              </div>
            )}
            {ai?.kind === "tests" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs"><span className="text-muted-foreground">Framework:</span> <span className="font-mono text-primary">{ai.framework}</span></div>
                  <button onClick={() => { navigator.clipboard.writeText(ai.tests); toast.success("Copied"); }} className="inline-flex items-center gap-1 text-xs text-primary hover:underline"><Copy className="h-3 w-3" /> Copy</button>
                </div>
                <pre className="max-h-80 overflow-auto rounded-lg border border-border bg-background p-3 font-mono text-xs whitespace-pre-wrap">{ai.tests}</pre>
                <p className="text-xs text-muted-foreground italic">{ai.notes}</p>
                <button onClick={() => { setCode(code + "\n\n// --- TESTS ---\n" + ai.tests); toast.success("Appended to editor"); }} className="text-xs text-primary hover:underline">Append to editor →</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <EngineeringCalculators />
    </div>
  );
}

function OutputPanel({ result, isRunning }: { result: ExecutionResult | null; isRunning: boolean }) {
  if (isRunning) {
    return (
      <div className="mt-1 min-h-20 rounded-lg border border-border bg-background p-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Running…
      </div>
    );
  }
  if (!result) {
    return <pre className="mt-1 min-h-20 rounded-lg border border-border bg-background p-2 font-mono text-xs text-muted-foreground">—</pre>;
  }
  const hasError = result.exitCode !== 0 || result.stderr.length > 0;
  return (
    <div className="mt-1 space-y-2">
      <div className={`flex items-center gap-2 text-xs font-semibold ${hasError ? "text-red-400" : "text-emerald-400"}`}>
        {hasError ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
        {hasError
          ? <>Execution failed{result.exitCode ? ` (exit ${result.exitCode})` : ""}</>
          : <>Ran successfully{result.executionTimeMs ? ` in ${result.executionTimeMs}ms` : ""}</>}
        {result.method === "gemini-simulation" && (
          <span className="ml-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] text-primary">✨ AI-simulated</span>
        )}
      </div>

      {result.stdout && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5">
          <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-emerald-400 border-b border-emerald-500/20">Output</div>
          <pre className="max-h-40 overflow-auto p-2 font-mono text-xs text-emerald-200 whitespace-pre-wrap">{result.stdout}</pre>
        </div>
      )}

      {result.stderr && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/5">
          <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-red-400 border-b border-red-500/20 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Error
          </div>
          <pre className="max-h-40 overflow-auto p-2 font-mono text-xs text-red-200 whitespace-pre-wrap">{result.stderr}</pre>
        </div>
      )}

      {!result.stdout && !result.stderr && (
        <div className="rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground italic">
          Code ran with no output. Add a print / console.log to see results.
        </div>
      )}
    </div>
  );
}
