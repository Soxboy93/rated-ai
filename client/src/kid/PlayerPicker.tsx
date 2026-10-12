import { Link } from "wouter";
import { AGE_GROUPS } from "@shared/characters";
import { useChild } from "./ChildContext";
import { GUIDES, guideById } from "./guides";
import { playSound } from "./sound";
import KidShell from "./Shell";

export default function PlayerPicker() {
  const { profiles, profilesLoading, selectChild } = useChild();
  return (
    <KidShell title="Who's playing?" home>
      <div style={{ display: "grid", gap: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <img src="/art/logo.webp" alt="" width={84} height={84} className="k-bob" />
          <div>
            <h2 style={{ fontSize: "2.4rem" }}>Who's playing?</h2>
            <p className="k-muted">Tap your name to start your adventure.</p>
          </div>
        </div>

        {profilesLoading ? (
          <p className="k-muted">Loading…</p>
        ) : !profiles || profiles.length === 0 ? (
          <div className="k-card" style={{ maxWidth: 560, display: "grid", gap: 12 }}>
            <h3 style={{ fontSize: "1.6rem" }}>No players yet</h3>
            <p>A grown-up needs to add a child profile first. It only takes a minute.</p>
            <div><Link href="/parent" className="k-btn">🔒 Open the parent area</Link></div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
            {profiles.map((p, i) => {
              const guide = guideById(p.selectedCharacter ?? GUIDES[i % GUIDES.length].id);
              return (
                <button
                  key={p.id}
                  type="button"
                  className="k-tile k-in"
                  style={{ ["--c" as string]: guide.color, minHeight: 230, alignItems: "center", textAlign: "center", animationDelay: `${i * 70}ms` }}
                  onClick={() => { playSound("correct"); selectChild(p.id); }}
                >
                  <img src={guide.art} alt="" width={120} height={120} className="k-bob" style={{ filter: "drop-shadow(0 4px 0 rgba(0,0,0,.25))" }} />
                  <span className="name" style={{ fontSize: "1.8rem" }}>{p.childName}</span>
                  <span className="sub">{AGE_GROUPS[p.ageGroup].name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </KidShell>
  );
}
