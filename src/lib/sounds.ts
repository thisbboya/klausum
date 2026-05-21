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

export const Sounds = {
  // UI feedback
  tap()    { if (!enabled()) return; tone(600, 0.04, "triangle", 0.08); },
  nav()    { if (!enabled()) return; tone(500, 0.06, "sine", 0.1); },

  // Flashcard
  flip()   { if (!enabled()) return; tone(440, 0.06, "triangle", 0.12); },
  again()  { if (!enabled()) return; tone(196, 0.28, "sawtooth", 0.18); },
  hard()   { if (!enabled()) return; tone(330, 0.12, "sine", 0.15); },
  good()   { if (!enabled()) return; tone(523, 0.09, "sine", 0.2); tone(659, 0.12, "sine", 0.2, 0.08); },
  easy()   {
    if (!enabled()) return;
    tone(523, 0.08, "sine", 0.22);
    tone(659, 0.08, "sine", 0.22, 0.07);
    tone(784, 0.14, "sine", 0.22, 0.14);
  },

  // Quiz
  correct() {
    if (!enabled()) return;
    tone(523, 0.08, "sine", 0.2);
    tone(659, 0.08, "sine", 0.2, 0.07);
    tone(784, 0.15, "sine", 0.2, 0.14);
  },
  wrong() { if (!enabled()) return; tone(220, 0.3, "sawtooth", 0.18); },

  // Rewards
  xpEarn() {
    if (!enabled()) return;
    tone(660, 0.07, "sine", 0.18);
    tone(880, 0.1, "sine", 0.18, 0.07);
  },
  chest() {
    if (!enabled()) return;
    [880, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.12, "sine", 0.2, i * 0.07));
  },
  levelUp() {
    if (!enabled()) return;
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.15, "sine", 0.25, i * 0.09));
  },
  streak() {
    if (!enabled()) return;
    tone(784, 0.1, "sine", 0.22);
    tone(1047, 0.15, "sine", 0.22, 0.1);
  },
  streakMilestone() {
    if (!enabled()) return;
    [523, 659, 784, 1047, 1319, 1047, 1319, 1568].forEach((f, i) =>
      tone(f, 0.18, "sine", 0.28, i * 0.08),
    );
  },
  questComplete() {
    if (!enabled()) return;
    [659, 784, 1047].forEach((f, i) => tone(f, 0.14, "sine", 0.22, i * 0.08));
  },
  heartBreak() {
    if (!enabled()) return;
    tone(330, 0.08, "triangle", 0.15);
    tone(220, 0.18, "triangle", 0.18, 0.07);
  },

  // Legacy aliases (kept so existing code keeps working)
  buttonTap() { this.tap(); },
};
