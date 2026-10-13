import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GAME_IDS } from "@shared/gamification";
import { GAME_META } from "@/kid/guides";
import { t, T, fmtDate } from "@/i18n";
import { gradeLabel } from "./grades";
import { selectClass } from "./FamilyPanel";

const LEVELS = [T("Level 1 (easy)"), T("Level 2"), T("Level 3 (tricky)")];

export default function AssignmentsTab() {
  const utils = trpc.useUtils();
  const { data: classes } = trpc.classes.list.useQuery();
  const [classId, setClassId] = useState("");
  useEffect(() => {
    if (classes?.length && !classes.some(c => c.id === classId)) setClassId(classes[0].id);
  }, [classes, classId]);
  const list = trpc.assignments.list.useQuery({ classId }, { enabled: !!classId });
  const [game, setGame] = useState<(typeof GAME_IDS)[number]>("math");
  const [level, setLevel] = useState(1);
  const [note, setNote] = useState("");
  const [due, setDue] = useState("");
  const refresh = () => { utils.assignments.invalidate(); utils.classes.invalidate(); utils.parent.invalidate(); };
  const create = trpc.assignments.create.useMutation({ onSuccess: () => { setNote(""); setDue(""); refresh(); } });
  const archive = trpc.assignments.archive.useMutation({ onSuccess: refresh });

  if (!classes || classes.length === 0) {
    return <Card><CardContent className="py-8 text-center text-gray-600">{t('Create a class in the "Classes and students" tab first.')}</CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <label htmlFor="assign-class" className="text-sm font-medium">{t("Class")}</label>
        <select id="assign-class" className={selectClass} value={classId} onChange={e => setClassId(e.target.value)}>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name} · {gradeLabel(c.grade)}</option>)}
        </select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("Set an activity")}</CardTitle>
          <CardDescription>{t("Students see it on their home screen. It counts as done when a student finishes that game at that level or higher.")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); create.mutate({ classId, game, level, note: note.trim() || undefined, dueDate: due || undefined }); }}>
            <div className="space-y-1">
              <label htmlFor="assign-game" className="text-sm font-medium">{t("Game")}</label>
              <select id="assign-game" className={selectClass + " w-full"} value={game} onChange={e => setGame(e.target.value as typeof game)}>
                {GAME_IDS.map(id => <option key={id} value={id}>{GAME_META[id].icon} {GAME_META[id].name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="assign-level" className="text-sm font-medium">{t("Level")}</label>
              <select id="assign-level" className={selectClass + " w-full"} value={level} onChange={e => setLevel(Number(e.target.value))}>
                {LEVELS.map((l, i) => <option key={i} value={i + 1}>{t(l)}</option>)}
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label htmlFor="assign-note" className="text-sm font-medium">{t("Note for students (optional)")}</label>
              <Input id="assign-note" value={note} maxLength={200} onChange={e => setNote(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label htmlFor="assign-due" className="text-sm font-medium">{t("Due date (optional)")}</label>
              <Input id="assign-due" type="date" dir="ltr" value={due} onChange={e => setDue(e.target.value)} />
            </div>
            <div className="flex items-end"><Button type="submit" disabled={create.isPending}>{t("Set activity")}</Button></div>
            {create.error && <p className="text-sm text-red-600 sm:col-span-2" role="alert">{t(create.error.message)}</p>}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("Open activities")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {(list.data ?? []).length === 0 && <p className="text-gray-600">{t("No open activities.")}</p>}
          {(list.data ?? []).map(a => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
              <div>
                <p className="font-semibold">{GAME_META[a.game as keyof typeof GAME_META]?.icon} {GAME_META[a.game as keyof typeof GAME_META]?.name ?? a.game} · {t(LEVELS[a.level - 1] ?? "Level 1 (easy)")}</p>
                <p className="text-sm text-gray-600">
                  {t("{a} of {b} students done", { a: a.doneCount, b: a.studentCount })}
                  {a.dueDate ? ` · ${t("due {date}", { date: fmtDate(a.dueDate + "T00:00:00") })}` : ""}
                </p>
                {a.note && <p className="text-sm"><bdi>{a.note}</bdi></p>}
              </div>
              <Button variant="outline" size="sm" disabled={archive.isPending} onClick={() => archive.mutate({ assignmentId: a.id })}>{t("Archive")}</Button>
            </div>
          ))}
          {archive.error && <p className="text-sm text-red-600" role="alert">{t(archive.error.message)}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
