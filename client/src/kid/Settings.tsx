import { useA11y } from "./Accessibility";
import { playSound } from "./sound";
import { t } from "@/i18n";

function Toggle({ icon, label, on, onChange }: { icon: string; label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => { playSound("tap"); onChange(!on); }}
      className={`k-btn light${on ? " picked" : ""}`}
      style={{ justifyContent: "space-between", width: "100%", background: on ? "var(--k-brand-soft)" : undefined, borderColor: on ? "var(--k-brand)" : undefined, color: on ? "var(--k-brand-dark)" : undefined }}
    >
      <span>{icon} {label}</span>
      <span>{on ? t("On") : t("Off")}</span>
    </button>
  );
}

/** "Make it yours": sound, night mode and the reading aids. Saved for the child on this device and account. */
export default function DisplaySettings() {
  const { settings, update } = useA11y();
  return (
    <section className="k-card" style={{ display: "grid", gap: 10 }} aria-labelledby="display">
      <h2 id="display" className="k-section-title">{t("Make it yours")}</h2>
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        <Toggle icon="🔊" label={t("Sounds")} on={settings.sound} onChange={v => update({ sound: v })} />
        <Toggle icon="🌙" label={t("Night mode")} on={settings.night} onChange={v => update({ night: v })} />
        <Toggle icon="🔎" label={t("Big text")} on={settings.largeText} onChange={v => update({ largeText: v })} />
        <Toggle icon="📖" label={t("Easy-read letters")} on={settings.easyRead} onChange={v => update({ easyRead: v })} />
        <Toggle icon="🍃" label={t("Calm mode (less motion)")} on={settings.calm} onChange={v => update({ calm: v })} />
        <Toggle icon="◐" label={t("High contrast")} on={settings.highContrast} onChange={v => update({ highContrast: v })} />
      </div>
    </section>
  );
}
