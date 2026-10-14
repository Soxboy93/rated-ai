import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { fmtDateTime, fmtTime, t } from "@/i18n";

export default function ConversationsTab({ school }: { school: boolean }) {
  const { data: report } = trpc.parent.getActivityReport.useQuery();
  const sessions = report?.sessions ?? [];
  const messages = report?.messages ?? [];
  const flagged = report?.flaggedMessages ?? [];
  const who = school ? t("Student") : t("Child");
  return (
    <div className="space-y-6">
      {flagged.length > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900"><AlertTriangle className="w-5 h-5" />{t("Messages worth a conversation")}</CardTitle>
            <CardDescription>{t("These matched our safety checks. The assistant did not answer them with AI-generated text.")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {flagged.map(m => (
              <div key={m.id} className="rounded border border-amber-200 bg-white p-3">
                <p className="mb-1 text-xs text-gray-500">{m.createdAt ? fmtDateTime(m.createdAt) : ""} · {m.role === "user" ? who : t("AI reply (blocked)")} · {m.flagged}</p>
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader><CardTitle>{t("Chats")}</CardTitle><CardDescription>{t("{a} chats · {b} messages", { a: sessions.length, b: messages.length })}</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          {sessions.length === 0 ? <p className="text-gray-600">{t("No chats yet.")}</p> : sessions.slice(0, 20).map(s => {
            const ms = messages.filter(m => m.sessionId === s.id);
            return (
              <details key={s.id} className="rounded-lg border p-3">
                <summary className="cursor-pointer font-medium">{s.childName || who} · {s.characterId ? t(s.characterId.charAt(0).toUpperCase() + s.characterId.slice(1)) : t("guide")} · {s.createdAt ? fmtDateTime(s.createdAt) : ""} <span className="text-gray-500 font-normal">({t("{n} messages", { n: ms.length })})</span></summary>
                <div className="mt-3 space-y-2 max-h-96 overflow-y-auto">
                  {ms.map(m => (
                    <div key={m.id} className={`rounded p-2 border-s-4 ${m.role === "user" ? "border-brand-500 bg-brand-50" : "border-blue-500 bg-blue-50"}`}>
                      <p className="text-xs text-gray-500">{m.role === "user" ? who : t("AI")} · {m.createdAt ? fmtTime(m.createdAt) : ""}{m.flagged && m.flagged !== "safe" ? ` · ${m.flagged}` : ""}</p>
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    </div>
                  ))}
                </div>
              </details>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
