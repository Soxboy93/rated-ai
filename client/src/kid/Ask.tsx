import { useState } from "react";
import { useChild } from "./ChildContext";
import KidShell from "./Shell";
import AskChat from "./AskChat";
import AskLookup from "./AskLookup";
import AskHomework from "./AskHomework";
import { playSound } from "./sound";
import { t } from "@/i18n";

type Mode = "chat" | "lookup" | "homework";

/** One place for everything you want to ask: talk to your guide, look something up, or get help with homework. */
export default function Ask() {
  const { progress } = useChild();
  const controls = progress?.controls;
  const modes: Array<{ id: Mode; icon: string; label: string; on: boolean }> = [
    { id: "chat", icon: "💬", label: t("Chat"), on: controls?.chat !== false && !controls?.focus },
    { id: "lookup", icon: "🔎", label: t("Look up"), on: controls?.search !== false && !controls?.focus },
    { id: "homework", icon: "📚", label: t("Homework"), on: !controls?.focus },
  ];
  const available = modes.filter(m => m.on);
  const [mode, setMode] = useState<Mode>("chat");
  const current = available.find(m => m.id === mode)?.id ?? available[0]?.id;

  return (
    <KidShell title={t("Ask")}>
      {available.length === 0 ? (
        <p className="k-card k-note-warn" role="status">🎯 {t("Focus time: your teacher has set up what to do right now.")}</p>
      ) : (
        <div className="k-stack">
          <div className="k-seg" role="tablist" aria-label={t("What do you want to do?")}>
            {available.map(m => (
              <button key={m.id} role="tab" aria-selected={current === m.id} onClick={() => { playSound("tap"); setMode(m.id); }}>
                <span aria-hidden="true">{m.icon}</span> {m.label}
              </button>
            ))}
          </div>
          {current === "chat" && <AskChat />}
          {current === "lookup" && <AskLookup />}
          {current === "homework" && <AskHomework />}
        </div>
      )}
    </KidShell>
  );
}
