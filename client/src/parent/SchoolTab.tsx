import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SchoolOverview } from "@shared/schoolReport";
import { currentLang, fmtDate, t, T } from "@/i18n";
import { gradeLabel } from "./grades";
import PrintNow from "./PrintNow";

const BAR = "#0f766e";
const pctText = (n: number | null) => (n === null ? "–" : `${n}%`);

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <p className="text-sm text-gray-600">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

/** One series, so no legend: the heading names it. Every bar carries its own number, and the table below is the same data. */
function WeeklyChart({ weekly }: { weekly: SchoolOverview["weekly"] }) {
  const max = Math.max(1, ...weekly.map(w => w.plays));
  const H = 140;
  return (
    <figure className="space-y-2">
      <figcaption className="text-sm font-medium">{t("Practice rounds played per week, last 8 weeks")}</figcaption>
      <div className="flex items-end gap-2 border-b border-gray-300" style={{ height: H + 22 }} role="img" aria-label={weekly.map(w => `${fmtDate(w.weekStart + "T00:00:00")}: ${w.plays}`).join(", ")}>
        {weekly.map(w => (
          <div key={w.weekStart} className="flex flex-1 flex-col items-center justify-end" title={`${fmtDate(w.weekStart + "T00:00:00")}: ${w.plays}`}>
            <span className="mb-1 text-xs tabular-nums text-gray-700">{w.plays}</span>
            <div style={{ height: Math.max(2, Math.round((w.plays / max) * H)), background: BAR, borderRadius: "4px 4px 0 0", width: "100%", maxWidth: 36 }} />
          </div>
        ))}
      </div>
      <div className="flex gap-2 text-center text-[11px] text-gray-500">{weekly.map(w => <span key={w.weekStart} className="flex-1">{fmtDate(w.weekStart + "T00:00:00")}</span>)}</div>
    </figure>
  );
}

function ClassTable({ d }: { d: SchoolOverview }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b text-start text-gray-600">
            {[t("Class"), t("Students"), t("Active this week"), t("Practice rounds"), t("Answers right"), t("Lessons shared"), t("Quiz average"), t("Check in with")].map(h => <th key={h} className="px-2 py-2 text-start font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {d.classes.map(c => (
            <tr key={c.id} className="border-b last:border-0">
              <td className="px-2 py-2 font-medium"><bdi>{c.name}</bdi> <span className="text-gray-500">· {gradeLabel(c.grade)}</span></td>
              <td className="px-2 py-2 tabular-nums">{c.students}</td>
              <td className="px-2 py-2 tabular-nums">{c.activeThisWeek} / {c.students}</td>
              <td className="px-2 py-2 tabular-nums">{c.plays}</td>
              <td className="px-2 py-2 tabular-nums">{pctText(c.accuracyPercent)}</td>
              <td className="px-2 py-2 tabular-nums">{c.lessonsShared}</td>
              <td className="px-2 py-2 tabular-nums">{pctText(c.quizAveragePercent)}</td>
              <td className="px-2 py-2 tabular-nums">{c.needAttention}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const NOTES = [
  T("These numbers come from what students actually did in the app. Nothing is estimated."),
  T("\"Active\" means a student played at least one practice round in the last 7 days."),
  T("Quiz averages are each student's first attempt at a teacher's quiz. They show what was practised in the app, not a student's overall ability or an exam result."),
  T("The app is one tool among many. These figures do not prove it caused any change in learning."),
];

export default function SchoolTab() {
  const { data, isLoading } = trpc.school.overview.useQuery();
  const [printing, setPrinting] = useState(false);
  if (isLoading || !data) return <p className="text-gray-600">{t("Loading…")}</p>;
  const tt = data.totals;
  const rtl = currentLang() === "ar";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("School overview")}</CardTitle>
          <CardDescription>{t("How the whole school is using the app: real numbers across every class, ready to share with your head teacher or print as a report.")}</CardDescription>
        </CardHeader>
        <CardContent><Button onClick={() => setPrinting(true)}>🖨 {t("Print the report")}</Button></CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label={t("Students")} value={String(tt.students)} hint={t("Classes: {n}", { n: tt.classes })} />
        <Tile label={t("Active this week")} value={pctText(tt.activePercent)} hint={t("{a} of {b} students", { a: tt.activeThisWeek, b: tt.students })} />
        <Tile label={t("Practice rounds played")} value={String(tt.plays)} />
        <Tile label={t("Lessons shared")} value={String(tt.lessonsShared)} hint={tt.quizTakenPercent === null ? undefined : t("{n}% of expected quizzes taken", { n: tt.quizTakenPercent })} />
        <Tile label={t("Quiz average")} value={pctText(tt.quizAveragePercent)} hint={t("first attempts")} />
        <Tile label={t("Students to check in with")} value={String(tt.needAttention)} hint={t("inactive, struggling or flagged")} />
        <Tile label={t("Safety flags, last 30 days")} value={String(data.safety.flaggedLast30Days)} hint={t("{n} still to review", { n: data.safety.open })} />
      </div>

      <Card><CardContent className="pt-6"><WeeklyChart weekly={data.weekly} /></CardContent></Card>
      <Card><CardHeader><CardTitle>{t("By class")}</CardTitle></CardHeader><CardContent><ClassTable d={data} /></CardContent></Card>
      <ul className="list-disc space-y-1 ps-5 text-xs text-gray-600">{NOTES.map(n => <li key={n}>{t(n)}</li>)}</ul>

      {printing && (
        <PrintNow dir={rtl ? "rtl" : "ltr"} lang={currentLang()} onDone={() => setPrinting(false)}>
          <h1>{t("School report")}</h1>
          <p>{fmtDate(data.generatedAt)}</p>
          <h3>{t("Summary")}</h3>
          <ul>
            <li>{t("Classes: {n}", { n: tt.classes })}, {t("{n} students", { n: tt.students })}</li>
            <li>{t("Active this week")}: {pctText(tt.activePercent)} ({t("{a} of {b} students", { a: tt.activeThisWeek, b: tt.students })})</li>
            <li>{t("Practice rounds played")}: {tt.plays}</li>
            <li>{t("Lessons shared")}: {tt.lessonsShared}; {t("Quiz average")}: {pctText(tt.quizAveragePercent)}</li>
            <li>{t("Safety flags, last 30 days")}: {data.safety.flaggedLast30Days} ({t("{n} still to review", { n: data.safety.open })})</li>
          </ul>
          <h3>{t("Practice rounds played per week, last 8 weeks")}</h3>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <tbody>
              {data.weekly.map(w => (
                <tr key={w.weekStart}>
                  <td style={{ padding: "2px 6px", width: 110 }}>{fmtDate(w.weekStart + "T00:00:00")}</td>
                  <td style={{ padding: "2px 6px" }}><div style={{ height: 10, width: `${Math.round((w.plays / Math.max(1, ...data.weekly.map(x => x.plays))) * 100)}%`, background: "#444" }} /></td>
                  <td style={{ padding: "2px 6px", width: 40 }}>{w.plays}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3>{t("By class")}</h3>
          <ClassTable d={data} />
          <h3>{t("About these numbers")}</h3>
          <ul>{NOTES.map(n => <li key={n}>{t(n)}</li>)}</ul>
        </PrintNow>
      )}
    </div>
  );
}
