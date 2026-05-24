// Server-only: Gemini API key pool with rate-limit-aware rotation.
// Supports GEMINI_API_KEY plus GEMINI_API_KEY_2 ... GEMINI_API_KEY_8.

type KeyState = {
  key: string;
  label: string;
  callsThisMinute: number;
  lastMinuteReset: number;
  blockedUntil: number;
};

let pool: KeyState[] | null = null;

function loadPool(): KeyState[] {
  if (pool) return pool;
  const raw = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
    process.env.GEMINI_API_KEY_5,
    process.env.GEMINI_API_KEY_6,
    process.env.GEMINI_API_KEY_7,
    process.env.GEMINI_API_KEY_8,
  ];
  const seen = new Set<string>();
  pool = [];
  raw.forEach((k, i) => {
    const v = (k ?? "").trim();
    if (!v || seen.has(v)) return;
    seen.add(v);
    pool!.push({
      key: v,
      label: `Key ${i + 1}`,
      callsThisMinute: 0,
      lastMinuteReset: Date.now(),
      blockedUntil: 0,
    });
  });
  return pool;
}

export function hasGeminiKeys(): boolean {
  return loadPool().length > 0;
}

export function pickGeminiKey(): KeyState | null {
  const now = Date.now();
  const keys = loadPool();
  if (keys.length === 0) return null;
  for (const k of keys) {
    if (now - k.lastMinuteReset > 60_000) {
      k.callsThisMinute = 0;
      k.lastMinuteReset = now;
    }
  }
  const available = keys.filter((k) => k.blockedUntil <= now && k.callsThisMinute < 15);
  if (available.length === 0) return null;
  const best = available.reduce((a, b) => (a.callsThisMinute <= b.callsThisMinute ? a : b));
  best.callsThisMinute += 1;
  return best;
}

export function blockGeminiKey(key: string, durationMs = 60_000) {
  const keys = loadPool();
  const k = keys.find((x) => x.key === key);
  if (k) k.blockedUntil = Date.now() + durationMs;
}
