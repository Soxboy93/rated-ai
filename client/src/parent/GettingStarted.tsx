import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";
import { t } from "@/i18n";

type Go = (tab: "roster" | "lessons") => void;

/** The first five minutes for a new teacher, ticked off from what they have actually done. Disappears when finished. */
export default function GettingStarted({ go }: { go: Go }) {
  const { data: classes } = trpc.classes.list.useQuery();
  const { data: lessons } = trpc.lessons.list.useQuery();
  const { data: shares } = trpc.lessons.shares.useQuery({});
  if (!classes || !lessons || !shares) return null;
  const students = classes.reduce((n, c) => n + c.studentCount, 0);
  const steps: Array<{ done: boolean; label: string; hint: string; tab: "roster" | "lessons"; cta: string }> = [
    { done: classes.length > 0, label: t("Create a class"), hint: t("For example 4A. Students never get passwords or emails."), tab: "roster", cta: t("Add a class") },
    { done: students > 0, label: t("Add your students"), hint: t("Paste or upload a list of first names."), tab: "roster", cta: t("Add students") },
    { done: lessons.length > 0, label: t("Make your first lesson"), hint: t("Type a topic, or upload a photo of the textbook page. The companion drafts it; you check it."), tab: "lessons", cta: t("New lesson") },
    { done: shares.length > 0, label: t("Share it with your class"), hint: t("Students then learn it on their tablets, as cards, a game and a quiz."), tab: "lessons", cta: t("Open lessons") },
  ];
  const finished = steps.filter(s => s.done).length;
  if (finished === steps.length) return null;
  const next = steps.find(s => !s.done)!;
  return (
    <Card className="border-brand-300 bg-brand-50">
      <CardHeader>
        <CardTitle>{t("Get started")} · {finished} / {steps.length}</CardTitle>
        <CardDescription>{t("Four small steps and your class is learning.")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ol className="space-y-2">
          {steps.map(s => (
            <li key={s.label} className="flex items-start gap-3">
              <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs ${s.done ? "border-brand-600 bg-brand-600 text-white" : "border-gray-400 bg-white"}`} aria-hidden="true">{s.done ? <Check className="h-4 w-4" /> : ""}</span>
              <span><b className={s.done ? "text-gray-500 line-through" : ""}>{s.label}</b><span className="block text-sm text-gray-600">{s.hint}</span></span>
            </li>
          ))}
        </ol>
        <Button onClick={() => go(next.tab)}>{next.cta}</Button>
      </CardContent>
    </Card>
  );
}
