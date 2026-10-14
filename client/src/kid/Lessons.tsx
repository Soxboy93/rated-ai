import { Link } from "wouter";
import { useChild } from "./ChildContext";
import { playSound } from "./sound";
import { t, fmtDate } from "@/i18n";
import KidShell from "./Shell";

type L = { shareId: string; title: string; dueDate: string | null; done: boolean; result: { correct: number; total: number } | null };

export function LessonRow({ l }: { l: L }) {
  return (
    <Link href={`/lesson/${l.shareId}`} className="k-card k-row" onClick={() => playSound("tap")} style={{ background: l.done ? "var(--k-brand-soft)" : undefined }}>
      <span className="icon" aria-hidden="true">{l.done ? "✅" : "📘"}</span>
      <span style={{ minWidth: 0 }}>
        <b style={{ display: "block" }}><bdi>{l.title}</bdi></b>
        <span className="k-muted" style={{ fontSize: ".95rem" }}>
          {l.done && l.result ? t("{a} out of {b} right", { a: l.result.correct, b: l.result.total }) : t("Learn it, play the game, take the quiz")}
          {l.dueDate && !l.done ? ` · ${t("due {date}", { date: fmtDate(l.dueDate + "T00:00:00") })}` : ""}
        </span>
      </span>
    </Link>
  );
}

/** Every lesson your teacher has shared, to do first, then done. */
export default function Lessons() {
  const { progress } = useChild();
  const lessons = progress?.lessons ?? [];
  const todo = lessons.filter(l => !l.done);
  const done = lessons.filter(l => l.done);
  return (
    <KidShell title={t("Lessons")}>
      {lessons.length === 0 ? (
        <div className="k-card" style={{ textAlign: "center", display: "grid", gap: 8, justifyItems: "center" }}>
          <span style={{ fontSize: "2.6rem" }} aria-hidden="true">📭</span>
          <p style={{ fontSize: "1.15rem" }}>{t("No lessons yet. When your teacher shares one, it appears here.")}</p>
        </div>
      ) : (
        <div className="k-stack">
          {todo.length > 0 && <section style={{ display: "grid", gap: 12 }}><h2 className="k-section-title">{t("To do")}</h2>{todo.map(l => <LessonRow key={l.shareId} l={l} />)}</section>}
          {done.length > 0 && <section style={{ display: "grid", gap: 12 }}><h2 className="k-section-title">{t("Done")}</h2>{done.map(l => <LessonRow key={l.shareId} l={l} />)}</section>}
        </div>
      )}
    </KidShell>
  );
}
