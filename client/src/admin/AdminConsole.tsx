import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, ShieldCheck } from "lucide-react";
import LanguageSwitch from "@/i18n/LanguageSwitch";
import { PinGate } from "@/parent/ParentArea";
import { fmtDateTime, t, T } from "@/i18n";
import AccountList from "./AccountList";
import AccountDetail from "./AccountDetail";
import StudentDetail from "./StudentDetail";

const SECTIONS = [
  ["overview", T("Overview")],
  ["schools", T("Teachers and schools")],
  ["families", T("Families")],
  ["students", T("Students")],
  ["activity", T("Activity log")],
] as const;
type Section = (typeof SECTIONS)[number][0];
type View = { section: Section; account?: string; student?: string; from?: View };

function Tile({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return <div className="rounded-lg border bg-white p-4 shadow-sm"><p className="text-sm text-gray-600">{label}</p><p className="mt-1 text-3xl font-bold tabular-nums">{value}</p>{hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}</div>;
}

function Overview({ go }: { go: (s: Section) => void }) {
  const { data } = trpc.admin.overview.useQuery();
  if (!data) return <p className="text-gray-600">{t("Loading…")}</p>;
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label={t("School accounts")} value={data.accounts.school} />
        <Tile label={t("Family accounts")} value={data.accounts.family} />
        <Tile label={t("Students and children")} value={data.students} />
        <Tile label={t("Signed in, last 7 days")} value={data.signedInLast7Days} hint={t("accounts")} />
        <Tile label={t("Practice rounds, last 7 days")} value={data.playsLast7Days} />
        <Tile label={t("Lessons created")} value={data.lessons} />
        <Tile label={t("New accounts, last 30 days")} value={data.newAccountsLast30Days} />
        <Tile label={t("Safety flags to review")} value={data.flaggedOpen} hint={t("across all accounts")} />
      </div>
      <Card>
        <CardHeader><CardTitle>{t("Where to go")}</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {data.accounts.suspended > 0 && <span className="self-center text-sm text-red-800">{t("{n} suspended", { n: data.accounts.suspended })}</span>}
          <Button variant="outline" onClick={() => go("schools")}>{t("Teachers and schools")}</Button>
          <Button variant="outline" onClick={() => go("families")}>{t("Families")}</Button>
          <Button variant="outline" onClick={() => go("students")}>{t("Find a student")}</Button>
        </CardContent>
      </Card>
      <p className="text-xs text-gray-600">{t("Administrator accounts: {n}. They are made on the server, never by signing up.", { n: data.accounts.admin })}</p>
    </div>
  );
}

function Students({ onOpen }: { onOpen: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const [q, setQ] = useState<string | null>(null);
  const { data, isLoading } = trpc.admin.students.useQuery({ search: q ?? "" }, { enabled: q !== null });
  return (
    <Card>
      <CardHeader><CardTitle>{t("Find a student")}</CardTitle><CardDescription>{t("Search every account by the student's first name. Searches are logged.")}</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <form className="flex gap-2" onSubmit={e => { e.preventDefault(); setQ(search.trim()); }}>
          <Input className="max-w-xs" value={search} onChange={e => setSearch(e.target.value)} placeholder={t("Student's name")} aria-label={t("Student's name")} />
          <Button type="submit">{t("Search")}</Button>
        </form>
        {q === null ? null : isLoading ? <p className="text-gray-600">{t("Loading…")}</p> : !data || data.length === 0 ? <p className="text-gray-600">{t("No students match.")}</p> : (
          <ul className="grid gap-2 sm:grid-cols-2">{data.map(s => (
            <li key={s.id}><button className="w-full rounded border bg-white p-3 text-start text-sm hover:border-teal-500" onClick={() => onOpen(s.id)}>
              <b><bdi>{s.childName}</bdi></b>{s.className && <span className="text-gray-600"> · <bdi>{s.className}</bdi></span>}
              <span className="block text-xs text-gray-500"><bdi>{s.ownerEmail}</bdi> · {s.ownerType === "school" ? t("School account") : t("Family account")}</span>
            </button></li>
          ))}</ul>
        )}
      </CardContent>
    </Card>
  );
}

function Activity() {
  const { data, isLoading } = trpc.admin.actions.useQuery();
  return (
    <Card>
      <CardHeader><CardTitle>{t("Activity log")}</CardTitle><CardDescription>{t("Everything administrators have looked at or changed, newest first.")}</CardDescription></CardHeader>
      <CardContent>
        {isLoading ? <p className="text-gray-600">{t("Loading…")}</p> : !data || data.length === 0 ? <p className="text-gray-600">{t("Nothing recorded yet.")}</p> : (
          <ul className="space-y-1 text-sm">{data.map(a => (
            <li key={a.id} className="flex flex-wrap justify-between gap-2 rounded border px-3 py-1"><span><b><bdi>{a.adminEmail ?? "?"}</bdi></b> · {a.action.replace(/^admin_/, "").replace(/_/g, " ")}{a.detail ? ` · ${a.detail}` : ""}</span><span className="whitespace-nowrap text-gray-500">{a.createdAt ? fmtDateTime(a.createdAt) : ""}</span></li>
          ))}</ul>
        )}
      </CardContent>
    </Card>
  );
}

/** The administrator console: every school, family and student, read-mostly, with each look recorded. */
export default function AdminConsole() {
  const { logout } = useAuth();
  const { data: status, isLoading } = trpc.parent.status.useQuery();
  const utils = trpc.useUtils();
  const lock = trpc.parent.lock.useMutation({ onSuccess: () => utils.parent.invalidate() });
  const [view, setView] = useState<View>({ section: "overview" });

  if (isLoading) return <div className="flex min-h-screen items-center justify-center text-gray-500">{t("Loading…")}</div>;
  if (!status?.unlocked) return <PinGate hasPin={!!status?.hasPin} school admin onBack={() => void logout()} />;

  const goSection = (section: Section) => setView({ section });
  const openAccount = (account: string) => setView(v => ({ section: v.section, account, from: v.student ? v : v.from }));
  const openStudent = (student: string) => setView(v => ({ section: v.section, student, from: v }));
  const back = () => setView(v => v.from ?? { section: v.section });

  let body;
  if (view.student) body = <StudentDetail profileId={view.student} onBack={back} onOpenAccount={openAccount} />;
  else if (view.account) body = <AccountDetail userId={view.account} onBack={back} onOpenStudent={openStudent} />;
  else if (view.section === "overview") body = <Overview go={goSection} />;
  else if (view.section === "schools") body = <AccountList key="s" type="school" onOpen={openAccount} />;
  else if (view.section === "families") body = <AccountList key="f" type="family" onOpen={openAccount} />;
  else if (view.section === "students") body = <Students onOpen={openStudent} />;
  else body = <Activity />;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-700"><ShieldCheck className="h-5 w-5 text-white" /></div>
            <div><h1 className="text-xl font-bold">{t("Admin console")}</h1><p className="text-sm text-gray-600">{t("All schools, families and students")}</p></div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitch />
            <Button variant="outline" size="sm" onClick={() => lock.mutate()}><Lock className="me-1 h-4 w-4" />{t("Lock")}</Button>
            <Button variant="outline" size="sm" onClick={() => void logout()}>{t("Sign out")}</Button>
          </div>
        </div>
      </header>
      <div className="container mx-auto flex flex-col gap-6 px-4 py-6 md:flex-row">
        <nav className="flex shrink-0 gap-1 overflow-x-auto md:w-52 md:flex-col" aria-label={t("Admin sections")}>
          {SECTIONS.map(([id, label]) => (
            <button key={id} onClick={() => goSection(id)} aria-current={view.section === id && !view.account && !view.student ? "page" : undefined}
              className={`whitespace-nowrap rounded-md px-3 py-2 text-start text-sm font-medium ${view.section === id ? "bg-indigo-700 text-white" : "text-gray-700 hover:bg-white"}`}>
              {t(label)}
            </button>
          ))}
        </nav>
        <main className="min-w-0 flex-1 space-y-6">{body}</main>
      </div>
    </div>
  );
}
