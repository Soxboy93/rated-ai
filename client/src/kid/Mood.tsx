import { useEffect, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { MOODS } from "@shared/gamification";
import Avatar from "./Avatar";
import KidShell from "./Shell";
import { useChild } from "./ChildContext";
import { MOOD_META, guideById } from "./guides";
import { playSound } from "./sound";
import { t, T, currentLang } from "@/i18n";

const PHASES = [[T("Breathe in…"), 4], [T("Hold…"), 4], [T("Breathe out…"), 4]] as const;

function Breathing({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0); // 0..8 across 3 cycles
  useEffect(() => {
    if (step >= PHASES.length * 3) return;
    const timer = setTimeout(() => setStep(s => s + 1), PHASES[step % 3][1] * 1000);
    return () => clearTimeout(timer);
  }, [step]);
  const finished = step >= PHASES.length * 3;
  return (
    <div className="k-card" style={{ textAlign: "center", display: "grid", gap: 14, justifyItems: "center" }}>
      <h3 style={{ fontSize: "1.5rem" }}>{finished ? t("Nice and calm. Well done!") : t(PHASES[step % 3][0])}</h3>
      <div aria-hidden="true" style={{ width: 150, height: 150, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%, #fff8, var(--c-mood))", border: "1px solid var(--k-line)", animation: finished ? undefined : "k-breathe 12s ease-in-out infinite" }} />
      <p className="k-muted">{finished ? t("Take one more slow breath if you like.") : t("Breath {n} of 3. Follow the bubble.", { n: Math.floor(step / 3) + 1 })}</p>
      <button className="k-btn small light" onClick={onDone}>{finished ? t("Done") : t("Skip")}</button>
    </div>
  );
}

export default function Mood() {
  const { child, progress, refreshProgress, celebrate } = useChild();
  const guide = guideById(child?.selectedCharacter);
  const checkin = trpc.progress.checkin.useMutation();
  const [mood, setMood] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [done, setDone] = useState<{ reply: string; flagged: boolean } | null>(null);
  const [breathing, setBreathing] = useState(false);
  const [error, setError] = useState("");
  const olderKid = child?.ageGroup !== "kids";

  const submit = async () => {
    if (!child || !mood) return;
    setError("");
    try {
      const out = await checkin.mutateAsync({ profileId: child.id, mood: mood as (typeof MOODS)[number], note: note.trim() || undefined, language: currentLang() });
      playSound("badge");
      setDone({ reply: out.reply ?? MOOD_META[mood].reply, flagged: out.flagged !== "safe" });
      await refreshProgress();
      celebrate({ badges: out.newBadges });
    } catch (e) { setError(e instanceof Error ? t(e.message) : t("Could not save. Try again!")); }
  };

  if (done && mood) {
    const m = MOOD_META[mood];
    return (
      <KidShell title={t("How I Feel")} color="var(--c-mood)">
        <div style={{ display: "grid", gap: 16, maxWidth: 640, margin: "0 auto" }}>
          <div className="k-card k-in" style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <Avatar guide={guide} size={100} bob />
            <div>
              <h2 style={{ fontSize: "1.6rem" }}>{t("Thanks for telling me")} {m.emoji}</h2>
              <p style={{ fontSize: "1.15rem", marginTop: 6 }}>{done.reply}</p>
            </div>
          </div>
          {done.flagged && <p className="k-card k-note-warn">{t("Your grown-up can see this check-in so they can help.")}</p>}
          {["worried", "angry", "sad", "tired"].includes(mood) && !breathing && (
            <button className="k-btn" style={{ ["--c" as string]: "var(--c-memory)" }} onClick={() => setBreathing(true)}>🫧 {t("Try a calm breathing break")}</button>
          )}
          {breathing && <Breathing onDone={() => setBreathing(false)} />}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/" className="k-btn">🏠 {t("Home")}</Link>
            <button className="k-btn light" onClick={() => { setMood(null); setNote(""); setDone(null); setBreathing(false); }}>{t("Check in again")}</button>
          </div>
        </div>
      </KidShell>
    );
  }

  return (
    <KidShell title={t("How I Feel")} color="var(--c-mood)">
      <div style={{ display: "grid", gap: 20, maxWidth: 820, margin: "0 auto" }}>
        <div className="k-card" style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <Avatar guide={guide} size={100} bob />
          <div>
            <h2 style={{ fontSize: "2rem" }}>{t("How are you feeling?")}</h2>
            <p className="k-muted">{t("Tap the face that fits best. There are no wrong answers.")}{progress?.lastMood ? ` ${t("Last time you felt {mood}.", { mood: MOOD_META[progress.lastMood] ? MOOD_META[progress.lastMood].label : progress.lastMood })}` : ""}</p>
          </div>
        </div>
        <div role="radiogroup" aria-label={t("Your mood")} style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(112px, 1fr))" }}>
          {MOODS.map(id => {
            const m = MOOD_META[id];
            const on = mood === id;
            return (
              <button key={id} role="radio" aria-checked={on} className="k-tile" onClick={() => { setMood(id); playSound("tap"); }}
                style={{ ["--c" as string]: m.color, minHeight: 140, alignItems: "center", textAlign: "center", outline: on ? "3px solid var(--k-brand)" : undefined, transform: on ? "scale(1.05)" : undefined, color: "#2b2250" }}>
                <span className="icon" aria-hidden="true" style={{ fontSize: "3.4rem" }}>{m.emoji}</span>
                <span className="name" style={{ textShadow: "none" }}>{m.label}</span>
              </button>
            );
          })}
        </div>
        {mood && (
          <div className="k-card k-in" style={{ display: "grid", gap: 12 }}>
            {olderKid && (
              <>
                <label htmlFor="mood-note" style={{ fontWeight: 800 }}>{t("Want to add a few words? (optional)")}</label>
                <input id="mood-note" className="k-input" value={note} onChange={e => setNote(e.target.value)} maxLength={200} placeholder={t("What made you feel this way?")} />
                <p className="k-muted" style={{ fontSize: ".9rem" }}>{t("Your grown-up can read your check-ins.")}</p>
              </>
            )}
            {error && <p role="alert" style={{ color: "var(--k-bad)", fontWeight: 800 }}>{error}</p>}
            <div><button className="k-btn" style={{ ["--c" as string]: "var(--c-mood)" }} onClick={submit} disabled={checkin.isPending}>{t("Save my check-in")}</button></div>
          </div>
        )}
      </div>
    </KidShell>
  );
}
