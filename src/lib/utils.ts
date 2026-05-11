import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return d.toLocaleDateString();
}

export function chunkContent(content: string, maxChars = 14000): string {
  if (content.length <= maxChars) return content;
  const slice = content.substring(0, maxChars);
  const lastBreak = slice.lastIndexOf("\n\n");
  return (
    slice.substring(0, lastBreak > maxChars * 0.6 ? lastBreak : maxChars) +
    "\n\n[Content continues — first section shown]"
  );
}

export function safeParseJSON<T>(raw: string, fallback: T): T {
  try {
    const clean = raw
      .replace(/^```json\s*/im, "")
      .replace(/^```\s*/im, "")
      .replace(/```\s*$/im, "")
      .trim();
    return JSON.parse(clean) as T;
  } catch {
    return fallback;
  }
}
