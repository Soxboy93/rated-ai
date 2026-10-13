import { useMemo } from "react";
import { Link } from "wouter";
import { levelProgress } from "@shared/gamification";
import { useChild } from "./ChildContext";
import { GAME_META, GUIDES, guideById } from "./guides";
import { playSound } from "./sound";
import { t, T, fmtDate } from "@/i18n";
import KidShell from "./Shell";
import Avatar from "./Avatar";

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
  const lessons = progress?.lessons ?? [];

  const games: Tile[] = (Object.keys(GAME_META) as Array<keyof typeof GAME_META>).map(id => ({
    href: `/games/${id}`, name: GAME_META[id].name, sub: GAME_META[id].blurb, icon: GAME_META[id].icon, color: GAME_META[id].color,
  }));
  const ctl = progress?.controls;
  const focus = !!ctl?.focus;
  const more: Tile[] = [
    ...(lessons.length > 0 ? [{ href: "/boost", name: t("Daily Boost"), sub: t("A quick mix from your lessons"), icon: "🚀", color: "var(--c-memory)" }] : []),
    { href: "/search", name: t("Safe Search"), sub: t("Find things out"), icon: "🔎", color: "var(--c-search)" },
    { href: "/chat", name: t("Chat with {name}", { name: guide.short }), sub: t("Ask me anything"), icon: "💬", color: "var(--c-chat)" },
    { href: "/story", name: t("Story Maker"), sub: t("Dream up a tale"), icon: "📖", color: "var(--c-story)" },
    { href: "/doodle", name: t("Doodle Pad"), sub: t("Draw and stamp"), icon: "🎨", color: "var(--c-doodle)" },
    { href: "/homework", name: t("Homework Buddy"), sub: t("Learn it step by step"), icon: "📚", color: "var(--c-homework)" },
    { href: "/pet", name: t("My Pet"), sub: t("Feed and play"), icon: "🐉", color: "var(--c-pet)" },
    { href: "/mood", name: t("How I Feel"), sub: t("A quick check-in"), icon: "💛", color: "var(--c-mood)" },
    { href: "/trophies", name: t("Trophy Room"), sub: t("{n} badges", { n: progress?.badges.length ?? 0 }), icon: "🏆", color: "var(--c-trophy)" },
  ];

  // The companion's suggestion for what to do right now: the most urgent unfinished lesson, then a teacher's game, then free play.
  const openLessons = lessons.filter(l => !l.done).sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
  const openAssignment = assignments.find(a => !a.done);
  const hour = new Date().getHours();
  const dayPart = hour < 12 ? t("Good morning") : hour < 17 ? t("Good afternoon") : t("Good evening");
  const next = openLessons[0]
    ? { href: `/lesson/${openLessons[0].shareId}`, icon: "📘", title: openLessons[0].title, hint: t("Your teacher's lesson is ready. Let's learn it together!"), cta: t("Start the lesson") }
    : openAssignment && GAME_META[openAssignment.game as keyof typeof GAME_META]
      ? { href: `/games/${openAssignment.game}`, icon: GAME_META[openAssignment.game as keyof typeof GAME_META].icon, title: GAME_META[openAssignment.game as keyof typeof GAME_META].name, hint: t("Your teacher picked this game for you."), cta: t("Play now") }
      : lessons[0]
        ? { href: `/lesson/${lessons[0].shareId}`, icon: "🎮", title: lessons[0].title, hint: t("Practise it again with the game. It is not marked!"), cta: t("Practise") }
        : { href: "/games/math", icon: "🎮", title: t("Play a game"), hint: t("Any game counts"), cta: t("Play now") };

  const visibleMore = more.filter(tl => {
    if (tl.href === "/search") return !focus && ctl?.search !== false;
    if (tl.href === "/chat") return !focus && ctl?.chat !== false;
    if (focus) return !["/story", "/doodle", "/pet", "/homework"].includes(tl.href);
    return true;
  });

  const renderTile = (tl: Tile, i: number) => (
    <Link key={tl.href} href={tl.href} className="k-tile k-in" style={{ ["--c" as string]: tl.color, animationDelay: `${Math.min(i, 10) * 40}ms` }} onClick={() => playSound("tap")}>
      <span className="icon" aria-hidden="true">{tl.icon}</span>
      <span>
        <span className="name" style={{ display: "block" }}>{tl.name}</span>
        <span className="sub">{tl.sub}</span>
      </span>
    </Link>
  );

  const sectionTitle = { fontSize: "1.3rem" } as const;
  const grid = { display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fill, minmax(168px, 1fr))" } as const;

  return (
    <KidShell title={t("Home")} home>
      <div style={{ display: "grid", gap: 28 }}>
        <section className="k-card k-hero" style={{ padding: 24 }}>
          <Avatar guide={guide} size={104} bob />
          <div style={{ display: "grid", gap: 10, minWidth: 0 }}>
            <h2 style={{ fontSize: "clamp(1.5rem, 4.5vw, 2.2rem)" }}>{t("Hi {name}!", { name: child?.childName ?? "" })}</h2>
            <p className="k-muted" style={{ fontSize: "1.1rem" }}>{greeting}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span className="k-chip" style={{ background: "var(--k-brand)", color: "#fff", borderColor: "transparent" }}>{t("Level {level}", { level: lp.level })} · {t(progress?.title ?? "Newcomer")}</span>
              <span className="k-muted" style={{ fontWeight: 700 }}>{t("{n} XP", { n: progress?.xp ?? 0 })}</span>
            </div>
            <div className="k-bar" role="progressbar" aria-label={t("Progress to next level")} aria-valuenow={Math.round(lp.fraction * 100)} aria-valuemin={0} aria-valuemax={100}>
              <i style={{ width: `${Math.max(4, Math.round(lp.fraction * 100))}%` }} />
            </div>
            <p className="k-muted" style={{ fontSize: ".95rem" }}>{t("{n} XP to level {level}", { n: lp.next - (progress?.xp ?? 0), level: lp.level + 1 })}</p>
          </div>
        </section>

        <section aria-labelledby="today" className="k-card k-in" style={{ display: "grid", gap: 12, background: "var(--k-brand-soft)", borderColor: "transparent" }}>
          <h2 id="today" style={sectionTitle}>{dayPart}, {child?.childName}! {t("Here is what's next")}</h2>
          <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: "2rem" }} aria-hidden="true">{next.icon}</span>
            <div style={{ flex: "1 1 220px", minWidth: 0 }}>
              <b style={{ display: "block", fontSize: "1.2rem" }}><bdi>{next.title}</bdi></b>
              <span className="k-muted">{next.hint}</span>
            </div>
            <Link href={next.href} className="k-btn" onClick={() => playSound("tap")}>{next.cta}</Link>
          </div>
          {focus ? <p className="k-muted">🎯 {t("Focus time: your teacher has set up what to do right now.")}</p> : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {ctl?.search !== false && <Link href="/search" className="k-btn small light" onClick={() => playSound("tap")}>🔎 {t("Find something out")}</Link>}
              <Link href="/homework" className="k-btn small light" onClick={() => playSound("tap")}>📚 {t("Help with homework")}</Link>
              {ctl?.chat !== false && <Link href="/chat" className="k-btn small light" onClick={() => playSound("tap")}>💬 {t("Talk to {name}", { name: guide.short })}</Link>}
            </div>
          )}
        </section>

        {lessons.length > 0 && (
          <section aria-labelledby="lessons" style={{ display: "grid", gap: 12 }}>
            <h2 id="lessons" style={sectionTitle}>{t("Lessons from your teacher")}</h2>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
              {lessons.map(l => (
                <Link key={l.shareId} href={`/lesson/${l.shareId}`} className="k-card" style={{ display: "flex", alignItems: "center", gap: 14, textDecoration: "none", color: "inherit", background: l.done ? "var(--k-brand-soft)" : undefined, borderColor: l.done ? "var(--k-brand)" : undefined }}>
                  <span style={{ fontSize: "1.8rem" }} aria-hidden="true">{l.done ? "✅" : "📘"}</span>
                  <span>
                    <b style={{ display: "block" }}><bdi>{l.title}</bdi></b>
                    <span className="k-muted" style={{ fontSize: ".95rem" }}>
                      {l.done && l.result ? t("{a} out of {b} right", { a: l.result.correct, b: l.result.total }) : t("Read it and take the quiz")}
                      {l.dueDate && !l.done ? ` · ${t("due {date}", { date: fmtDate(l.dueDate + "T00:00:00") })}` : ""}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {assignments.length > 0 && (
          <section aria-labelledby="assigned" style={{ display: "grid", gap: 12 }}>
            <h2 id="assigned" style={sectionTitle}>{t("From your teacher")}</h2>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
              {assignments.map(a => {
                const meta = GAME_META[a.game as keyof typeof GAME_META];
                if (!meta) return null;
                return (
                  <Link key={a.id} href={`/games/${a.game}`} className="k-card" style={{ display: "flex", alignItems: "center", gap: 14, textDecoration: "none", color: "inherit", background: a.done ? "var(--k-brand-soft)" : undefined, borderColor: a.done ? "var(--k-brand)" : undefined }}>
                    <span style={{ fontSize: "1.8rem" }} aria-hidden="true">{a.done ? "✅" : meta.icon}</span>
                    <span>
                      <b style={{ display: "block" }}>{meta.name} · {t("Level {level}", { level: a.level })}</b>
                      <span className="k-muted" style={{ fontSize: ".95rem" }}>
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
          <h2 id="missions" style={sectionTitle}>{t("Today's missions")}</h2>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            <Mission done={playedToday} icon="🎮" text={t("Play a game")} hint={t("Any game counts")} href="/games/math" />
            <Mission done={moodDone} icon="💛" text={t("Check in with your feelings")} hint={t("It takes 10 seconds")} href="/mood" />
            <div className="k-card" style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ fontSize: "1.8rem" }} aria-hidden="true">🔥</span>
              <div>
                <p style={{ fontWeight: 800 }}>{progress?.streakDays ? t("{n}-day streak!", { n: progress.streakDays }) : t("Start a streak")}</p>
                <p className="k-muted" style={{ fontSize: ".95rem" }}>{progress?.streakDays ? (playedToday ? t("Come back tomorrow to keep it!") : t("Play today to keep it going")) : t("Play today to begin")}</p>
              </div>
            </div>
          </div>
        </section>

        {!focus && <section aria-labelledby="games" style={{ display: "grid", gap: 12 }}>
          <h2 id="games" style={sectionTitle}>{t("Play and practise")}</h2>
          <div style={grid}>{games.map(renderTile)}</div>
        </section>}

        {([
          ["learn", t("Learn and ask"), ["/boost", "/search", "/chat", "/homework"]],
          ["create", t("Make something"), ["/story", "/doodle"]],
          ["me", t("All about me"), ["/pet", "/mood", "/trophies"]],
        ] as const).map(([id, title, hrefs]) => {
          const tiles = visibleMore.filter(tl => (hrefs as readonly string[]).includes(tl.href));
          if (tiles.length === 0) return null;
          return (
            <section key={id} aria-labelledby={`g-${id}`} style={{ display: "grid", gap: 12 }}>
              <h2 id={`g-${id}`} style={sectionTitle}>{title}</h2>
              <div style={grid}>{tiles.map((tl, i) => renderTile(tl, i))}</div>
            </section>
          );
        })}

        <p className="k-card" style={{ display: "flex", gap: 12, alignItems: "center", background: "var(--k-brand-soft)", borderColor: "transparent" }}>
          <span style={{ fontSize: "1.6rem" }} aria-hidden="true">💡</span>
          <span><b>{t("Tip:")}</b> {tip}</span>
        </p>
      </div>
    </KidShell>
  );
}

function Mission({ done, icon, text, hint, href }: { done: boolean; icon: string; text: string; hint: string; href: string }) {
  return (
    <Link href={href} className="k-card" style={{ display: "flex", alignItems: "center", gap: 14, textDecoration: "none", color: "inherit", background: done ? "var(--k-brand-soft)" : undefined, borderColor: done ? "var(--k-brand)" : undefined }}>
      <span style={{ fontSize: "1.8rem" }} aria-hidden="true">{done ? "✅" : icon}</span>
      <span>
        <b style={{ display: "block" }}>{text}</b>
        <span className="k-muted" style={{ fontSize: ".95rem" }}>{done ? t("Done! Great job.") : hint}</span>
      </span>
    </Link>
  );
}
