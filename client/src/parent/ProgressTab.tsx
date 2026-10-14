import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AGE_GROUPS } from "@shared/characters";
import { BADGES, GAME_IDS, badgeById } from "@shared/gamification";
import { GAME_META, MOOD_META } from "@/kid/guides";
import { t, fmtDate, fmtDateTime } from "@/i18n";

export default function ProgressTab() {
  const { data, isLoading } = trpc.progress.overview.useQuery();
  if (isLoading) return <p className="text-gray-600">{t("Loading…")}</p>;
  if (!data || data.length === 0) {
    return <Card><CardContent className="py-8 text-center text-gray-600">{t('Add a child in the "Children and privacy" tab to see their progress here.')}</CardContent></Card>;
  }
  return (
    <div className="space-y-6">
      {data.map(({ profile, progress, moods }) => {
        const flaggedMoods = moods.filter(m => m.flagged && m.flagged !== "safe");
        return (
          <Card key={profile.id}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-3">
                {profile.childName}
                <span className="text-sm font-normal text-gray-600">{t(AGE_GROUPS[profile.ageGroup as keyof typeof AGE_GROUPS].name)}</span>
              </CardTitle>
              <CardDescription>
                {t("Level {level}", { level: progress.level })} ({t(progress.title)}) · {t("{n} XP", { n: progress.xp })} · {t("{n}-day streak", { n: progress.streakDays })} · {t("{n} games played", { n: progress.totalPlays })} · {t("{a} of {b} badges", { a: progress.badges.length, b: BADGES.length })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <h3 className="font-semibold mb-2">{t("Games")}</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {GAME_IDS.map(id => {
                    const g = progress.breakdown.find(b => b.game === id);
                    const pct = g && g.total ? Math.round((g.correct / g.total) * 100) : 0;
                    return (
                      <div key={id} className="rounded-lg border p-3">
                        <div className="flex justify-between text-sm"><span>{GAME_META[id].icon} {GAME_META[id].name}</span><span className="text-gray-600">{g ? t("{a} played · {b}% right", { a: g.plays, b: pct }) : t("Not played yet")}</span></div>
                        <div className="mt-2 h-2 rounded bg-gray-100" role="progressbar" aria-label={t("{name} accuracy", { name: GAME_META[id].name })} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className="h-2 rounded bg-brand-500" style={{ width: `${pct}%` }} /></div>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-gray-500">{t("Scores are counted by the app when a round ends. They show practice and accuracy in these games, not a school grade.")}</p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">{t("How they've been feeling")}</h3>
                {moods.length === 0 ? <p className="text-sm text-gray-600">{t("No mood check-ins yet.")}</p> : (
                  <ul className="flex flex-wrap gap-2">
                    {moods.map((m, i) => (
                      <li key={i} className={`rounded-full border px-3 py-1 text-sm ${m.flagged && m.flagged !== "safe" ? "border-amber-400 bg-amber-50" : ""}`} title={m.note ?? undefined}>
                        {MOOD_META[m.mood]?.emoji} {MOOD_META[m.mood]?.label ?? m.mood}
                        <span className="ms-2 text-xs text-gray-500">{m.createdAt ? fmtDate(m.createdAt) : ""}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {flaggedMoods.length > 0 && (
                  <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm space-y-1">
                    <p className="font-semibold text-amber-900">{t("A note worth a conversation")}</p>
                    {flaggedMoods.map((m, i) => <p key={i} className="text-amber-900">“{m.note}” <span className="text-amber-700">({m.createdAt ? fmtDateTime(m.createdAt) : ""})</span></p>)}
                  </div>
                )}
              </div>

              {progress.badges.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">{t("Badges earned")}</h3>
                  <div className="flex flex-wrap gap-2">
                    {progress.badges.map(b => <span key={b.badgeId} className="rounded-full border px-3 py-1 text-sm" title={t(badgeById(b.badgeId)?.description ?? "")}>{badgeById(b.badgeId)?.icon} {t(badgeById(b.badgeId)?.name ?? "")}</span>)}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
