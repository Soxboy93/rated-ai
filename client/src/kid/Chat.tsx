import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import KidShell from "./Shell";
import { useChild } from "./ChildContext";
import { GUIDES, guideById, type Guide } from "./guides";
import { playSound } from "./sound";
import { t, currentLang } from "@/i18n";
import { canListen, canSpeakIn, listenOnce, speak, stopSpeaking } from "./speech";

type Msg = { id: string; role: "user" | "assistant" | "system"; content: string; pending?: boolean };

export default function Chat() {
  const { child } = useChild();
  const [guide, setGuide] = useState<Guide>(guideById(child?.selectedCharacter));
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [autoRead, setAutoRead] = useState(false);
  const [listening, setListening] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const createSession = trpc.chat.createSession.useMutation();
  const send = trpc.chat.sendMessage.useMutation();
  const messagesQ = trpc.chat.getMessages.useQuery({ sessionId: sessionId ?? "" }, { enabled: !!sessionId });
  const messages: Msg[] = (messagesQ.data as Msg[] | undefined) ?? [];

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages.length, pending, busy]);
  useEffect(() => () => stopSpeaking(), []);

  // A new guide means a fresh conversation (each chat belongs to one guide).
  const pickGuide = (g: Guide) => { playSound("tap"); setGuide(g); setSessionId(null); setError(""); stopSpeaking(); };

  const ensureSession = async () => {
    if (sessionId) return sessionId;
    if (!child) throw new Error(t("Pick a player first"));
    const out = await createSession.mutateAsync({ profileId: child.id, characterId: guide.id, language: currentLang() });
    setSessionId(out.sessionId);
    return out.sessionId;
  };

  const ask = async (raw: string) => {
    const message = raw.trim();
    if (!message || busy) return;
    setText(""); setError(""); setBusy(true); setPending(message); playSound("tap");
    try {
      const sid = await ensureSession();
      const out = await send.mutateAsync({ sessionId: sid, message });
      await messagesQ.refetch();
      playSound("correct");
      if (autoRead) speak(out.message);
    } catch (e) {
      setError(e instanceof Error ? t(e.message) : t("Something went wrong. Try again!"));
    } finally { setPending(null); setBusy(false); }
  };

  const mic = async () => {
    setListening(true);
    const heard = await listenOnce();
    setListening(false);
    if (heard) setText(heard);
  };

  return (
    <KidShell title={t("Chat with {name}", { name: guide.short })} color={guide.color}>
      <div style={{ display: "grid", gap: 16, maxWidth: 820, margin: "0 auto" }}>
        <div role="radiogroup" aria-label={t("Pick a guide")} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {GUIDES.map(g => (
            <button key={g.id} role="radio" aria-checked={g.id === guide.id} onClick={() => pickGuide(g)} className="k-chip"
              style={{ cursor: "pointer", background: g.id === guide.id ? g.color : undefined, color: g.id === guide.id ? "#fff" : undefined, paddingInline: 8 }}>
              <img src={g.art} alt="" width={32} height={32} /> {g.short}
            </button>
          ))}
          {canSpeakIn() && (
            <label className="k-chip" style={{ cursor: "pointer", marginInlineStart: "auto" }}>
              <input type="checkbox" checked={autoRead} onChange={e => { setAutoRead(e.target.checked); if (!e.target.checked) stopSpeaking(); }} style={{ width: 18, height: 18 }} />
              🔊 {t("Read replies")}
            </label>
          )}
        </div>

        <section className="k-card" style={{ padding: 0, overflow: "hidden", display: "grid", gridTemplateRows: "1fr auto" }}>
          <div role="log" aria-live="polite" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12, minHeight: 360, maxHeight: "58vh", overflowY: "auto" }}>
            {messages.length === 0 && !pending && (
              <div className="k-in" style={{ display: "flex", gap: 14, alignItems: "center", margin: "auto", textAlign: "center", flexDirection: "column" }}>
                <img src={guide.art} alt={guide.name} width={150} height={150} className="k-bob" />
                <h2 style={{ fontSize: "1.7rem" }}>{guide.greetings[0]}</h2>
                <p className="k-muted">{guide.name}</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                  {guide.starters.map(s => <button key={s} className="k-btn small light" onClick={() => ask(s)}>{s}</button>)}
                </div>
              </div>
            )}
            {messages.map(m => (
              <div key={m.id} className="k-in" style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start", gap: 4 }}>
                <div className={`k-bubble ${m.role === "user" ? "me" : "ai"}`}>{m.content}</div>
                {m.role !== "user" && canSpeakIn() && (
                  <button className="k-btn small light" style={{ minHeight: 34, padding: "2px 12px", fontSize: ".9rem" }} onClick={() => speak(m.content)} aria-label={t("Read this aloud")}>🔊 {t("Listen")}</button>
                )}
              </div>
            ))}
            {pending && <div className="k-bubble me">{pending}</div>}
            {busy && (
              <div className="k-bubble ai" aria-label={t("{name} is thinking", { name: guide.short })} style={{ display: "flex", gap: 6 }}>
                {[0, 1, 2].map(n => <span key={n} style={{ width: 12, height: 12, borderRadius: "50%", background: guide.color, border: "2px solid var(--k-ink)", animation: `k-bob 0.9s ${n * 0.15}s infinite` }} />)}
              </div>
            )}
            <div ref={endRef} />
          </div>
          <form onSubmit={e => { e.preventDefault(); void ask(text); }} style={{ display: "flex", gap: 10, padding: 14, borderTop: "3px solid var(--k-ink)", background: "var(--k-bg)" }}>
            <input className="k-input" value={text} onChange={e => setText(e.target.value)} maxLength={2000} placeholder={listening ? t("Listening…") : t("Ask {name} anything…", { name: guide.short })} aria-label={t("Your message")} disabled={busy} />
            {canListen && <button type="button" className="k-btn light round" onClick={mic} disabled={busy || listening} aria-label={t("Speak your message")}>{listening ? "👂" : "🎤"}</button>}
            <button type="submit" className="k-btn" style={{ ["--c" as string]: guide.color, whiteSpace: "nowrap" }} disabled={busy || !text.trim()}>{t("Send")} {currentLang() === "ar" ? "⬅" : "➤"}</button>
          </form>
        </section>
        {error && <p role="alert" className="k-card" style={{ background: "#ffe3e3", color: "#6b1217", fontWeight: 800 }}>{error}</p>}
        <p className="k-muted" style={{ fontSize: ".9rem", textAlign: "center" }}>{t("Your grown-up can read your chats. Never share your full name, address or phone number.")}</p>
      </div>
    </KidShell>
  );
}
