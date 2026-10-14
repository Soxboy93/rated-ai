import { useMemo, useState } from "react";
import Avatar from "./Avatar";
import { type Guide } from "./guides";
import { playSound } from "./sound";
import { canSpeakIn, speak, stopSpeaking } from "./speech";
import { t, currentLang } from "@/i18n";
import Bidi from "@/components/Bidi";

type Dir = { dir: "rtl" | "ltr"; lang: string };
export type Card = { title: string; points: string[] };
export type PracticeQ = { q: string; options: string[]; answer: number; explanation: string };

const arrow = () => (currentLang() === "ar" ? "⬅" : "➜");

/** The lesson told as a short run of cards, one idea each, with the guide beside you and an optional read-aloud. */
export function LearnCards({ cards, summary, guide, d, onDone, onBack }: { cards: Card[]; summary: string[]; guide: Guide; d: Dir; onDone: () => void; onBack: () => void }) {
  const deck = useMemo<Card[]>(() => {
    const out = cards.filter(c => c.title || c.points.length);
    if (summary.length) out.push({ title: t("What to remember"), points: summary });
    return out;
  }, [cards, summary]);
  const [i, setI] = useState(0);
  const cur = deck[i];
  const last = i + 1 >= deck.length;
  if (!cur) { onDone(); return null; }
  const say = () => speak([cur.title, ...cur.points].join(". "));
  const go = (n: number) => { stopSpeaking(); playSound("tap"); setI(n); };
  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 760, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div className="k-bar" style={{ flex: 1, ["--c" as string]: "var(--c-lesson)" }} role="progressbar" aria-label={t("Round progress")} aria-valuenow={Math.round(((i + 1) / deck.length) * 100)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${Math.round(((i + 1) / deck.length) * 100)}%` }} /></div>
        <span className="k-chip">{i + 1} / {deck.length}</span>
      </div>
      <section className="k-card k-in" key={i} dir={d.dir} lang={d.lang} aria-live="polite" style={{ display: "grid", gap: 14, padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Avatar guide={guide} size={72} bob />
          <h2 style={{ fontSize: "clamp(1.4rem, 5vw, 2rem)", overflowWrap: "anywhere" }}><Bidi>{cur.title}</Bidi></h2>
        </div>
        {cur.points.length > 0 && (
          <ul style={{ margin: 0, paddingInlineStart: "1.3em", listStyle: "disc", display: "grid", gap: 10, fontSize: "clamp(1.15rem, 4vw, 1.5rem)" }}>
            {cur.points.map((p, n) => <li key={n}><Bidi>{p}</Bidi></li>)}
          </ul>
        )}
      </section>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" className="k-btn light" onClick={() => (i === 0 ? onBack() : go(i - 1))}>{i === 0 ? `🏠 ${t("Back")}` : t("Back")}</button>
        {canSpeakIn() && <button type="button" className="k-btn light" onClick={say}>🔊 {t("Listen")}</button>}
        <button type="button" className="k-btn" style={{ marginInlineStart: "auto" }} onClick={() => (last ? onDone() : go(i + 1))}>{last ? `🎮 ${t("Let's play!")}` : `${t("Next")} ${arrow()}`}</button>
      </div>
    </div>
  );
}

/** A practice round as a game: instant feedback, a combo counter, stars at the end. Nothing here is marked or can lose points. */
export function PracticeGame({ questions, guide, d, onExit, onQuiz }: { questions: PracticeQ[]; guide: Guide; d: Dir; onExit: () => void; onQuiz?: () => void }) {
  const [round, setRound] = useState(0);
  const order = useMemo(() => questions.map((_, n) => n).sort(() => Math.random() - 0.5), [questions, round]); // eslint-disable-line react-hooks/exhaustive-deps
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [right, setRight] = useState(0);
  const [combo, setCombo] = useState(0);
  const [best, setBest] = useState(0);
  const total = questions.length;
  const q = questions[order[i]];

  const choose = (idx: number) => {
    if (picked !== null) return;
    setPicked(idx);
    if (idx === q.answer) { setRight(r => r + 1); setCombo(c => { const n = c + 1; setBest(b => Math.max(b, n)); return n; }); playSound(combo >= 2 ? "match" : "correct"); }
    else { setCombo(0); playSound("wrong"); }
  };
  const next = () => { playSound("tap"); setPicked(null); setI(n => n + 1); };
  const again = () => { playSound("tap"); setRound(r => r + 1); setI(0); setPicked(null); setRight(0); setCombo(0); setBest(0); };

  if (i >= total) {
    const stars = right === total ? 3 : right >= Math.ceil(total * 0.6) ? 2 : 1;
    return (
      <div className="k-card k-in" style={{ maxWidth: 760, margin: "0 auto", textAlign: "center", display: "grid", gap: 12, justifyItems: "center" }}>
        <Avatar guide={guide} size={90} bob />
        <p style={{ fontSize: "2.4rem", letterSpacing: 6 }} aria-label={t("{n} stars", { n: stars })}>{"⭐".repeat(stars)}{"☆".repeat(3 - stars)}</p>
        <h2 style={{ fontSize: "1.8rem" }}>{stars === 3 ? t("Perfect round!") : t("Well done!")}</h2>
        <p className="display" style={{ fontSize: "1.4rem" }}>{t("{a} out of {b} right", { a: right, b: total })}</p>
        {best >= 2 && <p className="k-chip">🔥 {t("Best streak: {n} in a row", { n: best })}</p>}
        <p className="k-muted">{t("This was practice, so nothing is marked. Play again as often as you like!")}</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <button type="button" className="k-btn" onClick={again}>🔁 {t("Play again")}</button>
          {onQuiz && <button type="button" className="k-btn light" onClick={onQuiz}>📝 {t("Take the quiz")}</button>}
          <button type="button" className="k-btn light" onClick={onExit}>🏠 {t("Back")}</button>
        </div>
      </div>
    );
  }

  const ok = picked !== null && picked === q.answer;
  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 760, margin: "0 auto" }} dir={d.dir} lang={d.lang}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div className="k-bar" style={{ flex: 1, ["--c" as string]: "var(--c-words)" }} role="progressbar" aria-label={t("Round progress")} aria-valuenow={Math.round((i / total) * 100)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${Math.max(4, Math.round((i / total) * 100))}%` }} /></div>
        <span className="k-chip">{i + 1} / {total}</span>
        <span className="k-chip" aria-label={t("Stars")}>⭐ {right}</span>
        {combo >= 2 && <span className="k-chip k-in" style={{ background: "var(--k-brand)", color: "#fff", borderColor: "transparent" }}>🔥 {combo}</span>}
      </div>
      <section className="k-card k-in" key={`${round}-${i}`} aria-live="polite" style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <Avatar guide={guide} size={64} bob={picked === null} />
        <h2 style={{ fontSize: "clamp(1.4rem, 5vw, 2rem)", overflowWrap: "anywhere" }}><Bidi>{q.q}</Bidi></h2>
      </section>
      <div style={{ display: "grid", gap: 12 }}>
        {q.options.map((o, idx) => (
          <button key={idx} type="button" disabled={picked !== null} className={`k-answer${picked !== null && idx === q.answer ? " right" : picked === idx ? " wrong" : ""}`} onClick={() => choose(idx)}>
            <span className="key" aria-hidden="true">{["A", "B", "C", "D"][idx]}</span>
            <span style={{ overflowWrap: "anywhere" }}><Bidi>{o}</Bidi></span>
          </button>
        ))}
      </div>
      {picked !== null && (
        <div className={`k-card k-in ${ok ? "k-note-good" : "k-note-warn"}`} role="status" style={{ display: "grid", gap: 6 }}>
          <b>{ok ? (combo >= 3 ? t("Amazing, {n} in a row!", { n: combo }) : t("Yes! Well done!")) : t("Not quite, and that is fine. Here is how it works:")}</b>
          {q.explanation && <span>💡 {q.explanation}</span>}
        </div>
      )}
      <div style={{ display: "flex", gap: 10 }}>
        <button type="button" className="k-btn light" onClick={onExit}>{t("Stop")}</button>
        <button type="button" className="k-btn" style={{ marginInlineStart: "auto" }} disabled={picked === null} onClick={next}>{i + 1 >= total ? `${t("Finish")} 🏁` : `${t("Next")} ${arrow()}`}</button>
      </div>
    </div>
  );
}


export type Vocab = { term: string; meaning: string };

/** Flip a word to see what it means, then say whether you know it. Words you are unsure of come round again. */
export function WordCards({ vocab, guide, d, onDone, onBack }: { vocab: Vocab[]; guide: Guide; d: Dir; onDone: () => void; onBack: () => void }) {
  const [queue, setQueue] = useState(() => vocab.map((_, n) => n));
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(0);
  const cur = vocab[queue[0]];
  if (!cur) {
    return (
      <div className="k-card k-in" style={{ maxWidth: 760, margin: "0 auto", textAlign: "center", display: "grid", gap: 12, justifyItems: "center" }}>
        <Avatar guide={guide} size={90} bob />
        <h2 style={{ fontSize: "1.8rem" }}>{t("You went through all the words!")}</h2>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          {vocab.length >= 3 && <button type="button" className="k-btn" onClick={onDone}>🧩 {t("Match the words")}</button>}
          <button type="button" className="k-btn light" onClick={onBack}>🏠 {t("Back")}</button>
        </div>
      </div>
    );
  }
  const answer = (knew: boolean) => {
    playSound(knew ? "correct" : "tap");
    setFlipped(false);
    setQueue(q => (knew ? q.slice(1) : [...q.slice(1), q[0]]));
    if (knew) setKnown(k => k + 1);
  };
  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 760, margin: "0 auto" }} dir={d.dir} lang={d.lang}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div className="k-bar" style={{ flex: 1, ["--c" as string]: "var(--c-words)" }} role="progressbar" aria-label={t("Round progress")} aria-valuenow={Math.round((known / vocab.length) * 100)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${Math.max(4, Math.round((known / vocab.length) * 100))}%` }} /></div>
        <span className="k-chip">{known} / {vocab.length}</span>
      </div>
      <button type="button" className="k-card k-in" key={`${queue[0]}-${queue.length}`} onClick={() => { playSound("flip"); setFlipped(f => !f); }} aria-live="polite" aria-label={flipped ? t("Hide the meaning") : t("Show the meaning")}
        style={{ minHeight: 240, display: "grid", placeItems: "center", textAlign: "center", cursor: "pointer", padding: 24, background: flipped ? "var(--k-brand-soft)" : undefined }}>
        <span style={{ display: "grid", gap: 10 }}>
          <span style={{ fontSize: "clamp(2rem, 8vw, 3.2rem)", fontWeight: 800, overflowWrap: "anywhere" }}><Bidi>{cur.term}</Bidi></span>
          {flipped ? <span style={{ fontSize: "clamp(1.2rem, 4.5vw, 1.8rem)" }}><Bidi>{cur.meaning}</Bidi></span> : <span className="k-muted">👆 {t("Tap to see what it means")}</span>}
        </span>
      </button>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" className="k-btn light" onClick={onBack}>{t("Stop")}</button>
        {canSpeakIn() && <button type="button" className="k-btn light" onClick={() => speak(flipped ? `${cur.term}. ${cur.meaning}` : cur.term)}>🔊 {t("Listen")}</button>}
        {flipped && (
          <span style={{ display: "flex", gap: 10, marginInlineStart: "auto" }}>
            <button type="button" className="k-btn light" onClick={() => answer(false)}>🔁 {t("Show me again later")}</button>
            <button type="button" className="k-btn" onClick={() => answer(true)}>✅ {t("I know it!")}</button>
          </span>
        )}
      </div>
    </div>
  );
}

/** Match each word to its meaning. A wrong pick just wobbles; stars at the end depend on how few slips you made. */
export function MatchGame({ vocab, guide, d, onExit }: { vocab: Vocab[]; guide: Guide; d: Dir; onExit: () => void }) {
  const [round, setRound] = useState(0);
  const pairs = useMemo(() => [...vocab].sort(() => Math.random() - 0.5).slice(0, 6), [vocab, round]); // eslint-disable-line react-hooks/exhaustive-deps
  const meanings = useMemo(() => pairs.map((_, n) => n).sort(() => Math.random() - 0.5), [pairs]);
  const [term, setTerm] = useState<number | null>(null);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [slips, setSlips] = useState(0);
  const [wobble, setWobble] = useState<number | null>(null);

  const pickMeaning = (m: number) => {
    if (term === null || matched.has(m)) return;
    if (term === m) { playSound("match"); setMatched(new Set(matched).add(m)); setTerm(null); }
    else { playSound("wrong"); setSlips(s => s + 1); setWobble(m); setTimeout(() => setWobble(null), 400); }
  };
  const again = () => { setRound(r => r + 1); setMatched(new Set()); setSlips(0); setTerm(null); };

  if (matched.size === pairs.length) {
    const stars = slips === 0 ? 3 : slips <= 2 ? 2 : 1;
    return (
      <div className="k-card k-in" style={{ maxWidth: 760, margin: "0 auto", textAlign: "center", display: "grid", gap: 12, justifyItems: "center" }}>
        <Avatar guide={guide} size={90} bob />
        <p style={{ fontSize: "2.4rem", letterSpacing: 6 }} aria-label={t("{n} stars", { n: stars })}>{"⭐".repeat(stars)}{"☆".repeat(3 - stars)}</p>
        <h2 style={{ fontSize: "1.8rem" }}>{slips === 0 ? t("Perfect round!") : t("Well done!")}</h2>
        <p className="k-muted">{t("Mix-ups: {n}", { n: slips })}</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <button type="button" className="k-btn" onClick={again}>🔁 {t("Play again")}</button>
          <button type="button" className="k-btn light" onClick={onExit}>🏠 {t("Back")}</button>
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 760, margin: "0 auto" }} dir={d.dir} lang={d.lang}>
      <p className="k-card" style={{ display: "flex", gap: 12, alignItems: "center" }}><Avatar guide={guide} size={52} bob /> <b>{term === null ? t("Tap a word, then tap its meaning.") : t("Now tap the meaning that fits.")}</b></p>
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
        <div style={{ display: "grid", gap: 10, alignContent: "start" }}>
          {pairs.map((p, n) => (
            <button key={n} type="button" data-term={n} disabled={matched.has(n)} aria-pressed={term === n} className={`k-answer${matched.has(n) ? " right" : term === n ? " picked" : ""}`} onClick={() => { playSound("tap"); setTerm(n); }}>
              <span style={{ overflowWrap: "anywhere", fontWeight: 800 }}><Bidi>{p.term}</Bidi></span>
            </button>
          ))}
        </div>
        <div style={{ display: "grid", gap: 10, alignContent: "start" }}>
          {meanings.map(m => (
            <button key={m} type="button" data-meaning={m} disabled={matched.has(m)} className={`k-answer${matched.has(m) ? " right" : wobble === m ? " wrong" : ""}`} onClick={() => pickMeaning(m)}>
              <span style={{ overflowWrap: "anywhere", fontSize: ".95rem" }}><Bidi>{pairs[m].meaning}</Bidi></span>
            </button>
          ))}
        </div>
      </div>
      <div><button type="button" className="k-btn light" onClick={onExit}>{t("Stop")}</button></div>
    </div>
  );
}
