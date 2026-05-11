import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import Editor from "@monaco-editor/react";
import { useServerFn } from "@tanstack/react-start";
import { debugCode } from "@/lib/lab.functions";
import { getAccessToken } from "@/lib/auth-helper";
import { toast } from "sonner";
import { Play, Sparkles, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/codelab")({ component: CodeLab });

const LANGS = [
  { id: "python", piston: "python", version: "3.10.0", sample: 'print("Hello, NkyinkyimIQ")\n' },
  { id: "javascript", piston: "javascript", version: "18.15.0", sample: 'console.log("Hello, NkyinkyimIQ")\n' },
  { id: "typescript", piston: "typescript", version: "5.0.3", sample: 'const x: string = "Hello"; console.log(x);\n' },
  { id: "java", piston: "java", version: "15.0.2", sample: 'public class Main { public static void main(String[] a) { System.out.println("Hello"); } }\n' },
  { id: "cpp", piston: "c++", version: "10.2.0", sample: '#include <iostream>\nint main(){ std::cout << "Hello"; }\n' },
  { id: "c", piston: "c", version: "10.2.0", sample: '#include <stdio.h>\nint main(){ printf("Hello"); return 0; }\n' },
  { id: "go", piston: "go", version: "1.16.2", sample: 'package main\nimport "fmt"\nfunc main(){ fmt.Println("Hello") }\n' },
  { id: "rust", piston: "rust", version: "1.68.2", sample: 'fn main(){ println!("Hello"); }\n' },
];

function CodeLab() {
  const [lang, setLang] = useState(LANGS[0]);
  const [code, setCode] = useState(LANGS[0].sample);
  const [stdin, setStdin] = useState("");
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);
  const [askBusy, setAskBusy] = useState(false);
  const [aiReply, setAiReply] = useState("");
  const [question, setQuestion] = useState("");
  const debug = useServerFn(debugCode);

  function changeLang(id: string) {
    const l = LANGS.find((x) => x.id === id)!;
    setLang(l);
    setCode(l.sample);
    setOutput("");
  }

  async function run() {
    setRunning(true);
    setOutput("Running…");
    try {
      const r = await fetch("https://emkc.org/api/v2/piston/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: lang.piston,
          version: lang.version,
          files: [{ content: code }],
          stdin,
        }),
      });
      const j = await r.json();
      const out = (j.run?.stdout ?? "") + (j.run?.stderr ? `\n[stderr]\n${j.run.stderr}` : "") + (j.compile?.stderr ? `\n[compile]\n${j.compile.stderr}` : "");
      setOutput(out || "(no output)");
    } catch (e: any) {
      setOutput("Run failed: " + e.message);
    } finally {
      setRunning(false);
    }
  }

  async function askAI() {
    setAskBusy(true);
    try {
      const accessToken = await getAccessToken();
      const r = await debug({ data: { accessToken, language: lang.id, code, output, question } });
      setAiReply(r.reply);
    } catch (e: any) {
      toast.error(e.message ?? "AI failed");
    } finally {
      setAskBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Code Lab</h1>
          <p className="text-sm text-muted-foreground">Run code in 8 languages. Get Socratic AI debugging.</p>
        </div>
        <select value={lang.id} onChange={(e) => changeLang(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
          {LANGS.map((l) => <option key={l.id} value={l.id}>{l.id}</option>)}
        </select>
      </header>

      <div className="rounded-xl border border-border/60 overflow-hidden">
        <Editor
          height="380px"
          language={lang.id === "cpp" ? "cpp" : lang.id}
          value={code}
          onChange={(v) => setCode(v ?? "")}
          theme="vs-dark"
          options={{ fontSize: 13, minimap: { enabled: false }, scrollBeyondLastLine: false, tabSize: 2 }}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs uppercase text-muted-foreground">stdin</label>
          <textarea value={stdin} onChange={(e) => setStdin(e.target.value)} className="mt-1 w-full min-h-20 rounded-lg border border-border bg-background p-2 font-mono text-xs" placeholder="(optional input)" />
        </div>
        <div>
          <label className="text-xs uppercase text-muted-foreground">Output</label>
          <pre className="mt-1 min-h-20 max-h-48 overflow-auto rounded-lg border border-border bg-background p-2 font-mono text-xs whitespace-pre-wrap">{output || "—"}</pre>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={run} disabled={running} className="inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Run
        </button>
      </div>

      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          <Sparkles className="h-4 w-4" /> Ask AI tutor
        </div>
        <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="What's wrong? Or: explain my output…" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <button onClick={askAI} disabled={askBusy} className="inline-flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary disabled:opacity-50">
          {askBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Get hint
        </button>
        {aiReply && <div className="rounded-lg border border-border/40 bg-background/40 p-3 text-sm whitespace-pre-wrap">{aiReply}</div>}
      </div>
    </div>
  );
}
