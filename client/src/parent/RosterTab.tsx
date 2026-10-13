import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { parseRosterText } from "@shared/classroom";
import { MAX_CLASSES_PER_TEACHER, MAX_STUDENTS_PER_CLASS } from "@shared/jordan";
import { t, T } from "@/i18n";
import { CLASS_GRADES, gradeLabel } from "./grades";
import { downloadJson, selectClass } from "./FamilyPanel";

const SKIP_REASONS: Record<string, string> = {
  empty: T("blank line"),
  too_long: T("name too long"),
  contact_details: T("looks like contact details"),
  duplicate: T("already in the class"),
  class_full: T("class is full"),
};

type Student = { id: string; childName: string; ageGroup: string; classId: string | null };
type Cls = { id: string; name: string; grade: number; studentCount: number };

function CreateClass({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [grade, setGrade] = useState(4);
  const create = trpc.classes.create.useMutation({ onSuccess: () => { setName(""); onDone(); } });
  return (
    <form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); create.mutate({ name, grade }); }}>
      <div className="space-y-1">
        <label htmlFor="class-name" className="text-sm font-medium">{t("Class name")}</label>
        <Input id="class-name" value={name} maxLength={100} required placeholder={t("e.g. 4A")} onChange={e => setName(e.target.value)} />
      </div>
      <div className="space-y-1">
        <label htmlFor="class-grade" className="text-sm font-medium">{t("Grade")}</label>
        <select id="class-grade" className={selectClass} value={grade} onChange={e => setGrade(Number(e.target.value))}>
          {CLASS_GRADES.map(g => <option key={g} value={g}>{gradeLabel(g)}</option>)}
        </select>
      </div>
      <Button type="submit" disabled={create.isPending || !name.trim()}>{t("Add class")}</Button>
      {create.error && <p className="w-full text-sm text-red-600" role="alert">{t(create.error.message)}</p>}
    </form>
  );
}

function ClassRow({ cls, onChanged }: { cls: Cls; onChanged: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const del = trpc.classes.delete.useMutation({ onSuccess: onChanged });
  return (
    <li className="rounded-lg border p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="font-semibold">{cls.name}</p><p className="text-sm text-gray-600">{gradeLabel(cls.grade)} · {t("{n} students", { n: cls.studentCount })}</p></div>
        <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>{t("Delete class")}</Button>
      </div>
      {confirming && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm space-y-2" role="alertdialog" aria-label={t("Delete {name}", { name: cls.name })}>
          <p className="text-red-900">{t("This removes the class and its activities. The students stay in your list, without a class.")}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" disabled={del.isPending} onClick={() => del.mutate({ classId: cls.id })}>{t("Delete class")}</Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>{t("Keep")}</Button>
          </div>
        </div>
      )}
      {del.error && <p className="text-sm text-red-600" role="alert">{t(del.error.message)}</p>}
    </li>
  );
}

function AddStudents({ classes, onDone }: { classes: Cls[]; onDone: () => void }) {
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const imp = trpc.profiles.importRoster.useMutation({ onSuccess: () => { setText(""); onDone(); } });
  const names = parseRosterText(text);
  const cls = classes.find(c => c.id === classId) ?? classes[0];

  const readFile = async (file?: File) => {
    if (!file) return;
    const content = await file.text();
    setText(prev => (prev.trim() ? prev.trimEnd() + "\n" : "") + content);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label htmlFor="roster-class" className="text-sm font-medium">{t("Add to class")}</label>
        <select id="roster-class" className={selectClass} value={cls?.id ?? ""} onChange={e => setClassId(e.target.value)}>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name} · {gradeLabel(c.grade)}</option>)}
        </select>
      </div>
      <div className="space-y-1">
        <label htmlFor="roster-text" className="text-sm font-medium">{t("Student first names, one per line")}</label>
        <textarea id="roster-text" className="min-h-32 w-full rounded-md border border-input bg-background p-3 text-sm" value={text} onChange={e => setText(e.target.value)} placeholder={t("Layla\nOmar\nSara")} />
        <p className="text-xs text-gray-500">{t("Use first names or nicknames only: never surnames, phone numbers or other contact details. You can also paste a spreadsheet column or choose a .csv or .txt file.")}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <input ref={fileRef} type="file" accept=".csv,.txt,text/csv,text/plain" hidden onChange={e => readFile(e.target.files?.[0])} aria-label={t("Choose a student list file")} />
        <Button variant="outline" onClick={() => fileRef.current?.click()}>{t("Choose a file…")}</Button>
        <Button disabled={!cls || names.length === 0 || imp.isPending} onClick={() => cls && imp.mutate({ classId: cls.id, names: names.slice(0, MAX_STUDENTS_PER_CLASS) })}>
          {imp.isPending ? t("Adding…") : t("Add {n} students", { n: names.length })}
        </Button>
        {names.length > MAX_STUDENTS_PER_CLASS && <p className="text-sm text-amber-800">{t("Only the first {n} names are used.", { n: MAX_STUDENTS_PER_CLASS })}</p>}
      </div>
      {imp.error && <p className="text-sm text-red-600" role="alert">{t(imp.error.message)}</p>}
      {imp.data && (
        <div className="rounded-md border bg-white p-3 text-sm space-y-1" role="status">
          <p className="font-medium">{t("{n} students added.", { n: imp.data.created })}</p>
          {imp.data.skipped.length > 0 && (
            <>
              <p className="text-amber-900">{t("{n} names were skipped:", { n: imp.data.skipped.length })}</p>
              <ul className="list-disc ps-5 text-gray-700">
                {imp.data.skipped.map((s, i) => <li key={i}><bdi>{s.name || "—"}</bdi> ({t(SKIP_REASONS[s.reason] ?? s.reason)})</li>)}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function StudentRow({ student, classes, onChanged }: { student: Student; classes: Cls[]; onChanged: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState("");
  const move = trpc.profiles.update.useMutation({ onSuccess: onChanged });
  const del = trpc.profiles.delete.useMutation({ onSuccess: onChanged });
  const exp = trpc.profiles.export.useMutation({
    onSuccess: data => {
      if (import.meta.env.VITE_DEMO) setNote(t("In the live app this downloads a file with the student's profile, chats, scores and badges."));
      else downloadJson(`rated-ai-${student.childName.replace(/\W+/g, "-").toLowerCase() || "student"}.json`, data);
    },
  });
  const err = move.error || del.error || exp.error;
  return (
    <li className="rounded-lg border p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-semibold"><bdi>{student.childName}</bdi></p>
        <div className="flex flex-wrap items-center gap-2">
          <select className={selectClass} aria-label={t("Class for {name}", { name: student.childName })} value={student.classId ?? ""}
            onChange={e => e.target.value && move.mutate({ profileId: student.id, classId: e.target.value })}>
            {!student.classId && <option value="">{t("No class")}</option>}
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <Button variant="outline" size="sm" disabled={exp.isPending} onClick={() => exp.mutate({ profileId: student.id })}>{t("Download data")}</Button>
          <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>{t("Delete")}</Button>
        </div>
      </div>
      {confirming && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm space-y-2" role="alertdialog" aria-label={t("Delete {name}", { name: student.childName })}>
          <p className="text-red-900">{t("This permanently deletes {name}'s profile and every conversation they had. It cannot be undone. Download their data first if you want a copy.", { name: student.childName })}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" disabled={del.isPending} onClick={() => del.mutate({ profileId: student.id })}>{t("Delete permanently")}</Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>{t("Keep")}</Button>
          </div>
        </div>
      )}
      {note && <p className="text-sm text-gray-600" role="status">{note}</p>}
      {err && <p className="text-sm text-red-600" role="alert">{t(err.message)}</p>}
    </li>
  );
}

export default function RosterTab() {
  const utils = trpc.useUtils();
  const { data: classes } = trpc.classes.list.useQuery();
  const { data: students } = trpc.profiles.list.useQuery();
  const { data: consent } = trpc.consent.status.useQuery();
  const refresh = () => { utils.classes.invalidate(); utils.profiles.invalidate(); utils.account.auditLog.invalidate(); utils.parent.invalidate(); };
  const list = (students ?? []) as Student[];
  const cls = (classes ?? []) as Cls[];

  if (!consent?.granted) {
    return <Card><CardContent className="py-6 text-sm text-amber-800">{t("Consent is withdrawn. Agree again from the start screen to add students or chat.")}</CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("Classes")}</CardTitle>
          <CardDescription>{t("Create a class for each group of students. You can have up to {n} classes.", { n: MAX_CLASSES_PER_TEACHER })}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {cls.length > 0 && <ul className="space-y-3">{cls.map(c => <ClassRow key={c.id} cls={c} onChanged={refresh} />)}</ul>}
          <CreateClass onDone={refresh} />
        </CardContent>
      </Card>

      {cls.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("Add students")}</CardTitle>
            <CardDescription>{t("Students pick their name on the start screen; there are no student passwords or emails.")}</CardDescription>
          </CardHeader>
          <CardContent><AddStudents classes={cls} onDone={refresh} /></CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>{t("Students")}</CardTitle><CardDescription>{t("{n} students", { n: list.length })}</CardDescription></CardHeader>
        <CardContent className="space-y-6">
          {list.length === 0 && <p className="text-gray-600">{t("No students yet.")}</p>}
          {[...cls.map(c => ({ id: c.id, label: `${c.name} · ${gradeLabel(c.grade)}` })), { id: "", label: t("No class") }].map(group => {
            const members = list.filter(s => (s.classId ?? "") === group.id);
            if (members.length === 0) return null;
            return (
              <section key={group.id || "none"} aria-label={group.label} className="space-y-2">
                <h3 className="font-semibold">{group.label}</h3>
                <ul className="space-y-2">{members.map(s => <StudentRow key={s.id} student={s} classes={cls} onChanged={refresh} />)}</ul>
              </section>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
