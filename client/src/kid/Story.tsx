import { useState } from "react";
import { trpc } from "@/lib/trpc";
import KidShell from "./Shell";
import { useChild } from "./ChildContext";
import { guideById } from "./guides";
import { playSound } from "./sound";
import { canSpeak, speak, stopSpeaking } from "./speech";

const IDEAS = [
  "a dragon who is afraid of fire", "a robot who learns to paint", "a friendly cloud that wants to travel", "twins who find a secret door in the garden",
  "a penguin who wants to see the desert", "a kid who can talk to bees", "a space picnic on the moon", "a tiny knight and a very big snail",
  "a magic backpack that grows vegetables", "the day the animals swapped voices",
];

export default function Story() {
  const { child } = useChild();
  const guide = guideById(child?.selectedCharacter);
  const [idea, setIdea] = useState("");
  const [story, setStory] = useState<{ idea: string; text: string } | null>(null);
  const [picture, setPicture] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const [shuffle, setShuffle] = useState(0);

  const gen = trpc.creative.generateStory.useMutation();
  const draw = trpc.creative.generateIllustration.useMutation();

  const ideas = IDEAS.slice(shuffle % 5, (shuffle % 5) + 5);

  const make = async (prompt: string) => {
    const p = prompt.trim();
    if (!p || gen.isPending) return;
    setError(""); setPicture(null); setStory(null); stopSpeaking(); setReading(false); playSound("tap");
    try {
      const out = await gen.mutateAsync({ prompt: p });
      setStory({ idea: p, text: out.content });
      playSound("win");
    } catch (e) { setError(e instanceof Error ? e.message : "The story machine is resting. Try again!"); }
  };

  const picture1 = async () => {
    if (!story) return;
    setError("");
    try {
      const out = await draw.mutateAsync({ prompt: story.idea });
      setPicture(out.imageUrl ?? null);
      playSound("badge");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not make a picture."); }
  };

  const toggleRead = () => {
    if (!story) return;
    if (reading) { stopSpeaking(); setReading(false); return; }
    setReading(true);
    speak(story.text, { rate: 0.9, onEnd: () => setReading(false) });
  };

  return (
    <KidShell title="Story Maker" color="var(--c-story)">
      <div style={{ display: "grid", gap: 20, maxWidth: 820, margin: "0 auto" }}>
        <section className="k-card" style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <img src={guide.art} alt="" width={90} height={90} className="k-bob" />
            <div>
              <h2 style={{ fontSize: "1.8rem" }}>What should the story be about?</h2>
              <p className="k-muted">Pick an idea or type your own.</p>
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {ideas.map(i => <button key={i} className="k-btn small light" onClick={() => { setIdea(i); void make(i); }}>{i}</button>)}
            <button className="k-btn small light" onClick={() => setShuffle(s => s + 1)} aria-label="Show different ideas">🎲 More ideas</button>
          </div>
          <form onSubmit={e => { e.preventDefault(); void make(idea); }} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input className="k-input" style={{ flex: 1, minWidth: 200 }} value={idea} onChange={e => setIdea(e.target.value)} maxLength={500} placeholder="A story about…" aria-label="Story idea" />
            <button className="k-btn" style={{ ["--c" as string]: "var(--c-story)", color: "#2b2250", textShadow: "none" }} disabled={!idea.trim() || gen.isPending}>✨ Make my story</button>
          </form>
        </section>

        {gen.isPending && (
          <div className="k-card k-in" style={{ textAlign: "center" }}>
            <img src={guide.art} alt="" width={110} height={110} className="k-bob" style={{ margin: "0 auto" }} />
            <p className="display" style={{ fontSize: "1.5rem" }}>{guide.short} is writing your story…</p>
          </div>
        )}
        {error && <p role="alert" className="k-card" style={{ background: "#ffe3e3", color: "#6b1217", fontWeight: 800 }}>{error}</p>}

        {story && (
          <article className="k-card k-in" style={{ display: "grid", gap: 14, background: "#fffbe8", color: "#2b2250" }}>
            <h2 style={{ fontSize: "1.7rem", textTransform: "capitalize" }}>{story.idea}</h2>
            {picture && <img src={picture} alt={`An illustration of ${story.idea}`} style={{ width: "100%", maxWidth: 420, margin: "0 auto", border: "3px solid #2b2250", borderRadius: 18 }} />}
            <div style={{ display: "grid", gap: 12, fontSize: "1.2rem", lineHeight: 1.7 }}>
              {story.text.split(/\n{2,}/).map((p, n) => <p key={n}>{p}</p>)}
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {canSpeak && <button className="k-btn small" onClick={toggleRead}>{reading ? "⏹ Stop" : "🔊 Read it to me"}</button>}
              <button className="k-btn small light" style={{ color: "#2b2250" }} onClick={picture1} disabled={draw.isPending}>{draw.isPending ? "Painting…" : picture ? "🖼 New picture" : "🖼 Make a picture"}</button>
              <button className="k-btn small light" style={{ color: "#2b2250" }} onClick={() => { setStory(null); setPicture(null); setIdea(""); stopSpeaking(); }}>🔁 New story</button>
            </div>
          </article>
        )}
      </div>
    </KidShell>
  );
}
