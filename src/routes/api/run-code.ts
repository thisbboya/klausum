import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { generateText } from "ai";
import { getUserIdFromToken } from "@/lib/server-auth";
import { resolveModel, DEFAULT_MODEL } from "@/lib/ai-gateway";

// Judge0 CE language IDs (RapidAPI hosted) keyed by the codelab "piston" id.
const JUDGE0_LANG_MAP: Record<string, number> = {
  python: 71,         // Python 3.8.1
  javascript: 63,     // JavaScript Node.js 12.14.0
  typescript: 74,     // TypeScript 3.7.4
  java: 62,           // Java OpenJDK 13.0.1
  "c++": 54,          // C++ GCC 9.2.0
  c: 50,              // C GCC 9.2.0
  go: 60,             // Go 1.13.5
  rust: 73,           // Rust 1.40.0
  octave: 66,         // GNU Octave 5.1.0 (MATLAB-compatible)
};

async function simulateWithAI(language: string, code: string, stdin: string): Promise<string> {
  const { text } = await generateText({
    model: resolveModel(DEFAULT_MODEL),
    prompt:
      `Act as a ${language} interpreter. Execute this program mentally and return ONLY the stdout ` +
      `it would produce. No commentary, no markdown fences, no explanations — just the raw output. ` +
      `If the program would crash, output the error message exactly as the runtime would print it.\n\n` +
      `--- stdin ---\n${stdin || "(empty)"}\n--- code ---\n${code}\n--- end ---`,
  });
  return text.trim();
}

export const Route = createFileRoute("/api/run-code")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            language?: string;
            version?: string;
            code?: string;
            stdin?: string;
            accessToken?: string;
          };
          if (!body?.accessToken) {
            return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
          }
          try {
            await getUserIdFromToken(body.accessToken);
          } catch {
            return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
          }
          if (!body?.language || !body?.code) {
            return Response.json({ ok: false, error: "Missing language or code" }, { status: 400 });
          }
          if (typeof body.code !== "string" || body.code.length > 100_000) {
            return Response.json({ ok: false, error: "Code too large" }, { status: 413 });
          }

          // 1) Try Piston (real sandbox) first — still works for whitelisted callers.
          const t0 = Date.now();
          let realOk = false;
          let realStdout = "";
          let realStderr = "";
          let realExit = 0;
          let realEngine: "piston" | "judge0" = "piston";
          try {
            const r = await fetch("https://emkc.org/api/v2/piston/execute", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                language: body.language,
                version: body.version,
                files: [{ content: body.code }],
                stdin: body.stdin ?? "",
              }),
            });
            if (r.ok) {
              const j = (await r.json()) as { run?: { stdout?: string; stderr?: string; code?: number }; compile?: { stderr?: string; code?: number } };
              realStdout = j.run?.stdout ?? "";
              realStderr = [j.compile?.stderr, j.run?.stderr].filter(Boolean).join("\n");
              realExit = j.run?.code ?? j.compile?.code ?? 0;
              realOk = true;
            }
          } catch { /* fall through */ }

          // 2) Try Judge0 CE via RapidAPI if Piston failed and a key is configured.
          const judge0Key = process.env.JUDGE0_RAPIDAPI_KEY;
          if (!realOk && judge0Key) {
            try {
              const langId = JUDGE0_LANG_MAP[body.language!];
              if (langId) {
                const submit = await fetch(
                  "https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=false&wait=true",
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "X-RapidAPI-Key": judge0Key,
                      "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
                    },
                    body: JSON.stringify({
                      source_code: body.code,
                      language_id: langId,
                      stdin: body.stdin ?? "",
                    }),
                  },
                );
                if (submit.ok) {
                  const j = (await submit.json()) as {
                    stdout?: string | null;
                    stderr?: string | null;
                    compile_output?: string | null;
                    message?: string | null;
                    status?: { id?: number };
                  };
                  realStdout = j.stdout ?? "";
                  realStderr = [j.compile_output, j.stderr, (!j.stdout && !j.stderr ? j.message : null)].filter(Boolean).join("\n");
                  realExit = j.status?.id && j.status.id > 3 ? 1 : 0;
                  realOk = true;
                  realEngine = "judge0";
                }
              }
            } catch (e) {
              console.error("[run-code] Judge0 failed:", e);
            }
          }

          const executionTimeMs = Date.now() - t0;
          if (realOk) {
            return Response.json({
              ok: true,
              stdout: realStdout,
              stderr: realStderr,
              exitCode: realExit,
              engine: realEngine,
              method: realEngine,
              executionTimeMs,
              output: (realStdout || "") + (realStderr ? `\n[stderr]\n${realStderr}` : ""),
            });
          }

          // Fallback: AI-simulated execution (Piston is whitelist-only since Feb 2026)
          try {
            const out = await simulateWithAI(body.language, body.code, body.stdin ?? "");
            return Response.json({
              ok: true,
              stdout: out,
              stderr: "",
              exitCode: 0,
              engine: "ai",
              method: "gemini-simulation",
              executionTimeMs: Date.now() - t0,
              output: `[AI simulator — sandbox unavailable]\n${out || "(no output)"}`,
            });
          } catch (e: any) {
            console.error("[run-code] AI fallback failed:", e);
            return Response.json(
              { ok: false, error: "Sandbox unavailable. Please try again later." },
              { status: 502 },
            );
          }
        } catch (e: any) {
          console.error("[run-code] failed:", e);
          return Response.json({ ok: false, error: "Run failed" }, { status: 500 });
        }
      },
    },
  },
});
