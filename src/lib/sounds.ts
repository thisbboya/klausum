// Web Audio API sound effects — no audio files needed.
// All tones are generated procedurally. Respects user preference
// in localStorage("sounds_enabled"), defaults to enabled.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") {
    try { ctx.resume(); } catch { /* ignore */ }
  }
  return ctx;
}

function enabled(): boolean {
  if (typeof window === "undefined") return false;
  const v = localStorage.getItem("sounds_enabled");
  return v === null ? true : v === "true";
}

export function setSoundsEnabled(on: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem("sounds_enabled", on ? "true" : "false");
}

export function soundsEnabled(): boolean {
  return enabled();
}

function tone(freq: number, duration: number, type: OscillatorType = "sine", volume = 0.25, delay = 0) {
  const c = getCtx();
  if (!c) return;
  try {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, c.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + duration);
    osc.start(c.currentTime + delay);
    osc.stop(c.currentTime + delay + duration + 0.01);
  } catch {
    // audio context may be suspended; ignore
  }
}


/**
 * A marimba-like pluck: fundamental + soft 2nd harmonic, fast attack and a
 * natural exponential decay. Sounds like a friendly instrument, not a beep.
 * Tiny random detune keeps repeated taps from feeling robotic (micro-novelty).
 */
function pluck(freq: number, duration = 0.22, volume = 0.2, delay = 0, humanize = true) {
  const c = getCtx();
  if (!c) return;
  try {
    const f = humanize ? freq * (1 + (Math.random() - 0.5) * 0.03) : freq;
    const t0 = c.currentTime + delay;
    for (const [mult, vol] of [[1, volume], [2, volume * 0.28], [3, volume * 0.08]] as const) {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.connect(gain); gain.connect(c.destination);
      osc.type = "sine";
      osc.frequency.value = f * mult;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
      osc.start(t0); osc.stop(t0 + duration + 0.02);
    }
  } catch {}
}

/** Bright noise shimmer layered under big rewards. */
function sparkle(delay = 0, duration = 0.35, volume = 0.06) {
  const c = getCtx();
  if (!c) return;
  try {
    const t0 = c.currentTime + delay;
    const len = Math.floor(c.sampleRate * duration);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const filter = c.createBiquadFilter();
    filter.type = "highpass"; filter.frequency.value = 5000;
    const gain = c.createGain();
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(filter); filter.connect(gain); gain.connect(c.destination);
    src.start(t0);
  } catch {}
}

// Pentatonic ladder — every combination of these sounds pleasant, which is
// why Duolingo-style apps live on it.
const P = { c5: 523.25, d5: 587.33, e5: 659.25, g5: 783.99, a5: 880, c6: 1046.5, e6: 1318.5, g6: 1568 };

export const Sounds = {
  // UI feedback — soft wooden tap, humanized so it never repeats exactly
  tap()    { if (!enabled()) return; pluck(P.a5, 0.09, 0.07); },
  nav()    { if (!enabled()) return; pluck(P.g5, 0.12, 0.08); },

  // Flashcard
  flip()   { if (!enabled()) return; pluck(P.e5, 0.1, 0.1); },
  // "again" is a gentle low thud — informative, never punishing
  again()  { if (!enabled()) return; pluck(196, 0.3, 0.14, 0, false); },
  hard()   { if (!enabled()) return; pluck(P.d5 / 2, 0.18, 0.12, 0, false); },
  good()   { if (!enabled()) return; pluck(P.c5, 0.16, 0.16); pluck(P.e5, 0.2, 0.16, 0.07); },
  easy()   { if (!enabled()) return; pluck(P.c5, 0.14, 0.16); pluck(P.e5, 0.14, 0.16, 0.06); pluck(P.g5, 0.24, 0.18, 0.12); },

  // Quiz
  correct() { if (!enabled()) return; pluck(P.c5, 0.14, 0.16); pluck(P.e5, 0.14, 0.16, 0.06); pluck(P.g5, 0.24, 0.18, 0.12); sparkle(0.12, 0.25, 0.04); },
  // soft descending "hm" — keeps players in flow instead of stinging them
  wrong()   { if (!enabled()) return; pluck(P.d5 / 2, 0.16, 0.12, 0, false); pluck(P.c5 / 2, 0.26, 0.12, 0.09, false); },

  // Rewards — ascending pentatonic + shimmer (variable-reward moments)
  xpEarn() { if (!enabled()) return; pluck(P.e5, 0.1, 0.14); pluck(P.a5, 0.16, 0.14, 0.06); },
  chest() {
    if (!enabled()) return;
    [P.a5, P.c6, P.e6, P.g6].forEach((f, i) => pluck(f, 0.18, 0.16, i * 0.07));
    sparkle(0.2, 0.4, 0.07);
  },
  levelUp() {
    if (!enabled()) return;
    [P.c5, P.e5, P.g5, P.c6, P.e6].forEach((f, i) => pluck(f, 0.2, 0.18, i * 0.09));
    sparkle(0.35, 0.45, 0.08);
  },
  streak() { if (!enabled()) return; pluck(P.g5, 0.12, 0.16); pluck(P.c6, 0.2, 0.18, 0.09); },
  streakMilestone() {
    if (!enabled()) return;
    [P.c5, P.e5, P.g5, P.c6, P.e6, P.c6, P.e6, P.g6].forEach((f, i) => pluck(f, 0.2, 0.2, i * 0.08));
    sparkle(0.5, 0.5, 0.09);
  },
  questComplete() { if (!enabled()) return; [P.e5, P.g5, P.c6].forEach((f, i) => pluck(f, 0.16, 0.16, i * 0.08)); },
  heartBreak() { if (!enabled()) return; pluck(P.e5 / 2, 0.12, 0.12, 0, false); pluck(220, 0.22, 0.13, 0.07, false); },

  // Legacy aliases (kept so existing code keeps working)
  buttonTap() { this.tap(); },
};
