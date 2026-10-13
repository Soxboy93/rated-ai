import { useRef, useState } from "react";
import { Link, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { MIN_MS_PER_QUESTION, levelFromXp } from "@shared/gamification";
import KidShell from "./Shell";
import Avatar from "./Avatar";
import { useChild } from "./ChildContext";
import { guideById } from "./guides";
import { playSound } from "./sound";
import { t, currentLang } from "@/i18n";
import Bidi from "@/components/Bidi";
import { LearnCards, MatchGame, PracticeGame, WordCards } from "./LessonGame";
import LessonHelp from "./LessonHelp";

/** A lesson the teacher shared: read the summary and examples, then take the quiz. Marking happens on the server. */
export default function Lesson() {
  const { shareId = "" } = useParams<{ shareId: string }>();
  const { child, celebrate, refreshProgress, localDay } = useChild();
  const guide = guideById(child?.selectedCharacter);
  const q = trpc.studentLessons.get.useQuery({ profileId: child?.id ?? "", shareId }, { enabled: !!child && !!shareId });
  const submit = trpc.studentLessons.submit.useMutation();
  const [phase, setPhase] = useState<"hub" | "learn" | "practice" | "words" | "match" | "quiz" | "done">("hub");
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [shown, setShown] = useState<Record<number, boolean>>({});
  const [error, setError] = useState("");
  const startedAt = useRef(0);

  if (q.isLoading) return <KidShell title={t("Lesson")} color="var(--c-homework)"><p className="k-muted">{t("Loading…")}</p></KidShell>;
  if (q.error || !q.data) {
    return (
      <KidShell title={t("Lesson")} color="var(--c-homework)">
        <div className="k-card k-note-bad" role="alert">{t(q.error?.message ?? "Lesson not found")}</div>
        <div style={{ marginTop: 16 }}><Link href="/" className="k-btn">🏠 {t("Home")}</Link></div>
      </KidShell>
    );
  }
  const lesson = q.data;
  const dir = lesson.language === "ar" ? "rtl" : "ltr";
  const total = lesson.quiz.length;
  const out = submit.data;

  const finish = async (final: number[]) => {
    setError("");
    try {
      const res = await submit.mutateAsync({ profileId: child!.id, shareId, answers: final, durationMs: Math.max(Date.now() - startedAt.current, total * MIN_MS_PER_QUESTION + 50), localDay: localDay() });
      setPhase("done");
      playSound(res.correct === res.total ? "win" : "badge");
      await refreshProgress();
      if (!res.already) celebrate({ badges: res.newBadges, levelUp: res.leveledUp && res.xp != null ? levelFromXp(res.xp) : null });
      void q.refetch();
    } catch (e) { setError(t(e instanceof Error ? e.message : "Could not save your score.")); }
  };

  const choose = (idx: number) => {
    playSound("tap");
    const next = [...answers]; next[i] = idx; setAnswers(next);
  };
  const next = () => {
    playSound("tap");
    if (i + 1 >= total) void finish(answers);
    else setI(i + 1);
  };

  /* ---------------------------------------------------------------- done */
  if (phase === "done" && out) {
    return (
      <KidShell title={lesson.title} color="var(--c-homework)">
        <div style={{ display: "grid", gap: 18, maxWidth: 760, margin: "0 auto" }}>
          <div className="k-card k-in" style={{ textAlign: "center", display: "grid", gap: 12, justifyItems: "center" }}>
            <Avatar guide={guide} size={84} bob />
            <h2 style={{ fontSize: "1.8rem" }}>{out.correct === out.total ? t("Perfect score!") : t("Well done!")}</h2>
            <p className="display" style={{ fontSize: "1.5rem" }}>{t("{a} out of {b} right", { a: out.correct, b: out.total })}</p>
            {out.already ? <p className="k-muted">{t("You already took this quiz, so your first score is kept.")}</p>
              : <p className="k-chip" style={{ background: "var(--k-brand)", color: "#fff", borderColor: "transparent", fontSize: "1.1rem" }}>{t("+{n} XP", { n: out.xpEarned })}</p>}
          </div>
          <section aria-label={t("Check your answers")} style={{ display: "grid", gap: 12 }} dir={dir} lang={lesson.language}>
            <h3 style={{ fontSize: "1.3rem" }}>{t("Check your answers")}</h3>
            {lesson.quiz.map((qq, n) => {
              const r = out.review[n];
              return (
                <div key={n} className={`k-card ${r.right ? "k-note-good" : "k-note-warn"}`} style={{ display: "grid", gap: 4 }}>
                  <b>{r.right ? "✅" : "❌"} {n + 1}. <Bidi>{qq.q}</Bidi></b>
                  <span>{t("Right answer:")} <Bidi>{qq.options[r.correctAnswer]}</Bidi></span>
                  {r.explanation && <span>💡 {r.explanation}</span>}
                </div>
              );
            })}
          </section>
          <div><Link href="/" className="k-btn">🏠 {t("Home")}</Link></div>
        </div>
      </KidShell>
    );
  }

  const d = { dir: dir as "rtl" | "ltr", lang: lesson.language };
  const startQuiz = () => { startedAt.current = Date.now(); setAnswers([]); setI(0); setPhase("quiz"); };
  if (phase === "learn") {
    return (
      <KidShell title={lesson.title} color="var(--c-homework)">
        <LearnCards cards={lesson.cards} summary={lesson.summary} guide={guide} d={d} onBack={() => setPhase("hub")} onDone={() => setPhase(lesson.practice.length ? "practice" : "hub")} />
      </KidShell>
    );
  }
  if (phase === "words") {
    return (
      <KidShell title={lesson.title} color="var(--c-memory)">
        <WordCards vocab={lesson.vocabulary} guide={guide} d={d} onBack={() => setPhase("hub")} onDone={() => setPhase("match")} />
      </KidShell>
    );
  }
  if (phase === "match") {
    return (
      <KidShell title={lesson.title} color="var(--c-memory)">
        <MatchGame vocab={lesson.vocabulary} guide={guide} d={d} onExit={() => setPhase("hub")} />
      </KidShell>
    );
  }
  if (phase === "practice") {
    return (
      <KidShell title={lesson.title} color="var(--c-memory)">
        <PracticeGame questions={lesson.practice} guide={guide} d={d} onExit={() => setPhase("hub")} onQuiz={lesson.result || total === 0 ? undefined : startQuiz} />
      </KidShell>
    );
  }

  /* ---------------------------------------------------------------- quiz */
  if (phase === "quiz") {
    const cur = lesson.quiz[i];
    return (
      <KidShell title={lesson.title} color="var(--c-homework)">
        <div style={{ display: "grid", gap: 16, maxWidth: 760, margin: "0 auto" }} dir={dir} lang={lesson.language}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="k-bar" style={{ flex: 1, ["--c" as string]: "var(--c-homework)" }} role="progressbar" aria-label={t("Round progress")} aria-valuenow={Math.round((i / total) * 100)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${Math.max(4, Math.round((i / total) * 100))}%` }} /></div>
            <span className="k-chip">{i + 1} / {total}</span>
          </div>
          <section className="k-card k-in" key={i} aria-live="polite"><h2 style={{ fontSize: "clamp(1.4rem, 5vw, 2rem)", overflowWrap: "anywhere" }}><Bidi>{cur.q}</Bidi></h2></section>
          <div style={{ display: "grid", gap: 12 }}>
            {cur.options.map((o, idx) => (
              <button key={idx} type="button" className={`k-answer${answers[i] === idx ? " picked" : ""}`} aria-pressed={answers[i] === idx} onClick={() => choose(idx)}>
                <span className="key" aria-hidden="true">{["A", "B", "C", "D"][idx]}</span>
                <span style={{ overflowWrap: "anywhere" }}><Bidi>{o}</Bidi></span>
              </button>
            ))}
          </div>
          {error && <p role="alert" className="k-card k-note-bad">{error}</p>}
          <div><button type="button" className="k-btn" disabled={answers[i] === undefined || submit.isPending} onClick={next}>{i + 1 >= total ? `${t("Finish")} 🏁` : `${t("Next")} ${currentLang() === "ar" ? "⬅" : "➜"}`}</button></div>
        </div>
      </KidShell>
    );
  }

  /* ---------------------------------------------------------------- hub */
  return (
    <KidShell title={lesson.title} color="var(--c-homework)">
      <div style={{ display: "grid", gap: 18, maxWidth: 760, margin: "0 auto" }}>
        <div className="k-card" style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <Avatar guide={guide} size={72} />
          <p className="k-muted" style={{ fontSize: "1.1rem" }}>{t("Your teacher shared this lesson. Pick how you want to learn it!")}</p>
        </div>

        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          {lesson.cards.length + lesson.summary.length > 0 && (
            <button type="button" className="k-tile" style={{ ["--c" as string]: "var(--c-homework)", textAlign: "start" }} onClick={() => { playSound("tap"); setPhase("learn"); }}>
              <span className="icon" aria-hidden="true">🎴</span><span><span className="name" style={{ display: "block" }}>{t("Learn it with {name}", { name: guide.short })}</span><span className="sub">{t("Short cards, one idea each")}</span></span>
            </button>
          )}
          {lesson.vocabulary.length > 0 && (
            <button type="button" className="k-tile" style={{ ["--c" as string]: "var(--c-patterns)", textAlign: "start" }} onClick={() => { playSound("tap"); setPhase("words"); }}>
              <span className="icon" aria-hidden="true">🔤</span><span><span className="name" style={{ display: "block" }}>{t("Word cards")}</span><span className="sub">{t("Flip them, then match them")}</span></span>
            </button>
          )}
          {lesson.practice.length > 0 && (
            <button type="button" className="k-tile" style={{ ["--c" as string]: "var(--c-memory)", textAlign: "start" }} onClick={() => { playSound("tap"); setPhase("practice"); }}>
              <span className="icon" aria-hidden="true">🎮</span><span><span className="name" style={{ display: "block" }}>{t("Play the practice game")}</span><span className="sub">{t("Not marked. Play as much as you like")}</span></span>
            </button>
          )}
        </div>

        <div style={{ display: "grid", gap: 18 }} dir={dir} lang={lesson.language}>
          {lesson.summary.length > 0 && (
            <section className="k-card" style={{ display: "grid", gap: 8 }}>
              <h2 style={{ fontSize: "1.4rem" }}>{t("What to remember")}</h2>
              <ul style={{ margin: 0, paddingInlineStart: "1.3em", listStyle: "disc", display: "grid", gap: 6, fontSize: "1.1rem" }}>{lesson.summary.map((s, n) => <li key={n}>{s}</li>)}</ul>
            </section>
          )}
          {lesson.examples.length > 0 && (
            <section className="k-card" style={{ display: "grid", gap: 12 }}>
              <h2 style={{ fontSize: "1.4rem" }}>{t("Examples")}</h2>
              {lesson.examples.map((e, n) => (
                <div key={n} style={{ display: "grid", gap: 6 }}>
                  <b style={{ fontSize: "1.1rem" }}><Bidi>{e.prompt}</Bidi></b>
                  {shown[n] ? <p className="k-note-good" style={{ padding: "8px 12px", borderRadius: 12 }}>✅ <Bidi>{e.solution}</Bidi></p>
                    : <div><button type="button" className="k-btn small light" onClick={() => setShown(s => ({ ...s, [n]: true }))}>{t("Show the solution")}</button></div>}
                </div>
              ))}
            </section>
          )}
        </div>

        {lesson.result ? (
          <div className="k-card k-note-good" role="status" style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span style={{ fontSize: "1.8rem" }} aria-hidden="true">✅</span>
            <div><b>{t("You took the quiz.")}</b><p>{t("{a} out of {b} right", { a: lesson.result.correct, b: lesson.result.total })}</p></div>
          </div>
        ) : total > 0 ? (
          <div><button type="button" className="k-btn" style={{ ["--c" as string]: "var(--c-homework)" }} onClick={startQuiz}>📝 {t("Take the quiz")}</button></div>
        ) : null}
        {child && <LessonHelp shareId={shareId} />}
      </div>
    </KidShell>
  );
}
