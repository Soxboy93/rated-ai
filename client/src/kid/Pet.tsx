import { useState } from "react";
import { trpc } from "@/lib/trpc";
import KidShell from "./Shell";
import { playSound } from "./sound";
import { t, T } from "@/i18n";

const PET_TYPES = [
  { id: "dragon", name: T("Dragon"), emoji: "🐉" },
  { id: "unicorn", name: T("Unicorn"), emoji: "🦄" },
  { id: "robot", name: T("Robot"), emoji: "🤖" },
  { id: "cat", name: T("Cat"), emoji: "🐱" },
  { id: "owl", name: T("Owl"), emoji: "🦉" },
  { id: "fox", name: T("Fox"), emoji: "🦊" },
];
const STAGES: Record<string, { name: string; scale: number }> = {
  baby: { name: T("Baby"), scale: 0.7 },
  child: { name: T("Young"), scale: 0.85 },
  teen: { name: T("Teen"), scale: 1 },
  adult: { name: T("Grown-up"), scale: 1.15 },
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

  if (isLoading) return <KidShell title={t("My Pet")} color="var(--c-pet)"><p className="k-muted">{t("Loading…")}</p></KidShell>;

  if (!pet) {
    return (
      <KidShell title={t("My Pet")} color="var(--c-pet)">
        <div style={{ display: "grid", gap: 20, maxWidth: 760, margin: "0 auto" }}>
          <div className="k-card"><h2 style={{ fontSize: "2rem" }}>{t("Choose your pet!")}</h2><p className="k-muted">{t("Pick a friend to look after. Feed it and play with it so it grows.")}</p></div>
          <div role="radiogroup" aria-label={t("Pet type")} style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
            {PET_TYPES.map(pt => (
              <button key={pt.id} role="radio" aria-checked={type === pt.id} className="k-tile" onClick={() => { setType(pt.id); playSound("tap"); }}
                style={{ ["--c" as string]: "var(--c-pet)", minHeight: 130, alignItems: "center", textAlign: "center", outline: type === pt.id ? "5px solid var(--k-ink)" : undefined }}>
                <span className="icon" aria-hidden="true" style={{ fontSize: "3.6rem" }}>{pt.emoji}</span>
                <span className="name">{t(pt.name)}</span>
              </button>
            ))}
          </div>
          <form className="k-card" style={{ display: "grid", gap: 12 }} onSubmit={e => { e.preventDefault(); if (name.trim()) { create.mutate({ type, name: name.trim() }); playSound("badge"); } }}>
            <label htmlFor="pet-name" style={{ fontWeight: 800 }}>{t("Give your pet a name")}</label>
            <input id="pet-name" className="k-input" value={name} onChange={e => setName(e.target.value)} maxLength={50} placeholder={t("Sparky")} />
            {create.error && <p role="alert" style={{ color: "var(--k-bad)", fontWeight: 800 }}>{t(create.error.message)}</p>}
            <div><button className="k-btn" style={{ ["--c" as string]: "var(--c-pet)" }} disabled={!name.trim() || create.isPending}>{t("Meet my pet")} 🎉</button></div>
          </form>
        </div>
      </KidShell>
    );
  }

  const meta = PET_TYPES.find(pt => pt.id === pet.type) ?? PET_TYPES[0];
  const stage = STAGES[pet.evolution ?? "baby"] ?? STAGES.baby;
  const hunger = pet.hunger ?? 0;
  const happy = pet.happiness ?? 0;
  const mood = happy > 70 ? t("{name} is super happy!", { name: pet.name }) : happy > 40 ? t("{name} is doing okay.", { name: pet.name }) : t("{name} needs some fun!", { name: pet.name });
  const expInLevel = (pet.experience ?? 0) % 100;

  return (
    <KidShell title={t("My Pet")} color="var(--c-pet)">
      <div style={{ display: "grid", gap: 18, maxWidth: 720, margin: "0 auto" }}>
        <section className="k-card" style={{ textAlign: "center", display: "grid", gap: 10, background: "linear-gradient(#bfe6ff 0 62%, #8be08f 62% 100%)", color: "#2b2250", overflow: "hidden" }}>
          <h2 style={{ fontSize: "1.8rem" }}>{pet.name}</h2>
          <p style={{ fontWeight: 800 }}>{t(stage.name)} {t(meta.name)} · {t("Level {level}", { level: pet.level ?? 1 })}</p>
          <div style={{ fontSize: "7rem", lineHeight: 1, transform: `scale(${stage.scale})`, animation: bounce ? "k-pop .5s ease" : "k-bob 3s ease-in-out infinite", transition: "transform .6s" }} role="img" aria-label={t("{type} named {name}", { type: t(meta.name), name: pet.name })}>
            {meta.emoji}
          </div>
          <p aria-live="polite" style={{ fontWeight: 800, minHeight: 28 }}>{bounce === "feed" ? `${t("Yum yum!")} 🍎` : bounce === "play" ? `${t("Wheee!")} ⚽` : mood}</p>
        </section>

        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))" }}>
          <div className="k-card" style={{ display: "grid", gap: 6 }}>
            <b>{t("Tummy")} {100 - hunger >= 60 ? "😋" : "😕"}</b>
            <div className="k-bar" role="progressbar" aria-label={t("Fullness")} aria-valuenow={100 - hunger} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${Math.max(4, 100 - hunger)}%`, ["--c" as string]: "#46c37b" }} /></div>
          </div>
          <div className="k-card" style={{ display: "grid", gap: 6 }}>
            <b>{t("Happiness")} {happy >= 60 ? "😄" : "😐"}</b>
            <div className="k-bar" role="progressbar" aria-label={t("Happiness")} aria-valuenow={happy} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${Math.max(4, happy)}%`, ["--c" as string]: "#ff5d8f" }} /></div>
          </div>
          <div className="k-card" style={{ display: "grid", gap: 6 }}>
            <b>{t("Growing")} ⭐</b>
            <div className="k-bar" role="progressbar" aria-label={t("Experience to next level")} aria-valuenow={expInLevel} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${Math.max(4, expInLevel)}%`, ["--c" as string]: "var(--c-trophy)" }} /></div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
          <button className="k-btn" style={{ ["--c" as string]: "#46c37b" }} onClick={() => act("feed")} disabled={feed.isPending}>🍎 {t("Feed")}</button>
          <button className="k-btn" style={{ ["--c" as string]: "var(--c-memory)" }} onClick={() => act("play")} disabled={play.isPending}>⚽ {t("Play")}</button>
        </div>
      </div>
    </KidShell>
  );
}
