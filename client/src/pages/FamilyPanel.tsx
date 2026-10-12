import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AGE_GROUPS, AI_CHARACTERS } from "@shared/characters";

type AgeId = "kids" | "tweens" | "teens";
const AGE_IDS = Object.keys(AGE_GROUPS) as AgeId[];

function downloadJson(filename: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const selectClass = "h-10 rounded-md border border-input bg-background px-3 text-sm";

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
        <label htmlFor="child-name" className="text-sm font-medium">First name or nickname</label>
        <Input id="child-name" value={name} maxLength={50} required onChange={e => setName(e.target.value)} />
      </div>
      <div className="space-y-1">
        <label htmlFor="child-age" className="text-sm font-medium">Age group</label>
        <select id="child-age" className={selectClass} value={age} onChange={e => setAge(e.target.value as AgeId)}>
          {AGE_IDS.map(id => <option key={id} value={id}>{AGE_GROUPS[id].name} ({AGE_GROUPS[id].ageRange})</option>)}
        </select>
      </div>
      <div className="space-y-1">
        <label htmlFor="child-character" className="text-sm font-medium">Favourite guide</label>
        <select id="child-character" className={selectClass} value={character} onChange={e => setCharacter(e.target.value)}>
          <option value="">No preference</option>
          {AI_CHARACTERS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <Button type="submit" disabled={create.isPending || !name.trim()}>Add child</Button>
      {create.error && <p className="text-sm text-red-600 sm:col-span-4" role="alert">{create.error.message}</p>}
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
  const exp = trpc.profiles.export.useMutation({
    onSuccess: data => downloadJson(`rated-ai-${profile.childName.replace(/\W+/g, "-").toLowerCase()}.json`, data),
  });
  const group = AGE_GROUPS[profile.ageGroup as AgeId];

  return (
    <li className="rounded-lg border p-4 space-y-3">
      {editing ? (
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label htmlFor={`name-${profile.id}`} className="text-sm font-medium">Name</label>
            <Input id={`name-${profile.id}`} value={name} maxLength={50} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label htmlFor={`age-${profile.id}`} className="text-sm font-medium">Age group</label>
            <select id={`age-${profile.id}`} className={selectClass} value={age} onChange={e => setAge(e.target.value as AgeId)}>
              {AGE_IDS.map(id => <option key={id} value={id}>{AGE_GROUPS[id].name}</option>)}
            </select>
          </div>
          <Button disabled={update.isPending || !name.trim()} onClick={() => update.mutate({ profileId: profile.id, childName: name, ageGroup: age })}>Save</Button>
          <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold">{profile.childName}</p>
            <p className="text-sm text-gray-600">{group.name} · Ages {group.ageRange}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Edit</Button>
            <Button variant="outline" size="sm" disabled={exp.isPending} onClick={() => exp.mutate({ profileId: profile.id })}>Download data</Button>
            <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>Delete</Button>
          </div>
        </div>
      )}
      {confirming && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm space-y-2" role="alertdialog" aria-label={`Delete ${profile.childName}`}>
          <p className="text-red-900">
            This permanently deletes {profile.childName}'s profile and every conversation they had. It cannot be undone. Download their data first if you want a copy.
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" disabled={del.isPending} onClick={() => del.mutate({ profileId: profile.id })}>Delete permanently</Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>Keep</Button>
          </div>
        </div>
      )}
      {(update.error || del.error || exp.error) && (
        <p className="text-sm text-red-600" role="alert">{(update.error || del.error || exp.error)!.message}</p>
      )}
    </li>
  );
}

function DeleteAccount() {
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [typed, setTyped] = useState("");
  const del = trpc.account.delete.useMutation({ onSuccess: () => logout() });
  return (
    <Card className="border-red-200">
      <CardHeader>
        <CardTitle className="text-red-900">Delete account</CardTitle>
        <CardDescription>Permanently removes your account, every child profile and all conversations, homework and reports.</CardDescription>
      </CardHeader>
      <CardContent>
        {!open ? (
          <Button variant="outline" onClick={() => setOpen(true)}>Delete my account…</Button>
        ) : (
          <form
            className="space-y-3 max-w-sm"
            onSubmit={e => { e.preventDefault(); del.mutate({ password, confirm: "DELETE" }); }}
          >
            <div className="space-y-1">
              <label htmlFor="del-password" className="text-sm font-medium">Your account password</label>
              <Input id="del-password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label htmlFor="del-confirm" className="text-sm font-medium">Type DELETE to confirm</label>
              <Input id="del-confirm" value={typed} onChange={e => setTyped(e.target.value)} autoComplete="off" />
            </div>
            {del.error && <p className="text-sm text-red-600" role="alert">{del.error.message}</p>}
            <div className="flex gap-2">
              <Button type="submit" variant="destructive" disabled={!password || typed !== "DELETE" || del.isPending}>Delete everything</Button>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

export default function FamilyPanel() {
  const utils = trpc.useUtils();
  const { data: profiles } = trpc.profiles.list.useQuery();
  const { data: consent } = trpc.consent.status.useQuery();
  const { data: audit } = trpc.account.auditLog.useQuery();
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const refresh = () => { utils.profiles.invalidate(); utils.account.auditLog.invalidate(); utils.parent.invalidate(); };
  const withdraw = trpc.consent.withdraw.useMutation({
    onSuccess: () => { setConfirmWithdraw(false); utils.consent.status.invalidate(); refresh(); },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Children</CardTitle>
          <CardDescription>Each child has their own profile. Use a first name or nickname, never contact details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!profiles || profiles.length === 0 ? (
            <p className="text-gray-600">No children yet. Add your first child to start the chat.</p>
          ) : (
            <ul className="space-y-3">
              {profiles.map(p => <ChildRow key={p.id} profile={p} onChanged={refresh} />)}
            </ul>
          )}
          {consent?.granted ? (
            <AddChildForm onDone={refresh} />
          ) : (
            <p className="text-sm text-amber-800">Consent is withdrawn. Agree again from the start screen to add children or chat.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Privacy and consent</CardTitle>
          <CardDescription>
            {consent?.granted
              ? `You agreed on ${consent.grantedAt ? new Date(consent.grantedAt).toLocaleDateString() : "an earlier date"} (wording ${consent.grantedVersion}).`
              : "Consent is withdrawn. Chat and the AI tools are switched off."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {consent?.granted && !confirmWithdraw && (
            <Button variant="outline" onClick={() => setConfirmWithdraw(true)}>Withdraw consent…</Button>
          )}
          {confirmWithdraw && (
            <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm space-y-2" role="alertdialog" aria-label="Withdraw consent">
              <p className="text-amber-900">Chat and all AI tools stop immediately. Your data stays until you delete it below.</p>
              <div className="flex gap-2">
                <Button size="sm" disabled={withdraw.isPending} onClick={() => withdraw.mutate()}>Withdraw consent</Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmWithdraw(false)}>Keep consent</Button>
              </div>
            </div>
          )}
          {withdraw.error && <p className="text-sm text-red-600" role="alert">{withdraw.error.message}</p>}
          {consent?.contactEmail && <p className="text-sm text-gray-600">Privacy contact: {consent.contactEmail}</p>}
          <div>
            <h3 className="font-semibold mb-2">Recent privacy activity</h3>
            {!audit || audit.length === 0 ? (
              <p className="text-sm text-gray-600">Nothing yet.</p>
            ) : (
              <ul className="text-sm divide-y max-h-56 overflow-y-auto">
                {audit.map(ev => (
                  <li key={ev.id} className="py-1.5 flex justify-between gap-3">
                    <span>{ev.action.replace(/_/g, " ")}{ev.detail ? ` · ${ev.detail}` : ""}</span>
                    <time className="text-gray-500 shrink-0">{ev.createdAt ? new Date(ev.createdAt).toLocaleString() : ""}</time>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      <DeleteAccount />
    </div>
  );
}
