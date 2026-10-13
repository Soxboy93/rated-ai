import { useState } from "react";
import { trpc } from "@/lib/trpc";
import Avatar from "./Avatar";
import { useChild } from "./ChildContext";
import { guideById } from "./guides";
import { playSound } from "./sound";
import { t, currentLang } from "@/i18n";

type Line = { who: "me" | "ai"; text: string };

/** Ask your guide about the lesson you are on. The guide knows the lesson but never the quiz answers. Saved like any chat. */
export default function LessonHelp({ shareId }: { shareId: string }) {
  const { child } = useChild();
  const guide = guideById(child?.selectedCharacter);
  const createSession = trpc.chat.createSession.useMutation();
  const send = trpc.chat.sendMessage.useMutation();
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const busy = send.isPending || createSession.isPending;

  const ask = async (raw: string) => {
    const message = raw.trim();
    if (!message || busy || !child) return;
    setText(""); setError(""); playSound("tap");
    setLines(l => [...l, { who: "me", text: message }]);
    try {
      let sid = sessionId;
      if (!sid) { sid = (await createSession.mutateAsync({ profileId: child.id, characterId: guide.id, language: currentLang() })).sessionId; setSessionId(sid); }
      const out = await send.mutateAsync({ sessionId: sid, message, shareId });
      setLines(l => [...l, { who: "ai", text: out.message }]);
      playSound("correct");
    } catch (e) { setError(e instanceof Error ? t(e.message) : t("Something went wrong. Try again!")); }
  };

  if (!open) {
    return <div><button type="button" className="k-btn light" onClick={() => { playSound("tap"); setOpen(true); }}>💬 {t("Ask {name} about this lesson", { name: guide.short })}</button></div>;
  }
  const starters = [t("Explain it a different way"), t("Give me another example"), t("I'm stuck. Can you give me a hint?")];
  return (
    <section className="k-card" style={{ display: "grid", gap: 12 }} aria-label={t("Ask {name} about this lesson", { name: guide.short })}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Avatar guide={guide} size={52} />
        <b style={{ flex: 1 }}>{t("Ask {name} about this lesson", { name: guide.short })}</b>
        <button type="button" className="k-btn small light round" aria-label={t("Close")} onClick={() => setOpen(false)}>✕</button>
      </div>
      <div role="log" aria-live="polite" style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 280, overflowY: "auto" }}>
        {lines.map((l, n) => <div key={n} className={`k-bubble ${l.who === "me" ? "me" : "ai"}`} style={{ alignSelf: l.who === "me" ? "flex-end" : "flex-start" }}>{l.text}</div>)}
        {busy && <div className="k-bubble ai">…</div>}
      </div>
      {lines.length === 0 && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{starters.map(s => <button key={s} type="button" className="k-btn small light" onClick={() => void ask(s)}>{s}</button>)}</div>}
      {error && <p role="alert" className="k-note-bad" style={{ padding: 8, borderRadius: 12 }}>{error}</p>}
      <form style={{ display: "flex", gap: 10 }} onSubmit={e => { e.preventDefault(); void ask(text); }}>
        <input className="k-input" value={text} maxLength={500} onChange={e => setText(e.target.value)} placeholder={t("Ask {name} anything…", { name: guide.short })} aria-label={t("Your message")} disabled={busy} />
        <button type="submit" className="k-btn" disabled={busy || !text.trim()}>{t("Send")}</button>
      </form>
    </section>
  );
}
