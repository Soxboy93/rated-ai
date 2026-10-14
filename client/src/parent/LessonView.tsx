import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { normalizeLesson, plannedMinutes, type ActivityMode, type LessonContent, type LessonSubject } from "@shared/lesson";
import type { Lang } from "@shared/jordan";
import { fmtDate, t, T } from "@/i18n";
import Bidi from "@/components/Bidi";
import { gradeLabel } from "./grades";
import { selectClass } from "./FamilyPanel";
import { SUBJECT_LABEL } from "./LessonsTab";
import TeachMode from "./TeachMode";

type Lesson = { id: string; title: string; subject: string; grade: number; language: Lang; topic: string; durationMin: number; hasSource: boolean; content: LessonContent };

const textarea = "w-full rounded-md border border-input bg-background p-2 text-sm";
const MODES: Array<[ActivityMode, string]> = [["individual", T("On their own")], ["pair", T("In pairs")], ["group", T("In groups")]];
const MODE_LABEL = Object.fromEntries(MODES) as Record<ActivityMode, string>;
const REVISE_IDEAS = [T("Make it simpler"), T("Make it more challenging"), T("Add two more quiz questions"), T("Make it shorter"), T("Add a hands-on activity")];

/* ------------------------------------------------------------------------------------------ editing */

function LinesField({ id, label, value, onChange, rows = 3 }: { id: string; label: string; value: string[]; onChange: (v: string[]) => void; rows?: number }) {
  const [text, setText] = useState(value.join("\n"));
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <textarea id={id} rows={rows} className={textarea} value={text} onChange={e => { setText(e.target.value); onChange(e.target.value.split("\n")); }} />
    </div>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><label htmlFor={id} className="text-sm font-medium">{label}</label>{children}</div>;
}

function Editor({ draft, set }: { draft: LessonContent; set: (c: LessonContent) => void }) {
  const patch = (p: Partial<LessonContent>) => set({ ...draft, ...p });
  const move = <T,>(arr: T[], i: number, v: T) => arr.map((x, k) => (k === i ? v : x));
  const drop = <T,>(arr: T[], i: number) => arr.filter((_, k) => k !== i);
  return (
    <div className="space-y-6">
      <LinesField id="ed-obj" label={t("Goals (one per line)")} value={draft.objectives} onChange={v => patch({ objectives: v })} />

      <section className="space-y-2">
        <h3 className="font-semibold">{t("Warm-up")}</h3>
        <Field id="ed-wu-t" label={t("Title")}><Input id="ed-wu-t" value={draft.warmup.title} onChange={e => patch({ warmup: { ...draft.warmup, title: e.target.value } })} /></Field>
        <Field id="ed-wu-s" label={t("What to say and do")}><textarea id="ed-wu-s" rows={3} className={textarea} value={draft.warmup.script} onChange={e => patch({ warmup: { ...draft.warmup, script: e.target.value } })} /></Field>
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold">{t("Teaching steps")}</h3>
        {draft.steps.map((s, i) => (
          <div key={i} className="space-y-2 rounded-lg border p-3">
            <div className="flex items-end gap-2">
              <div className="flex-1"><Field id={`ed-st-t${i}`} label={t("Step {n}", { n: i + 1 })}><Input id={`ed-st-t${i}`} value={s.title} onChange={e => patch({ steps: move(draft.steps, i, { ...s, title: e.target.value }) })} /></Field></div>
              <Button type="button" variant="outline" size="sm" disabled={draft.steps.length <= 1} onClick={() => patch({ steps: drop(draft.steps, i) })}>{t("Remove")}</Button>
            </div>
            <Field id={`ed-st-e${i}`} label={t("What to say and do")}><textarea id={`ed-st-e${i}`} rows={4} className={textarea} value={s.explanation} onChange={e => patch({ steps: move(draft.steps, i, { ...s, explanation: e.target.value }) })} /></Field>
            <LinesField id={`ed-st-b${i}`} label={t("Points for the board (one per line)")} value={s.board} onChange={v => patch({ steps: move(draft.steps, i, { ...s, board: v }) })} rows={2} />
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" disabled={draft.steps.length >= 8} onClick={() => patch({ steps: [...draft.steps, { title: "", explanation: "", board: [], minutes: 5 }] })}>＋ {t("Add a step")}</Button>
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold">{t("Worked examples")}</h3>
        {draft.examples.map((e, i) => (
          <div key={i} className="space-y-2 rounded-lg border p-3">
            <Field id={`ed-ex-p${i}`} label={t("Question")}><textarea id={`ed-ex-p${i}`} rows={2} className={textarea} value={e.prompt} onChange={ev => patch({ examples: move(draft.examples, i, { ...e, prompt: ev.target.value }) })} /></Field>
            <Field id={`ed-ex-s${i}`} label={t("Solution")}><textarea id={`ed-ex-s${i}`} rows={2} className={textarea} value={e.solution} onChange={ev => patch({ examples: move(draft.examples, i, { ...e, solution: ev.target.value }) })} /></Field>
            <Button type="button" variant="outline" size="sm" onClick={() => patch({ examples: drop(draft.examples, i) })}>{t("Remove")}</Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" disabled={draft.examples.length >= 5} onClick={() => patch({ examples: [...draft.examples, { prompt: "", solution: "" }] })}>＋ {t("Add an example")}</Button>
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold">{t("Activities")}</h3>
        {draft.activities.map((a, i) => (
          <div key={i} className="space-y-2 rounded-lg border p-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <Field id={`ed-ac-t${i}`} label={t("Title")}><Input id={`ed-ac-t${i}`} value={a.title} onChange={e => patch({ activities: move(draft.activities, i, { ...a, title: e.target.value }) })} /></Field>
              <Field id={`ed-ac-m${i}`} label={t("Format")}>
                <select id={`ed-ac-m${i}`} className={selectClass} value={a.mode} onChange={e => patch({ activities: move(draft.activities, i, { ...a, mode: e.target.value as ActivityMode }) })}>
                  {MODES.map(([m, l]) => <option key={m} value={m}>{t(l)}</option>)}
                </select>
              </Field>
            </div>
            <Field id={`ed-ac-i${i}`} label={t("Instructions")}><textarea id={`ed-ac-i${i}`} rows={3} className={textarea} value={a.instructions} onChange={e => patch({ activities: move(draft.activities, i, { ...a, instructions: e.target.value }) })} /></Field>
            <Button type="button" variant="outline" size="sm" onClick={() => patch({ activities: drop(draft.activities, i) })}>{t("Remove")}</Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" disabled={draft.activities.length >= 5} onClick={() => patch({ activities: [...draft.activities, { title: "", mode: "pair", instructions: "", minutes: 10 }] })}>＋ {t("Add an activity")}</Button>
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold">{t("Word cards")}</h3>
        <p className="text-xs text-gray-500">{t("Key words with a short meaning. Students flip them as cards and play a matching game with them.")}</p>
        {draft.vocabulary.map((v, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <Input className="max-w-[12rem]" aria-label={t("Word {n}", { n: i + 1 })} value={v.term} onChange={e => patch({ vocabulary: move(draft.vocabulary, i, { ...v, term: e.target.value }) })} />
            <Input className="min-w-[12rem] flex-1" aria-label={t("Meaning {n}", { n: i + 1 })} value={v.meaning} onChange={e => patch({ vocabulary: move(draft.vocabulary, i, { ...v, meaning: e.target.value }) })} />
            <Button type="button" variant="outline" size="sm" onClick={() => patch({ vocabulary: drop(draft.vocabulary, i) })}>{t("Remove")}</Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" disabled={draft.vocabulary.length >= 12} onClick={() => patch({ vocabulary: [...draft.vocabulary, { term: "", meaning: "" }] })}>＋ {t("Add a word")}</Button>
      </section>

      {(["quiz", "practice"] as const).map(kind => (
      <section key={kind} className="space-y-3">
        <h3 className="font-semibold">{kind === "quiz" ? t("Quiz") : t("Practice game")}</h3>
        <p className="text-xs text-gray-500">{kind === "practice" ? t("Students play these as a game with instant feedback, as often as they like. They are not marked.") + " " : ""}{t("Each question needs four different options and one correct answer. Incomplete questions are dropped when you save.")}</p>
        {draft[kind].map((q, i) => (
          <div key={i} className="space-y-2 rounded-lg border p-3">
            <Field id={`ed-${kind}-q${i}`} label={t("Question {n}", { n: i + 1 })}><Input id={`ed-${kind}-q${i}`} value={q.q} onChange={e => patch({ [kind]: move(draft[kind], i, { ...q, q: e.target.value }) })} /></Field>
            {q.options.map((o, k) => (
              <div key={k} className="flex items-center gap-2">
                <input type="radio" name={`ed-${kind}-a${i}`} aria-label={t("Correct answer: option {n}", { n: k + 1 })} checked={q.answer === k} onChange={() => patch({ [kind]: move(draft[kind], i, { ...q, answer: k }) })} className="h-4 w-4" />
                <Input aria-label={t("Option {n}", { n: k + 1 })} value={o} onChange={e => patch({ [kind]: move(draft[kind], i, { ...q, options: move(q.options, k, e.target.value) }) })} />
              </div>
            ))}
            <Field id={`ed-${kind}-e${i}`} label={t("Why this is the answer")}><Input id={`ed-${kind}-e${i}`} value={q.explanation} onChange={e => patch({ [kind]: move(draft[kind], i, { ...q, explanation: e.target.value }) })} /></Field>
            <Button type="button" variant="outline" size="sm" onClick={() => patch({ [kind]: drop(draft[kind], i) })}>{t("Remove")}</Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" disabled={draft[kind].length >= 10} onClick={() => patch({ [kind]: [...draft[kind], { q: "", options: ["", "", "", ""], answer: 0, explanation: "" }] })}>＋ {kind === "quiz" ? t("Add a question") : t("Add a practice question")}</Button>
      </section>
      ))}

      <Field id="ed-sup" label={t("Support for students who struggle")}><textarea id="ed-sup" rows={2} className={textarea} value={draft.differentiation.support} onChange={e => patch({ differentiation: { ...draft.differentiation, support: e.target.value } })} /></Field>
      <Field id="ed-ext" label={t("Extension for students who finish early")}><textarea id="ed-ext" rows={2} className={textarea} value={draft.differentiation.extension} onChange={e => patch({ differentiation: { ...draft.differentiation, extension: e.target.value } })} /></Field>
      <LinesField id="ed-mis" label={t("Common misconceptions (one per line)")} value={draft.misconceptions} onChange={v => patch({ misconceptions: v })} />
      <Field id="ed-hw" label={t("Homework")}><textarea id="ed-hw" rows={2} className={textarea} value={draft.homework} onChange={e => patch({ homework: e.target.value })} /></Field>
      <LinesField id="ed-sum" label={t("Summary for students (one short sentence per line)")} value={draft.studentSummary} onChange={v => patch({ studentSummary: v })} />
    </div>
  );
}

/* ------------------------------------------------------------------------------------------ reading */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-2"><h3 className="font-semibold">{title}</h3>{children}</section>;
}
const List = ({ items }: { items: string[] }) => <ul className="list-disc space-y-1 ps-5">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>;

function Body({ c }: { c: LessonContent }) {
  return (
    <div className="space-y-5 text-sm leading-relaxed">
      {c.objectives.length > 0 && <Section title={t("Goals")}><List items={c.objectives} /></Section>}
      {c.warmup.script && <Section title={`${t("Warm-up")} · ${t("{n} minutes", { n: c.warmup.minutes })}`}><p className="font-medium">{c.warmup.title}</p><p className="whitespace-pre-wrap">{c.warmup.script}</p></Section>}
      <Section title={t("Teaching steps")}>
        <ol className="space-y-3">
          {c.steps.map((s, i) => (
            <li key={i} className="rounded-lg border p-3">
              <p className="font-medium">{i + 1}. {s.title} <span className="font-normal text-gray-500">· {t("{n} minutes", { n: s.minutes })}</span></p>
              <p className="whitespace-pre-wrap">{s.explanation}</p>
              {s.board.length > 0 && <div className="mt-2 rounded bg-slate-50 p-2"><p className="text-xs font-medium text-gray-500">{t("On the board")}</p><List items={s.board} /></div>}
            </li>
          ))}
        </ol>
      </Section>
      {c.examples.length > 0 && <Section title={t("Worked examples")}>{c.examples.map((e, i) => <p key={i}><b><Bidi>{e.prompt}</Bidi></b><br /><Bidi>{e.solution}</Bidi></p>)}</Section>}
      {c.activities.length > 0 && <Section title={t("Activities")}>{c.activities.map((a, i) => <p key={i}><b>{a.title}</b> · {t(MODE_LABEL[a.mode])} · {t("{n} minutes", { n: a.minutes })}<br /><span className="whitespace-pre-wrap">{a.instructions}</span></p>)}</Section>}
      {c.quiz.length > 0 && (
        <Section title={t("Quiz")}>
          <ol className="space-y-3">
            {c.quiz.map((q, i) => (
              <li key={i} className="rounded-lg border p-3">
                <p className="font-medium">{i + 1}. <Bidi>{q.q}</Bidi></p>
                <ul className="mt-1 space-y-0.5">{q.options.map((o, k) => <li key={k} className={k === q.answer ? "font-semibold text-brand-700" : ""}>{["A", "B", "C", "D"][k]}. <Bidi>{o}</Bidi>{k === q.answer ? " ✓" : ""}</li>)}</ul>
                {q.explanation && <p className="mt-1 text-gray-600">💡 {q.explanation}</p>}
              </li>
            ))}
          </ol>
        </Section>
      )}
      {c.practice.length > 0 && <Section title={t("Practice game")}><p>{t("{n} game questions with instant feedback (not marked). Edit them with Edit lesson.", { n: c.practice.length })}</p></Section>}
      {c.vocabulary.length > 0 && (
        <Section title={t("Word cards")}>
          <ul className="grid gap-1 sm:grid-cols-2">{c.vocabulary.map((v, i) => <li key={i} className="rounded border px-2 py-1"><b><Bidi>{v.term}</Bidi></b>: <Bidi>{v.meaning}</Bidi></li>)}</ul>
        </Section>
      )}
      {(c.differentiation.support || c.differentiation.extension) && <Section title={t("Differentiation")}>{c.differentiation.support && <p><b>{t("Support:")}</b> {c.differentiation.support}</p>}{c.differentiation.extension && <p><b>{t("Extension:")}</b> {c.differentiation.extension}</p>}</Section>}
      {c.misconceptions.length > 0 && <Section title={t("Common misconceptions")}><List items={c.misconceptions} /></Section>}
      {c.homework && <Section title={t("Homework")}><p className="whitespace-pre-wrap">{c.homework}</p></Section>}
      {c.studentSummary.length > 0 && <Section title={t("Summary for students")}><List items={c.studentSummary} /></Section>}
    </div>
  );
}

/** Printable copy rendered outside the app root so printing shows only the lesson (see index.css). */
function PrintSheet({ lesson, mode }: { lesson: Lesson; mode: "plan" | "worksheet" }) {
  const rtl = lesson.language === "ar";
  return createPortal(
    <div className="print-sheet" dir={rtl ? "rtl" : "ltr"} lang={lesson.language}>
      <h1>{lesson.title}</h1>
      <p>{t(SUBJECT_LABEL[lesson.subject as LessonSubject] ?? "Other")} · {gradeLabel(lesson.grade)}</p>
      {mode === "plan" ? <Body c={lesson.content} /> : (
        <>
          <p style={{ margin: "16px 0" }}>{t("Name")}: ______________________ &nbsp; {t("Date")}: ____________</p>
          <ol style={{ display: "grid", gap: 14, paddingInlineStart: 20 }}>
            {lesson.content.quiz.map((q, i) => (
              <li key={i}><b><Bidi>{q.q}</Bidi></b><div>{q.options.map((o, k) => <div key={k}>○ {["A", "B", "C", "D"][k]}. <Bidi>{o}</Bidi></div>)}</div></li>
            ))}
          </ol>
        </>
      )}
    </div>,
    document.body
  );
}

/* ------------------------------------------------------------------------------------------ sharing */

/** What to re-teach: the questions the class missed, who needs support or a challenge, and an AI-written plan (it sees counts, never names). */
function Insights({ shareId }: { shareId: string }) {
  const run = trpc.lessons.insights.useMutation();
  const d = run.data;
  return (
    <div className="space-y-3 rounded-lg border border-brand-200 bg-brand-50 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={() => run.mutate({ shareId })} disabled={run.isPending}>{run.isPending ? t("Reading the results…") : `💡 ${t("What should I re-teach?")}`}</Button>
        <span className="text-xs text-gray-600">{t("The companion sees the questions and how many students picked each answer, never a student's name.")}</span>
      </div>
      {run.error && <p className="text-red-600" role="alert">{t(run.error.message)}</p>}
      {d && (
        <div className="space-y-3">
          {!d.enough && <p className="text-amber-900">{t("At least {n} students need to take the quiz before the companion can suggest a plan.", { n: 3 })}</p>}
          {d.insights && (
            <div className="space-y-2">
              <p className="font-medium">{d.insights.summary}</p>
              {d.insights.misconceptions.length > 0 && <ul className="list-disc ps-5">{d.insights.misconceptions.map((m, i) => <li key={i}>{m}</li>)}</ul>}
              {d.insights.reteach.length > 0 && (
                <ol className="space-y-1 ps-5 list-decimal">
                  {d.insights.reteach.map((r, i) => <li key={i}><b>{r.title}</b> ({t("{n} minutes", { n: r.minutes })}): {r.instructions}</li>)}
                </ol>
              )}
              {d.insights.quickCheck && <p>❓ <b>{t("Quick check next lesson:")}</b> {d.insights.quickCheck}</p>}
              {d.insights.extension && <p>🚀 <b>{t("For students who got everything:")}</b> {d.insights.extension}</p>}
              <p className="text-xs text-gray-500">{t("A draft from the companion. Use your own judgement.")}</p>
            </div>
          )}
          <div className="grid gap-2 sm:grid-cols-3">
            {([[t("May need support"), d.needsSupport], [t("Ready for a challenge"), d.readyForMore], [t("Not taken yet"), d.notYetTaken]] as const).map(([label, names]) => (
              <div key={label} className="rounded border bg-white p-2"><p className="font-medium">{label}</p><p className="text-gray-700">{names.length ? names.map((n, i) => <span key={i}>{i ? "، " : ""}<bdi>{n}</bdi></span>) : "–"}</p></div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Results({ shareId }: { shareId: string }) {
  const { data, isLoading } = trpc.lessons.results.useQuery({ shareId });
  if (isLoading || !data) return <p className="text-sm text-gray-600">{t("Loading…")}</p>;
  return (
    <div className="space-y-3 rounded-lg bg-slate-50 p-3 text-sm">
      <p className="font-medium">{t("{a} of {b} students have taken the quiz.", { a: data.doneCount, b: data.studentCount })}</p>
      {data.doneCount > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">{t("Share of students who got each question right. Low numbers show what to re-teach.")}</p>
          {data.questions.map((q, i) => (
            <div key={i}>
              <div className="flex justify-between gap-3"><span>{i + 1}. {q.q}</span><b>{q.percentCorrect}%</b></div>
              <div className="h-2 rounded bg-gray-200" role="progressbar" aria-valuenow={q.percentCorrect ?? 0} aria-valuemin={0} aria-valuemax={100} aria-label={t("Question {n}", { n: i + 1 })}>
                <div className="h-2 rounded" style={{ width: `${q.percentCorrect ?? 0}%`, background: (q.percentCorrect ?? 0) < 50 ? "#d6384a" : "#0f766e" }} />
              </div>
            </div>
          ))}
        </div>
      )}
      {data.doneCount > 0 && <Insights shareId={shareId} />}
      <ul className="grid gap-1 sm:grid-cols-2">
        {data.students.map(s => <li key={s.profileId} className="flex justify-between rounded border bg-white px-2 py-1"><bdi>{s.childName}</bdi><span>{s.correct === null ? t("Not done") : `${s.correct} / ${s.total}`}</span></li>)}
      </ul>
    </div>
  );
}

function SharePanel({ lessonId }: { lessonId: string }) {
  const utils = trpc.useUtils();
  const { data: classes } = trpc.classes.list.useQuery();
  const { data: shares } = trpc.lessons.shares.useQuery({});
  const [classId, setClassId] = useState("");
  const [due, setDue] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const refresh = () => { utils.lessons.invalidate(); utils.progress.invalidate(); };
  const share = trpc.lessons.share.useMutation({ onSuccess: () => { setDue(""); refresh(); } });
  const archive = trpc.lessons.archiveShare.useMutation({ onSuccess: refresh });
  const mine = (shares ?? []).filter(s => s.lessonId === lessonId);
  const chosen = classId || classes?.[0]?.id || "";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("Share with a class")}</CardTitle>
        <CardDescription>{t("Students see the summary and examples on their home screen and take the quiz. The quiz is marked by the app; each student's first attempt counts.")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!classes || classes.length === 0 ? <p className="text-sm text-gray-600">{t('Create a class in the "Classes and students" tab first.')}</p> : (
          <form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); share.mutate({ lessonId, classId: chosen, dueDate: due || undefined }); }}>
            <div className="space-y-1">
              <label htmlFor="sh-class" className="text-sm font-medium">{t("Class")}</label>
              <select id="sh-class" className={selectClass} value={chosen} onChange={e => setClassId(e.target.value)}>{classes.map(c => <option key={c.id} value={c.id}>{c.name} · {gradeLabel(c.grade)}</option>)}</select>
            </div>
            <div className="space-y-1">
              <label htmlFor="sh-due" className="text-sm font-medium">{t("Due date (optional)")}</label>
              <Input id="sh-due" type="date" dir="ltr" value={due} onChange={e => setDue(e.target.value)} />
            </div>
            <Button type="submit" disabled={share.isPending}>{t("Share")}</Button>
          </form>
        )}
        {share.error && <p className="text-sm text-red-600" role="alert">{t(share.error.message)}</p>}
        {mine.map(s => (
          <div key={s.id} className="space-y-2 rounded-lg border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{s.className}{s.dueDate ? <span className="font-normal text-gray-500"> · {t("due {date}", { date: fmtDate(s.dueDate + "T00:00:00") })}</span> : null}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setOpen(open === s.id ? null : s.id)}>{open === s.id ? t("Hide results") : t("Results")}</Button>
                <Button size="sm" variant="outline" disabled={archive.isPending} onClick={() => archive.mutate({ shareId: s.id })}>{t("Stop sharing")}</Button>
              </div>
            </div>
            {open === s.id && <Results shareId={s.id} />}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------------------------------ the lesson */

export default function LessonView({ lessonId, onBack }: { lessonId: string; onBack: () => void }) {
  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.lessons.get.useQuery({ lessonId });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<LessonContent | null>(null);
  const [title, setTitle] = useState("");
  const [teaching, setTeaching] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [printMode, setPrintMode] = useState<"plan" | "worksheet" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const refresh = () => utils.lessons.get.invalidate({ lessonId });
  const update = trpc.lessons.update.useMutation({ onSuccess: () => { setEditing(false); refresh(); } });
  const revise = trpc.lessons.revise.useMutation({ onSuccess: () => { setInstruction(""); refresh(); } });
  const del = trpc.lessons.delete.useMutation({ onSuccess: () => onBack() });

  useEffect(() => {
    if (!printMode) return;
    const id = setTimeout(() => { window.print(); setPrintMode(null); }, 150);
    return () => clearTimeout(id);
  }, [printMode]);

  if (isLoading) return <p className="text-gray-600">{t("Loading…")}</p>;
  if (error || !data) return <Card><CardContent className="py-6 text-red-600" role="alert">{t(error?.message ?? "Lesson not found")}</CardContent></Card>;
  const lesson = data as Lesson;
  const planned = plannedMinutes(lesson.content);

  const startEdit = () => { setDraft(structuredClone(lesson.content)); setTitle(lesson.title); setEditing(true); };
  let savedQuestions = 0;
  if (editing && draft) { try { savedQuestions = normalizeLesson({ ...draft, steps: draft.steps.length ? draft.steps : [{ title: "x" }] }).quiz.length; } catch { savedQuestions = 0; } }

  if (teaching) {
    return <TeachMode lesson={{ title: lesson.title, subtitle: `${t(SUBJECT_LABEL[lesson.subject as LessonSubject] ?? "Other")} · ${gradeLabel(lesson.grade)}`, language: lesson.language, content: lesson.content }} onExit={() => setTeaching(false)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" size="sm" onClick={onBack}>{t("← All lessons")}</Button>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setTeaching(true)}>▶ {t("Teach this lesson")}</Button>
          <Button size="sm" variant="outline" onClick={() => setPrintMode("plan")}>🖨 {t("Print the plan")}</Button>
          <Button size="sm" variant="outline" disabled={lesson.content.quiz.length === 0} onClick={() => setPrintMode("worksheet")}>🖨 {t("Print the quiz")}</Button>
        </div>
      </div>

      <Card className="no-print">
        <CardHeader>
          <CardTitle><bdi>{lesson.title}</bdi></CardTitle>
          <CardDescription>
            {t(SUBJECT_LABEL[lesson.subject as LessonSubject] ?? "Other")} · {gradeLabel(lesson.grade)} · {lesson.language === "ar" ? "العربية" : "English"} · {t("Planned: {a} of {b} minutes", { a: planned, b: lesson.durationMin })}
          </CardDescription>
          <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
            {lesson.hasSource ? t("Written from the textbook passage you provided. Still read it before teaching: the companion can make mistakes.") : t("This is an AI-written draft from general knowledge. Read and correct it before teaching or sharing it with students: you are responsible for what is taught.")}
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {editing && draft ? (
            <>
              <Field id="ed-title" label={t("Lesson title")}><Input id="ed-title" value={title} maxLength={200} onChange={e => setTitle(e.target.value)} /></Field>
              <Editor draft={draft} set={setDraft} />
              <p className="text-sm text-gray-600">{t("Quiz questions that will be saved: {n}", { n: savedQuestions })}</p>
              <div className="flex gap-2">
                <Button disabled={update.isPending || !title.trim()} onClick={() => update.mutate({ lessonId, title: title.trim(), content: draft })}>{t("Save changes")}</Button>
                <Button variant="ghost" onClick={() => setEditing(false)}>{t("Cancel")}</Button>
              </div>
              {update.error && <p className="text-sm text-red-600" role="alert">{t(update.error.message)}</p>}
            </>
          ) : (
            <>
              <div dir={lesson.language === "ar" ? "rtl" : "ltr"} lang={lesson.language}><Body c={lesson.content} /></div>
              <div className="flex flex-wrap gap-2 border-t pt-4">
                <Button variant="outline" onClick={startEdit}>✏️ {t("Edit")}</Button>
                <Button variant="outline" onClick={() => setConfirmDelete(true)}>{t("Delete")}</Button>
              </div>
            </>
          )}
          {confirmDelete && (
            <div className="space-y-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm" role="alertdialog" aria-label={t("Delete {name}", { name: lesson.title })}>
              <p className="text-red-900">{t("This deletes the lesson, its shares and its students' quiz results. It cannot be undone.")}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="destructive" disabled={del.isPending} onClick={() => del.mutate({ lessonId })}>{t("Delete permanently")}</Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>{t("Keep")}</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {!editing && (
        <Card className="no-print">
          <CardHeader>
            <CardTitle>{t("Improve it with the companion")}</CardTitle>
            <CardDescription>{t("Tell the companion what to change. It rewrites the lesson; your current version is replaced, so edit by hand first if you want to keep something.")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {REVISE_IDEAS.map(r => <button key={r} type="button" className="rounded-full border px-3 py-1 text-sm hover:bg-brand-50" onClick={() => setInstruction(t(r))}>{t(r)}</button>)}
            </div>
            <form className="flex gap-2" onSubmit={e => { e.preventDefault(); revise.mutate({ lessonId, instruction }); }}>
              <Input value={instruction} maxLength={500} aria-label={t("What should change?")} placeholder={t("What should change?")} onChange={e => setInstruction(e.target.value)} />
              <Button type="submit" disabled={revise.isPending || instruction.trim().length < 3}>{revise.isPending ? t("Rewriting…") : t("Rewrite")}</Button>
            </form>
            {revise.error && <p className="text-sm text-red-600" role="alert">{t(revise.error.message)}</p>}
          </CardContent>
        </Card>
      )}

      {!editing && <div className="no-print"><SharePanel lessonId={lessonId} /></div>}
      {printMode && <PrintSheet lesson={lesson} mode={printMode} />}
    </div>
  );
}
