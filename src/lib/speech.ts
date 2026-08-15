// Speaking and listening, using what the browser already has.
//
// Every hosted option here costs money per character or per minute, which for
// a free study app used by students on prepaid data is the wrong shape of
// bill. The Web Speech API costs nothing, needs no key, and on Android speaks
// through Google's neural voices — which are genuinely good. On desktop the
// voices are more robotic, and that is the honest trade for zero cost.
//
// Both halves degrade rather than break: a browser without speech support
// simply reports unsupported, and the feature hides itself.

export type Voice = SpeechSynthesisVoice;

export const ttsSupported = () =>
  typeof window !== "undefined" && "speechSynthesis" in window;

/**
 * Voices load asynchronously in most browsers and are an empty array on the
 * first call, which is the classic reason "no voices found" appears once and
 * then never again after a refresh.
 */
export function loadVoices(): Promise<Voice[]> {
  return new Promise((resolve) => {
    if (!ttsSupported()) return resolve([]);
    const now = speechSynthesis.getVoices();
    if (now.length) return resolve(now);
    const onChange = () => {
      speechSynthesis.removeEventListener("voiceschanged", onChange);
      resolve(speechSynthesis.getVoices());
    };
    speechSynthesis.addEventListener("voiceschanged", onChange);
    // Some browsers never fire the event if voices were already warm.
    setTimeout(() => resolve(speechSynthesis.getVoices()), 1200);
  });
}

/**
 * Pick two clearly different English voices for the two podcast hosts.
 *
 * Two voices that sound the same defeat the entire point of a dialogue, so
 * this prefers a male/female pair, then any two distinct voices, and only
 * falls back to one voice at two different pitches if the device has just one.
 */
export function pickPair(voices: Voice[]): { host: Voice | null; guest: Voice | null } {
  const en = voices.filter((v) => v.lang?.toLowerCase().startsWith("en"));
  const pool = en.length >= 2 ? en : voices;
  if (pool.length === 0) return { host: null, guest: null };

  const female = pool.find((v) => /female|samantha|zira|aria|jenny|karen|moira|tessa/i.test(v.name));
  const male = pool.find((v) => /male|david|george|guy|daniel|alex|fred|ryan/i.test(v.name) && v !== female);

  if (female && male) return { host: female, guest: male };
  if (pool.length >= 2) return { host: pool[0], guest: pool[1] };
  return { host: pool[0], guest: pool[0] };
}

export type SpeakOptions = {
  voice?: Voice | null;
  rate?: number;
  pitch?: number;
  onEnd?: () => void;
};

/** Speak one utterance. Resolves when it finishes or is cancelled. */
export function speak(text: string, opts: SpeakOptions = {}): Promise<void> {
  return new Promise((resolve) => {
    if (!ttsSupported() || !text.trim()) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    if (opts.voice) u.voice = opts.voice;
    u.rate = opts.rate ?? 1;
    u.pitch = opts.pitch ?? 1;
    u.onend = () => {
      opts.onEnd?.();
      resolve();
    };
    // An error must resolve too, or a queue of lines stalls forever on one
    // bad utterance.
    u.onerror = () => resolve();
    speechSynthesis.speak(u);
  });
}

export const stopSpeaking = () => {
  if (ttsSupported()) speechSynthesis.cancel();
};
export const pauseSpeaking = () => {
  if (ttsSupported()) speechSynthesis.pause();
};
export const resumeSpeaking = () => {
  if (ttsSupported()) speechSynthesis.resume();
};

// ─── Listening ──────────────────────────────────────────────────────────────

type Recognition = any;

export const sttSupported = () =>
  typeof window !== "undefined" &&
  ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

/**
 * Dictation. Returns a stop() handle; results stream to `onText` as they are
 * recognised, with `final` marking a settled phrase.
 *
 * Chrome and Android support this natively and for free. Firefox does not, and
 * rather than shipping a 40 MB Whisper model to cover it the button simply
 * does not appear there.
 */
export function listen(
  onText: (text: string, final: boolean) => void,
  onEnd?: () => void,
): { stop: () => void } | null {
  if (!sttSupported()) return null;
  const Ctor: any = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
  const rec: Recognition = new Ctor();
  rec.lang = "en-US";
  rec.continuous = true;
  rec.interimResults = true;

  rec.onresult = (e: any) => {
    let interim = "";
    let settled = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) settled += r[0].transcript;
      else interim += r[0].transcript;
    }
    if (settled) onText(settled, true);
    else if (interim) onText(interim, false);
  };
  rec.onerror = () => onEnd?.();
  rec.onend = () => onEnd?.();

  try {
    rec.start();
  } catch {
    return null;
  }
  return { stop: () => { try { rec.stop(); } catch { /* already stopped */ } } };
}
