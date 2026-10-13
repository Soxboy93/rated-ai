import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { makeRng, randomRng } from "@shared/rng";
import type { Choice, Level } from "@shared/games";
import { MIN_MS_PER_QUESTION, levelFromXp, type GameId } from "@shared/gamification";
import Avatar from "../Avatar";
import KidShell from "../Shell";
import { useChild } from "../ChildContext";
import { GAME_META, guideById } from "../guides";
import { playSound } from "../sound";
import { canSpeakIn, speak, stopSpeaking } from "../speech";
import { t, T, currentLang } from "@/i18n";
import Confetti from "../Confetti";

type Props = {
  game: Exclude<GameId, "memory">;
  makeRound: (age: "kids" | "tweens" | "teens", level: Level, rng: () => number) => Choice[];
  levelNames?: [string, string, string];
  autoSpeak?: boolean; // spelling: say the word when the question appears
  needsSpeech?: boolean;
};

const CHEERS = [T("Great job!"), T("You got it!"), T("Brilliant!"), T("Super smart!"), T("Yes! Keep going!"), T("Nailed it!")];
const OOPS = [T("Not quite. You'll get the next one!"), T("Good try! Mistakes help us learn."), T("Almost! Let's look at the answer.")];

/**
 * Maths and pattern prompts are equations: they read left to right even inside Arabic. A question with Arabic words
 * stays right to left, with the equation after the colon isolated left to right.
 */
function Prompt({ text }: { text: string }) {
  const hasArabic = /[\u0621-\u064A]/.test(text.replace(/[؟]/g, ""));
  if (!hasArabic) return <bdi dir="ltr" style={{ display: "inline-block" }}>{text}</bdi>;
  const cut = text.indexOf(":  ");
  if (cut < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, cut + 1)}
      <bdi dir="ltr" style={{ display: "block", textAlign: "center", marginTop: 6 }}>{text.slice(cut + 3)}</bdi>
    </>
  );
}
const KEYS = ["1", "2", "3", "4"];

export default function RoundGame({ game, makeRound, levelNames = [T("Easy"), T("Medium"), T("Tricky")], autoSpeak, needsSpeech }: Props) {
  const meta = GAME_META[game];
  const { child, celebrate, refreshProgress, localDay } = useChild();
  const guide = guideById(child?.selectedCharacter);
  const submit = trpc.progress.submitPlay.useMutation();

  const [phase, setPhase] = useState<"intro" | "play" | "done">("intro");
  const [level, setLevel] = useState<Level>(1);
  const [round, setRound] = useState<Choice[]>([]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [readAloud, setReadAloud] = useState(false);
  const [confetti, setConfetti] = useState(0);
  const startedAt = useRef(0);
  const sent = useRef(false);
  const [saveError, setSaveError] = useState("");
  const [result, setResult] = useState<{ xpEarned: number; xp: number; leveledUp: boolean } | null>(null);

  const q = round[i];
  const age = child?.ageGroup ?? "kids";
  // Browsers load speech voices late; re-render when they arrive so Arabic read-aloud appears as soon as it can.
  const [, setVoiceTick] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const bump = () => setVoiceTick(n => n + 1);
    window.speechSynthesis.addEventListener("voiceschanged", bump);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", bump);
  }, []);
  const speechOk = canSpeakIn();
  // Spelling Bee normally speaks the word. Arabic voices are missing on many devices, so show a written clue instead.
  const clueMode = !!autoSpeak && !speechOk && currentLang() === "ar";

  const start = useCallback((lv: Level) => {
    stopSpeaking();
    setLevel(lv);
    setRound(makeRound(age, lv, randomRng));
    setI(0); setPicked(null); setCorrect(0); setCombo(0); setBestCombo(0);
    setResult(null); setSaveError(""); sent.current = false;
    startedAt.current = Date.now();
    setPhase("play");
  }, [age, makeRound]);

  // Say the spelling word (or read the question aloud) whenever a new question appears.
  useEffect(() => {
    if (phase !== "play" || !q) return;
    if (autoSpeak && q.say && speechOk) speak(q.say, { rate: 0.8 });
    else if (readAloud) speak(`${q.prompt}. ${q.options.join(". ")}`);
    return () => stopSpeaking();
  }, [phase, i, q, autoSpeak, readAloud, speechOk]);

  const choose = useCallback((idx: number) => {
    if (picked !== null || !q) return;
    setPicked(idx);
    const right = idx === q.answer;
    playSound(right ? "correct" : "wrong");
    if (right) {
      setCorrect(c => c + 1);
      setCombo(c => { const n = c + 1; setBestCombo(b => Math.max(b, n)); return n; });
    } else setCombo(0);
  }, [picked, q]);

  const finish = useCallback(async (finalCorrect: number) => {
    setPhase("done");
    const total = round.length;
    if (finalCorrect === total) { setConfetti(Date.now()); playSound("win"); } else playSound("badge");
    if (sent.current || !child) return;
    sent.current = true;
    try {
      const out = await submit.mutateAsync({
        profileId: child.id,
        game,
        level,
        correct: finalCorrect,
        total,
        // The server rejects rounds faster than 0.4 s per question (forged results); real play is never that quick.
        durationMs: Math.max(Date.now() - startedAt.current, total * MIN_MS_PER_QUESTION + 50),
        localDay: localDay(),
      });
      setResult({ xpEarned: out.xpEarned, xp: out.xp, leveledUp: out.leveledUp });
      await refreshProgress();
      celebrate({ badges: out.newBadges, levelUp: out.leveledUp ? levelFromXp(out.xp) : null });
    } catch (e) {
      setSaveError(e instanceof Error ? t(e.message) : t("Could not save your score."));
    }
  }, [round.length, child, submit, game, level, localDay, refreshProgress, celebrate]);

  const next = useCallback(() => {
    if (picked === null) return;
    playSound("tap");
    if (i + 1 >= round.length) void finish(correct);
    else { setI(i + 1); setPicked(null); }
  }, [picked, i, round.length, correct, finish]);

  useEffect(() => {
    if (phase !== "play") return;
    const onKey = (e: KeyboardEvent) => {
      const k = KEYS.indexOf(e.key);
      if (k >= 0 && picked === null && q && k < q.options.length) choose(k);
      else if ((e.key === "Enter" || e.key === " ") && picked !== null) { e.preventDefault(); next(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, picked, q, choose, next]);

  const feedback = useMemo(() => {
    if (picked === null || !q) return null;
    const right = picked === q.answer;
    const pool = right ? CHEERS : OOPS;
    return { right, text: t(pool[(i + correct) % pool.length]) };
  }, [picked, q, i, correct]);

  if (needsSpeech && !speechOk && currentLang() !== "ar") {
    return (
      <KidShell title={meta.name} color={meta.color}>
        <div className="k-card" style={{ maxWidth: 560, display: "grid", gap: 12 }}>
          <h2>{t("This game needs sound")}</h2>
          <p>{t("Spelling Bee reads each word out loud, and this device can't talk. Try it on a phone, tablet or computer with sound.")}</p>
          <div><Link href="/" className="k-btn">🏠 {t("Back home")}</Link></div>
        </div>
      </KidShell>
    );
  }

  /* ---------------------------------------------------------------- intro */
  if (phase === "intro") {
    return (
      <KidShell title={meta.name} color={meta.color}>
        <div style={{ display: "grid", gap: 22, maxWidth: 720 }}>
          <div className="k-card" style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <span style={{ fontSize: "4rem" }} aria-hidden="true">{meta.icon}</span>
            <div>
              <h2 style={{ fontSize: "2rem" }}>{meta.name}</h2>
              <p className="k-muted">{meta.blurb}. {game === "spelling" ? (clueMode ? t("Read the clue, then pick the right spelling.") : t("Listen to the word, then pick the right spelling.")) : t("Pick the right answer. Earn XP and badges!")}</p>
            </div>
          </div>
          <h3 style={{ fontSize: "1.4rem" }}>{t("Choose your level")}</h3>
          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            {([1, 2, 3] as Level[]).map(lv => (
              <button key={lv} className="k-btn" style={{ ["--c" as string]: meta.color, flexDirection: "column", minHeight: 96 }} onClick={() => { playSound("tap"); start(lv); }}>
                <span aria-hidden="true">{"⭐".repeat(lv)}</span>
                <span>{t(levelNames[lv - 1])}</span>
              </button>
            ))}
          </div>
          {!autoSpeak && speechOk && (
            <label className="k-chip" style={{ width: "fit-content", cursor: "pointer" }}>
              <input type="checkbox" checked={readAloud} onChange={e => setReadAloud(e.target.checked)} style={{ width: 20, height: 20 }} />
              🔊 {t("Read the questions to me")}
            </label>
          )}
        </div>
      </KidShell>
    );
  }

  /* ----------------------------------------------------------------- done */
  if (phase === "done") {
    const total = round.length;
    const pct = total ? correct / total : 0;
    const stars = pct >= 0.9 ? 3 : pct >= 0.6 ? 2 : 1;
    return (
      <KidShell title={meta.name} color={meta.color}>
        <Confetti fire={confetti} />
        <div className="k-card k-in" style={{ maxWidth: 640, margin: "0 auto", textAlign: "center", display: "grid", gap: 14 }}>
          <Avatar guide={guide} size={120} bob />
          <h2 style={{ fontSize: "2.2rem" }}>{pct === 1 ? t("Perfect round!") : pct >= 0.6 ? t("Awesome work!") : t("Nice try!")}</h2>
          <div style={{ fontSize: "3rem" }} role="img" aria-label={t("{n} out of 3 stars", { n: stars })}>
            {[1, 2, 3].map(s => <span key={s} style={{ opacity: s <= stars ? 1 : 0.2, display: "inline-block", animation: s <= stars ? `k-pop .5s ${s * 0.18}s both` : undefined }}>⭐</span>)}
          </div>
          <p className="display" style={{ fontSize: "1.6rem" }}>{t("{a} out of {b} right", { a: correct, b: total })}</p>
          {bestCombo >= 3 && <p className="k-chip" style={{ margin: "0 auto" }}>🔥 {t("Best streak: {n} in a row", { n: bestCombo })}</p>}
          {result ? (
            <p className="k-chip k-in" style={{ margin: "0 auto", background: "var(--k-brand)", color: "#fff", borderColor: "transparent", fontSize: "1.2rem" }}>{t("+{n} XP", { n: result.xpEarned })}</p>
          ) : saveError ? (
            <p role="alert" style={{ color: "var(--k-bad)", fontWeight: 800 }}>{saveError}</p>
          ) : (
            <p className="k-muted">{t("Saving your points…")}</p>
          )}
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="k-btn" style={{ ["--c" as string]: meta.color }} onClick={() => start(level)}>🔁 {t("Play again")}</button>
            <button className="k-btn light" onClick={() => { setPhase("intro"); }}>⭐ {t("Change level")}</button>
            <Link href="/" className="k-btn light">🏠 {t("Home")}</Link>
          </div>
        </div>
      </KidShell>
    );
  }

  /* ----------------------------------------------------------------- play */
  const progressPct = Math.round((i / round.length) * 100);
  return (
    <KidShell title={meta.name} color={meta.color}>
      <div style={{ display: "grid", gap: 18, maxWidth: 760, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="k-bar" style={{ flex: 1, ["--c" as string]: meta.color }} role="progressbar" aria-label={t("Round progress")} aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
            <i style={{ width: `${Math.max(4, progressPct)}%` }} />
          </div>
          <span className="k-chip">{i + 1} / {round.length}</span>
          {combo >= 2 && <span className="k-chip k-in" style={{ background: "#fff0c2", color: "#6e4300", borderColor: "#f0d391" }}><span className="k-flame" aria-hidden="true">🔥</span> {combo}</span>}
        </div>

        <section className="k-card k-in" key={i} style={{ display: "grid", gap: 14 }} aria-live="polite">
          <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
            {q.topic && <span className="k-chip" style={{ background: meta.color, color: "#fff" }}>{q.topic}</span>}
            {speechOk && (
              <button className="k-btn small light" onClick={() => speak(autoSpeak && q.say ? q.say : `${q.prompt}. ${q.options.join(". ")}`, { rate: autoSpeak ? 0.8 : 0.92 })} aria-label={autoSpeak ? t("Hear the word again") : t("Read the question aloud")}>
                🔊 {autoSpeak ? t("Hear it again") : t("Read to me")}
              </button>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <h2 style={{ flex: 1, minWidth: 0, fontSize: "clamp(1.7rem, 6vw, 2.6rem)", textAlign: autoSpeak ? "center" : "start", overflowWrap: "anywhere" }}>
              {autoSpeak ? q.prompt : <Prompt text={q.prompt} />}
            </h2>
            <Avatar guide={guide} size={84} bob />
          </div>
          {clueMode && q.clue && (
            <p className="k-chip" style={{ justifySelf: "center", fontSize: "1.2rem", background: "#fff0c2", color: "#6e4300", borderColor: "#f0d391" }}>💡 {t("Clue:")} {q.clue}</p>
          )}
        </section>

        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          {q.options.map((opt, idx) => {
            const state = picked === null ? "" : idx === q.answer ? "right" : idx === picked ? "wrong" : "";
            return (
              <button key={idx} className={`k-answer ${state}`} disabled={picked !== null} onClick={() => choose(idx)} aria-label={t("Answer {n}: {text}", { n: idx + 1, text: opt })}>
                <span className="key" aria-hidden="true">{idx + 1}</span>
                <span style={{ overflowWrap: "anywhere" }}>{opt}</span>
                {state === "right" && <span style={{ marginInlineStart: "auto" }} aria-hidden="true">✅</span>}
                {state === "wrong" && <span style={{ marginInlineStart: "auto" }} aria-hidden="true">❌</span>}
              </button>
            );
          })}
        </div>

        {feedback && (
          <div className="k-card k-in" role="status" style={{ display: "flex", gap: 14, alignItems: "center", background: feedback.right ? "#dcf5e8" : "#fde4e6", color: "#172033", borderColor: feedback.right ? "#9fdcbd" : "#f3b3b9" }}>
            <Avatar guide={guide} size={64} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p className="display" style={{ fontSize: "1.3rem" }}>{feedback.text}</p>
              {q.explain && <p style={{ fontWeight: 700 }}>{q.explain}</p>}
            </div>
            <button className="k-btn" style={{ ["--c" as string]: meta.color }} onClick={next} autoFocus>
              {i + 1 >= round.length ? `${t("Finish")} 🏁` : `${t("Next")} ${currentLang() === "ar" ? "⬅" : "➜"}`}
            </button>
          </div>
        )}
      </div>
    </KidShell>
  );
}
