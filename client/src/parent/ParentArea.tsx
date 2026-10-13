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
import LessonsTab from "./LessonsTab";
import CompanionChat from "./CompanionChat";
import SafetyTab from "./SafetyTab";
import LettersTab from "./LettersTab";
import SchoolTab from "./SchoolTab";
import GettingStarted from "./GettingStarted";
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
// The teacher area is grouped by what a teacher is doing, not by when each screen was built.
const SCHOOL_GROUPS = [
  [T("Teach"), [["lessons", T("Lessons")], ["companion", T("Companion")], ["assign", T("Activities")]]],
  [T("My classes"), [["class", T("Class progress")], ["roster", T("Classes and students")], ["letters", T("Parent notes")]]],
  [T("Whole school"), [["overview", T("School overview")], ["safety", T("Safety")], ["chats", T("Conversations")]]],
  [T("Settings"), [["privacy", T("Privacy")], ["display", T("Display")]]],
] as const;
const SCHOOL_TABS = [
  ["class", T("Class progress")],
  ["overview", T("School overview")],
  ["lessons", T("Lessons")],
  ["companion", T("Companion")],
  ["roster", T("Classes and students")],
  ["assign", T("Activities")],
  ["letters", T("Parent notes")],
  ["safety", T("Safety")],
  ["chats", T("Conversations")],
  ["privacy", T("Privacy")],
  ["display", T("Display")],
] as const;
type Tab = (typeof FAMILY_TABS)[number][0] | (typeof SCHOOL_TABS)[number][0];

export function PinGate({ hasPin, school, admin = false, onBack }: { hasPin: boolean; school: boolean; admin?: boolean; onBack?: () => void }) {
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
    if (!hasPin) { if (pin.length < (admin ? 8 : 4)) return setError(admin ? t("Choose a PIN of at least 8 characters.") : t("Choose a PIN of at least 4 characters.")); setup.mutate({ pin }); }
    else if (!pin) setError(t("Please enter your PIN"));
    else unlock.mutate({ pin });
  };
  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 to-slate-50 flex items-center justify-center p-4">
      <LanguageSwitch className="fixed top-3 end-3" />
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-teal-700 rounded-full flex items-center justify-center"><Lock className="w-8 h-8 text-white" /></div>
          <div>
            <CardTitle className="text-2xl">{admin ? t("Admin console") : school ? t("Teacher area") : t("Parent area")}</CardTitle>
            <CardDescription className="mt-2">
              {admin
                ? (hasPin ? t("Enter your admin PIN to open it") : t("Create an admin PIN (8+ characters). It protects every account here if your password is ever stolen."))
                : hasPin
                ? (school ? t("Enter your teacher PIN to open it") : t("Enter your parent PIN to open it"))
                : (school ? t("Create a teacher PIN so students can't open this area") : t("Create a parent PIN so your child can't open this area"))}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="pin" className="text-sm font-medium">{admin ? t("Admin PIN") : school ? t("Teacher PIN") : t("Parent PIN")}</label>
            <Input id="pin" type="password" dir="ltr" maxLength={64} autoComplete="off" placeholder={hasPin ? t("Enter your PIN") : admin ? t("Create a PIN (8+ characters)") : t("Create a PIN (4+ characters)")} value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} />
            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          </div>
          <Button onClick={submit} disabled={unlock.isPending || setup.isPending} className="w-full">{hasPin ? t("Unlock") : t("Set PIN and continue")}</Button>
          {admin ? (onBack && <Button variant="outline" className="w-full" onClick={onBack}>{t("Sign out")}</Button>) : (
            <Link href="/"><Button variant="outline" className="w-full"><ArrowLeft className="w-4 h-4 me-2 rtl:rotate-180" />{school ? t("Back to the students' area") : t("Back to the games")}</Button></Link>
          )}
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
                    <div key={m.id} className={`rounded p-2 border-s-4 ${m.role === "user" ? "border-teal-600 bg-teal-50" : "border-blue-500 bg-blue-50"}`}>
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
  const inbox = trpc.safety.inbox.useQuery(undefined, { enabled: school && !!status?.unlocked });

  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-gray-500">{t("Loading…")}</div>;
  if (!status?.unlocked) return <PinGate hasPin={!!status?.hasPin} school={school} />;

  const tabs = school ? SCHOOL_TABS : FAMILY_TABS;
  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 to-slate-50">
      <header className="border-b bg-white/90 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-teal-700 flex items-center justify-center"><Shield className="w-5 h-5 text-white" /></div>
            <div>
              <h1 className="text-xl font-bold">{school ? t("Teacher area") : t("Parent area")}</h1>
              <p className="text-sm text-gray-600">{school ? t("Lessons, class progress and activities") : t("Progress, conversations and privacy")}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <LanguageSwitch />
            <Link href="/"><Button variant="outline" size="sm"><ArrowLeft className="w-4 h-4 me-1 rtl:rotate-180" />{school ? t("Students' area") : t("Games")}</Button></Link>
            <Button variant="outline" size="sm" onClick={() => lock.mutate()}><Lock className="w-4 h-4 me-1" />{t("Lock")}</Button>
          </div>
        </div>
        {!school && (
        <nav className="container mx-auto flex gap-1 overflow-x-auto px-4" aria-label={t("Parent sections")}>
          {FAMILY_TABS.map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} aria-current={tab === id ? "page" : undefined}
              className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${tab === id ? "border-teal-700 text-teal-800" : "border-transparent text-gray-600 hover:text-gray-900"}`}>
              {t(label)}
            </button>
          ))}
        </nav>
        )}
      </header>
      <div className={school ? "container mx-auto flex flex-col gap-6 px-4 py-6 md:flex-row" : ""}>
      {school && (
        <nav className="shrink-0 md:w-56" aria-label={t("Teacher sections")}>
          <div className="flex gap-4 overflow-x-auto pb-1 md:sticky md:top-24 md:flex-col md:gap-5 md:overflow-visible">
            {SCHOOL_GROUPS.map(([group, items]) => (
              <div key={group} className="flex shrink-0 items-center gap-1 md:block md:space-y-1">
                <p className="px-3 text-xs font-semibold uppercase tracking-wide text-gray-500">{t(group)}</p>
                {items.map(([id, label]) => (
                  <button key={id} onClick={() => setTab(id)} aria-current={tab === id ? "page" : undefined}
                    className={`flex w-full items-center justify-between whitespace-nowrap rounded-md px-3 py-2 text-start text-sm font-medium ${tab === id ? "bg-teal-700 text-white" : "text-gray-700 hover:bg-white"}`}>
                    <span>{t(label)}</span>
                    {id === "safety" && !!inbox.data?.open && <span className={`ms-2 rounded-full px-1.5 text-xs font-semibold text-white ${inbox.data.urgentOpen ? "bg-red-600" : "bg-amber-600"}`} aria-label={t("{n} to review", { n: inbox.data.open })}>{inbox.data.open}</span>}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </nav>
      )}
      <main className={school ? "min-w-0 flex-1 space-y-6" : "container mx-auto max-w-5xl space-y-6 px-4 py-6"}>
        {school && tab === "class" && <GettingStarted go={setTab} />}
        {tab === "progress" && <ProgressTab />}
        {tab === "class" && <ClassTab />}
        {tab === "overview" && <SchoolTab />}
        {tab === "lessons" && <LessonsTab />}
        {tab === "companion" && <CompanionChat />}
        {tab === "roster" && <RosterTab />}
        {tab === "assign" && <AssignmentsTab />}
        {tab === "letters" && <LettersTab />}
        {tab === "safety" && <SafetyTab />}
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
    </div>
  );
}
