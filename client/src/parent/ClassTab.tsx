import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GAME_IDS } from "@shared/gamification";
import { GAME_META } from "@/kid/guides";
import { MOOD_META } from "@/kid/guides";
import { localDay } from "@/kid/ChildContext";
import { t, T, fmtDate } from "@/i18n";
import { gradeLabel } from "./grades";
import { selectClass } from "./FamilyPanel";

const ATTENTION: Record<string, string> = {
  inactive: T("Has not played this week"),
  low_accuracy: T("Many answers wrong"),
  flagged: T("Flagged message or note"),
};

/** One cell value per CSV field: quoted, with quotes doubled, and guarded against spreadsheet formula injection. */
const csvCell = (v: string | number | null | undefined) => {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
};

export default function ClassTab() {
  const { data: classes, isLoading } = trpc.classes.list.useQuery();
  const [classId, setClassId] = useState("");
  useEffect(() => {
    if (classes?.length && !classes.some(c => c.id === classId)) setClassId(classes[0].id);
  }, [classes, classId]);
  const overview = trpc.classes.overview.useQuery({ classId, localDay: localDay() }, { enabled: !!classId });
  const [note, setNote] = useState("");

  if (isLoading) return <p className="text-gray-600">{t("Loading…")}</p>;
  if (!classes || classes.length === 0) {
    return <Card><CardContent className="py-8 text-center text-gray-600">{t('Create your first class in the "Classes and students" tab to see progress here.')}</CardContent></Card>;
  }

  const data = overview.data;
  const exportCsv = () => {
    if (!data) return;
    if (import.meta.env.VITE_DEMO) { setNote(t("In the live app this downloads a spreadsheet (CSV) of this table.")); return; }
    const head = [t("Student"), t("Level"), t("XP"), t("Day streak"), t("Games played"), t("Answers right (%)"), t("Last played"), t("Activities done"), t("Needs a check-in")];
    const rows = data.students.map(s => [
      s.childName, s.level, s.xp, s.streakDays, s.totalPlays,
      s.accuracy === null ? "" : Math.round(s.accuracy * 100),
      s.lastPlayedAt ? new Date(s.lastPlayedAt).toISOString().slice(0, 10) : "",
      s.assignmentsDone,
      s.attention.map(a => t(ATTENTION[a])).join("; "),
    ]);
    const csv = "﻿" + [head, ...rows].map(r => r.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `rated-ai-${data.class.name.replace(/\W+/g, "-").toLowerCase() || "class"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label htmlFor="class-pick" className="text-sm font-medium">{t("Class")}</label>
          <select id="class-pick" className={selectClass} value={classId} onChange={e => setClassId(e.target.value)}>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name} · {gradeLabel(c.grade)}</option>)}
          </select>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={!data || data.students.length === 0}>{t("Download as spreadsheet")}</Button>
        {note && <p className="text-sm text-gray-600" role="status">{note}</p>}
      </div>

      {overview.isLoading || !data ? <p className="text-gray-600">{t("Loading…")}</p> : data.students.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-gray-600">{t("This class has no students yet. Add them in the \"Classes and students\" tab.")}</CardContent></Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            {([
              [T("Students"), data.summary.studentCount],
              [T("Active this week"), `${data.summary.activeThisWeek} / ${data.summary.studentCount}`],
              [T("Games played"), data.summary.totalPlays],
              [T("Need a check-in"), data.summary.attentionCount],
            ] as const).map(([label, value]) => (
              <Card key={label}><CardContent className="py-4"><p className="text-2xl font-bold">{value}</p><p className="text-sm text-gray-600">{t(label)}</p></CardContent></Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t("Answers right, by game")}</CardTitle>
              <CardDescription>{t("Across the whole class. Practice results from the games, not school grades.")}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {GAME_IDS.map(id => {
                const acc = data.summary.accuracyByGame[id];
                const pct = acc === undefined ? 0 : Math.round(acc * 100);
                return (
                  <div key={id} className="rounded-lg border p-3">
                    <div className="flex justify-between text-sm"><span>{GAME_META[id].icon} {GAME_META[id].name}</span><span className="text-gray-600">{acc === undefined ? t("Not played yet") : `${pct}%`}</span></div>
                    <div className="mt-2 h-2 rounded bg-gray-100" role="progressbar" aria-label={t("{name} accuracy", { name: GAME_META[id].name })} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className="h-2 rounded bg-purple-500" style={{ width: `${pct}%` }} /></div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>{t("Students")}</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-start text-gray-600">
                    {[T("Student"), T("Level"), T("Day streak"), T("Games played"), T("Answers right"), T("Last played"), T("Activities done"), T("Mood"), T("Check-in")].map(h => <th key={h} scope="col" className="py-2 pe-3 text-start font-medium">{t(h)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {data.students.map(s => (
                    <tr key={s.profileId} className={`border-b ${s.attention.length ? "bg-amber-50" : ""}`}>
                      <th scope="row" className="py-2 pe-3 text-start font-medium">{s.childName}</th>
                      <td className="pe-3">{s.level} <span className="text-xs text-gray-500">({t("{n} XP", { n: s.xp })})</span></td>
                      <td className="pe-3">{s.streakDays}</td>
                      <td className="pe-3">{s.totalPlays}</td>
                      <td className="pe-3">{s.accuracy === null ? "–" : `${Math.round(s.accuracy * 100)}%`}</td>
                      <td className="pe-3">{s.lastPlayedAt ? fmtDate(s.lastPlayedAt) : t("Never")}</td>
                      <td className="pe-3">{s.assignmentsDone}{data.summary.assignmentCount ? ` / ${data.summary.assignmentCount}` : ""}</td>
                      <td className="pe-3">{s.lastMood ? `${MOOD_META[s.lastMood]?.emoji ?? ""} ${MOOD_META[s.lastMood]?.label ?? s.lastMood}` : "–"}</td>
                      <td>{s.attention.length ? s.attention.map(a => <span key={a} className="me-1 inline-block rounded-full border border-amber-400 bg-white px-2 py-0.5 text-xs text-amber-900">{t(ATTENTION[a])}</span>) : "✓"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-xs text-gray-500">{t("\"Check-in\" is only a prompt to look at a student: no play for a week, many wrong answers, or a flagged message. It is not a judgement.")}</p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
