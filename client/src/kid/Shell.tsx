import { useState, type ReactNode } from "react";
import { Link } from "wouter";
import { levelProgress } from "@shared/gamification";
import { useChild } from "./ChildContext";
import { useA11y } from "./Accessibility";
import { guideById } from "./guides";
import { playSound } from "./sound";
import { t } from "@/i18n";
import LanguageSwitch from "@/i18n/LanguageSwitch";
import { useAuth } from "@/_core/hooks/useAuth";

function Toggle({ label, on, onChange, icon }: { label: string; on: boolean; onChange: (v: boolean) => void; icon: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => { playSound("tap"); onChange(!on); }}
      className="k-btn small light"
      style={{ justifyContent: "space-between", width: "100%", background: on ? "#b8f2d4" : undefined, color: on ? "#0d4a30" : undefined }}
    >
      <span>{icon} {label}</span>
      <span>{on ? t("On") : t("Off")}</span>
    </button>
  );
}

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { settings, update } = useA11y();
  return (
    <div className="k-card k-in" role="dialog" aria-label={t("Display and sound settings")} style={{ position: "absolute", insetInlineEnd: 0, top: "calc(100% + 10px)", width: 300, zIndex: 40, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ fontSize: "1.3rem" }}>{t("Make it yours")}</h2>
        <button className="k-btn small light round" onClick={onClose} aria-label={t("Close settings")}>✕</button>
      </div>
      <Toggle icon="🔊" label={t("Sounds")} on={settings.sound} onChange={v => update({ sound: v })} />
      <Toggle icon="🌙" label={t("Night mode")} on={settings.night} onChange={v => update({ night: v })} />
      <Toggle icon="🔎" label={t("Big text")} on={settings.largeText} onChange={v => update({ largeText: v })} />
      <Toggle icon="📖" label={t("Easy-read letters")} on={settings.easyRead} onChange={v => update({ easyRead: v })} />
      <Toggle icon="🍃" label={t("Calm mode (less motion)")} on={settings.calm} onChange={v => update({ calm: v })} />
      <Toggle icon="◐" label={t("High contrast")} on={settings.highContrast} onChange={v => update({ highContrast: v })} />
      <LanguageSwitch className="k-btn small light" style={{ width: "100%", justifyContent: "center" }} />
    </div>
  );
}

export default function KidShell({ title, color = "var(--k-brand)", home = false, children }: { title: string; color?: string; home?: boolean; children: ReactNode }) {
  const { child, progress, selectChild } = useChild();
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const school = user?.accountType === "school";
  const guide = guideById(child?.selectedCharacter);
  const lp = levelProgress(progress?.xp ?? 0);

  return (
    <div className="kid">
      <header style={{ background: color, borderBottom: "3px solid var(--k-ink)" }}>
        <div className="kid-wrap" style={{ display: "flex", alignItems: "center", gap: 12, paddingBlock: 10, flexWrap: "wrap", position: "relative" }}>
          {home ? (
            <span className="display" style={{ fontSize: "1.6rem", color: "#fff", textShadow: "0 2px 0 rgba(0,0,0,.3)" }}>{t("Rated AI")}</span>
          ) : (
            <Link href="/" className="k-btn small light" aria-label={t("Back to home")}>🏠 {t("Home")}</Link>
          )}
          <h1 className="display" style={{ flex: "1 1 150px", minWidth: 120, textAlign: home ? "end" : "start", color: "#fff", fontSize: "1.45rem", textShadow: "0 2px 0 rgba(0,0,0,.3)" }}>
            {home ? "" : title}
          </h1>

          {child && (
            <button
              type="button"
              className="k-chip"
              onClick={() => { playSound("tap"); selectChild(null); }}
              aria-label={t("{name}, level {level}. Switch player", { name: child.childName, level: lp.level })}
              style={{ cursor: "pointer", paddingInline: 8 }}
            >
              <img src={guide.art} alt="" width={34} height={34} style={{ borderRadius: "50%" }} />
              <span>{child.childName}</span>
              <span style={{ background: "var(--c-trophy)", color: "#2b2250", borderRadius: 999, padding: "0 8px", border: "2px solid var(--k-ink)" }}>{t("Lv {level}", { level: lp.level })}</span>
            </button>
          )}
          {child && progress && progress.streakDays > 0 && (
            <span className="k-chip" title={t("{n} day streak", { n: progress.streakDays })}><span className="k-flame" aria-hidden="true">🔥</span>{progress.streakDays}</span>
          )}
          <button type="button" className="k-btn small light round" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-label={t("Settings")}>⚙️</button>
          <Link href="/parent" className="k-btn small light" aria-label={school ? t("Teacher area") : t("Parent area")}>🔒 {school ? t("Teachers") : t("Parents")}</Link>
          {open && <SettingsPanel onClose={() => setOpen(false)} />}
        </div>
      </header>
      <main className="kid-wrap" style={{ paddingBlock: 24 }}>{children}</main>
    </div>
  );
}
