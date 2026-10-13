import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildSlides, type LessonContent, type Slide } from "@shared/lesson";
import type { Lang } from "@shared/jordan";
import { currentLang, t } from "@/i18n";
import { speak, stopSpeaking, canSpeakIn } from "@/kid/speech";

const MODE_ICON = { individual: "🧍", pair: "👥", group: "👨‍👩‍👧‍👦" } as const;

const clock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

/**
 * Full-screen presenter for teaching a lesson in class (projector or smart board). Shows one idea per slide in large
 * type, with the quiz questions and worked examples revealed on demand. The teacher's spoken script stays hidden
 * (toggle "Notes") so students see only what is meant for the board.
 */
export default function TeachMode({ lesson, onExit }: { lesson: { title: string; subtitle: string; language: Lang; content: LessonContent }; onExit: () => void }) {
  const slides = useMemo(() => buildSlides(lesson.content, { title: lesson.title, subtitle: lesson.subtitle }), [lesson]);
  const [i, setI] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [notes, setNotes] = useState(false);
  const [size, setSize] = useState(1);
  const [elapsed, setElapsed] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const rtl = lesson.language === "ar"; // direction of the lesson text
  const uiRtl = currentLang() === "ar"; // direction of the controls, which follows the app language
  const slide = slides[i];

  const go = useCallback((d: number) => {
    setI(n => Math.min(slides.length - 1, Math.max(0, n + d)));
    setRevealed(false);
    stopSpeaking();
  }, [slides.length]);

  useEffect(() => { const id = setInterval(() => setElapsed(e => e + 1), 1000); return () => clearInterval(id); }, []);
  useEffect(() => () => stopSpeaking(), []);
  useEffect(() => { root.current?.focus(); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onExit();
      // With right-to-left controls the "next" arrow points left.
      const next = uiRtl ? "ArrowLeft" : "ArrowRight", prev = uiRtl ? "ArrowRight" : "ArrowLeft";
      if (e.key === next || e.key === "PageDown" || e.key === " ") { e.preventDefault(); go(1); }
      else if (e.key === prev || e.key === "PageUp") { e.preventDefault(); go(-1); }
      else if (e.key === "Enter" || e.key.toLowerCase() === "r") setRevealed(r => !r);
      else if (e.key.toLowerCase() === "n") setNotes(n => !n);
      else if (e.key === "+" || e.key === "=") setSize(s => Math.min(1.6, s + 0.1));
      else if (e.key === "-") setSize(s => Math.max(0.7, s - 0.1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onExit, uiRtl]);

  const fullscreen = () => { try { void (document.fullscreenElement ? document.exitFullscreen() : root.current?.requestFullscreen()); } catch { /* not supported */ } };
  const planned = lesson.content.warmup.minutes + lesson.content.steps.reduce((n, s) => n + s.minutes, 0) + lesson.content.activities.reduce((n, a) => n + a.minutes, 0);

  const label = (s: Slide) => {
    switch (s.kind) {
      case "objectives": return t("Today's goals");
      case "warmup": return t("Warm-up");
      case "step": return t("Step {n} of {total}", { n: s.n, total: s.of });
      case "example": return t("Example {n} of {total}", { n: s.n, total: s.of });
      case "activity": return t("Activity");
      case "quiz": return t("Question {n} of {total}", { n: s.n, total: s.of });
      case "summary": return t("What we learned");
      case "homework": return t("Homework");
      default: return "";
    }
  };

  const big = { fontSize: `${2.1 * size}rem`, lineHeight: 1.45 } as const;
  const bullets = (items: string[]) => (
    <ul style={{ ...big, display: "grid", gap: "0.6em", paddingInlineStart: "1.2em", margin: 0 }}>
      {items.map((b, k) => <li key={k}>{b}</li>)}
    </ul>
  );

  const body = (() => {
    switch (slide.kind) {
      case "title":
        return (<div style={{ textAlign: "center", display: "grid", gap: 24 }}><h1 style={{ fontSize: `${4 * size}rem`, lineHeight: 1.2, fontWeight: 800 }}>{slide.title}</h1><p style={{ fontSize: `${1.6 * size}rem`, opacity: 0.75 }}>{slide.subtitle}</p></div>);
      case "objectives":
      case "summary":
        return bullets(slide.bullets);
      case "warmup":
        return (<div style={{ display: "grid", gap: 20 }}>{slide.title && <h2 style={{ fontSize: `${2.6 * size}rem`, fontWeight: 800 }}>{slide.title}</h2>}<p style={{ ...big, whiteSpace: "pre-wrap" }}>{slide.body}</p></div>);
      case "step":
        return (
          <div style={{ display: "grid", gap: 24 }}>
            <h2 style={{ fontSize: `${2.8 * size}rem`, fontWeight: 800 }}>{slide.title}</h2>
            {slide.bullets.length > 0 ? bullets(slide.bullets) : <p style={{ ...big, whiteSpace: "pre-wrap" }}>{slide.body}</p>}
            {slide.bullets.length > 0 && notes && <p style={{ fontSize: "1.15rem", background: "rgba(255,255,255,.1)", padding: 16, borderRadius: 12, whiteSpace: "pre-wrap" }}>📝 {slide.body}</p>}
          </div>
        );
      case "example":
        return (
          <div style={{ display: "grid", gap: 28 }}>
            <p style={{ ...big, fontWeight: 700, whiteSpace: "pre-wrap" }}>{slide.prompt}</p>
            {revealed ? <p style={{ ...big, color: "#7ef0c0", whiteSpace: "pre-wrap" }}>✅ {slide.solution}</p> : <button type="button" className="tm-btn" onClick={() => setRevealed(true)}>{t("Show the solution")}</button>}
          </div>
        );
      case "activity":
        return (
          <div style={{ display: "grid", gap: 20 }}>
            <h2 style={{ fontSize: `${2.6 * size}rem`, fontWeight: 800 }}>{MODE_ICON[slide.mode]} {slide.title}</h2>
            <p style={{ ...big, whiteSpace: "pre-wrap" }}>{slide.body}</p>
            <p style={{ fontSize: "1.2rem", opacity: 0.75 }}>⏱ {t("{n} minutes", { n: slide.minutes })}</p>
          </div>
        );
      case "quiz":
        return (
          <div style={{ display: "grid", gap: 24 }}>
            <p style={{ ...big, fontWeight: 700 }}>{slide.q}</p>
            <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
              {slide.options.map((o, k) => (
                <li key={k} style={{ ...big, fontSize: `${1.8 * size}rem`, padding: "14px 20px", borderRadius: 16, border: "2px solid", borderColor: revealed && k === slide.answer ? "#7ef0c0" : "rgba(255,255,255,.25)", background: revealed && k === slide.answer ? "rgba(126,240,192,.18)" : "rgba(255,255,255,.06)", display: "flex", gap: 14, alignItems: "center" }}>
                  <b style={{ opacity: 0.7 }}>{["A", "B", "C", "D"][k]}</b><span>{o}</span>
                </li>
              ))}
            </ol>
            {revealed ? slide.explanation && <p style={{ fontSize: "1.4rem", opacity: 0.9 }}>💡 {slide.explanation}</p> : <button type="button" className="tm-btn" onClick={() => setRevealed(true)}>{t("Show the answer")}</button>}
          </div>
        );
      case "homework":
        return (<div style={{ display: "grid", gap: 20 }}><p style={{ ...big, whiteSpace: "pre-wrap" }}>{slide.body}</p></div>);
    }
  })();

  const readAloud = slide.kind === "step" || slide.kind === "example" || slide.kind === "quiz" || slide.kind === "objectives" || slide.kind === "summary" || slide.kind === "warmup";
  const spokenText = slide.kind === "quiz" ? `${slide.q}. ${slide.options.join(". ")}` : slide.kind === "step" ? `${slide.title}. ${slide.bullets.join(". ") || slide.body}` : slide.kind === "example" ? slide.prompt : "bullets" in slide ? slide.bullets.join(". ") : slide.kind === "warmup" ? slide.body : "";

  return (
    <div ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-label={t("Teaching mode")} style={{ position: "fixed", inset: 0, zIndex: 100, background: "#0f1b33", color: "#fff", display: "grid", gridTemplateRows: "auto 1fr auto", outline: "none" }}>
      <style>{`.tm-btn{background:#fff;color:#0f1b33;border:0;border-radius:14px;padding:12px 22px;font-weight:800;font-size:1.1rem;cursor:pointer}.tm-btn:hover{filter:brightness(.92)}.tm-ghost{background:rgba(255,255,255,.12);color:#fff}.tm-ghost:hover{background:rgba(255,255,255,.22)}.tm-btn:focus-visible{outline:3px solid #7ef0c0;outline-offset:2px}`}</style>
      <header style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", flexWrap: "wrap" }}>
        <b style={{ opacity: 0.9 }}>{lesson.title}</b>
        <span style={{ opacity: 0.6 }}>{label(slide)}</span>
        <span style={{ flex: 1 }} />
        <span style={{ opacity: 0.8 }} aria-label={t("Time taught")}>⏱ {clock(elapsed)} / {clock(planned * 60)}</span>
        {canSpeakIn(lesson.language) && readAloud && <button type="button" className="tm-btn tm-ghost" onClick={() => speak(spokenText, { lang: lesson.language })}>🔊 {t("Read aloud")}</button>}
        {slide.kind === "step" && slide.bullets.length > 0 && <button type="button" className="tm-btn tm-ghost" aria-pressed={notes} onClick={() => setNotes(n => !n)}>📝 {t("Notes")}</button>}
        <button type="button" className="tm-btn tm-ghost" onClick={() => setSize(s => Math.max(0.7, s - 0.1))} aria-label={t("Smaller text")}>A−</button>
        <button type="button" className="tm-btn tm-ghost" onClick={() => setSize(s => Math.min(1.6, s + 0.1))} aria-label={t("Bigger text")}>A+</button>
        <button type="button" className="tm-btn tm-ghost" onClick={fullscreen}>⛶ {t("Full screen")}</button>
        <button type="button" className="tm-btn" onClick={onExit}>✕ {t("Exit")}</button>
      </header>

      <main dir={rtl ? "rtl" : "ltr"} lang={lesson.language} style={{ overflow: "auto", display: "grid", alignContent: "center", padding: "24px clamp(20px, 7vw, 120px)" }}>{body}</main>

      <footer style={{ display: "grid", gap: 10, padding: "10px 20px 16px" }}>
        <div role="progressbar" aria-valuemin={1} aria-valuemax={slides.length} aria-valuenow={i + 1} aria-label={t("Slide progress")} style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,.15)", overflow: "hidden" }}>
          <div style={{ width: `${((i + 1) / slides.length) * 100}%`, height: "100%", background: "#7ef0c0", transition: "width .25s" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <button type="button" className="tm-btn tm-ghost" disabled={i === 0} onClick={() => go(-1)} style={{ opacity: i === 0 ? 0.4 : 1 }}>{uiRtl ? "→" : "←"} {t("Back")}</button>
          <span style={{ opacity: 0.7 }}>{i + 1} / {slides.length}</span>
          <button type="button" className="tm-btn" disabled={i === slides.length - 1} onClick={() => go(1)} style={{ opacity: i === slides.length - 1 ? 0.4 : 1 }}>{t("Next")} {uiRtl ? "←" : "→"}</button>
        </div>
      </footer>
    </div>
  );
}
