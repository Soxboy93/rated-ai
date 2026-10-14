import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, BookOpen, LayoutDashboard, Lock, Mail, Settings as SettingsIcon, ShieldAlert, Users, MessageSquare, TrendingUp } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Logo from "@/kid/Logo";
import ProgressTab from "./ProgressTab";
import ClassTab from "./ClassTab";
import RosterTab from "./RosterTab";
import LessonsTab from "./LessonsTab";
import SafetyTab from "./SafetyTab";
import LettersTab from "./LettersTab";
import SchoolTab from "./SchoolTab";
import GettingStarted from "./GettingStarted";
import ConversationsTab from "./ConversationsTab";
import SettingsTab from "./SettingsTab";
import { t, T } from "@/i18n";
import LanguageSwitch from "@/i18n/LanguageSwitch";

// Six places for a teacher, three for a parent. Everything lives under one of these.
const SCHOOL_NAV = [
  ["overview", T("Overview"), LayoutDashboard],
  ["lessons", T("Lessons"), BookOpen],
  ["classes", T("Classes"), Users],
  ["notes", T("Parent notes"), Mail],
  ["safety", T("Safety"), ShieldAlert],
  ["settings", T("Settings"), SettingsIcon],
] as const;
const FAMILY_NAV = [
  ["progress", T("Progress"), TrendingUp],
  ["chats", T("Conversations"), MessageSquare],
  ["settings", T("Settings"), SettingsIcon],
] as const;
type Tab = (typeof SCHOOL_NAV)[number][0] | (typeof FAMILY_NAV)[number][0];

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
    <div className="min-h-screen bg-paper flex items-center justify-center p-4">
      <LanguageSwitch className="fixed top-3 end-3" />
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-brand-600 rounded-full flex items-center justify-center"><Lock className="w-8 h-8 text-white" /></div>
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

/** The school-wide numbers and printable report are one click away, not in the way of the daily class view. */
function WholeSchool() {
  const [open, setOpen] = useState(false);
  return open ? <SchoolTab /> : (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 py-5">
        <div><p className="font-bold">{t("Whole-school numbers")}</p><p className="text-sm text-muted-foreground">{t("Activity across every class, with a printable report for your head teacher.")}</p></div>
        <Button variant="outline" onClick={() => setOpen(true)}>{t("Show")}</Button>
      </CardContent>
    </Card>
  );
}

export default function ParentArea() {
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const school = user?.accountType === "school";
  const { data: status, isLoading } = trpc.parent.status.useQuery();
  const [tab, setTab] = useState<Tab>(school ? "overview" : "progress");
  const lock = trpc.parent.lock.useMutation({ onSuccess: async () => { await utils.parent.invalidate(); } });
  const inbox = trpc.safety.inbox.useQuery(undefined, { enabled: school && !!status?.unlocked });

  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-gray-500">{t("Loading…")}</div>;
  if (!status?.unlocked) return <PinGate hasPin={!!status?.hasPin} school={school} />;

  const nav = school ? SCHOOL_NAV : FAMILY_NAV;
  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-10 border-b-2 border-ledge bg-paper/90 backdrop-blur">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Logo size={38} />
            <div>
              <h1 className="text-lg font-extrabold leading-tight">{school ? t("Teacher area") : t("Parent area")}</h1>
              <p className="text-xs text-muted-foreground">{t("Rated AI")}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <LanguageSwitch />
            <Link href="/"><Button variant="outline" size="sm"><ArrowLeft className="me-1 h-4 w-4 rtl:rotate-180" />{school ? t("Students' area") : t("Kids' area")}</Button></Link>
            <Button variant="outline" size="sm" onClick={() => lock.mutate()}><Lock className="me-1 h-4 w-4" />{t("Lock")}</Button>
          </div>
        </div>
      </header>
      <div className="container mx-auto flex flex-col gap-6 px-4 py-6 md:flex-row">
        <nav className="shrink-0 md:w-52" aria-label={school ? t("Teacher sections") : t("Parent sections")}>
          <div className="flex gap-1 overflow-x-auto pb-1 md:sticky md:top-24 md:flex-col md:overflow-visible">
            {nav.map(([id, label, Icon]) => (
              <button key={id} onClick={() => setTab(id)} aria-current={tab === id ? "page" : undefined}
                className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2.5 text-start text-sm font-bold ${tab === id ? "bg-brand-600 text-white shadow-[0_3px_0_var(--color-brand-800)]" : "text-foreground/80 hover:bg-white"}`}>
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="flex-1">{t(label)}</span>
                {id === "safety" && !!inbox.data?.open && <span className={`rounded-full px-1.5 text-xs font-bold text-white ${inbox.data.urgentOpen ? "bg-red-600" : "bg-amber-600"}`} aria-label={t("{n} to review", { n: inbox.data.open })}>{inbox.data.open}</span>}
              </button>
            ))}
          </div>
        </nav>
        <main className="min-w-0 flex-1 space-y-6">
          {tab === "overview" && <><GettingStarted go={t2 => setTab(t2 === "roster" ? "classes" : "lessons")} /><ClassTab /><WholeSchool /></>}
          {tab === "lessons" && <LessonsTab />}
          {tab === "classes" && <RosterTab />}
          {tab === "notes" && <LettersTab />}
          {tab === "safety" && <><SafetyTab /><ConversationsTab school /></>}
          {tab === "progress" && <ProgressTab />}
          {tab === "chats" && <ConversationsTab school={false} />}
          {tab === "settings" && <SettingsTab school={school} />}
          <p className="text-xs text-muted-foreground">{t("Safety checks use automated keyword screening plus age-appropriate instructions to the AI. They reduce risk but cannot catch everything, so we recommend reviewing conversations.")}</p>
        </main>
      </div>
    </div>
  );
}
