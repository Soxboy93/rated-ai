import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { t, currentLang, fmtDate } from "@/i18n";

export default function ReportsTab() {
  const utils = trpc.useUtils();
  const report = trpc.reports.getLatestReport.useQuery();
  const gen = trpc.reports.generateReport.useMutation({ onSuccess: () => utils.reports.getLatestReport.invalidate() });
  const summary = trpc.summaries.getLatest.useQuery();
  const genSummary = trpc.summaries.generate.useMutation({ onSuccess: () => utils.summaries.getLatest.invalidate() });
  const r = report.data;
  const s = summary.data;

  return (
    <div className="space-y-6">
      <p className="text-sm text-amber-900 rounded-md border border-amber-200 bg-amber-50 p-3">
        {t("These two reports are written by an AI from the topics your children chat about. They are rough estimates to start a conversation, not grades or assessments. For real numbers on practice and accuracy, see the Progress tab.")}
      </p>
      <Card>
        <CardHeader>
          <CardTitle>{t("Weekly summary")}</CardTitle>
          <CardDescription>{t("A short summary of the last 7 days of chats. Email delivery is not available yet.")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={() => genSummary.mutate({ language: currentLang() })} disabled={genSummary.isPending}>{genSummary.isPending ? t("Writing…") : t("Write this week's summary")}</Button>
          {genSummary.error && <p className="text-sm text-red-600" role="alert">{t(genSummary.error.message)}</p>}
          {s && (
            <div className="space-y-2 text-sm">
              <p className="text-gray-500">{fmtDate(s.weekStart)} – {fmtDate(s.weekEnd)} · {t("{n} messages", { n: s.totalMessages })} · {t("{n} chats", { n: s.totalSessions })}</p>
              <p><b>{t("Topics:")}</b> {s.topicsCovered}</p>
              <p><b>{t("Strengths:")}</b> {s.strengths}</p>
              <p><b>{t("To work on:")}</b> {s.areasToImprove}</p>
              <p><b>{t("Next week:")}</b> {s.recommendations}</p>
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("Chat topics report")}</CardTitle>
          <CardDescription>{t("AI-estimated strengths and areas to explore from recent chats.")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={() => gen.mutate({ language: currentLang() })} disabled={gen.isPending}>{gen.isPending ? t("Writing…") : t("Create a new report")}</Button>
          {gen.error && <p className="text-sm text-red-600" role="alert">{t(gen.error.message)}</p>}
          {r && (
            <div className="space-y-2 text-sm">
              <p className="text-gray-500">{t("{name} · {a} messages in {b} chats", { name: r.childName, a: r.totalMessages, b: r.totalSessions })}</p>
              <p><b>{t("Strengths:")}</b> {r.strengths}</p>
              <p><b>{t("To explore:")}</b> {r.weaknesses}</p>
              <p><b>{t("Ideas:")}</b> {r.recommendations}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
