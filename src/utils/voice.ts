// Aura's spoken voice — the head unit talks to the driver in the moment.
// Uses the browser's built-in Web Speech synthesis: no API key, works offline, reliable on
// stage. Premium neural voices (ElevenLabs / GCP) can be swapped in later behind speak().

let muted = false;
let warmed = false;

/** Some browsers populate voices asynchronously; call once on mount to prime the list. */
export function warmVoices(): void {
  if (warmed || typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.getVoices();
  // trigger async load in browsers that need it
  window.speechSynthesis.onvoiceschanged = () => { warmed = true; };
  warmed = true;
}

export function setVoiceMuted(m: boolean): void {
  muted = m;
  if (m && typeof window !== 'undefined') window.speechSynthesis?.cancel();
}
export function isVoiceMuted(): boolean {
  return muted;
}

function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  // Prefer natural-sounding English voices where available.
  const prefer = [/Google US English/i, /Microsoft (Aria|Jenny|Sonia|Zira)/i, /Samantha/i];
  for (const re of prefer) {
    const v = voices.find((x) => re.test(x.name));
    if (v) return v;
  }
  return voices.find((x) => x.lang?.toLowerCase().startsWith('en')) || voices[0];
}

/**
 * Speak a line. By default interrupts any in-progress speech so escalations don't stack.
 * rate < 1 = calmer; rate > 1 = more urgent.
 */
export function speak(text: string, opts?: { rate?: number; pitch?: number; interrupt?: boolean }): void {
  if (muted || !text || typeof window === 'undefined' || !window.speechSynthesis) return;
  try {
    if (opts?.interrupt !== false) window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = opts?.rate ?? 1.0;
    u.pitch = opts?.pitch ?? 1.0;
    const v = pickVoice();
    if (v) u.voice = v;
    window.speechSynthesis.speak(u);
  } catch {
    /* speech is best-effort — never let it break the UI */
  }
}
