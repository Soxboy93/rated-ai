import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AGE_GROUPS, AI_CHARACTERS } from "@shared/characters";
import { t, T, fmtDate, fmtDateTime } from "@/i18n";

type AgeId = "kids" | "tweens" | "teens";
const AGE_IDS = Object.keys(AGE_GROUPS) as AgeId[];

export function downloadJson(filename: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const selectClass = "h-10 rounded-md border border-input bg-background px-3 text-sm";

function AddChildForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [age, setAge] = useState<AgeId>("kids");
  const [character, setCharacter] = useState("");
  const create = trpc.profiles.create.useMutation({ onSuccess: () => { setName(""); onDone(); } });
  return (
    <form
      className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] items-end"
      onSubmit={e => {
        e.preventDefault();
        create.mutate({ childName: name, ageGroup: age, selectedCharacter: (character || undefined) as any });
      }}
    >
      <div className="space-y-1">
        <label htmlFor="child-name" className="text-sm font-medium">{t("First name or nickname")}</label>
        <Input id="child-name" value={name} maxLength={50} required onChange={e => setName(e.target.value)} />
      </div>
      <div className="space-y-1">
        <label htmlFor="child-age" className="text-sm font-medium">{t("Age group")}</label>
        <select id="child-age" className={selectClass} value={age} onChange={e => setAge(e.target.value as AgeId)}>
          {AGE_IDS.map(id => <option key={id} value={id}>{t(AGE_GROUPS[id].name)} ({AGE_GROUPS[id].ageRange})</option>)}
        </select>
      </div>
      <div className="space-y-1">
        <label htmlFor="child-character" className="text-sm font-medium">{t("Favourite guide")}</label>
        <select id="child-character" className={selectClass} value={character} onChange={e => setCharacter(e.target.value)}>
          <option value="">{t("No preference")}</option>
          {AI_CHARACTERS.map(c => <option key={c.id} value={c.id}>{t(c.name)}</option>)}
        </select>
      </div>
      <Button type="submit" disabled={create.isPending || !name.trim()}>{t("Add child")}</Button>
      {create.error && <p className="text-sm text-red-600 sm:col-span-4" role="alert">{t(create.error.message)}</p>}
    </form>
  );
}

function ChildRow({ profile, onChanged }: { profile: { id: string; childName: string; ageGroup: string; selectedCharacter: string | null }; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.childName);
  const [age, setAge] = useState(profile.ageGroup as AgeId);
  const [confirming, setConfirming] = useState(false);
  const update = trpc.profiles.update.useMutation({ onSuccess: () => { setEditing(false); onChanged(); } });
  const del = trpc.profiles.delete.useMutation({ onSuccess: onChanged });
  const [note, setNote] = useState("");
  const exp = trpc.profiles.export.useMutation({
    onSuccess: data => {
      // The embedded preview cannot start downloads; the live app saves a JSON file.
      if (import.meta.env.VITE_DEMO) setNote(t("In the live app this downloads a file with the child's profile, chats, scores and badges."));
      else downloadJson(`rated-ai-${profile.childName.replace(/\W+/g, "-").toLowerCase()}.json`, data);
    },
  });
  const group = AGE_GROUPS[profile.ageGroup as AgeId];

  return (
    <li className="rounded-lg border p-4 space-y-3">
      {editing ? (
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label htmlFor={`name-${profile.id}`} className="text-sm font-medium">{t("Name")}</label>
            <Input id={`name-${profile.id}`} value={name} maxLength={50} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label htmlFor={`age-${profile.id}`} className="text-sm font-medium">{t("Age group")}</label>
            <select id={`age-${profile.id}`} className={selectClass} value={age} onChange={e => setAge(e.target.value as AgeId)}>
              {AGE_IDS.map(id => <option key={id} value={id}>{t(AGE_GROUPS[id].name)}</option>)}
            </select>
          </div>
          <Button disabled={update.isPending || !name.trim()} onClick={() => update.mutate({ profileId: profile.id, childName: name, ageGroup: age })}>{t("Save")}</Button>
          <Button variant="ghost" onClick={() => setEditing(false)}>{t("Cancel")}</Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold">{profile.childName}</p>
            <p className="text-sm text-gray-600">{t(group.name)} · {t("Ages {range}", { range: group.ageRange })}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>{t("Edit")}</Button>
            <Button variant="outline" size="sm" disabled={exp.isPending} onClick={() => exp.mutate({ profileId: profile.id })}>{t("Download data")}</Button>
            <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>{t("Delete")}</Button>
          </div>
        </div>
      )}
      {confirming && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm space-y-2" role="alertdialog" aria-label={t("Delete {name}", { name: profile.childName })}>
          <p className="text-red-900">
            {t("This permanently deletes {name}'s profile and every conversation they had. It cannot be undone. Download their data first if you want a copy.", { name: profile.childName })}
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" disabled={del.isPending} onClick={() => del.mutate({ profileId: profile.id })}>{t("Delete permanently")}</Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>{t("Keep")}</Button>
          </div>
        </div>
      )}
      {note && <p className="text-sm text-gray-600" role="status">{note}</p>}
      {(update.error || del.error || exp.error) && (
        <p className="text-sm text-red-600" role="alert">{t((update.error || del.error || exp.error)!.message)}</p>
      )}
    </li>
  );
}

function DeleteAccount({ school }: { school: boolean }) {
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [typed, setTyped] = useState("");
  const del = trpc.account.delete.useMutation({ onSuccess: () => logout() });
  return (
    <Card className="border-red-200">
      <CardHeader>
        <CardTitle className="text-red-900">{t("Delete account")}</CardTitle>
        <CardDescription>{school ? t("Permanently removes your account, every class and student profile and all conversations, homework and reports.") : t("Permanently removes your account, every child profile and all conversations, homework and reports.")}</CardDescription>
      </CardHeader>
      <CardContent>
        {!open ? (
          <Button variant="outline" onClick={() => setOpen(true)}>{t("Delete my account…")}</Button>
        ) : (
          <form
            className="space-y-3 max-w-sm"
            onSubmit={e => { e.preventDefault(); del.mutate({ password, confirm: "DELETE" }); }}
          >
            <div className="space-y-1">
              <label htmlFor="del-password" className="text-sm font-medium">{t("Your account password")}</label>
              <Input id="del-password" type="password" dir="ltr" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label htmlFor="del-confirm" className="text-sm font-medium">{t("Type DELETE to confirm")}</label>
              <Input id="del-confirm" dir="ltr" value={typed} onChange={e => setTyped(e.target.value)} autoComplete="off" />
            </div>
            {del.error && <p className="text-sm text-red-600" role="alert">{t(del.error.message)}</p>}
            <div className="flex gap-2">
              <Button type="submit" variant="destructive" disabled={!password || typed !== "DELETE" || del.isPending}>{t("Delete everything")}</Button>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{t("Cancel")}</Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

export const AUDIT_LABELS: Record<string, string> = {
  assignment_created: T("Activity assigned"),
  class_created: T("Class created"),
  class_deleted: T("Class deleted"),
  consent_granted: T("Consent given"),
  consent_withdrawn: T("Consent withdrawn"),
  lesson_created: T("Lesson created"),
  lesson_deleted: T("Lesson deleted"),
  lesson_shared: T("Lesson shared with a class"),
  pin_changed: T("PIN changed"),
  profile_created: T("Profile created"),
  profile_deleted: T("Profile deleted"),
  profile_exported: T("Profile data downloaded"),
  profile_updated: T("Profile updated"),
  roster_imported: T("Student list imported"),
  class_controls: T("Class controls changed"),
  safety_reviewed: T("Safety message reviewed"),
  safety_reopened: T("Safety message reopened"),
  support_viewed_account: T("Support staff viewed this account"),
  support_viewed_student: T("Support staff viewed a student's progress"),
  support_read_chats: T("Support staff read a student's conversations"),
  support_suspended: T("Account suspended by support"),
  support_unsuspended: T("Account reactivated by support"),
  support_set_password: T("Support set a temporary password"),
  support_reset_pin: T("Support cleared the PIN"),
};

/** Consent, privacy activity and account deletion. Shared by family and school accounts. */
export function PrivacyPanel({ school = false }: { school?: boolean }) {
  const utils = trpc.useUtils();
  const { data: consent } = trpc.consent.status.useQuery();
  const { data: audit } = trpc.account.auditLog.useQuery();
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const withdraw = trpc.consent.withdraw.useMutation({
    onSuccess: () => { setConfirmWithdraw(false); utils.consent.status.invalidate(); utils.profiles.invalidate(); utils.account.auditLog.invalidate(); utils.parent.invalidate(); },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("Privacy and consent")}</CardTitle>
          <CardDescription>
            {consent?.granted
              ? t("You agreed on {date} (wording {version}).", { date: consent.grantedAt ? fmtDate(consent.grantedAt) : t("an earlier date"), version: consent.grantedVersion })
              : t("Consent is withdrawn. Chat and the AI tools are switched off.")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {consent?.granted && !confirmWithdraw && (
            <Button variant="outline" onClick={() => setConfirmWithdraw(true)}>{t("Withdraw consent…")}</Button>
          )}
          {confirmWithdraw && (
            <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm space-y-2" role="alertdialog" aria-label={t("Withdraw consent")}>
              <p className="text-amber-900">{t("Chat and all AI tools stop immediately. Your data stays until you delete it below.")}</p>
              <div className="flex gap-2">
                <Button size="sm" disabled={withdraw.isPending} onClick={() => withdraw.mutate()}>{t("Withdraw consent")}</Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmWithdraw(false)}>{t("Keep consent")}</Button>
              </div>
            </div>
          )}
          {withdraw.error && <p className="text-sm text-red-600" role="alert">{t(withdraw.error.message)}</p>}
          {consent?.contactEmail && <p className="text-sm text-gray-600">{t("Privacy contact:")} <span dir="ltr">{consent.contactEmail}</span></p>}
          <div>
            <h3 className="font-semibold mb-2">{t("Recent privacy activity")}</h3>
            {!audit || audit.length === 0 ? (
              <p className="text-sm text-gray-600">{t("Nothing yet.")}</p>
            ) : (
              <ul className="text-sm divide-y max-h-56 overflow-y-auto">
                {audit.map(ev => (
                  <li key={ev.id} className="py-1.5 flex justify-between gap-3">
                    <span>{AUDIT_LABELS[ev.action] ? t(AUDIT_LABELS[ev.action]) : ev.action.replace(/_/g, " ")}{ev.detail ? ` · ${ev.detail}` : ""}</span>
                    <time className="text-gray-500 shrink-0">{ev.createdAt ? fmtDateTime(ev.createdAt) : ""}</time>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      <DeleteAccount school={school} />
    </div>
  );
}

export default function FamilyPanel() {
  const utils = trpc.useUtils();
  const { data: profiles } = trpc.profiles.list.useQuery();
  const { data: consent } = trpc.consent.status.useQuery();
  const refresh = () => { utils.profiles.invalidate(); utils.account.auditLog.invalidate(); utils.parent.invalidate(); };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("Children")}</CardTitle>
          <CardDescription>{t("Each child has their own profile. Use a first name or nickname, never contact details.")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!profiles || profiles.length === 0 ? (
            <p className="text-gray-600">{t("No children yet. Add your first child to start the chat.")}</p>
          ) : (
            <ul className="space-y-3">
              {profiles.map(p => <ChildRow key={p.id} profile={p} onChanged={refresh} />)}
            </ul>
          )}
          {consent?.granted ? (
            <AddChildForm onDone={refresh} />
          ) : (
            <p className="text-sm text-amber-800">{t("Consent is withdrawn. Agree again from the start screen to add children or chat.")}</p>
          )}
        </CardContent>
      </Card>

      <PrivacyPanel />
    </div>
  );
}
