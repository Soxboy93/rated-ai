import { useState, type ReactNode } from "react";
import { Link } from "wouter";
import { levelProgress } from "@shared/gamification";
import { useChild } from "./ChildContext";
import { useA11y } from "./Accessibility";
import { guideById } from "./guides";
import Avatar from "./Avatar";
import Logo from "./Logo";
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
      style={{ justifyContent: "space-between", width: "100%", background: on ? "var(--k-brand-soft)" : undefined, color: on ? "var(--k-brand)" : undefined, borderColor: on ? "var(--k-brand)" : undefined }}
    >
      <span>{icon} {label}</span>
      <span>{on ? t("On") : t("Off")}</span>
    </button>
  );
}

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { settings, update } = useA11y();
  return (
    <div className="k-card k-in" role="dialog" aria-label={t("Display and sound settings")} style={{ position: "absolute", insetInlineEnd: 0, top: "calc(100% + 10px)", width: 300, maxWidth: "calc(100vw - 32px)", zIndex: 40, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ fontSize: "1.2rem" }}>{t("Make it yours")}</h2>
        <button className="k-btn small light round" onClick={onClose} aria-label={t("Close settings")}>✕</button>
      </div>
      <Toggle icon="🔊" label={t("Sounds")} on={settings.sound} onChange={v => update({ sound: v })} />
      <Toggle icon="🌙" label={t("Night mode")} on={settings.night} onChange={v => update({ night: v })} />
      <Toggle icon="🔎" label={t("Big text")} on={settings.largeText} onChange={v => update({ largeText: v })} />
      <Toggle icon="📖" label={t("Easy-read letters")} on={settings.easyRead} onChange={v => update({ easyRead: v })} />
      <Toggle icon="🍃" label={t("Calm mode (less motion)")} on={settings.calm} onChange={v => update({ calm: v })} />
      <Toggle icon="◐" label={t("High contrast")} on={settings.highContrast} onChange={v => update({ highContrast: v })} />
    </div>
  );
}

export default function KidShell({ title, color = "var(--k-brand)", home = false, children }: { title: string; color?: string; home?: boolean; children: ReactNode }) {
  const { child, progress, selectChild } = useChild();
  const { user } = useAuth();
  const school = user?.accountType === "school";
  const [open, setOpen] = useState(false);
  const guide = guideById(child?.selectedCharacter);
  const lp = levelProgress(progress?.xp ?? 0);

  return (
    <div className="kid">
      <header className="k-top">
        <div className="kid-wrap">
          {home ? (
            <span className="k-brandmark"><Logo size={34} />{t("Rated AI")}</span>
          ) : (
            <Link href="/" className="k-btn small light" aria-label={t("Back to home")}>🏠 {t("Home")}</Link>
          )}
          <span style={{ flex: 1 }} />
          {child && progress && progress.streakDays > 0 && (
            <span className="k-chip" title={t("{n} day streak", { n: progress.streakDays })}><span className="k-flame" aria-hidden="true">🔥</span>{progress.streakDays}</span>
          )}
          {child && (
            <button
              type="button"
              className="k-chip"
              onClick={() => { playSound("tap"); selectChild(null); }}
              aria-label={t("{name}, level {level}. Switch player", { name: child.childName, level: lp.level })}
              style={{ cursor: "pointer", paddingInline: 5 }}
            >
              <Avatar guide={guide} size={30} />
              <span><bdi>{child.childName}</bdi></span>
              <span style={{ background: "var(--k-brand)", color: "#fff", borderRadius: 999, padding: "1px 9px", fontSize: ".85rem" }}>{t("Lv {level}", { level: lp.level })}</span>
            </button>
          )}
          <LanguageSwitch />
          <button type="button" className="k-btn small light round" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-label={t("Settings")}>⚙️</button>
          <Link href="/parent" className="k-btn small light" aria-label={school ? t("Teacher area") : t("Parent area")}>🔒 {school ? t("Teachers") : t("Parents")}</Link>
          {open && <SettingsPanel onClose={() => setOpen(false)} />}
        </div>
      </header>
      <main className="kid-wrap" style={{ paddingBlock: 24 }}>
        {!home && (
          <h1 style={{ display: "flex", alignItems: "center", gap: 12, fontSize: "clamp(1.5rem, 4vw, 2rem)", marginBottom: 20 }}>
            <span aria-hidden="true" style={{ width: 8, height: "1.2em", borderRadius: 4, background: color }} />
            {title}
          </h1>
        )}
        {children}
      </main>
    </div>
  );
}
