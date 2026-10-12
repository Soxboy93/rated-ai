import { useCallback, useEffect, useRef, useState } from "react";
import KidShell from "./Shell";
import { playSound } from "./sound";

const COLORS = ["#2b2250", "#e5484d", "#ff9f1c", "#ffd23f", "#46c37b", "#1fc2b0", "#4f8cff", "#8b5cf6", "#ff5d8f", "#8a5a2b", "#ffffff"];
const BACKGROUNDS = ["#ffffff", "#fff3c4", "#d8ecff", "#ffd9e6", "#d9f7e8", "#2b2250"];
const STAMPS = ["⭐", "❤️", "🌈", "🦄", "🐶", "🐱", "🚀", "🌸", "🍕", "🦖", "🐠", "☀️"];
const SIZES = [4, 10, 20, 36];
const W = 900, H = 640;

type Tool = "brush" | "rainbow" | "eraser" | "stamp";

export default function Doodle() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const hue = useRef(0);
  const history = useRef<ImageData[]>([]);
  const [tool, setTool] = useState<Tool>("brush");
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZES[1]);
  const [stamp, setStamp] = useState(STAMPS[0]);
  const [bg, setBg] = useState(BACKGROUNDS[0]);
  const [canUndo, setCanUndo] = useState(false);
  const [saved, setSaved] = useState(false);

  const ctx = () => canvasRef.current!.getContext("2d", { willReadFrequently: true })!;

  const fillBackground = useCallback((c: string) => {
    const g = ctx();
    g.fillStyle = c;
    g.fillRect(0, 0, W, H);
  }, []);

  useEffect(() => { fillBackground(BACKGROUNDS[0]); }, [fillBackground]);

  const snapshot = () => {
    history.current.push(ctx().getImageData(0, 0, W, H));
    if (history.current.length > 25) history.current.shift();
    setCanUndo(true);
  };

  const pos = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  const stampAt = (p: { x: number; y: number }) => {
    const g = ctx();
    g.font = `${size * 3 + 24}px serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(stamp, p.x, p.y);
  };

  const down = (e: React.PointerEvent) => {
    canvasRef.current!.setPointerCapture(e.pointerId);
    snapshot();
    setSaved(false);
    const p = pos(e);
    if (tool === "stamp") { stampAt(p); playSound("flip"); return; }
    drawing.current = true;
    last.current = p;
    dot(p);
  };

  const strokeColor = () => (tool === "eraser" ? bg : tool === "rainbow" ? `hsl(${(hue.current = (hue.current + 6) % 360)} 90% 55%)` : color);

  const dot = (p: { x: number; y: number }) => {
    const g = ctx();
    g.fillStyle = strokeColor();
    g.beginPath();
    g.arc(p.x, p.y, size / 2, 0, Math.PI * 2);
    g.fill();
  };

  const move = (e: React.PointerEvent) => {
    if (!drawing.current || tool === "stamp") return;
    const p = pos(e);
    const g = ctx();
    g.strokeStyle = strokeColor();
    g.lineWidth = size;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.beginPath();
    g.moveTo(last.current!.x, last.current!.y);
    g.lineTo(p.x, p.y);
    g.stroke();
    last.current = p;
  };

  const up = () => { drawing.current = false; last.current = null; };

  const undo = () => {
    const prev = history.current.pop();
    if (prev) ctx().putImageData(prev, 0, 0);
    setCanUndo(history.current.length > 0);
    playSound("tap");
  };

  const clear = () => { snapshot(); fillBackground(bg); playSound("wrong"); };

  const changeBackground = (c: string) => {
    // Repaint the page colour without losing the drawing: swap only pixels that still match the old background.
    snapshot();
    const g = ctx();
    const img = g.getImageData(0, 0, W, H);
    const old = hexToRgb(bg), neu = hexToRgb(c);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] === old[0] && d[i + 1] === old[1] && d[i + 2] === old[2]) { d[i] = neu[0]; d[i + 1] = neu[1]; d[i + 2] = neu[2]; }
    }
    g.putImageData(img, 0, 0);
    setBg(c);
    playSound("tap");
  };

  const save = () => {
    canvasRef.current!.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "my-doodle.png";
      a.click();
      URL.revokeObjectURL(url);
      setSaved(true);
      playSound("badge");
    });
  };

  const toolBtn = (id: Tool, label: string, icon: string) => (
    <button key={id} className="k-btn small light" aria-pressed={tool === id} onClick={() => { setTool(id); playSound("tap"); }} style={{ background: tool === id ? "var(--c-doodle)" : undefined, color: tool === id ? "#fff" : undefined }}>
      {icon} {label}
    </button>
  );

  return (
    <KidShell title="Doodle Pad" color="var(--c-doodle)">
      <div style={{ display: "grid", gap: 14, maxWidth: 940, margin: "0 auto" }}>
        <div className="k-card" style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {toolBtn("brush", "Brush", "🖌️")}
            {toolBtn("rainbow", "Rainbow", "🌈")}
            {toolBtn("stamp", "Stamps", "⭐")}
            {toolBtn("eraser", "Eraser", "🧽")}
            <span style={{ flex: 1 }} />
            <button className="k-btn small light" onClick={undo} disabled={!canUndo}>↩️ Undo</button>
            <button className="k-btn small light" onClick={clear}>🗑️ Clear</button>
            <button className="k-btn small" style={{ ["--c" as string]: "var(--c-doodle)" }} onClick={save}>💾 Save picture</button>
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
            {tool === "stamp" ? (
              <div role="radiogroup" aria-label="Stamp" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {STAMPS.map(s => <button key={s} role="radio" aria-checked={stamp === s} className="k-btn small light round" style={{ width: 46, minHeight: 46, outline: stamp === s ? "4px solid var(--k-brand-2)" : undefined }} onClick={() => setStamp(s)}>{s}</button>)}
              </div>
            ) : (
              <div role="radiogroup" aria-label="Colour" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {COLORS.map(c => <button key={c} role="radio" aria-checked={color === c} aria-label={`Colour ${c}`} onClick={() => { setColor(c); if (tool === "eraser") setTool("brush"); }} style={{ width: 38, height: 38, borderRadius: "50%", background: c, border: "3px solid var(--k-ink)", outline: color === c && tool !== "rainbow" ? "4px solid var(--k-brand-2)" : undefined, cursor: "pointer" }} />)}
              </div>
            )}
            <div role="radiogroup" aria-label="Size" style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {SIZES.map(s => <button key={s} role="radio" aria-checked={size === s} aria-label={`Size ${s}`} onClick={() => setSize(s)} className="k-btn small light round" style={{ width: 46, minHeight: 46, outline: size === s ? "4px solid var(--k-brand-2)" : undefined }}><span style={{ width: Math.min(s, 30), height: Math.min(s, 30), borderRadius: "50%", background: "var(--k-ink)", display: "block" }} /></button>)}
            </div>
            <div role="radiogroup" aria-label="Paper colour" style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span className="k-muted" style={{ fontWeight: 800 }}>Paper</span>
              {BACKGROUNDS.map(c => <button key={c} role="radio" aria-checked={bg === c} aria-label={`Paper ${c}`} onClick={() => changeBackground(c)} style={{ width: 30, height: 30, borderRadius: 8, background: c, border: "3px solid var(--k-ink)", cursor: "pointer", outline: bg === c ? "4px solid var(--k-brand-2)" : undefined }} />)}
            </div>
          </div>
        </div>

        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          aria-label="Drawing area"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          style={{ width: "100%", height: "auto", aspectRatio: `${W} / ${H}`, border: "3px solid var(--k-ink)", borderRadius: 22, boxShadow: "0 5px 0 var(--k-ink)", touchAction: "none", cursor: tool === "stamp" ? "copy" : "crosshair", background: "#fff" }}
        />
        <p className="k-muted" style={{ textAlign: "center", fontSize: ".95rem" }}>{saved ? "Saved to your device! Your drawing never leaves it unless you share it." : "Your doodles stay on this device. Press Save to keep one."}</p>
      </div>
    </KidShell>
  );
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
