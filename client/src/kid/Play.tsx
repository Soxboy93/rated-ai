import { Link } from "wouter";
import { GAME_IDS } from "@shared/gamification";
import { useChild } from "./ChildContext";
import { GAME_META } from "./guides";
import { playSound } from "./sound";
import { t } from "@/i18n";
import KidShell from "./Shell";

/** Three practice games. Every finished round earns XP and keeps the streak alive. */
export default function Play() {
  const { progress } = useChild();
  return (
    <KidShell title={t("Play")}>
      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        {GAME_IDS.map((id, i) => {
          const g = progress?.breakdown.find(b => b.game === id);
          return (
            <Link key={id} href={`/games/${id}`} className="k-tile k-in" style={{ ["--c" as string]: GAME_META[id].color, animationDelay: `${i * 60}ms` }} onClick={() => playSound("tap")}>
              <span className="icon" aria-hidden="true">{GAME_META[id].icon}</span>
              <span>
                <span className="name" style={{ display: "block" }}>{GAME_META[id].name}</span>
                <span className="sub">{GAME_META[id].blurb}{g ? ` · ${t("{n} played", { n: g.plays })}` : ""}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </KidShell>
  );
}
