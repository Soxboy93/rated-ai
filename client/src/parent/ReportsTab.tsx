import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
        These two reports are written by an AI from the topics your children chat about. They are rough estimates to start a conversation, not grades or assessments. For real numbers on practice and accuracy, see the Progress tab.
      </p>
      <Card>
        <CardHeader>
          <CardTitle>Weekly summary</CardTitle>
          <CardDescription>A short summary of the last 7 days of chats. Email delivery is not available yet.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={() => genSummary.mutate()} disabled={genSummary.isPending}>{genSummary.isPending ? "Writing…" : "Write this week's summary"}</Button>
          {genSummary.error && <p className="text-sm text-red-600" role="alert">{genSummary.error.message}</p>}
          {s && (
            <div className="space-y-2 text-sm">
              <p className="text-gray-500">{new Date(s.weekStart).toLocaleDateString()} – {new Date(s.weekEnd).toLocaleDateString()} · {s.totalMessages} messages · {s.totalSessions} chats</p>
              <p><b>Topics:</b> {s.topicsCovered}</p>
              <p><b>Strengths:</b> {s.strengths}</p>
              <p><b>To work on:</b> {s.areasToImprove}</p>
              <p><b>Next week:</b> {s.recommendations}</p>
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Chat topics report</CardTitle>
          <CardDescription>AI-estimated strengths and areas to explore from recent chats.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={() => gen.mutate()} disabled={gen.isPending}>{gen.isPending ? "Writing…" : "Create a new report"}</Button>
          {gen.error && <p className="text-sm text-red-600" role="alert">{gen.error.message}</p>}
          {r && (
            <div className="space-y-2 text-sm">
              <p className="text-gray-500">{r.childName} · {r.totalMessages} messages in {r.totalSessions} chats</p>
              <p><b>Strengths:</b> {r.strengths}</p>
              <p><b>To explore:</b> {r.weaknesses}</p>
              <p><b>Ideas:</b> {r.recommendations}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
