/** Tiny synthesised sound effects (no audio files). Muted state is remembered; silent in calm mode. */
let ctx: AudioContext | null = null;
let muted = false;
try { muted = localStorage.getItem("ra_muted") === "1"; } catch { /* storage unavailable */ }

export const isMuted = () => muted;
export function setMuted(value: boolean) {
  muted = value;
  try { localStorage.setItem("ra_muted", value ? "1" : "0"); } catch { /* ignore */ }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = "triangle", gain = 0.12) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = ctx.currentTime + start;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export type SoundName = "tap" | "correct" | "wrong" | "win" | "badge" | "flip" | "match" | "levelup";

const NOTE = { C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880, C6: 1046.5, E6: 1318.5, G4: 392, E4: 329.63, C4: 261.63 };

export function playSound(name: SoundName) {
  if (muted || document.documentElement.classList.contains("a11y-calm")) return;
  try {
    ctx ??= new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === "suspended") void ctx.resume();
    switch (name) {
      case "tap": tone(NOTE.E5, 0, 0.06, "square", 0.05); break;
      case "flip": tone(NOTE.G5, 0, 0.07, "sine", 0.08); break;
      case "correct": [NOTE.C5, NOTE.E5, NOTE.G5].forEach((f, i) => tone(f, i * 0.08, 0.18)); break;
      case "match": [NOTE.E5, NOTE.A5].forEach((f, i) => tone(f, i * 0.09, 0.2, "sine", 0.1)); break;
      case "wrong": tone(NOTE.G4, 0, 0.18, "sawtooth", 0.07); tone(NOTE.E4, 0.12, 0.28, "sawtooth", 0.07); break;
      case "badge": [NOTE.G5, NOTE.C6, NOTE.E6].forEach((f, i) => tone(f, i * 0.09, 0.3, "sine", 0.1)); break;
      case "win": [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6].forEach((f, i) => tone(f, i * 0.11, 0.3)); tone(NOTE.E6, 0.5, 0.5, "sine", 0.1); break;
      case "levelup": [NOTE.C5, NOTE.G5, NOTE.C6, NOTE.E6].forEach((f, i) => tone(f, i * 0.1, 0.35, "sine", 0.11)); break;
    }
  } catch { /* audio unavailable: stay silent */ }
}
