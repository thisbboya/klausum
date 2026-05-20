// Web Audio API sound effects — no audio files needed.
// All tones are generated programmatically. Respects user preference
// in localStorage("sounds_enabled"), defaults to enabled.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
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
    osc.stop(c.currentTime + delay + duration);
  } catch {
    // audio context may be suspended; ignore
  }
}

export const Sounds = {
  correct() {
    if (!enabled()) return;
    tone(523, 0.1, "sine", 0.2, 0);
    tone(659, 0.1, "sine", 0.2, 0.08);
    tone(784, 0.16, "sine", 0.2, 0.16);
  },
  wrong() {
    if (!enabled()) return;
    tone(200, 0.28, "sawtooth", 0.15);
  },
  flip() {
    if (!enabled()) return;
    tone(440, 0.05, "triangle", 0.12);
  },
  xpEarn() {
    if (!enabled()) return;
    tone(660, 0.08, "sine", 0.18);
    tone(880, 0.12, "sine", 0.18, 0.07);
  },
  levelUp() {
    if (!enabled()) return;
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, "sine", 0.22, i * 0.08));
  },
  streak() {
    if (!enabled()) return;
    tone(880, 0.1, "sine", 0.18);
    tone(1047, 0.14, "sine", 0.18, 0.09);
  },
  buttonTap() {
    if (!enabled()) return;
    tone(600, 0.04, "triangle", 0.08);
  },
  heartBreak() {
    if (!enabled()) return;
    tone(330, 0.08, "triangle", 0.15);
    tone(220, 0.18, "triangle", 0.18, 0.07);
  },
};
