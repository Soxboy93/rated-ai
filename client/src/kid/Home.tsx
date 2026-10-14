import { useMemo } from "react";
import { Link } from "wouter";
import { levelProgress } from "@shared/gamification";
import { useChild } from "./ChildContext";
import { GUIDES, guideById } from "./guides";
import { playSound } from "./sound";
import { t, fmtDate } from "@/i18n";
import KidShell from "./Shell";
import Avatar from "./Avatar";
import { LessonRow } from "./Lessons";

/** Home answers one question: what should I do now? Everything else is one tap away in the bottom bar. */
export default function Home() {
  const { child, progress } = useChild();
  const guide = guideById(child?.selectedCharacter ?? GUIDES[0].id);
  const lp = levelProgress(progress?.xp ?? 0);
  const greeting = useMemo(() => guide.greetings[Math.floor(Date.now() / 60000) % guide.greetings.length], [guide]);
  const lessons = progress?.lessons ?? [];
  const controls = progress?.controls;
  const focus = !!controls?.focus;

  const open = lessons.filter(l => !l.done).sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
  const next = open[0]
    ? { href: `/lesson/${open[0].shareId}`, icon: "📘", title: open[0].title, hint: open[0].dueDate ? t("due {date}", { date: fmtDate(open[0].dueDate + "T00:00:00") }) : t("Your teacher's lesson is ready."), cta: t("Start") }
    : lessons[0]
      ? { href: `/lesson/${lessons[0].shareId}`, icon: "🎮", title: lessons[0].title, hint: t("Practise it again with the game. It is not marked!"), cta: t("Practise") }
      : { href: "/play", icon: "🎮", title: t("Play a game"), hint: t("Earn XP and keep your streak going."), cta: t("Play") };

  const hour = new Date().getHours();
  const dayPart = hour < 12 ? t("Good morning") : hour < 17 ? t("Good afternoon") : t("Good evening");

  return (
    <KidShell>
      <div className="k-stack">
        <section className="k-card k-hero">
          <Avatar guide={guide} size={96} bob />
          <div style={{ display: "grid", gap: 8, minWidth: 0 }}>
            <h1 style={{ fontSize: "clamp(1.6rem, 5vw, 2.2rem)" }}>{dayPart}, <bdi>{child?.childName}</bdi>!</h1>
            <p className="k-muted" style={{ fontSize: "1.05rem" }}>{greeting}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span className="k-chip brand">{t("Level {level}", { level: lp.level })} · {t(progress?.title ?? "Newcomer")}</span>
              <span className="k-muted" style={{ fontWeight: 800 }}>{t("{n} XP to level {level}", { n: lp.next - (progress?.xp ?? 0), level: lp.level + 1 })}</span>
            </div>
            <div className="k-bar" role="progressbar" aria-label={t("Progress to next level")} aria-valuenow={Math.round(lp.fraction * 100)} aria-valuemin={0} aria-valuemax={100}>
              <i style={{ width: `${Math.max(4, Math.round(lp.fraction * 100))}%` }} />
            </div>
          </div>
        </section>

        <section className="k-card k-next" aria-labelledby="next">
          <span className="icon" aria-hidden="true">{next.icon}</span>
          <div style={{ flex: "1 1 200px", minWidth: 0 }}>
            <p className="k-muted" style={{ fontWeight: 800 }} id="next">{t("Up next")}</p>
            <h2 style={{ fontSize: "1.35rem" }}><bdi>{next.title}</bdi></h2>
            <p className="k-muted">{next.hint}</p>
          </div>
          <Link href={next.href} className="k-btn" onClick={() => playSound("tap")}>{next.cta}</Link>
        </section>

        {lessons.length > 0 && (
          <section aria-labelledby="lessons" style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <h2 id="lessons" className="k-section-title">{t("Your lessons")}</h2>
              <Link href="/lessons" style={{ fontWeight: 800, color: "var(--k-brand)" }}>{t("See all")}</Link>
            </div>
            <div style={{ display: "grid", gap: 12 }}>{lessons.slice(0, 3).map(l => <LessonRow key={l.shareId} l={l} />)}</div>
          </section>
        )}

        {!focus && <section aria-labelledby="jump" style={{ display: "grid", gap: 12 }}>
          <h2 id="jump" className="k-section-title">{t("Jump in")}</h2>
          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            {(
              <Link href="/ask" className="k-tile k-in" style={{ ["--c" as string]: "var(--c-ask)" }} onClick={() => playSound("tap")}>
                <span className="icon" aria-hidden="true">💬</span>
                <span><span className="name" style={{ display: "block" }}>{t("Ask {name}", { name: guide.short })}</span><span className="sub">{t("Chat, look things up, get homework help")}</span></span>
              </Link>
            )}
            <Link href="/play" className="k-tile k-in" style={{ ["--c" as string]: "var(--c-quiz)" }} onClick={() => playSound("tap")}>
              <span className="icon" aria-hidden="true">🎮</span>
              <span><span className="name" style={{ display: "block" }}>{t("Play")}</span><span className="sub">{t("Maths, spelling and quizzes")}</span></span>
            </Link>
          </div>
        </section>}
      </div>
    </KidShell>
  );
}
