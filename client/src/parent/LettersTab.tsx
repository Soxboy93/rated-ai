import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Lang } from "@shared/jordan";
import { currentLang, fmtDate, t } from "@/i18n";
import { selectClass } from "./FamilyPanel";
import PrintNow from "./PrintNow";
import { GAME_META } from "@/kid/guides";
import { SUBJECT_LABEL } from "./LessonsTab";
import { gradeLabel } from "./grades";
import type { LessonSubject } from "@shared/lesson";

/** Notes to parents: the AI drafts from real class data, the teacher edits, then copies or prints. The AI never sees a child's name. */
export default function LettersTab() {
  const { data: classes } = trpc.classes.list.useQuery();
  const { data: students } = trpc.profiles.list.useQuery();
  const [kind, setKind] = useState<"student" | "class">("class");
  const [classId, setClassId] = useState("");
  const [profileId, setProfileId] = useState("");
  const [language, setLanguage] = useState<Lang>(currentLang());
  const [note, setNote] = useState("");
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  const [printing, setPrinting] = useState(false);
  const utils = trpc.useUtils();
  const [report, setReport] = useState<Awaited<ReturnType<typeof utils.classes.studentReport.fetch>> | null>(null);
  const [reportError, setReportError] = useState("");
  const loadReport = async () => {
    setReportError("");
    try { setReport(await utils.classes.studentReport.fetch({ profileId: pid })); } catch (e) { setReportError(t(e instanceof Error ? e.message : "Something went wrong. Try again!")); }
  };
  const draft = trpc.letters.draft.useMutation({ onSuccess: out => { setText(out.text); setCopied(false); } });

  const cls = classId || classes?.[0]?.id || "";
  const inClass = (students ?? []).filter(s => s.classId === cls);
  const pid = profileId && inClass.some(s => s.id === profileId) ? profileId : inClass[0]?.id ?? "";
  const ready = kind === "class" ? !!cls : !!pid;

  const write = () => {
    const common = { language, note: note.trim() || undefined };
    draft.mutate(kind === "class" ? { kind, classId: cls, ...common } : { kind, profileId: pid, ...common });
  };
  const copy = async () => { try { await navigator.clipboard.writeText(text); setCopied(true); } catch { /* the teacher can select the text instead */ } };

  if (!classes || classes.length === 0) return <Card><CardContent className="py-6 text-gray-600">{t("Create a class and add students first.")}</CardContent></Card>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("Notes to parents")}</CardTitle>
          <CardDescription>{t("The companion drafts a short, warm note from your class's real numbers. It is never given a child's name, and it never includes moods or safety flags. Read and edit it before you send or print it.")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="lt-kind" className="text-sm font-medium">{t("Note about")}</label>
            <select id="lt-kind" className={selectClass + " w-full"} value={kind} onChange={e => setKind(e.target.value as "student" | "class")}>
              <option value="class">{t("The whole class (weekly update)")}</option>
              <option value="student">{t("One student")}</option>
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="lt-class" className="text-sm font-medium">{t("Class")}</label>
            <select id="lt-class" className={selectClass + " w-full"} value={cls} onChange={e => { setClassId(e.target.value); setProfileId(""); }}>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {kind === "student" && (
            <div className="space-y-1">
              <label htmlFor="lt-student" className="text-sm font-medium">{t("Student")}</label>
              <select id="lt-student" className={selectClass + " w-full"} value={pid} onChange={e => setProfileId(e.target.value)}>
                {inClass.map(s => <option key={s.id} value={s.id}>{s.childName}</option>)}
              </select>
            </div>
          )}
          <div className="space-y-1">
            <label htmlFor="lt-lang" className="text-sm font-medium">{t("Language of the note")}</label>
            <select id="lt-lang" className={selectClass + " w-full"} value={language} onChange={e => setLanguage(e.target.value as Lang)}>
              <option value="ar">العربية</option>
              <option value="en">English</option>
            </select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label htmlFor="lt-note" className="text-sm font-medium">{t("Anything to add? (optional)")}</label>
            <Input id="lt-note" value={note} maxLength={300} placeholder={t("e.g. parents' meeting on Thursday, or please practise times tables")} onChange={e => setNote(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Button onClick={write} disabled={!ready || draft.isPending}>{draft.isPending ? t("Writing the note…") : t("Write a draft")}</Button>
            {kind === "student" && <Button className="ms-2" variant="outline" onClick={loadReport} disabled={!pid}>🖨 {t("Print a progress report")}</Button>}
            {draft.error && <p className="mt-2 text-sm text-red-600" role="alert">{t(draft.error.message)}</p>}
            {reportError && <p className="mt-2 text-sm text-red-600" role="alert">{reportError}</p>}
          </div>
        </CardContent>
      </Card>

      {text && (
        <Card>
          <CardHeader><CardTitle>{t("Your draft")}</CardTitle><CardDescription>{t("Edit anything you like. Check every fact before it goes home.")}</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <textarea className="min-h-56 w-full rounded-md border border-input bg-background p-3 text-base leading-relaxed" dir="auto" lang={language} value={text} onChange={e => setText(e.target.value)} aria-label={t("Your draft")} />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={copy}>{copied ? `✓ ${t("Copied")}` : t("Copy")}</Button>
              <Button variant="outline" onClick={() => setPrinting(true)}>🖨 {t("Print")}</Button>
            </div>
          </CardContent>
        </Card>
      )}
      {report && (
        <PrintNow dir={language === "ar" ? "rtl" : "ltr"} lang={language} onDone={() => setReport(null)}>
          <h1><bdi>{report.name}</bdi> · {t("Progress report")}</h1>
          <p>{report.className && <bdi>{report.className}</bdi>}{report.grade ? ` · ${gradeLabel(report.grade)}` : ""} · {fmtDate(new Date())}</p>
          <h3>{t("Practice in the app")}</h3>
          <ul>
            <li>{t("Level {level}", { level: report.level })} · {t("{n} XP", { n: report.xp })} · {t("Badges: {n}", { n: report.badges })}</li>
            <li>{t("Practice rounds played")}: {report.totalPlays}{report.accuracyPercent !== null ? ` · ${t("Answers right (%)")}: ${report.accuracyPercent}` : ""}</li>
            <li>{t("Day streak")}: {report.streakDays} · {t("Longest streak: {n}", { n: report.longestStreak })}</li>
            {report.activities.total > 0 && <li>{t("Activities done")}: {report.activities.done} / {report.activities.total}</li>}
          </ul>
          {report.byGame.length > 0 && (
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <tbody>{report.byGame.map(g => <tr key={g.game}><td style={{ padding: "2px 6px" }}>{GAME_META[g.game as keyof typeof GAME_META]?.name ?? g.game}</td><td style={{ padding: "2px 6px" }}>{g.plays}</td><td style={{ padding: "2px 6px" }}>{g.accuracyPercent}%</td></tr>)}</tbody>
            </table>
          )}
          {report.lessons.length > 0 && (
            <>
              <h3>{t("Lessons")}</h3>
              <ul>{report.lessons.map((l, i) => <li key={i}><bdi>{l.title}</bdi> ({t(SUBJECT_LABEL[l.subject as LessonSubject] ?? "Other")}): {l.correct === null ? t("Not done") : `${l.correct} / ${l.total}`}</li>)}</ul>
            </>
          )}
          <p style={{ marginTop: 18, fontSize: "10pt" }}>{t("These numbers come from what the student did in the app. They show practice, not overall ability.")}</p>
        </PrintNow>
      )}
      {printing && (
        <PrintNow dir={language === "ar" ? "rtl" : "ltr"} lang={language} onDone={() => setPrinting(false)}>
          <p style={{ textAlign: "end", marginBottom: 16 }}>{fmtDate(new Date())}</p>
          {text.split(/\n{2,}/).map((para, i) => <p key={i} style={{ whiteSpace: "pre-wrap", margin: "0 0 12px" }}>{para}</p>)}
        </PrintNow>
      )}
    </div>
  );
}
