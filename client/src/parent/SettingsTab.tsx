import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useA11y } from "@/kid/Accessibility";
import { t, T } from "@/i18n";
import FamilyPanel, { PrivacyPanel } from "./FamilyPanel";

function DisplayCard() {
  const { settings, update } = useA11y();
  const rows: Array<[keyof typeof settings, string, string]> = [
    ["sound", T("Sounds"), T("Game sound effects on this device")],
    ["night", T("Night mode"), T("Dark colours on this device")],
    ["largeText", T("Big text"), T("Larger writing everywhere. Saved to your account.")],
    ["easyRead", T("Easy-read letters"), T("A clearer font with more spacing. Helpful for dyslexia.")],
    ["calm", T("Calm mode"), T("No animation, confetti or sound. Helpful for focus or sensory needs.")],
    ["highContrast", T("High contrast"), T("Stronger outlines and plain backgrounds.")],
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("Display and comfort")}</CardTitle>
        <CardDescription>{t("Applies to the kids' area. Children can also change these in Me.")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map(([key, label, hint]) => (
          <label key={key} className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer">
            <input type="checkbox" className="mt-1 h-5 w-5" checked={settings[key]} onChange={e => update({ [key]: e.target.checked } as any)} />
            <span><span className="block font-medium">{t(label)}</span><span className="text-sm text-gray-600">{t(hint)}</span></span>
          </label>
        ))}
      </CardContent>
    </Card>
  );
}

/** Privacy and data, children or students, and how the kids' area looks. One page for everything you set once. */
export default function SettingsTab({ school }: { school: boolean }) {
  return (
    <div className="space-y-6">
      {school ? <PrivacyPanel school /> : <FamilyPanel />}
      <DisplayCard />
    </div>
  );
}
