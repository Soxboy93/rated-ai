import { Link } from "wouter";
import { BADGES, levelProgress, levelTitle } from "@shared/gamification";
import { useChild } from "./ChildContext";
import { guideById } from "./guides";
import { playSound } from "./sound";
import { t } from "@/i18n";
import KidShell from "./Shell";
import Avatar from "./Avatar";
import DisplaySettings from "./Settings";

/** Your level, streak and badges; how you are feeling today; display settings; switching player. */
export default function Me() {
  const { child, progress, selectChild } = useChild();
  const guide = guideById(child?.selectedCharacter);
  const lp = levelProgress(progress?.xp ?? 0);
  const earned = new Map((progress?.badges ?? []).map(b => [b.badgeId, b.earnedAt]));
  const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
  const moodDone = !!progress?.lastMoodAt && new Date(progress.lastMoodAt) >= midnight;

  return (
    <KidShell>
      <div className="k-stack">
        <section className="k-card k-hero">
          <Avatar guide={guide} size={96} />
          <div style={{ display: "grid", gap: 8 }}>
            <h1 style={{ fontSize: "clamp(1.6rem, 5vw, 2.2rem)" }}><bdi>{child?.childName}</bdi></h1>
            <p style={{ fontSize: "1.2rem", fontWeight: 800 }}>{t("Level {level}", { level: lp.level })}: {t(levelTitle(lp.level))}</p>
            <div className="k-bar" role="progressbar" aria-label={t("Progress to next level")} aria-valuenow={Math.round(lp.fraction * 100)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${Math.max(4, Math.round(lp.fraction * 100))}%` }} /></div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span className="k-chip">{t("{n} XP total", { n: progress?.xp ?? 0 })}</span>
              <span className="k-chip sun">🔥 {t("{n} day streak", { n: progress?.streakDays ?? 0 })}</span>
              <span className="k-chip">🎮 {t("{n} games", { n: progress?.totalPlays ?? 0 })}</span>
            </div>
          </div>
        </section>

        <Link href="/mood" className="k-card k-row" onClick={() => playSound("tap")} style={{ background: moodDone ? "var(--k-brand-soft)" : undefined }}>
          <span className="icon" aria-hidden="true">{moodDone ? "✅" : "💛"}</span>
          <span><b style={{ display: "block" }}>{t("How are you feeling?")}</b><span className="k-muted">{moodDone ? t("Done today. Thank you!") : t("A quick check-in. It takes 10 seconds.")}</span></span>
        </Link>

        <section aria-labelledby="badges" style={{ display: "grid", gap: 12 }}>
          <h2 id="badges" className="k-section-title">{t("Badges")} · {earned.size} / {BADGES.length}</h2>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
            {BADGES.map(b => {
              const got = earned.has(b.id);
              return (
                <div key={b.id} className="k-card" style={{ textAlign: "center", display: "grid", gap: 4, justifyItems: "center", padding: 14, opacity: got ? 1 : 0.55, boxShadow: got ? undefined : "none" }}>
                  <span style={{ fontSize: "2.4rem", filter: got ? undefined : "grayscale(1)" }} aria-hidden="true">{got ? b.icon : "🔒"}</span>
                  <h3 style={{ fontSize: "1rem" }}>{t(b.name)}</h3>
                  <p className="k-muted" style={{ fontSize: ".85rem" }}>{t(b.description)}</p>
                  <span className="sr-only">{got ? t("Earned") : t("Not earned yet")}</span>
                </div>
              );
            })}
          </div>
        </section>

        <DisplaySettings />

        <div><button type="button" className="k-btn light" onClick={() => { playSound("tap"); selectChild(null); }}>🔁 {t("Switch player")}</button></div>
      </div>
    </KidShell>
  );
}
