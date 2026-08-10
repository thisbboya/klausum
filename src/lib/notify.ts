// Drop-in replacement for sonner's `toast`, so every existing call site keeps
// working — but errors now pass through one sanitising choke point.
//
// The rule this file enforces:
//   toast.error(anything)  ->  student sees a calm, human sentence
//                          ->  the real text lands in app_error_logs (admins only)
//
// Because the sanitising happens HERE and not at 117 call sites, a future
// `toast.error(e.message)` cannot regress it.
import { dismissNotification, pushNotification } from "@/components/notify";
import { friendlyMessage, reportError } from "@/lib/report-error";

// `icon` is accepted-and-ignored: several call sites passed a sonner icon, and
// this system draws its own variant icon.
type Opts = {
  description?: string;
  duration?: number;
  id?: number;
  icon?: unknown;
};

/** Anything that looks like machinery rather than a sentence a student wrote. */
function looksTechnical(text: string): boolean {
  return (
    text.length > 140 ||
    /\bat\s+\w+\s*\(|\.tsx?:\d+|<!DOCTYPE|\{"|PGRST|SQLSTATE|TypeError|ReferenceError|fetch failed|ECONN|supabase|gemini|api[_ -]?key/i.test(
      text,
    ) ||
    /^[A-Z_]+:/.test(text) // RATE_LIMIT:…, AI_APICallError:…
  );
}

/** Bare `toast("…")` — a neutral message, same as sonner's default call form. */
function base(title: string, o?: Opts): number {
  return pushNotification({
    variant: "info",
    title,
    description: o?.description,
    duration: o?.duration ?? 4200,
  });
}

export const toast = Object.assign(base, {
  success(title: string, o?: Opts) {
    return pushNotification({
      variant: "success",
      title,
      description: o?.description,
      duration: o?.duration ?? 3800,
    });
  },

  info(title: string, o?: Opts) {
    return pushNotification({
      variant: "info",
      title,
      description: o?.description,
      duration: o?.duration ?? 4200,
    });
  },

  warning(title: string, o?: Opts) {
    return pushNotification({
      variant: "warning",
      title,
      description: o?.description,
      duration: o?.duration ?? 5000,
    });
  },

  /**
   * `raw` may be a hand-written sentence ("Name and date required") or a raw
   * Error/technical string. Hand-written copy is shown as-is; anything technical is
   * logged for admins and replaced with a friendly line.
   */
  error(raw: unknown, o?: Opts) {
    const text = raw instanceof Error ? raw.message : String(raw ?? "");
    let title = text;
    if (raw instanceof Error || looksTechnical(text) || !text) {
      // reportError logs the full detail to app_error_logs and hands back copy
      // that is safe to show. Rate-limit notices come back verbatim on purpose.
      title = reportError("ui", raw);
    }
    return pushNotification({
      variant: "error",
      title: title || friendlyMessage(""),
      description: o?.description,
      duration: o?.duration ?? 6000,
    });
  },

  message(title: string, o?: Opts) {
    return toast.info(title, o);
  },

  dismiss(id?: number) {
    dismissNotification(id);
  },
});

export default toast;
