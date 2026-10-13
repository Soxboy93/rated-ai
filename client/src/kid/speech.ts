/** Read-aloud and voice input using the browser's own speech features. Both are optional: callers check support. */
import { currentLang } from "@/i18n";
import type { Lang } from "@shared/jordan";

export const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;

const SR: any = typeof window !== "undefined" ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : undefined;
export const canListen = !!SR;

const voices = () => (canSpeak ? window.speechSynthesis.getVoices() : []);

function pickVoice(lang: Lang): SpeechSynthesisVoice | null {
  const all = voices();
  if (lang === "ar") return all.find(v => /^ar[-_]JO/i.test(v.lang)) ?? all.find(v => /^ar/i.test(v.lang)) ?? null;
  return all.find(v => /^en[-_](US|GB)/i.test(v.lang) && /female|samantha|google|zira|aria/i.test(v.name)) ?? all.find(v => /^en/i.test(v.lang)) ?? null;
}

/** Whether this device can read text aloud in the language. Arabic voices are missing on many devices. */
export const canSpeakIn = (lang: Lang = currentLang()) => canSpeak && (lang === "en" || pickVoice("ar") !== null);

export function speak(text: string, opts: { rate?: number; onEnd?: () => void; lang?: Lang } = {}) {
  const lang = opts.lang ?? currentLang();
  if (!canSpeak || !text.trim()) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice(lang);
    if (v) u.voice = v;
    u.lang = v?.lang ?? (lang === "ar" ? "ar-JO" : "en-US");
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
export function listenOnce(lang: Lang = currentLang()): Promise<string | null> {
  return new Promise(resolve => {
    if (!SR) return resolve(null);
    try {
      const rec = new SR();
      rec.lang = lang === "ar" ? "ar-JO" : "en-US";
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onresult = (e: any) => resolve(e.results?.[0]?.[0]?.transcript ?? null);
      rec.onerror = () => resolve(null);
      rec.onend = () => resolve(null);
      rec.start();
    } catch { resolve(null); }
  });
}
