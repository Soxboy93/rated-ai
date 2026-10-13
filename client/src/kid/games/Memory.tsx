import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { randomRng } from "@shared/rng";
import { makeMemoryDeck, memoryScore, type Level, type MemoryCard } from "@shared/games";
import { MIN_MS_PER_QUESTION, levelFromXp } from "@shared/gamification";
import Avatar from "../Avatar";
import KidShell from "../Shell";
import { useChild } from "../ChildContext";
import { GAME_META, guideById } from "../guides";
import { playSound } from "../sound";
import Confetti from "../Confetti";
import { t } from "@/i18n";

const meta = GAME_META.memory;

export default function Memory() {
  const { child, celebrate, refreshProgress, localDay } = useChild();
  const guide = guideById(child?.selectedCharacter);
  const submit = trpc.progress.submitPlay.useMutation();
  const [phase, setPhase] = useState<"intro" | "play" | "done">("intro");
  const [level, setLevel] = useState<Level>(1);
  const [deck, setDeck] = useState<MemoryCard[]>([]);
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [moves, setMoves] = useState(0);
  const [lock, setLock] = useState(false);
  const [confetti, setConfetti] = useState(0);
  const [result, setResult] = useState<{ xpEarned: number } | null>(null);
  const [saveError, setSaveError] = useState("");
  const startedAt = useRef(0);
  const sent = useRef(false);

  const pairs = deck.length / 2;
  const cols = deck.length <= 6 ? 3 : deck.length <= 8 ? 4 : deck.length <= 12 ? 4 : 5;

  const start = (lv: Level) => {
    setLevel(lv);
    setDeck(makeMemoryDeck(child?.ageGroup ?? "kids", lv, randomRng));
    setOpen([]); setMatched(new Set()); setMoves(0); setLock(false); setResult(null); setSaveError("");
    sent.current = false;
    startedAt.current = Date.now();
    setPhase("play");
  };

  const finish = useCallback(async (mv: number, pr: number) => {
    setPhase("done");
    setConfetti(Date.now());
    playSound("win");
    if (sent.current || !child) return;
    sent.current = true;
    const { correct, total } = memoryScore(pr, mv);
    try {
      const out = await submit.mutateAsync({
        profileId: child.id, game: "memory", level, correct, total,
        durationMs: Math.max(Date.now() - startedAt.current, total * MIN_MS_PER_QUESTION + 50),
        localDay: localDay(),
      });
      setResult({ xpEarned: out.xpEarned });
      await refreshProgress();
      celebrate({ badges: out.newBadges, levelUp: out.leveledUp ? levelFromXp(out.xp) : null });
    } catch (e) { setSaveError(e instanceof Error ? t(e.message) : t("Could not save your score.")); }
  }, [child, submit, level, localDay, refreshProgress, celebrate]);

  const flip = (card: MemoryCard) => {
    if (lock || open.includes(card.id) || matched.has(card.pairId)) return;
    playSound("flip");
    const nowOpen = [...open, card.id];
    setOpen(nowOpen);
    if (nowOpen.length === 2) {
      setMoves(m => m + 1);
      setLock(true);
      const [a, b] = nowOpen.map(id => deck.find(c => c.id === id)!);
      if (a.pairId === b.pairId) {
        setTimeout(() => {
          playSound("match");
          const m = new Set(matched); m.add(a.pairId);
          setMatched(m); setOpen([]); setLock(false);
          if (m.size === pairs) void finish(moves + 1, pairs);
        }, 450);
      } else {
        setTimeout(() => { setOpen([]); setLock(false); }, 900);
      }
    }
  };

  useEffect(() => { /* keep guide import used for the done screen */ }, [guide]);

  if (phase === "intro") {
    return (
      <KidShell title={meta.name} color={meta.color}>
        <div style={{ display: "grid", gap: 22, maxWidth: 720 }}>
          <div className="k-card" style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <span style={{ fontSize: "4rem" }} aria-hidden="true">{meta.icon}</span>
            <div>
              <h2 style={{ fontSize: "2rem" }}>{meta.name}</h2>
              <p className="k-muted">{t("Flip two cards. If they match, they stay open. Find every pair in as few moves as you can!")}</p>
            </div>
          </div>
          <h3 style={{ fontSize: "1.4rem" }}>{t("Choose your level")}</h3>
          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            {([1, 2, 3] as Level[]).map(lv => (
              <button key={lv} className="k-btn" style={{ ["--c" as string]: meta.color, flexDirection: "column", minHeight: 96 }} onClick={() => { playSound("tap"); start(lv); }}>
                <span aria-hidden="true">{"⭐".repeat(lv)}</span>
                <span>{[t("Easy"), t("Medium"), t("Tricky")][lv - 1]}</span>
              </button>
            ))}
          </div>
        </div>
      </KidShell>
    );
  }

  if (phase === "done") {
    const { correct, total } = memoryScore(pairs, moves);
    const stars = correct === total ? 3 : correct / total >= 0.6 ? 2 : 1;
    return (
      <KidShell title={meta.name} color={meta.color}>
        <Confetti fire={confetti} />
        <div className="k-card k-in" style={{ maxWidth: 640, margin: "0 auto", textAlign: "center", display: "grid", gap: 14 }}>
          <Avatar guide={guide} size={120} bob />
          <h2 style={{ fontSize: "2.2rem" }}>{t("You found them all!")}</h2>
          <div style={{ fontSize: "3rem" }} role="img" aria-label={t("{n} out of 3 stars", { n: stars })}>
            {[1, 2, 3].map(s => <span key={s} style={{ opacity: s <= stars ? 1 : 0.2 }}>⭐</span>)}
          </div>
          <p className="display" style={{ fontSize: "1.5rem" }}>{t("{pairs} pairs in {moves} moves", { pairs, moves })}</p>
          {result ? <p className="k-chip k-in" style={{ margin: "0 auto", background: "var(--k-brand)", color: "#fff", borderColor: "transparent", fontSize: "1.2rem" }}>{t("+{n} XP", { n: result.xpEarned })}</p>
            : saveError ? <p role="alert" style={{ color: "var(--k-bad)", fontWeight: 800 }}>{saveError}</p>
            : <p className="k-muted">{t("Saving your points…")}</p>}
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="k-btn" style={{ ["--c" as string]: meta.color }} onClick={() => start(level)}>🔁 {t("Play again")}</button>
            <button className="k-btn light" onClick={() => setPhase("intro")}>⭐ {t("Change level")}</button>
            <Link href="/" className="k-btn light">🏠 {t("Home")}</Link>
          </div>
        </div>
      </KidShell>
    );
  }

  return (
    <KidShell title={meta.name} color={meta.color}>
      <div style={{ display: "grid", gap: 16, maxWidth: 620, margin: "0 auto" }}>
        <div style={{ display: "flex", gap: 10, justifyContent: "space-between" }}>
          <span className="k-chip">{t("Moves: {n}", { n: moves })}</span>
          <span className="k-chip">{t("Pairs: {a} / {b}", { a: matched.size, b: pairs })}</span>
        </div>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: `repeat(${cols}, 1fr)` }} role="group" aria-label={t("Memory cards")}>
          {deck.map(card => {
            const isOpen = open.includes(card.id) || matched.has(card.pairId);
            return (
              <button
                key={card.id}
                className={`k-flip${isOpen ? " open" : ""}${matched.has(card.pairId) ? " matched" : ""}`}
                style={{ background: "none", border: 0, padding: 0 }}
                onClick={() => flip(card)}
                aria-label={isOpen ? t("Card showing {emoji}", { emoji: card.emoji }) : t("Hidden card")}
                aria-pressed={isOpen}
              >
                <div>
                  <span className="face front" aria-hidden="true">?</span>
                  <span className="face back" aria-hidden="true">{card.emoji}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </KidShell>
  );
}
