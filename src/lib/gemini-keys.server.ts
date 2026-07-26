// Server-only: Gemini API key pool with rate-limit-aware rotation.
// Sources, merged & de-duped:
//   1. Env vars GEMINI_API_KEY plus GEMINI_API_KEY_2 … GEMINI_API_KEY_10
//   2. Admin-pasted keys in the `api_providers` table (provider='gemini',
//      enabled=true) — loaded via the service-role key when available.
import { createClient } from "@supabase/supabase-js";

type KeyState = {
  key: string;
  label: string;
  callsThisMinute: number;
  lastMinuteReset: number;
  blockedUntil: number;
};

let pool: KeyState[] = [];
let envLoaded = false;
let lastDbRefresh = 0;
const DB_REFRESH_MS = 60_000; // re-read admin keys at most once a minute

/** Google issues more than one valid key shape for the Gemini API: classic AI
 *  Studio keys (`AIza…`) and project keys (`AQ.…`). Both authenticate, so we
 *  only reject empties/placeholders rather than guessing at a format. */
function looksLikeApiKey(v: string) {
  return v.length >= 20 && !/\s/.test(v);
}

function addKey(key: string, label: string) {
  const v = (key ?? "").trim();
  if (!v) return;
  if (pool.some((k) => k.key === v)) return;
  if (!looksLikeApiKey(v)) {
    console.warn(`[gemini-keys] Ignoring ${label}: does not look like an API key.`);
    return;
  }
  pool.push({ key: v, label, callsThisMinute: 0, lastMinuteReset: Date.now(), blockedUntil: 0 });
}

function loadEnv() {
  if (envLoaded) return;
  envLoaded = true;
  const raw = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
    process.env.GEMINI_API_KEY_5,
    process.env.GEMINI_API_KEY_6,
    process.env.GEMINI_API_KEY_7,
    process.env.GEMINI_API_KEY_8,
    process.env.GEMINI_API_KEY_9,
    process.env.GEMINI_API_KEY_10,
  ];
  raw.forEach((k, i) => addKey(k ?? "", `Env key ${i + 1}`));
}

/** Fire-and-forget: pull enabled gemini keys pasted in the admin tab. Needs
 *  the service-role key (server-only). Throttled to once per minute. */
function refreshFromDb() {
  const now = Date.now();
  if (now - lastDbRefresh < DB_REFRESH_MS) return;
  lastDbRefresh = now;
  const url = process.env.SUPABASE_URL;
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !svc) return; // admin keys require a service-role key to read securely
  const supa = createClient(url, svc, { auth: { persistSession: false } });
  supa
    .from("api_providers")
    .select("name, api_key, enabled, provider")
    .eq("provider", "gemini")
    .eq("enabled", true)
    .then(({ data }) => {
      for (const row of data ?? []) addKey((row as any).api_key, `Admin: ${(row as any).name}`);
    });
}

export function hasGeminiKeys(): boolean {
  loadEnv();
  refreshFromDb();
  return pool.length > 0;
}

export function pickGeminiKey(): KeyState | null {
  loadEnv();
  refreshFromDb();
  const now = Date.now();
  if (pool.length === 0) return null;
  for (const k of pool) {
    if (now - k.lastMinuteReset > 60_000) {
      k.callsThisMinute = 0;
      k.lastMinuteReset = now;
    }
  }
  const available = pool.filter((k) => k.blockedUntil <= now && k.callsThisMinute < 15);
  if (available.length === 0) return null;
  const best = available.reduce((a, b) => (a.callsThisMinute <= b.callsThisMinute ? a : b));
  best.callsThisMinute += 1;
  return best;
}

export function blockGeminiKey(key: string, durationMs = 60_000) {
  const k = pool.find((x) => x.key === key);
  if (k) k.blockedUntil = Date.now() + durationMs;
}
