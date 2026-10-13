import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { currentLang, t, T } from "@/i18n";

type Msg = { role: "user" | "assistant"; content: string };

const QUICK_GENERAL = [T("Explain fractions to a 9-year-old in a simple way"), T("Give me 5 quick warm-up ideas"), T("Write a short note to parents about homework"), T("How can I keep a noisy class focused?")];
const QUICK_LESSON = [T("Explain this lesson's main idea in a simpler way"), T("Give me three more examples for this lesson"), T("Make a short worksheet for this lesson"), T("Ideas for students who find this hard"), T("Ideas for students who finish early")];

/** A chat with the teaching companion. Nothing is stored: closing the page clears it. */
export default function CompanionChat({ lessonId, title }: { lessonId?: string; title?: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const ask = trpc.assistant.ask.useMutation();
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }); }, [msgs.length, ask.isPending]);

  const send = async (raw: string) => {
    const content = raw.trim();
    if (!content || ask.isPending) return;
    const next: Msg[] = [...msgs, { role: "user", content }].slice(-12) as Msg[];
    setMsgs(next); setText(""); setError("");
    try {
      const out = await ask.mutateAsync({ messages: next, language: currentLang(), lessonId });
      setMsgs(m => [...m, { role: "assistant", content: out.reply }]);
    } catch (e) { setError(t(e instanceof Error ? e.message : "Something went wrong. Try again!")); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title ?? t("Teaching companion")}</CardTitle>
        <CardDescription>{t("Ask for explanations, examples, worksheets, activity ideas or a note to parents. The companion can make mistakes: check important facts against the textbook. Chats are not saved.")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {(lessonId ? QUICK_LESSON : QUICK_GENERAL).map(q => (
            <button key={q} type="button" className="rounded-full border px-3 py-1 text-sm hover:bg-teal-50" disabled={ask.isPending} onClick={() => void send(t(q))}>{t(q)}</button>
          ))}
        </div>
        <div role="log" aria-live="polite" className="max-h-96 min-h-24 space-y-2 overflow-y-auto rounded-lg border bg-slate-50 p-3">
          {msgs.length === 0 && <p className="text-sm text-gray-500">{t("Your conversation will appear here.")}</p>}
          {msgs.map((m, i) => (
            <div key={i} className={`max-w-[92%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${m.role === "user" ? "ms-auto bg-teal-700 text-white" : "bg-white border"}`}>{m.content}</div>
          ))}
          {ask.isPending && <p className="text-sm text-gray-500">{t("Thinking…")}</p>}
          <div ref={endRef} />
        </div>
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        <form className="flex gap-2" onSubmit={e => { e.preventDefault(); void send(text); }}>
          <textarea value={text} onChange={e => setText(e.target.value)} maxLength={3000} rows={2} aria-label={t("Your question")} placeholder={t("Ask the companion…")}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(text); } }}
            className="min-h-11 flex-1 rounded-md border border-input bg-background p-2 text-sm" />
          <Button type="submit" disabled={ask.isPending || !text.trim()}>{t("Send")}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
