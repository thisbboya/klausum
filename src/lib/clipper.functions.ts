import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({ url: z.string().url().max(2048) });

/**
 * Fetches a public URL server-side (bypassing CORS) and returns cleaned text
 * plus a page title. Used by the Web Clipper to seed a study material.
 */
export const fetchWebClip = createServerFn({ method: "POST" })
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data }) => {
    const parsed = new URL(data.url);
    if (!/^https?:$/.test(parsed.protocol)) throw new Error("Only http(s) URLs allowed");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let html = "";
    try {
      const res = await fetch(parsed.toString(), {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; KlausumClipper/1.0)",
          "Accept": "text/html,application/xhtml+xml",
        },
      });
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("html") && !ct.includes("text")) throw new Error("URL is not a text/HTML page");
      html = await res.text();
    } finally {
      clearTimeout(timeout);
    }

    // Extract <title>
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/\s+/g, " ").trim().slice(0, 300) : parsed.hostname;

    // Strip scripts/styles then tags
    const stripped = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();

    return { title, text: stripped.slice(0, 60000), url: parsed.toString() };
  });
