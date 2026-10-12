import { useState } from "react";
import { trpc } from "@/lib/trpc";
import KidShell from "./Shell";
import { playSound } from "./sound";

const PET_TYPES = [
  { id: "dragon", name: "Dragon", emoji: "🐉" },
  { id: "unicorn", name: "Unicorn", emoji: "🦄" },
  { id: "robot", name: "Robot", emoji: "🤖" },
  { id: "cat", name: "Cat", emoji: "🐱" },
  { id: "owl", name: "Owl", emoji: "🦉" },
  { id: "fox", name: "Fox", emoji: "🦊" },
];
const STAGES: Record<string, { name: string; scale: number }> = {
  baby: { name: "Baby", scale: 0.7 },
  child: { name: "Young", scale: 0.85 },
  teen: { name: "Teen", scale: 1 },
  adult: { name: "Grown-up", scale: 1.15 },
};

export default function Pet() {
  const utils = trpc.useUtils();
  const { data: pet, isLoading } = trpc.pet.getMyPet.useQuery();
  const create = trpc.pet.createPet.useMutation({ onSuccess: () => utils.pet.getMyPet.invalidate() });
  const feed = trpc.pet.feedPet.useMutation({ onSuccess: () => utils.pet.getMyPet.invalidate() });
  const play = trpc.pet.playWithPet.useMutation({ onSuccess: () => utils.pet.getMyPet.invalidate() });
  const [type, setType] = useState("dragon");
  const [name, setName] = useState("");
  const [bounce, setBounce] = useState<"" | "feed" | "play">("");

  const act = (kind: "feed" | "play") => {
    setBounce(kind);
    playSound(kind === "feed" ? "correct" : "match");
    (kind === "feed" ? feed : play).mutate();
    setTimeout(() => setBounce(""), 700);
  };

  if (isLoading) return <KidShell title="My Pet" color="var(--c-pet)"><p className="k-muted">Loading…</p></KidShell>;

  if (!pet) {
    return (
      <KidShell title="My Pet" color="var(--c-pet)">
        <div style={{ display: "grid", gap: 20, maxWidth: 760, margin: "0 auto" }}>
          <div className="k-card"><h2 style={{ fontSize: "2rem" }}>Choose your pet!</h2><p className="k-muted">Pick a friend to look after. Feed it and play with it so it grows.</p></div>
          <div role="radiogroup" aria-label="Pet type" style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
            {PET_TYPES.map(t => (
              <button key={t.id} role="radio" aria-checked={type === t.id} className="k-tile" onClick={() => { setType(t.id); playSound("tap"); }}
                style={{ ["--c" as string]: "var(--c-pet)", minHeight: 130, alignItems: "center", textAlign: "center", outline: type === t.id ? "5px solid var(--k-ink)" : undefined }}>
                <span className="icon" aria-hidden="true" style={{ fontSize: "3.6rem" }}>{t.emoji}</span>
                <span className="name">{t.name}</span>
              </button>
            ))}
          </div>
          <form className="k-card" style={{ display: "grid", gap: 12 }} onSubmit={e => { e.preventDefault(); if (name.trim()) { create.mutate({ type, name: name.trim() }); playSound("badge"); } }}>
            <label htmlFor="pet-name" style={{ fontWeight: 800 }}>Give your pet a name</label>
            <input id="pet-name" className="k-input" value={name} onChange={e => setName(e.target.value)} maxLength={50} placeholder="Sparky" />
            {create.error && <p role="alert" style={{ color: "var(--k-bad)", fontWeight: 800 }}>{create.error.message}</p>}
            <div><button className="k-btn" style={{ ["--c" as string]: "var(--c-pet)" }} disabled={!name.trim() || create.isPending}>Meet my pet 🎉</button></div>
          </form>
        </div>
      </KidShell>
    );
  }

  const meta = PET_TYPES.find(t => t.id === pet.type) ?? PET_TYPES[0];
  const stage = STAGES[pet.evolution ?? "baby"] ?? STAGES.baby;
  const hunger = pet.hunger ?? 0;
  const happy = pet.happiness ?? 0;
  const mood = happy > 70 ? "is super happy!" : happy > 40 ? "is doing okay." : "needs some fun!";
  const expInLevel = (pet.experience ?? 0) % 100;

  return (
    <KidShell title="My Pet" color="var(--c-pet)">
      <div style={{ display: "grid", gap: 18, maxWidth: 720, margin: "0 auto" }}>
        <section className="k-card" style={{ textAlign: "center", display: "grid", gap: 10, background: "linear-gradient(#bfe6ff 0 62%, #8be08f 62% 100%)", color: "#2b2250", overflow: "hidden" }}>
          <h2 style={{ fontSize: "1.8rem" }}>{pet.name}</h2>
          <p style={{ fontWeight: 800 }}>{stage.name} {meta.name} · Level {pet.level ?? 1}</p>
          <div style={{ fontSize: "7rem", lineHeight: 1, transform: `scale(${stage.scale})`, animation: bounce ? "k-pop .5s ease" : "k-bob 3s ease-in-out infinite", transition: "transform .6s" }} role="img" aria-label={`${meta.name} named ${pet.name}`}>
            {meta.emoji}
          </div>
          <p aria-live="polite" style={{ fontWeight: 800, minHeight: 28 }}>{bounce === "feed" ? "Yum yum! 🍎" : bounce === "play" ? "Wheee! ⚽" : `${pet.name} ${mood}`}</p>
        </section>

        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))" }}>
          <div className="k-card" style={{ display: "grid", gap: 6 }}>
            <b>Tummy {100 - hunger >= 60 ? "😋" : "😕"}</b>
            <div className="k-bar" role="progressbar" aria-label="Fullness" aria-valuenow={100 - hunger} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${Math.max(4, 100 - hunger)}%`, ["--c" as string]: "#46c37b" }} /></div>
          </div>
          <div className="k-card" style={{ display: "grid", gap: 6 }}>
            <b>Happiness {happy >= 60 ? "😄" : "😐"}</b>
            <div className="k-bar" role="progressbar" aria-label="Happiness" aria-valuenow={happy} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${Math.max(4, happy)}%`, ["--c" as string]: "#ff5d8f" }} /></div>
          </div>
          <div className="k-card" style={{ display: "grid", gap: 6 }}>
            <b>Growing ⭐</b>
            <div className="k-bar" role="progressbar" aria-label="Experience to next level" aria-valuenow={expInLevel} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${Math.max(4, expInLevel)}%`, ["--c" as string]: "var(--c-trophy)" }} /></div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
          <button className="k-btn" style={{ ["--c" as string]: "#46c37b" }} onClick={() => act("feed")} disabled={feed.isPending}>🍎 Feed</button>
          <button className="k-btn" style={{ ["--c" as string]: "var(--c-memory)" }} onClick={() => act("play")} disabled={play.isPending}>⚽ Play</button>
        </div>
      </div>
    </KidShell>
  );
}
