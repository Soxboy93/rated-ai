import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, Shield, AlertTriangle, ArrowLeft } from "lucide-react";
import FamilyPanel, { PrivacyPanel } from "./FamilyPanel";
import ProgressTab from "./ProgressTab";
import ReportsTab from "./ReportsTab";
import ClassTab from "./ClassTab";
import RosterTab from "./RosterTab";
import AssignmentsTab from "./AssignmentsTab";
import { useA11y } from "@/kid/Accessibility";
import { t, T, fmtDateTime, fmtTime } from "@/i18n";
import LanguageSwitch from "@/i18n/LanguageSwitch";

const FAMILY_TABS = [
  ["progress", T("Progress")],
  ["chats", T("Conversations")],
  ["family", T("Children and privacy")],
  ["reports", T("Reports")],
  ["display", T("Display")],
] as const;
const SCHOOL_TABS = [
  ["class", T("Class progress")],
  ["roster", T("Classes and students")],
  ["assign", T("Activities")],
  ["chats", T("Conversations")],
  ["privacy", T("Privacy")],
  ["display", T("Display")],
] as const;
type Tab = (typeof FAMILY_TABS)[number][0] | (typeof SCHOOL_TABS)[number][0];

function PinGate({ hasPin, school }: { hasPin: boolean; school: boolean }) {
  const utils = trpc.useUtils();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const refresh = () => utils.parent.invalidate();
  const unlock = trpc.parent.unlock.useMutation({
    onSuccess: res => { if (res.valid) { setPin(""); refresh(); } else setError(t("Incorrect PIN. Please try again.")); },
    onError: e => setError(t(e.message)),
  });
  const setup = trpc.parent.setPin.useMutation({ onSuccess: () => { setPin(""); refresh(); }, onError: e => setError(t(e.message)) });
  const submit = () => {
    setError("");
    if (!hasPin) { if (pin.length < 4) return setError(t("Choose a PIN of at least 4 characters.")); setup.mutate({ pin }); }
    else if (!pin) setError(t("Please enter your PIN"));
    else unlock.mutate({ pin });
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-purple-50 to-blue-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center"><Lock className="w-8 h-8 text-white" /></div>
          <div>
            <CardTitle className="text-2xl">{school ? t("Teacher area") : t("Parent area")}</CardTitle>
            <CardDescription className="mt-2">
              {hasPin
                ? (school ? t("Enter your teacher PIN to open it") : t("Enter your parent PIN to open it"))
                : (school ? t("Create a teacher PIN so students can't open this area") : t("Create a parent PIN so your child can't open this area"))}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="pin" className="text-sm font-medium">{school ? t("Teacher PIN") : t("Parent PIN")}</label>
            <Input id="pin" type="password" dir="ltr" maxLength={64} autoComplete="off" placeholder={hasPin ? t("Enter your PIN") : t("Create a PIN (4+ characters)")} value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} />
            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          </div>
          <Button onClick={submit} disabled={unlock.isPending || setup.isPending} className="w-full">{hasPin ? t("Unlock") : t("Set PIN and continue")}</Button>
          <Link href="/"><Button variant="outline" className="w-full"><ArrowLeft className="w-4 h-4 me-2 rtl:rotate-180" />{school ? t("Back to the students' area") : t("Back to the games")}</Button></Link>
        </CardContent>
      </Card>
    </div>
  );
}

function ConversationsTab({ school }: { school: boolean }) {
  const { data: report } = trpc.parent.getActivityReport.useQuery();
  const sessions = report?.sessions ?? [];
  const messages = report?.messages ?? [];
  const flagged = report?.flaggedMessages ?? [];
  const who = school ? t("Student") : t("Child");
  return (
    <div className="space-y-6">
      {flagged.length > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900"><AlertTriangle className="w-5 h-5" />{t("Messages worth a conversation")}</CardTitle>
            <CardDescription>{t("These matched our safety checks. The assistant did not answer them with AI-generated text.")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {flagged.map(m => (
              <div key={m.id} className="rounded border border-amber-200 bg-white p-3">
                <p className="mb-1 text-xs text-gray-500">{m.createdAt ? fmtDateTime(m.createdAt) : ""} · {m.role === "user" ? who : t("AI reply (blocked)")} · {m.flagged}</p>
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader><CardTitle>{t("Chats")}</CardTitle><CardDescription>{t("{a} chats · {b} messages", { a: sessions.length, b: messages.length })}</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          {sessions.length === 0 ? <p className="text-gray-600">{t("No chats yet.")}</p> : sessions.slice(0, 20).map(s => {
            const ms = messages.filter(m => m.sessionId === s.id);
            return (
              <details key={s.id} className="rounded-lg border p-3">
                <summary className="cursor-pointer font-medium">{s.childName || who} · {s.characterId ? t(s.characterId.charAt(0).toUpperCase() + s.characterId.slice(1)) : t("guide")} · {s.createdAt ? fmtDateTime(s.createdAt) : ""} <span className="text-gray-500 font-normal">({t("{n} messages", { n: ms.length })})</span></summary>
                <div className="mt-3 space-y-2 max-h-96 overflow-y-auto">
                  {ms.map(m => (
                    <div key={m.id} className={`rounded p-2 border-s-4 ${m.role === "user" ? "border-purple-500 bg-purple-50" : "border-blue-500 bg-blue-50"}`}>
                      <p className="text-xs text-gray-500">{m.role === "user" ? who : t("AI")} · {m.createdAt ? fmtTime(m.createdAt) : ""}{m.flagged && m.flagged !== "safe" ? ` · ${m.flagged}` : ""}</p>
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    </div>
                  ))}
                </div>
              </details>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function DisplayTab() {
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
        <CardDescription>{t("Applies to the kids' area. Children can also change these from the ⚙️ button.")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map(([key, label, hint]) => (
          <label key={key} className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer">
            <input type="checkbox" className="mt-1 h-5 w-5" checked={settings[key]} onChange={e => update({ [key]: e.target.checked } as any)} />
            <span><span className="block font-medium">{t(label)}</span><span className="text-sm text-gray-600">{t(hint)}</span></span>
          </label>
        ))}
        <LanguageSwitch className="rounded-lg border px-4 py-2 font-medium text-purple-800" />
      </CardContent>
    </Card>
  );
}

export default function ParentArea() {
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const school = user?.accountType === "school";
  const { data: status, isLoading } = trpc.parent.status.useQuery();
  const [tab, setTab] = useState<Tab>(school ? "class" : "progress");
  const lock = trpc.parent.lock.useMutation({ onSuccess: async () => { await utils.parent.invalidate(); } });

  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-gray-500">{t("Loading…")}</div>;
  if (!status?.unlocked) return <PinGate hasPin={!!status?.hasPin} school={school} />;

  const tabs = school ? SCHOOL_TABS : FAMILY_TABS;
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-purple-50 to-blue-50">
      <header className="border-b bg-white/90 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center"><Shield className="w-5 h-5 text-white" /></div>
            <div>
              <h1 className="text-xl font-bold">{school ? t("Teacher area") : t("Parent area")}</h1>
              <p className="text-sm text-gray-600">{school ? t("Class progress, activities and privacy") : t("Progress, conversations and privacy")}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/"><Button variant="outline" size="sm"><ArrowLeft className="w-4 h-4 me-1 rtl:rotate-180" />{school ? t("Students' area") : t("Games")}</Button></Link>
            <Button variant="outline" size="sm" onClick={() => lock.mutate()}><Lock className="w-4 h-4 me-1" />{t("Lock")}</Button>
          </div>
        </div>
        <nav className="container mx-auto flex gap-1 overflow-x-auto px-4" aria-label={school ? t("Teacher sections") : t("Parent sections")}>
          {tabs.map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} aria-current={tab === id ? "page" : undefined}
              className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${tab === id ? "border-purple-600 text-purple-700" : "border-transparent text-gray-600 hover:text-gray-900"}`}>
              {t(label)}
            </button>
          ))}
        </nav>
      </header>
      <main className="container mx-auto max-w-5xl space-y-6 px-4 py-6">
        {tab === "progress" && <ProgressTab />}
        {tab === "class" && <ClassTab />}
        {tab === "roster" && <RosterTab />}
        {tab === "assign" && <AssignmentsTab />}
        {tab === "chats" && <ConversationsTab school={school} />}
        {tab === "family" && <FamilyPanel />}
        {tab === "privacy" && <PrivacyPanel school />}
        {tab === "reports" && <ReportsTab />}
        {tab === "display" && <DisplayTab />}
        <p className="text-xs text-gray-500">
          {t("Safety checks use automated keyword screening plus age-appropriate instructions to the AI. They reduce risk but cannot catch everything, so we recommend reviewing conversations. Time limits are not enforced yet.")}
        </p>
      </main>
    </div>
  );
}
