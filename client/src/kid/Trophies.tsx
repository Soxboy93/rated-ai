import { BADGES, GAME_IDS, levelProgress, levelTitle } from "@shared/gamification";
import KidShell from "./Shell";
import { useChild } from "./ChildContext";
import { GAME_META } from "./guides";
import { t } from "@/i18n";

export default function Trophies() {
  const { progress } = useChild();
  const earned = new Map((progress?.badges ?? []).map(b => [b.badgeId, b.earnedAt]));
  const lp = levelProgress(progress?.xp ?? 0);

  return (
    <KidShell title={t("Trophy Room")} color="var(--c-trophy)">
      <div style={{ display: "grid", gap: 22 }}>
        <section className="k-card" style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <span style={{ fontSize: "3.4rem" }} aria-hidden="true">🏆</span>
            <div style={{ flex: 1, minWidth: 220 }}>
              <h2 style={{ fontSize: "2rem" }}>{t("Level {level}", { level: lp.level })}: {t(levelTitle(lp.level))}</h2>
              <p className="k-muted">{t("{n} XP total", { n: progress?.xp ?? 0 })} · {t("{n} XP to level {level}", { n: lp.next - (progress?.xp ?? 0), level: lp.level + 1 })}</p>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <span className="k-chip">🔥 {t("{n} day streak", { n: progress?.streakDays ?? 0 })}</span>
              <span className="k-chip">🎮 {t("{n} games", { n: progress?.totalPlays ?? 0 })}</span>
              <span className="k-chip">🏅 {t("{a} / {b} badges", { a: earned.size, b: BADGES.length })}</span>
            </div>
          </div>
          <div className="k-bar" role="progressbar" aria-label={t("Progress to next level")} aria-valuenow={Math.round(lp.fraction * 100)} aria-valuemin={0} aria-valuemax={100}>
            <i style={{ width: `${Math.max(4, Math.round(lp.fraction * 100))}%`, ["--c" as string]: "var(--c-trophy)" }} />
          </div>
        </section>

        <section aria-labelledby="badges" style={{ display: "grid", gap: 12 }}>
          <h2 id="badges" style={{ fontSize: "1.6rem" }}>{t("Badges")}</h2>
          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))" }}>
            {BADGES.map(b => {
              const got = earned.has(b.id);
              return (
                <div key={b.id} className="k-card" style={{ textAlign: "center", display: "grid", gap: 4, justifyItems: "center", opacity: got ? 1 : 0.6, background: got ? undefined : "var(--k-bg)" }}>
                  <span style={{ fontSize: "2.8rem", filter: got ? undefined : "grayscale(1) opacity(.5)" }} aria-hidden="true">{got ? b.icon : "🔒"}</span>
                  <h3 style={{ fontSize: "1.15rem" }}>{t(b.name)}</h3>
                  <p className="k-muted" style={{ fontSize: ".9rem" }}>{t(b.description)}</p>
                  <span className="sr-only">{got ? t("Earned") : t("Not earned yet")}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="stats" style={{ display: "grid", gap: 12 }}>
          <h2 id="stats" style={{ fontSize: "1.6rem" }}>{t("How you're doing")}</h2>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            {GAME_IDS.map(id => {
              const g = progress?.breakdown.find(b => b.game === id);
              const pct = g && g.total ? Math.round((g.correct / g.total) * 100) : 0;
              return (
                <div key={id} className="k-card" style={{ display: "grid", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ fontSize: "1.2rem" }}>{GAME_META[id].icon} {GAME_META[id].name}</h3>
                    <span className="k-muted" style={{ fontWeight: 800 }}>{t("{n} played", { n: g?.plays ?? 0 })}</span>
                  </div>
                  <div className="k-bar" role="progressbar" aria-label={t("{name} accuracy", { name: GAME_META[id].name })} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                    <i style={{ width: `${g ? Math.max(4, pct) : 0}%`, ["--c" as string]: GAME_META[id].color }} />
                  </div>
                  <p className="k-muted" style={{ fontSize: ".9rem" }}>{g ? t("{n}% of answers right", { n: pct }) : t("Not played yet")}</p>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </KidShell>
  );
}
