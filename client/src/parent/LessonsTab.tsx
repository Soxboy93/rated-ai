import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LESSON_SUBJECTS, MAX_SOURCE_CHARS, MIN_SOURCE_CHARS, SOURCE_REQUIRED_SUBJECTS, type LessonSubject } from "@shared/lesson";
import type { Lang } from "@shared/jordan";
import { currentLang, fmtDate, t, T } from "@/i18n";
import { CLASS_GRADES, gradeLabel } from "./grades";
import { selectClass } from "./FamilyPanel";
import LessonView from "./LessonView";

export const SUBJECT_LABEL: Record<LessonSubject, string> = {
  arabic: T("Arabic"), math: T("Maths"), science: T("Science"), english: T("English"),
  islamic: T("Islamic education"), social: T("Social studies"), computer: T("Computer science"), other: T("Other"),
};

function NewLesson({ onCreated, onCancel }: { onCreated: (id: string) => void; onCancel: () => void }) {
  const [subject, setSubject] = useState<LessonSubject>("math");
  const [grade, setGrade] = useState(4);
  const [topic, setTopic] = useState("");
  const [duration, setDuration] = useState(45);
  const [language, setLanguage] = useState<Lang>(currentLang());
  const [notes, setNotes] = useState("");
  const [source, setSource] = useState("");
  const gen = trpc.lessons.generate.useMutation({ onSuccess: out => onCreated(out.id) });
  const needsSource = SOURCE_REQUIRED_SUBJECTS.includes(subject);
  const tooShort = needsSource && source.trim().length < MIN_SOURCE_CHARS;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("New lesson")}</CardTitle>
        <CardDescription>{t("Tell the companion what you are teaching. It writes a draft lesson: goals, a warm-up, teaching steps, examples, activities and a quiz. You review and edit it before teaching or sharing.")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); gen.mutate({ subject, grade, topic, durationMin: duration, language, notes: notes.trim() || undefined, sourceText: source.trim() || undefined }); }}>
          <div className="space-y-1">
            <label htmlFor="ls-subject" className="text-sm font-medium">{t("Subject")}</label>
            <select id="ls-subject" className={selectClass + " w-full"} value={subject} onChange={e => setSubject(e.target.value as LessonSubject)}>
              {LESSON_SUBJECTS.map(s => <option key={s} value={s}>{t(SUBJECT_LABEL[s])}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="ls-grade" className="text-sm font-medium">{t("Grade")}</label>
            <select id="ls-grade" className={selectClass + " w-full"} value={grade} onChange={e => setGrade(Number(e.target.value))}>
              {CLASS_GRADES.map(g => <option key={g} value={g}>{gradeLabel(g)}</option>)}
            </select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label htmlFor="ls-topic" className="text-sm font-medium">{t("Lesson topic")}</label>
            <Input id="ls-topic" value={topic} maxLength={300} required minLength={3} placeholder={t("e.g. Adding fractions with the same denominator")} onChange={e => setTopic(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label htmlFor="ls-duration" className="text-sm font-medium">{t("Lesson length")}</label>
            <select id="ls-duration" className={selectClass + " w-full"} value={duration} onChange={e => setDuration(Number(e.target.value))}>
              {[30, 40, 45, 60, 90].map(m => <option key={m} value={m}>{t("{n} minutes", { n: m })}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="ls-lang" className="text-sm font-medium">{t("Language of the lesson")}</label>
            <select id="ls-lang" className={selectClass + " w-full"} value={language} onChange={e => setLanguage(e.target.value as Lang)}>
              <option value="ar">العربية</option>
              <option value="en">English</option>
            </select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label htmlFor="ls-notes" className="text-sm font-medium">{t("Anything the companion should know? (optional)")}</label>
            <Input id="ls-notes" value={notes} maxLength={500} placeholder={t("e.g. a mixed-ability class, only one projector, no internet")} onChange={e => setNotes(e.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label htmlFor="ls-source" className="text-sm font-medium">{needsSource ? t("Textbook passage (required for this subject)") : t("Textbook passage (optional)")}</label>
            <textarea id="ls-source" className="min-h-28 w-full rounded-md border border-input bg-background p-3 text-sm" maxLength={MAX_SOURCE_CHARS} value={source} onChange={e => setSource(e.target.value)} />
            <p className="text-xs text-gray-500">{needsSource
              ? t("For this subject the companion only uses the passage you paste, so it cannot invent content. At least {n} characters.", { n: MIN_SOURCE_CHARS })
              : t("Paste the page you teach from and the lesson will stick to it. Without it the companion writes from general knowledge, so check it carefully.")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <Button type="submit" disabled={gen.isPending || topic.trim().length < 3 || tooShort}>{gen.isPending ? t("Writing the lesson… this can take up to a minute") : t("Create lesson draft")}</Button>
            <Button type="button" variant="ghost" onClick={onCancel} disabled={gen.isPending}>{t("Cancel")}</Button>
          </div>
          {gen.error && <p className="text-sm text-red-600 sm:col-span-2" role="alert">{t(gen.error.message)}</p>}
        </form>
      </CardContent>
    </Card>
  );
}

export default function LessonsTab() {
  const utils = trpc.useUtils();
  const { data: lessons, isLoading } = trpc.lessons.list.useQuery();
  const [view, setView] = useState<{ kind: "list" } | { kind: "new" } | { kind: "lesson"; id: string }>({ kind: "list" });

  if (view.kind === "new") return <NewLesson onCancel={() => setView({ kind: "list" })} onCreated={id => { utils.lessons.invalidate(); setView({ kind: "lesson", id }); }} />;
  if (view.kind === "lesson") return <LessonView lessonId={view.id} onBack={() => { utils.lessons.invalidate(); setView({ kind: "list" }); }} />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("Your lessons")}</CardTitle>
          <CardDescription>{t("Plan a lesson with the companion, teach it on the board, share its quiz with a class and see which questions the class found hard.")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={() => setView({ kind: "new" })}>＋ {t("New lesson")}</Button>
          {isLoading ? <p className="text-gray-600">{t("Loading…")}</p> : !lessons || lessons.length === 0 ? (
            <p className="text-gray-600">{t("No lessons yet. Create your first one.")}</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {lessons.map(l => (
                <li key={l.id}>
                  <button type="button" onClick={() => setView({ kind: "lesson", id: l.id })} className="w-full rounded-xl border bg-white p-4 text-start shadow-sm transition hover:border-teal-500 hover:shadow">
                    <p className="font-semibold"><bdi>{l.title}</bdi></p>
                    <p className="text-sm text-gray-600">{t(SUBJECT_LABEL[l.subject as LessonSubject] ?? "Other")} · {gradeLabel(l.grade)} · {t("{n} minutes", { n: l.durationMin })}</p>
                    <p className="mt-1 text-xs text-gray-500">{l.updatedAt ? fmtDate(l.updatedAt) : ""}{l.sharedWith ? ` · ${t("Classes it is shared with: {n}", { n: l.sharedWith })}` : ""}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
