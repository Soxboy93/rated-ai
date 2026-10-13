import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import Avatar from "./Avatar";
import KidShell from "./Shell";
import { useChild } from "./ChildContext";
import { guideById } from "./guides";
import { playSound } from "./sound";
import { canSpeakIn, speak, stopSpeaking } from "./speech";
import { t, T, currentLang } from "@/i18n";

const IDEAS = [T("How do volcanoes work?"), T("Why do we have seasons?"), T("What do pandas eat?"), T("How do plants make food?"), T("Who built the pyramids?"), T("How far away is the Moon?")];

type Found = { title: string; answer: string; facts: string[]; didYouKnow: string; related: string[]; askGrownUp: string };

/** Safe search: ask anything, get a short answer written for your age. Not the open internet; grown-ups can read every search. */
export default function Search() {
  const { child } = useChild();
  const guide = guideById(child?.selectedCharacter);
  const ask = trpc.search.ask.useMutation();
  const [text, setText] = useState("");
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [found, setFound] = useState<Found | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const topRef = useRef<HTMLDivElement>(null);
  useEffect(() => () => stopSpeaking(), []);

  const go = async (raw: string) => {
    const query = raw.trim();
    if (query.length < 2 || ask.isPending || !child) return;
    setText(query); setError(""); setNotice(""); setFound(null); stopSpeaking(); playSound("tap");
    try {
      const out = await ask.mutateAsync({ profileId: child.id, query, language: currentLang(), sessionId });
      setSessionId(out.sessionId);
      if (out.result) { setFound(out.result); playSound("correct"); } else setNotice(out.reply ?? "");
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) { setError(e instanceof Error ? t(e.message) : t("Something went wrong. Try again!")); }
  };

  const readAloud = () => found && speak([found.title, found.answer, ...found.facts].join(". "));

  return (
    <KidShell title={t("Safe Search")} color="var(--c-search)">
      <div style={{ display: "grid", gap: 18, maxWidth: 820, margin: "0 auto" }} ref={topRef}>
        <form className="k-card" style={{ display: "grid", gap: 12 }} onSubmit={e => { e.preventDefault(); void go(text); }}>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <Avatar guide={guide} size={64} />
            <h2 style={{ fontSize: "1.4rem" }}>{t("What do you want to find out?")}</h2>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <input className="k-input" value={text} onChange={e => setText(e.target.value)} maxLength={200} placeholder={t("Type a question or a topic…")} aria-label={t("Search")} disabled={ask.isPending} />
            <button type="submit" className="k-btn" style={{ ["--c" as string]: "var(--c-search)", whiteSpace: "nowrap" }} disabled={ask.isPending || text.trim().length < 2}>🔎 {t("Search")}</button>
          </div>
          {!found && !ask.isPending && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {IDEAS.map(i => <button key={i} type="button" className="k-btn small light" onClick={() => void go(t(i))}>{t(i)}</button>)}
            </div>
          )}
        </form>

        {ask.isPending && <p className="k-card" role="status" aria-live="polite">🔎 {t("{name} is looking that up for you…", { name: guide.short })}</p>}
        {error && <p role="alert" className="k-card k-note-bad">{error}</p>}
        {notice && <p role="status" className="k-card k-note-warn" style={{ fontSize: "1.1rem" }}>{notice}</p>}

        {found && (
          <article className="k-card k-in" style={{ display: "grid", gap: 14 }}>
            <header style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
              <h2 style={{ fontSize: "1.6rem" }}>{found.title}</h2>
              {canSpeakIn() && <button type="button" className="k-btn small light" onClick={readAloud} aria-label={t("Read this aloud")}>🔊 {t("Listen")}</button>}
            </header>
            <p style={{ fontSize: "1.15rem", lineHeight: 1.6 }}>{found.answer}</p>
            {found.facts.length > 0 && (
              <ul style={{ margin: 0, paddingInlineStart: "1.3em", listStyle: "disc", display: "grid", gap: 6, fontSize: "1.1rem" }}>{found.facts.map((f, n) => <li key={n}>{f}</li>)}</ul>
            )}
            {found.didYouKnow && <p className="k-note-good" style={{ padding: "10px 14px", borderRadius: 14 }}>💡 <b>{t("Did you know?")}</b> {found.didYouKnow}</p>}
            {found.askGrownUp && <p className="k-note-warn" style={{ padding: "10px 14px", borderRadius: 14 }}>🧑‍🏫 {found.askGrownUp}</p>}
            {found.related.length > 0 && (
              <div style={{ display: "grid", gap: 8 }}>
                <b>{t("Explore next")}</b>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{found.related.map(r => <button key={r} type="button" className="k-btn small light" onClick={() => void go(r)}>🔎 {r}</button>)}</div>
              </div>
            )}
          </article>
        )}
        <p className="k-muted" style={{ fontSize: ".9rem", textAlign: "center" }}>{t("This is a helper, not the whole internet. Your grown-up and teacher can read your searches, and it can make mistakes, so check big facts with them.")}</p>
      </div>
    </KidShell>
  );
}
