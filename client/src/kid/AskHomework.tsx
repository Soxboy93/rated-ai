import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import Avatar from "./Avatar";
import { useChild } from "./ChildContext";
import { guideById } from "./guides";
import { playSound } from "./sound";
import { canSpeakIn, speak, stopSpeaking } from "./speech";
import { t, T, currentLang } from "@/i18n";

const SUBJECTS = [["Maths", "🔢", T("Maths")], ["Science", "🔬", T("Science")], ["Arabic", "📜", T("Arabic")], ["English", "📚", T("English")], ["Other", "✏️", T("Other")]] as const;
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

export default function AskHomework() {
  const { child } = useChild();
  const guide = guideById(child?.selectedCharacter);
  const analyze = trpc.homework.analyzeHomework.useMutation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [subject, setSubject] = useState("Maths");
  const [preview, setPreview] = useState<string | null>(null);
  const [data, setData] = useState<string | null>(null);
  const [solution, setSolution] = useState<Solution | null>(null);
  const [shown, setShown] = useState(0);
  const [mine, setMine] = useState("");
  const [error, setError] = useState("");

  const onFile = async (file?: File) => {
    if (!file) return;
    setError(""); setSolution(null); setShown(0);
    try {
      setData(await toJpegBase64(file));
      setPreview(URL.createObjectURL(file));
    } catch { setError(t("I couldn't open that picture. Try another one!")); }
  };

  const help = async () => {
    if (!data) return;
    setError(""); playSound("tap");
    try {
      const out = (await analyze.mutateAsync({ imageData: data, subject, language: currentLang() })) as Solution;
      setSolution(out); setShown(0); setMine(""); playSound("correct");
    } catch (e) { setError(e instanceof Error ? t(e.message) : t("Something went wrong. Try again!")); }
  };

  // Compare the child's own try with the answer: digits and letters only, Arabic-Indic digits treated as ordinary digits.
  const norm = (v: string) => v.replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x660)).toLowerCase().replace(/[^a-z0-9\u0621-\u064A./-]/g, "");
  const total = solution?.steps.length ?? 0;
  const allShown = solution ? shown >= total : false;

  return (
    <>
      <div style={{ display: "grid", gap: 18 }}>
        <section className="k-card" style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <Avatar guide={guide} size={90} bob />
            <div>
              <h2 style={{ fontSize: "1.8rem" }}>{t("Stuck on homework?")}</h2>
              <p className="k-muted">{t("Take a photo of the problem. I'll show you how to solve it one step at a time. Try it yourself first!")}</p>
            </div>
          </div>
          <div role="radiogroup" aria-label={t("Subject")} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {SUBJECTS.map(([s, icon, label]) => (
              <button key={s} role="radio" aria-checked={subject === s} className="k-btn small light" onClick={() => setSubject(s)} style={{ background: subject === s ? "var(--c-lesson)" : undefined, color: subject === s ? "#fff" : undefined }}>{icon} {t(label)}</button>
            ))}
          </div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={e => onFile(e.target.files?.[0])} aria-label={t("Choose a homework photo")} />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="k-btn" style={{ ["--c" as string]: "var(--c-lesson)" }} onClick={() => fileRef.current?.click()}>📷 {preview ? t("Choose another photo") : t("Take or choose a photo")}</button>
            {preview && <button className="k-btn" style={{ ["--c" as string]: "var(--c-words)" }} onClick={help} disabled={analyze.isPending}>{analyze.isPending ? t("Looking…") : `🔍 ${t("Help me!")}`}</button>}
          </div>
          {preview && <img src={preview} alt={t("Your homework")} style={{ maxHeight: 280, maxWidth: "100%", objectFit: "contain", border: "1px solid var(--k-line)", borderRadius: 16 }} />}
        </section>

        {error && <p role="alert" className="k-card k-note-bad">{error}</p>}

        {solution && (
          <section className="k-card k-in" style={{ display: "grid", gap: 14 }} aria-live="polite">
            <h2 style={{ fontSize: "1.5rem" }}>{t("The problem")}</h2>
            <p style={{ fontSize: "1.25rem", fontWeight: 700 }}>{solution.question}</p>
            {total === 0 && <p className="k-muted">{t("I couldn't find a homework problem in that photo. Try a clearer picture.")}</p>}
            <ol style={{ display: "grid", gap: 10, listStyle: "none", padding: 0, margin: 0 }}>
              {solution.steps.slice(0, shown).map((s, n) => (
                <li key={n} className="k-card k-in" style={{ display: "flex", gap: 12, alignItems: "flex-start", boxShadow: "var(--k-shadow)" }}>
                  <span className="k-chip" style={{ background: "var(--c-lesson)", color: "#fff", flex: "none" }}>{t("Step {n}", { n: n + 1 })}</span>
                  <span style={{ flex: 1, fontSize: "1.1rem" }}>{s}</span>
                  {canSpeakIn() && <button className="k-btn small light round" style={{ minHeight: 40, width: 40 }} onClick={() => speak(s)} aria-label={t("Read step {n} aloud", { n: n + 1 })}>🔊</button>}
                </li>
              ))}
            </ol>
            {total > 0 && shown === 0 && (
              <div className="k-note-good k-card" style={{ display: "grid", gap: 8 }}>
                <b>🤔 {t("Have a go first! What do you think the answer is?")}</b>
                <input className="k-input" value={mine} maxLength={60} onChange={e => setMine(e.target.value)} placeholder={t("My answer (you can skip this)")} aria-label={t("My answer (you can skip this)")} />
              </div>
            )}
            {total > 0 && !allShown && (
              <button className="k-btn" style={{ ["--c" as string]: "var(--c-lesson)", width: "fit-content" }} onClick={() => { setShown(shown + 1); playSound("flip"); }}>
                {shown === 0 ? t("Show me step 1") : `${t("Next step")} ${currentLang() === "ar" ? "⬅" : "➜"}`}
              </button>
            )}
            {allShown && total > 0 && (
              <div className="k-card k-in" style={{ background: "#dcf5e8", color: "#0d4a30", borderColor: "#9fdcbd", display: "grid", gap: 6 }}>
                <h3 style={{ fontSize: "1.3rem" }}>✅ {t("Answer:")} {solution.answer}</h3>
                <p>{solution.explanation}</p>
                {mine.trim() && (norm(mine) === norm(solution.answer)
                  ? <p><b>🎉 {t("You worked it out yourself before I showed you. Brilliant!")}</b></p>
                  : <p>💡 {t("You guessed: {guess}. Compare it with the steps above. Where did yours differ?", { guess: mine.trim() })}</p>)}
              </div>
            )}
            <div><button className="k-btn small light" onClick={() => { setSolution(null); setPreview(null); setData(null); setShown(0); setMine(""); stopSpeaking(); }}>🔁 {t("Another problem")}</button></div>
          </section>
        )}
      </div>
    </>
  );
}
