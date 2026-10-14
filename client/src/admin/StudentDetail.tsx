import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtDateTime, t } from "@/i18n";
import { GAME_META } from "@/kid/guides";

/** One student: progress and, behind a deliberate click, their conversations. Both are logged. */
export default function StudentDetail({ profileId, onBack, onOpenAccount }: { profileId: string; onBack: () => void; onOpenAccount: (userId: string) => void }) {
  const { data, isLoading, error } = trpc.admin.student.useQuery({ profileId });
  const [showChats, setShowChats] = useState(false);
  const chats = trpc.admin.studentChats.useQuery({ profileId }, { enabled: showChats });
  if (isLoading) return <p className="text-gray-600">{t("Loading…")}</p>;
  if (error || !data) return <p className="text-red-600" role="alert">{t(error?.message ?? "Child profile not found")}</p>;
  const { profile, owner, progress } = data;
  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={onBack}>← {t("Back")}</Button>
      <Card>
        <CardHeader>
          <CardTitle><bdi>{profile.childName}</bdi></CardTitle>
          <CardDescription>
            {profile.className ? <><bdi>{profile.className}</bdi> · </> : null}
            {t("Account")}: <button className="text-brand-700 underline" onClick={() => onOpenAccount(owner.id)}><bdi>{owner.email}</bdi></button>
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-4">
          {[[t("Level {level}", { level: progress.level }), t(progress.title)], [t("{n} XP", { n: progress.xp }), ""], [t("Day streak"), String(progress.streakDays)], [t("Practice rounds played"), String(progress.totalPlays)]].map(([a, b]) => (
            <div key={a} className="rounded-lg border bg-white p-3"><p className="font-semibold">{a}</p><p className="text-sm text-gray-600">{b}</p></div>
          ))}
        </CardContent>
      </Card>
      {progress.breakdown.length > 0 && (
        <Card>
          <CardHeader><CardTitle>{t("Games")}</CardTitle></CardHeader>
          <CardContent><ul className="grid gap-2 sm:grid-cols-2">{progress.breakdown.map(g => <li key={g.game} className="flex justify-between rounded border px-3 py-1 text-sm"><span>{GAME_META[g.game as keyof typeof GAME_META]?.name ?? g.game}</span><span>{g.plays} · {g.total ? Math.round((g.correct / g.total) * 100) : 0}%</span></li>)}</ul></CardContent>
        </Card>
      )}
      {progress.lessons.length > 0 && (
        <Card>
          <CardHeader><CardTitle>{t("Lessons")}</CardTitle></CardHeader>
          <CardContent><ul className="space-y-1 text-sm">{progress.lessons.map(l => <li key={l.shareId} className="flex justify-between rounded border px-3 py-1"><bdi>{l.title}</bdi><span>{l.result ? `${l.result.correct} / ${l.result.total}` : t("Not done")}</span></li>)}</ul></CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{t("Conversations")}</CardTitle>
          <CardDescription>{t("Reading a child's conversations is recorded in the audit log, and the account owner can see that support read them.")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!showChats ? <Button variant="outline" onClick={() => setShowChats(true)}>{t("Read conversations")}</Button> : chats.isLoading ? <p className="text-gray-600">{t("Loading…")}</p> : !chats.data || chats.data.length === 0 ? <p className="text-gray-600">{t("No chats yet.")}</p> : (
            <div className="max-h-[28rem] space-y-4 overflow-y-auto">
              {chats.data.map(s => (
                <div key={s.id} className="space-y-1 rounded border p-3">
                  <p className="text-xs text-gray-500">{s.createdAt ? fmtDateTime(s.createdAt) : ""}</p>
                  {s.messages.map(m => (
                    <p key={m.id} className={`rounded p-2 text-sm ${m.role === "user" ? "bg-brand-50" : "bg-blue-50"} ${m.flagged && m.flagged !== "safe" ? "ring-1 ring-amber-500" : ""}`} dir="auto">
                      <b>{m.role === "user" ? t("Student") : t("AI")}:</b> <bdi>{m.content}</bdi>{m.flagged && m.flagged !== "safe" ? ` · ${m.flagged}` : ""}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
