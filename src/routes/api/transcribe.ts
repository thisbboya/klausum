import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { getUserIdFromToken } from "@/lib/server-auth";

// POST audio (multipart/form-data, field "audio") -> { text }
// Uses Gemini directly (GEMINI_API_KEY) if available, else Lovable AI Gateway.
export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const form = await request.formData();
          const token = form.get("accessToken");
          if (typeof token !== "string" || !token) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
          }
          try {
            await getUserIdFromToken(token);
          } catch {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
          }
          const file = form.get("audio");
          if (!(file instanceof File)) {
            return new Response(JSON.stringify({ error: "Missing audio file" }), { status: 400 });
          }
          if (file.size > 25 * 1024 * 1024) {
            return new Response(JSON.stringify({ error: "Audio too large (max 25 MB)" }), { status: 413 });
          }
          const buf = new Uint8Array(await file.arrayBuffer());
          // base64 encode in chunks to avoid arg limits
          let bin = "";
          const CHUNK = 8192;
          for (let i = 0; i < buf.length; i += CHUNK) {
            bin += String.fromCharCode.apply(null, Array.from(buf.subarray(i, Math.min(i + CHUNK, buf.length))));
          }
          const b64 = btoa(bin);
          const mimeType = file.type || "audio/webm";

          const gemKey = process.env.GEMINI_API_KEY;
          if (!gemKey) {
            return new Response(JSON.stringify({ error: "Transcription requires GEMINI_API_KEY" }), { status: 500 });
          }

          const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${gemKey}`;
          const r = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { text: "Transcribe this audio verbatim. Return ONLY the transcript text, no preamble, no formatting." },
                  { inline_data: { mime_type: mimeType, data: b64 } },
                ],
              }],
              generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
            }),
          });
          if (!r.ok) {
            const t = await r.text();
            console.error(`[transcribe] upstream ${r.status}: ${t}`);
            return new Response(JSON.stringify({ error: "Transcription temporarily unavailable" }), { status: 502 });
          }
          const j: any = await r.json();
          const text = j?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join(" ").trim() ?? "";
          return Response.json({ text });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e?.message ?? "Transcription failed" }), { status: 500 });
        }
      },
    },
  },
});
