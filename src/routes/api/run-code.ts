import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/run-code")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { language: string; version: string; code: string; stdin?: string };
          if (!body?.language || !body?.code) {
            return Response.json({ ok: false, error: "Missing language or code" }, { status: 400 });
          }
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
          if (!r.ok) {
            const txt = await r.text().catch(() => "");
            return Response.json({ ok: false, error: `Sandbox ${r.status}: ${txt.slice(0, 300)}` }, { status: 502 });
          }
          const j = (await r.json()) as { run?: { stdout?: string; stderr?: string }; compile?: { stderr?: string } };
          const out =
            (j.run?.stdout ?? "") +
            (j.run?.stderr ? `\n[stderr]\n${j.run.stderr}` : "") +
            (j.compile?.stderr ? `\n[compile]\n${j.compile.stderr}` : "");
          return Response.json({ ok: true, output: out || "(no output)" });
        } catch (e: any) {
          return Response.json({ ok: false, error: e?.message ?? "Run failed" }, { status: 500 });
        }
      },
    },
  },
});
