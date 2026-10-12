/** Read-aloud and voice input using the browser's own speech features. Both are optional: callers check support. */
export const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;

const SR: any = typeof window !== "undefined" ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : undefined;
export const canListen = !!SR;

let voice: SpeechSynthesisVoice | null | undefined;
function pickVoice() {
  if (voice !== undefined) return voice;
  const voices = window.speechSynthesis.getVoices();
  voice = voices.find(v => /^en[-_](US|GB)/i.test(v.lang) && /female|samantha|google|zira|aria/i.test(v.name)) ?? voices.find(v => /^en/i.test(v.lang)) ?? null;
  return voice;
}

export function speak(text: string, opts: { rate?: number; onEnd?: () => void } = {}) {
  if (!canSpeak || !text.trim()) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice();
    if (v) u.voice = v;
    u.lang = v?.lang ?? "en-US";
    u.rate = opts.rate ?? 0.92;
    u.pitch = 1.05;
    if (opts.onEnd) u.onend = opts.onEnd;
    window.speechSynthesis.speak(u);
  } catch { /* speech unavailable */ }
}

export function stopSpeaking() {
  try { if (canSpeak) window.speechSynthesis.cancel(); } catch { /* ignore */ }
}

/** Listen once; resolves with the transcript or null. */
export function listenOnce(): Promise<string | null> {
  return new Promise(resolve => {
    if (!SR) return resolve(null);
    try {
      const rec = new SR();
      rec.lang = "en-US";
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onresult = (e: any) => resolve(e.results?.[0]?.[0]?.transcript ?? null);
      rec.onerror = () => resolve(null);
      rec.onend = () => resolve(null);
      rec.start();
    } catch { resolve(null); }
  });
}
