import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtDate, fmtDateTime, t } from "@/i18n";
import { StatusBadge } from "./AccountList";
import { AUDIT_LABELS } from "@/parent/FamilyPanel";
import { SUBJECT_LABEL } from "@/parent/LessonsTab";
import type { LessonSubject } from "@shared/lesson";
import { gradeLabel } from "@/parent/grades";

function Actions({ userId, email, suspended, onDeleted }: { userId: string; email: string; suspended: boolean; onDeleted: () => void }) {
  const utils = trpc.useUtils();
  const refresh = () => { utils.admin.account.invalidate(); utils.admin.accounts.invalidate(); utils.admin.overview.invalidate(); utils.admin.actions.invalidate(); };
  const [reason, setReason] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState("");
  const suspend = trpc.admin.suspend.useMutation({ onSuccess: () => { setReason(""); refresh(); } });
  const setPw = trpc.admin.setPassword.useMutation({ onSuccess: () => { setPassword(""); setDone(t("Temporary password set. Tell the owner securely; they should change it.")); } });
  const resetPin = trpc.admin.resetPin.useMutation({ onSuccess: () => setDone(t("PIN cleared. The owner can choose a new one next time they open the parent or teacher area.")) });
  const del = trpc.admin.deleteAccount.useMutation({ onSuccess: () => { refresh(); onDeleted(); } });
  const err = suspend.error ?? setPw.error ?? resetPin.error ?? del.error;

  return (
    <Card>
      <CardHeader><CardTitle>{t("Actions")}</CardTitle><CardDescription>{t("Each action is recorded in the audit log, and the account owner can see support acted.")}</CardDescription></CardHeader>
      <CardContent className="space-y-6">
        <section className="space-y-2">
          <h3 className="font-medium">{suspended ? t("Reactivate this account") : t("Suspend this account")}</h3>
          <p className="text-sm text-gray-600">{suspended ? t("The owner will be able to sign in again.") : t("The owner is signed out at once and cannot sign in. Nothing is deleted.")}</p>
          <div className="flex flex-wrap gap-2">
            {!suspended && <Input className="max-w-xs" value={reason} maxLength={200} onChange={e => setReason(e.target.value)} placeholder={t("Reason (optional)")} aria-label={t("Reason (optional)")} />}
            <Button variant={suspended ? "default" : "outline"} disabled={suspend.isPending} onClick={() => suspend.mutate({ userId, suspended: !suspended, reason: reason || undefined })}>{suspended ? t("Reactivate") : t("Suspend")}</Button>
          </div>
        </section>
        <section className="space-y-2">
          <h3 className="font-medium">{t("Set a temporary password")}</h3>
          <p className="text-sm text-gray-600">{t("For an owner who is locked out. Passwords can never be read, only replaced.")}</p>
          <div className="flex flex-wrap gap-2">
            <Input className="max-w-xs" type="password" dir="ltr" autoComplete="new-password" value={password} maxLength={128} onChange={e => setPassword(e.target.value)} placeholder={t("New password (8+ characters)")} aria-label={t("New password (8+ characters)")} />
            <Button variant="outline" disabled={password.length < 8 || setPw.isPending} onClick={() => setPw.mutate({ userId, password })}>{t("Set password")}</Button>
          </div>
        </section>
        <section className="space-y-2">
          <h3 className="font-medium">{t("Clear the PIN")}</h3>
          <p className="text-sm text-gray-600">{t("For an owner who forgot their parent or teacher PIN. They choose a new one next time.")}</p>
          <Button variant="outline" disabled={resetPin.isPending} onClick={() => resetPin.mutate({ userId })}>{t("Clear PIN")}</Button>
        </section>
        <section className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
          <h3 className="font-medium text-red-900">{t("Delete this account")}</h3>
          <p className="text-sm text-red-900">{t("Permanently deletes the account and every child, class, lesson, chat and score in it. This cannot be undone. Type the account's email to confirm.")}</p>
          <div className="flex flex-wrap gap-2">
            <Input className="max-w-xs bg-white" dir="ltr" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder={email} aria-label={t("Type the email to confirm")} />
            <Button variant="destructive" disabled={confirm.trim().toLowerCase() !== email.toLowerCase() || del.isPending} onClick={() => del.mutate({ userId, confirmEmail: confirm })}>{t("Delete account")}</Button>
          </div>
        </section>
        {done && <p className="text-sm text-green-800" role="status">{done}</p>}
        {err && <p className="text-sm text-red-600" role="alert">{t(err.message)}</p>}
      </CardContent>
    </Card>
  );
}

export default function AccountDetail({ userId, onBack, onOpenStudent }: { userId: string; onBack: () => void; onOpenStudent: (profileId: string) => void }) {
  const { data, isLoading, error } = trpc.admin.account.useQuery({ userId });
  if (isLoading) return <p className="text-gray-600">{t("Loading…")}</p>;
  if (error || !data) return <p className="text-red-600" role="alert">{t(error?.message ?? "Account not found")}</p>;
  const u = data.user;
  const isAdmin = u.role === "admin";
  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={onBack}>← {t("Back")}</Button>
      <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{t("Looking at this account is recorded, and its owner can see that support looked. Only open what you need for support.")}</div>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3"><CardTitle><bdi>{u.email}</bdi></CardTitle><StatusBadge suspended={!!u.suspendedAt} admin={isAdmin} /></div>
          <CardDescription>
            {u.accountType === "school" ? t("School account") : t("Family account")}{u.name ? <> · <bdi>{u.name}</bdi></> : null} · {t("Joined")} {u.createdAt ? fmtDate(u.createdAt) : "–"} · {t("Last sign-in")} {u.lastSignedIn ? fmtDate(u.lastSignedIn) : "–"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {u.suspendedAt && <p className="text-red-800">{t("Suspended")}: {u.suspendedReason}</p>}
          <p>{data.consent ? t("Parental consent given on {date}", { date: data.consent.grantedAt ? fmtDate(data.consent.grantedAt) : "–" }) : t("No active consent yet")}</p>
        </CardContent>
      </Card>

      {data.classes.length > 0 && (
        <Card>
          <CardHeader><CardTitle>{t("Classes")}</CardTitle></CardHeader>
          <CardContent><ul className="grid gap-2 sm:grid-cols-2">{data.classes.map(c => (
            <li key={c.id} className="rounded border p-3 text-sm"><b><bdi>{c.name}</bdi></b> · {gradeLabel(c.grade)}<span className="block text-xs text-gray-600">{t("Chat")}: {c.chat ? t("On") : t("Off")} · {t("Safe Search")}: {c.search ? t("On") : t("Off")} · {t("Focus mode")}: {c.focus ? t("On") : t("Off")}</span></li>
          ))}</ul></CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>{t("Students")} · {data.students.length}</CardTitle></CardHeader>
        <CardContent>
          {data.students.length === 0 ? <p className="text-gray-600">{t("No students yet.")}</p> : (
            <ul className="grid gap-2 sm:grid-cols-2">{data.students.map(s => {
              const cls = data.classes.find(c => c.id === s.classId);
              return (
                <li key={s.id}><button className="flex w-full items-center justify-between rounded border bg-white p-3 text-start text-sm hover:border-brand-400" onClick={() => onOpenStudent(s.id)}>
                  <span><b><bdi>{s.childName}</bdi></b>{cls && <span className="text-gray-600"> · <bdi>{cls.name}</bdi></span>}<span className="block text-xs text-gray-500">{t("{n} XP", { n: s.xp })}{s.lastPlayedAt ? ` · ${t("Last played")} ${fmtDate(s.lastPlayedAt)}` : ""}</span></span>
                  {s.flaggedMessages > 0 && <span className="rounded-full bg-amber-100 px-2 text-xs text-amber-900">{t("Flags: {n}", { n: s.flaggedMessages })}</span>}
                </button></li>
              );
            })}</ul>
          )}
        </CardContent>
      </Card>

      {data.lessons.length > 0 && (
        <Card>
          <CardHeader><CardTitle>{t("Lessons")} · {data.lessons.length}</CardTitle></CardHeader>
          <CardContent><ul className="space-y-1 text-sm">{data.lessons.slice(0, 30).map(l => <li key={l.id} className="flex justify-between rounded border px-3 py-1"><span><bdi>{l.title}</bdi></span><span className="text-gray-600">{t(SUBJECT_LABEL[l.subject as LessonSubject] ?? "Other")} · {gradeLabel(l.grade)}</span></li>)}</ul></CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>{t("Account activity")}</CardTitle><CardDescription>{t("What the owner sees in their own audit log, including support access.")}</CardDescription></CardHeader>
        <CardContent>{data.audit.length === 0 ? <p className="text-gray-600">{t("Nothing recorded yet.")}</p> : (
          <ul className="space-y-1 text-sm">{data.audit.map(ev => <li key={ev.id} className="flex justify-between gap-3 rounded border px-3 py-1"><span>{AUDIT_LABELS[ev.action] ? t(AUDIT_LABELS[ev.action]) : ev.action.replace(/_/g, " ")}{ev.detail ? ` · ${ev.detail}` : ""}</span><span className="whitespace-nowrap text-gray-500">{ev.createdAt ? fmtDateTime(ev.createdAt) : ""}</span></li>)}</ul>
        )}</CardContent>
      </Card>

      {isAdmin ? <p className="text-sm text-gray-600">{t("Administrator accounts cannot be changed from the console.")}</p> : <Actions userId={u.id} email={u.email ?? ""} suspended={!!u.suspendedAt} onDeleted={onBack} />}
    </div>
  );
}
