import { useState } from "react";
import { Link } from "wouter";
import { AGE_GROUPS } from "@shared/characters";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useChild } from "./ChildContext";
import { GUIDES, guideById } from "./guides";
import { playSound } from "./sound";
import KidShell from "./Shell";
import Avatar from "./Avatar";
import Logo from "./Logo";
import { t } from "@/i18n";

const CLASS_KEY = "ra_class";
const readClass = () => { try { return sessionStorage.getItem(CLASS_KEY) ?? ""; } catch { return ""; } };

export default function PlayerPicker() {
  const { profiles, profilesLoading, selectChild } = useChild();
  const { user } = useAuth();
  const school = user?.accountType === "school";
  const { data: classes } = trpc.classes.list.useQuery(undefined, { enabled: school });
  const [classId, setClassId] = useState(readClass);
  const pickClass = (id: string) => {
    setClassId(id);
    try { sessionStorage.setItem(CLASS_KEY, id); } catch { /* ignore */ }
  };

  const activeClass = school && classes?.some(c => c.id === classId) ? classId : "";
  const shown = (profiles ?? []).filter(p => !activeClass || p.classId === activeClass);

  return (
    <KidShell title={t("Who's playing?")} bare>
      <div style={{ display: "grid", gap: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <Logo size={64} />
          <div>
            <h2 style={{ fontSize: "clamp(1.7rem, 5vw, 2.3rem)" }}>{t("Who's playing?")}</h2>
            <p className="k-muted">{t("Tap your name to start your adventure.")}</p>
          </div>
        </div>

        {school && classes && classes.length > 0 && (
          <div role="radiogroup" aria-label={t("Pick your class")} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {[{ id: "", name: t("Everyone") }, ...classes].map(c => (
              <button key={c.id} role="radio" aria-checked={activeClass === c.id} className="k-chip" onClick={() => { playSound("tap"); pickClass(c.id); }}
                style={{ cursor: "pointer", background: activeClass === c.id ? "var(--k-brand)" : undefined, color: activeClass === c.id ? "#fff" : undefined }}>
                {c.name}
              </button>
            ))}
          </div>
        )}

        {profilesLoading ? (
          <p className="k-muted">{t("Loading…")}</p>
        ) : !profiles || profiles.length === 0 ? (
          <div className="k-card" style={{ maxWidth: 560, display: "grid", gap: 12 }}>
            <h3 style={{ fontSize: "1.6rem" }}>{school ? t("No students yet") : t("No players yet")}</h3>
            <p>{school ? t("A teacher needs to add the students first. It only takes a minute.") : t("A grown-up needs to add a child profile first. It only takes a minute.")}</p>
            <div><Link href="/parent" className="k-btn">🔒 {school ? t("Open the teacher area") : t("Open the parent area")}</Link></div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: school ? 14 : 18, gridTemplateColumns: `repeat(auto-fit, minmax(${school ? 160 : 210}px, 1fr))` }}>
            {shown.map((p, i) => {
              const guide = guideById(p.selectedCharacter ?? GUIDES[i % GUIDES.length].id);
              return (
                <button
                  key={p.id}
                  type="button"
                  className="k-tile k-in"
                  style={{ ["--c" as string]: guide.color, minHeight: school ? 150 : 200, alignItems: "center", justifyContent: "center", textAlign: "center", animationDelay: `${Math.min(i, 12) * 50}ms` }}
                  onClick={() => { playSound("correct"); selectChild(p.id); }}
                >
                  <Avatar guide={guide} size={school ? 64 : 92} bob />
                  <span className="name" style={{ fontSize: school ? "1.4rem" : "1.8rem" }}><bdi>{p.childName}</bdi></span>
                  {!school && <span className="sub">{t(AGE_GROUPS[p.ageGroup].name)}</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </KidShell>
  );
}
