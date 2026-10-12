import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import KidShell from "./Shell";
import { useChild } from "./ChildContext";
import { guideById } from "./guides";
import { playSound } from "./sound";
import { canSpeak, speak, stopSpeaking } from "./speech";

const SUBJECTS = [["Maths", "🔢"], ["Science", "🔬"], ["English", "📚"], ["Other", "✏️"]] as const;
const MAX_SIDE = 1280;

/** Shrink the photo before upload so phone pictures stay far below the server's size limit. */
async function toJpegBase64(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.8).split(",")[1];
}

type Solution = { question: string; steps: string[]; answer: string; explanation: string; subject: string; difficulty: string };

export default function Homework() {
  const { child } = useChild();
  const guide = guideById(child?.selectedCharacter);
  const analyze = trpc.homework.analyzeHomework.useMutation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [subject, setSubject] = useState("Maths");
  const [preview, setPreview] = useState<string | null>(null);
  const [data, setData] = useState<string | null>(null);
  const [solution, setSolution] = useState<Solution | null>(null);
  const [shown, setShown] = useState(0);
  const [error, setError] = useState("");

  const onFile = async (file?: File) => {
    if (!file) return;
    setError(""); setSolution(null); setShown(0);
    try {
      setData(await toJpegBase64(file));
      setPreview(URL.createObjectURL(file));
    } catch { setError("I couldn't open that picture. Try another one!"); }
  };

  const help = async () => {
    if (!data) return;
    setError(""); playSound("tap");
    try {
      const out = (await analyze.mutateAsync({ imageData: data, subject })) as Solution;
      setSolution(out); setShown(0); playSound("correct");
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong. Try again!"); }
  };

  const total = solution?.steps.length ?? 0;
  const allShown = solution ? shown >= total : false;

  return (
    <KidShell title="Homework Buddy" color="var(--c-homework)">
      <div style={{ display: "grid", gap: 18, maxWidth: 820, margin: "0 auto" }}>
        <section className="k-card" style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <img src={guide.art} alt="" width={90} height={90} className="k-bob" />
            <div>
              <h2 style={{ fontSize: "1.8rem" }}>Stuck on homework?</h2>
              <p className="k-muted">Take a photo of the problem. I'll show you how to solve it one step at a time. Try it yourself first!</p>
            </div>
          </div>
          <div role="radiogroup" aria-label="Subject" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {SUBJECTS.map(([s, icon]) => (
              <button key={s} role="radio" aria-checked={subject === s} className="k-btn small light" onClick={() => setSubject(s)} style={{ background: subject === s ? "var(--c-homework)" : undefined, color: subject === s ? "#fff" : undefined }}>{icon} {s}</button>
            ))}
          </div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={e => onFile(e.target.files?.[0])} aria-label="Choose a homework photo" />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="k-btn" style={{ ["--c" as string]: "var(--c-homework)" }} onClick={() => fileRef.current?.click()}>📷 {preview ? "Choose another photo" : "Take or choose a photo"}</button>
            {preview && <button className="k-btn" style={{ ["--c" as string]: "var(--c-memory)" }} onClick={help} disabled={analyze.isPending}>{analyze.isPending ? "Looking…" : "🔍 Help me!"}</button>}
          </div>
          {preview && <img src={preview} alt="Your homework" style={{ maxHeight: 280, maxWidth: "100%", objectFit: "contain", border: "3px solid var(--k-ink)", borderRadius: 16 }} />}
        </section>

        {error && <p role="alert" className="k-card" style={{ background: "#ffe3e3", color: "#6b1217", fontWeight: 800 }}>{error}</p>}

        {solution && (
          <section className="k-card k-in" style={{ display: "grid", gap: 14 }} aria-live="polite">
            <h2 style={{ fontSize: "1.5rem" }}>The problem</h2>
            <p style={{ fontSize: "1.25rem", fontWeight: 700 }}>{solution.question}</p>
            {total === 0 && <p className="k-muted">I couldn't find a homework problem in that photo. Try a clearer picture.</p>}
            <ol style={{ display: "grid", gap: 10, listStyle: "none", padding: 0, margin: 0 }}>
              {solution.steps.slice(0, shown).map((s, n) => (
                <li key={n} className="k-card k-in" style={{ display: "flex", gap: 12, alignItems: "flex-start", boxShadow: "0 3px 0 var(--k-ink)" }}>
                  <span className="k-chip" style={{ background: "var(--c-homework)", color: "#fff", flex: "none" }}>Step {n + 1}</span>
                  <span style={{ flex: 1, fontSize: "1.1rem" }}>{s}</span>
                  {canSpeak && <button className="k-btn small light round" style={{ minHeight: 40, width: 40 }} onClick={() => speak(s)} aria-label={`Read step ${n + 1} aloud`}>🔊</button>}
                </li>
              ))}
            </ol>
            {total > 0 && !allShown && (
              <button className="k-btn" style={{ ["--c" as string]: "var(--c-homework)", width: "fit-content" }} onClick={() => { setShown(shown + 1); playSound("flip"); }}>
                {shown === 0 ? "Show me step 1" : "Next step ➜"}
              </button>
            )}
            {allShown && total > 0 && (
              <div className="k-card k-in" style={{ background: "#b8f2d4", color: "#0d4a30", display: "grid", gap: 6 }}>
                <h3 style={{ fontSize: "1.3rem" }}>✅ Answer: {solution.answer}</h3>
                <p>{solution.explanation}</p>
              </div>
            )}
            <div><button className="k-btn small light" onClick={() => { setSolution(null); setPreview(null); setData(null); setShown(0); stopSpeaking(); }}>🔁 Another problem</button></div>
          </section>
        )}
      </div>
    </KidShell>
  );
}
