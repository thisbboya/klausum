import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { generateText } from "ai";
import { getUserIdFromToken } from "@/lib/server-auth";
import { resolveModel, DEFAULT_MODEL } from "@/lib/ai-gateway";

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
          let realOk = false;
          let realOut = "";
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
              const j = (await r.json()) as { run?: { stdout?: string; stderr?: string }; compile?: { stderr?: string } };
              realOut =
                (j.run?.stdout ?? "") +
                (j.run?.stderr ? `\n[stderr]\n${j.run.stderr}` : "") +
                (j.compile?.stderr ? `\n[compile]\n${j.compile.stderr}` : "");
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
                  };
                  realOut =
                    (j.stdout ?? "") +
                    (j.stderr ? `\n[stderr]\n${j.stderr}` : "") +
                    (j.compile_output ? `\n[compile]\n${j.compile_output}` : "") +
                    (j.message && !j.stdout && !j.stderr ? `\n[message]\n${j.message}` : "");
                  realOk = true;
                  realEngine = "judge0";
                }
              }
            } catch (e) {
              console.error("[run-code] Judge0 failed:", e);
            }
          }

          if (realOk) {
            return Response.json({ ok: true, output: realOut || "(no output)", engine: realEngine });
          }

          // Fallback: AI-simulated execution (Piston is whitelist-only since Feb 2026)
          try {
            const out = await simulateWithAI(body.language, body.code, body.stdin ?? "");
            return Response.json({
              ok: true,
              output: `[AI simulator — sandbox unavailable]\n${out || "(no output)"}`,
              engine: "ai",
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
