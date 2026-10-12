import { useEffect, useRef } from "react";

const COLORS = ["#ff5d8f", "#ffcb2b", "#4f8cff", "#1fc2b0", "#8b5cf6", "#ff9f1c", "#ffffff"];

/** One-shot confetti burst on a full-screen canvas. Renders nothing in calm mode. */
export default function Confetti({ fire }: { fire: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!fire || document.documentElement.classList.contains("a11y-calm")) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = ref.current;
    if (!canvas) return;
    const c = canvas.getContext("2d")!;
    const w = (canvas.width = window.innerWidth);
    const h = (canvas.height = window.innerHeight);
    const pieces = Array.from({ length: 140 }, () => ({
      x: w / 2 + (Math.random() - 0.5) * 120,
      y: h * 0.45,
      vx: (Math.random() - 0.5) * 16,
      vy: -Math.random() * 15 - 5,
      s: 6 + Math.random() * 8,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }));
    let frame = 0;
    let raf = 0;
    const tick = () => {
      c.clearRect(0, 0, w, h);
      frame++;
      for (const p of pieces) {
        p.vy += 0.38;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.vr;
        c.save();
        c.translate(p.x, p.y);
        c.rotate(p.r);
        c.fillStyle = p.color;
        c.fillRect(-p.s / 2, -p.s / 3, p.s, p.s / 1.6);
        c.restore();
      }
      if (frame < 130) raf = requestAnimationFrame(tick);
      else c.clearRect(0, 0, w, h);
    };
    raf = requestAnimationFrame(tick);
    // Wipe the canvas when the animation is cancelled (dialog closed, new burst, unmount) so nothing freezes mid-air.
    return () => { cancelAnimationFrame(raf); c.clearRect(0, 0, w, h); };
  }, [fire]);

  return <canvas ref={ref} aria-hidden="true" style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 80 }} />;
}
