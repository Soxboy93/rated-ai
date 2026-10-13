import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, CheckCircle2, ShieldAlert, Info } from "lucide-react";
import type { InboxCategory, Urgency } from "@shared/safetyInbox";
import { fmtDateTime, t, T } from "@/i18n";

const WHY: Record<InboxCategory, string> = {
  self_harm: T("May be about hurting themselves"),
  being_hurt: T("May be telling you someone is hurting them"),
  personal_info: T("Shared contact details"),
  sexual: T("Asked about something unsuitable"),
  violence: T("Asked about violence"),
  dangerous_activity: T("Asked about something dangerous"),
  other: T("Flagged by the safety check"),
};
const WHAT_TO_DO: Record<InboxCategory, string> = {
  self_harm: T("Talk to the student privately today, kindly and without alarm, and follow your school's child-protection procedure."),
  being_hurt: T("Do not promise to keep it secret. Follow your school's child-protection procedure and tell the person responsible for it."),
  personal_info: T("Remind the student not to share names, addresses or phone numbers online."),
  sexual: T("A short, calm conversation about what is suitable to ask. Tell their parents if your school's policy says so."),
  violence: T("A short conversation about what they were curious about, and what is suitable to ask."),
  dangerous_activity: T("A short conversation about safety, and what to ask a grown-up instead."),
  other: T("Read the message and decide whether a conversation is needed."),
};
const BADGE: Record<Urgency, { label: string; cls: string; Icon: typeof AlertTriangle }> = {
  urgent: { label: T("Urgent"), cls: "bg-red-100 text-red-900 border-red-300", Icon: ShieldAlert },
  attention: { label: T("Needs attention"), cls: "bg-amber-100 text-amber-900 border-amber-300", Icon: AlertTriangle },
  info: { label: T("For information"), cls: "bg-slate-100 text-slate-800 border-slate-300", Icon: Info },
};

/** Everything the safety checks caught, ranked, with what to do. Nothing here is a verdict: a teacher decides. */
export default function SafetyTab() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.safety.inbox.useQuery();
  const [showDone, setShowDone] = useState(false);
  const review = trpc.safety.review.useMutation({ onSuccess: () => utils.safety.inbox.invalidate() });
  const items = (data?.items ?? []).filter(i => showDone || !i.reviewedAt);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("Safety inbox")}</CardTitle>
          <CardDescription>{t("Every message or search that matched our safety checks, most urgent first. The assistant did not answer these with AI-generated text. The checks can miss things and can flag harmless words, so they support your own care for students; they do not replace it.")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <p className="text-lg font-semibold" role="status">
            {data ? (data.open === 0 ? `✅ ${t("Nothing waiting for review.")}` : t("{n} to review", { n: data.open })) : ""}
            {data && data.urgentOpen > 0 && <span className="ms-2 rounded-full border border-red-300 bg-red-100 px-2 py-0.5 text-sm text-red-900">{t("{n} urgent", { n: data.urgentOpen })}</span>}
          </p>
          <label className="ms-auto flex items-center gap-2 text-sm"><input type="checkbox" checked={showDone} onChange={e => setShowDone(e.target.checked)} className="h-4 w-4" />{t("Show reviewed")}</label>
        </CardContent>
      </Card>

      {isLoading ? <p className="text-gray-600">{t("Loading…")}</p> : items.length === 0 ? null : (
        <ul className="space-y-3">
          {items.map(i => {
            const b = BADGE[i.urgency];
            return (
              <li key={i.id} className={`rounded-lg border bg-white p-4 shadow-sm ${i.reviewedAt ? "opacity-60" : ""}`}>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium ${b.cls}`}><b.Icon className="h-4 w-4" aria-hidden="true" />{t(b.label)}</span>
                  <b><bdi>{i.studentName || t("Student")}</bdi></b>
                  {i.className && <span className="text-gray-600">· <bdi>{i.className}</bdi></span>}
                  <span className="text-gray-500">· {i.createdAt ? fmtDateTime(i.createdAt) : ""}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-gray-900" dir="auto"><bdi>{i.content}</bdi></p>
                <p className="mt-2 text-sm font-medium">{i.from === "reply" ? t("An AI reply was blocked by our check before the student saw it.") : t(WHY[i.category])}</p>
                {i.from === "child" && <p className="text-sm text-gray-700">{t(WHAT_TO_DO[i.category])}</p>}
                <div className="mt-3 flex items-center gap-3">
                  {i.reviewedAt ? (
                    <>
                      <span className="inline-flex items-center gap-1 text-sm text-green-800"><CheckCircle2 className="h-4 w-4" aria-hidden="true" />{t("Reviewed")}</span>
                      <Button size="sm" variant="ghost" disabled={review.isPending} onClick={() => review.mutate({ messageId: i.id, reviewed: false })}>{t("Reopen")}</Button>
                    </>
                  ) : (
                    <Button size="sm" disabled={review.isPending} onClick={() => review.mutate({ messageId: i.id, reviewed: true })}>{t("Mark as reviewed")}</Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {review.error && <p className="text-sm text-red-600" role="alert">{t(review.error.message)}</p>}
    </div>
  );
}
