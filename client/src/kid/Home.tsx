import { useMemo } from "react";
import { Link } from "wouter";
import { levelProgress } from "@shared/gamification";
import { useChild } from "./ChildContext";
import { GAME_META, GUIDES, guideById } from "./guides";
import { playSound } from "./sound";
import { t, T, fmtDate } from "@/i18n";
import KidShell from "./Shell";

const TIPS = [
  T("Making mistakes is how brains grow. Every wrong answer teaches you something!"),
  T("Drink some water and stretch between games."),
  T("Try the games on a harder level when you feel ready."),
  T("A little practice every day beats a lot of practice once."),
  T("Ask your guide anything. There are no silly questions!"),
];

type Tile = { href: string; name: string; sub: string; icon: string; color: string };

export default function Home() {
  const { child, progress } = useChild();
  const guide = guideById(child?.selectedCharacter ?? GUIDES[0].id);
  const lp = levelProgress(progress?.xp ?? 0);
  const greeting = useMemo(() => guide.greetings[Math.floor(Date.now() / 60000) % guide.greetings.length], [guide]);
  const tip = t(TIPS[new Date().getDate() % TIPS.length]);

  const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
  const moodDone = !!progress?.lastMoodAt && new Date(progress.lastMoodAt) >= midnight;
  const playedToday = !!progress?.playedToday;
  const assignments = progress?.assignments ?? [];

  const games: Tile[] = (Object.keys(GAME_META) as Array<keyof typeof GAME_META>).map(id => ({
    href: `/games/${id}`, name: GAME_META[id].name, sub: GAME_META[id].blurb, icon: GAME_META[id].icon, color: GAME_META[id].color,
  }));
  const more: Tile[] = [
    { href: "/chat", name: t("Chat with {name}", { name: guide.short }), sub: t("Ask me anything"), icon: "💬", color: "var(--c-chat)" },
    { href: "/story", name: t("Story Maker"), sub: t("Dream up a tale"), icon: "📖", color: "var(--c-story)" },
    { href: "/doodle", name: t("Doodle Pad"), sub: t("Draw and stamp"), icon: "🎨", color: "var(--c-doodle)" },
    { href: "/homework", name: t("Homework Buddy"), sub: t("Learn it step by step"), icon: "📚", color: "var(--c-homework)" },
    { href: "/pet", name: t("My Pet"), sub: t("Feed and play"), icon: "🐉", color: "var(--c-pet)" },
    { href: "/mood", name: t("How I Feel"), sub: t("A quick check-in"), icon: "💛", color: "var(--c-mood)" },
    { href: "/trophies", name: t("Trophy Room"), sub: t("{n} badges", { n: progress?.badges.length ?? 0 }), icon: "🏆", color: "var(--c-trophy)" },
  ];

  const renderTile = (t: Tile, i: number) => (
    <Link key={t.href} href={t.href} className="k-tile k-in" style={{ ["--c" as string]: t.color, animationDelay: `${i * 50}ms` }} onClick={() => playSound("tap")}>
      <span className="icon" aria-hidden="true">{t.icon}</span>
      <span>
        <span className="name" style={{ display: "block" }}>{t.name}</span>
        <span className="sub">{t.sub}</span>
      </span>
    </Link>
  );

  return (
    <KidShell title={t("Home")} home>
      <div style={{ display: "grid", gap: 26 }}>
        <section className="k-card k-hero">
          <img src={guide.art} alt={guide.name} width={132} height={132} className="k-bob" />
          <div style={{ display: "grid", gap: 10, minWidth: 0 }}>
            <h2 style={{ fontSize: "clamp(1.6rem, 5vw, 2.4rem)" }}>{t("Hi {name}!", { name: child?.childName ?? "" })} {greeting}</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span className="k-chip" style={{ background: "var(--c-trophy)", color: "#2b2250" }}>{t("Level {level}", { level: lp.level })} · {t(progress?.title ?? "Newcomer")}</span>
              <span className="k-muted" style={{ fontWeight: 700 }}>{t("{n} XP", { n: progress?.xp ?? 0 })}</span>
            </div>
            <div className="k-bar" role="progressbar" aria-label={t("Progress to next level")} aria-valuenow={Math.round(lp.fraction * 100)} aria-valuemin={0} aria-valuemax={100}>
              <i style={{ width: `${Math.max(4, Math.round(lp.fraction * 100))}%`, ["--c" as string]: "var(--c-trophy)" }} />
            </div>
            <p className="k-muted" style={{ fontSize: ".95rem" }}>{t("{n} XP to level {level}", { n: lp.next - (progress?.xp ?? 0), level: lp.level + 1 })}</p>
          </div>
        </section>

        {assignments.length > 0 && (
          <section aria-labelledby="assigned" style={{ display: "grid", gap: 12 }}>
            <h2 id="assigned" style={{ fontSize: "1.6rem" }}>{t("From your teacher")}</h2>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
              {assignments.map(a => {
                const meta = GAME_META[a.game as keyof typeof GAME_META];
                if (!meta) return null;
                return (
                  <Link key={a.id} href={`/games/${a.game}`} className="k-card" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", color: "inherit", background: a.done ? "#b8f2d4" : undefined }}>
                    <span style={{ fontSize: "2rem" }} aria-hidden="true">{a.done ? "✅" : meta.icon}</span>
                    <span>
                      <b style={{ display: "block", color: a.done ? "#0d4a30" : undefined }}>{meta.name} · {t("Level {level}", { level: a.level })}</b>
                      <span className="k-muted" style={{ fontSize: ".95rem", color: a.done ? "#0d4a30" : undefined }}>
                        {a.done ? t("Done! Great job.") : t("Play level {level} or higher", { level: a.level })}
                        {a.dueDate && !a.done ? ` · ${t("due {date}", { date: fmtDate(a.dueDate + "T00:00:00") })}` : ""}
                      </span>
                      {a.note && <span className="k-muted" style={{ display: "block", fontSize: ".95rem" }}><bdi>{a.note}</bdi></span>}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <section aria-labelledby="missions" style={{ display: "grid", gap: 12 }}>
          <h2 id="missions" style={{ fontSize: "1.6rem" }}>{t("Today's missions")}</h2>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            <Mission done={playedToday} icon="🎮" text={t("Play a game")} hint={t("Any game counts")} href="/games/math" />
            <Mission done={moodDone} icon="💛" text={t("Check in with your feelings")} hint={t("It takes 10 seconds")} href="/mood" />
            <div className="k-card" style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: "2rem" }} aria-hidden="true">🔥</span>
              <div>
                <p style={{ fontWeight: 800 }}>{progress?.streakDays ? t("{n}-day streak!", { n: progress.streakDays }) : t("Start a streak")}</p>
                <p className="k-muted" style={{ fontSize: ".95rem" }}>{progress?.streakDays ? (playedToday ? t("Come back tomorrow to keep it!") : t("Play today to keep it going")) : t("Play today to begin")}</p>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="games" style={{ display: "grid", gap: 12 }}>
          <h2 id="games" style={{ fontSize: "1.6rem" }}>{t("Brain games")}</h2>
          <div style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fill, minmax(165px, 1fr))" }}>{games.map(renderTile)}</div>
        </section>

        <section aria-labelledby="more" style={{ display: "grid", gap: 12 }}>
          <h2 id="more" style={{ fontSize: "1.6rem" }}>{t("Make, ask and explore")}</h2>
          <div style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fill, minmax(165px, 1fr))" }}>{more.map((t, i) => renderTile(t, i + games.length))}</div>
        </section>

        <p className="k-card" style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ fontSize: "1.8rem" }} aria-hidden="true">💡</span>
          <span><b>{t("Tip:")}</b> {tip}</span>
        </p>
      </div>
    </KidShell>
  );
}

function Mission({ done, icon, text, hint, href }: { done: boolean; icon: string; text: string; hint: string; href: string }) {
  return (
    <Link href={href} className="k-card" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", color: "inherit", background: done ? "#b8f2d4" : undefined }}>
      <span style={{ fontSize: "2rem" }} aria-hidden="true">{done ? "✅" : icon}</span>
      <span>
        <b style={{ display: "block", color: done ? "#0d4a30" : undefined }}>{text}</b>
        <span className="k-muted" style={{ fontSize: ".95rem", color: done ? "#0d4a30" : undefined }}>{done ? t("Done! Great job.") : hint}</span>
      </span>
    </Link>
  );
}
