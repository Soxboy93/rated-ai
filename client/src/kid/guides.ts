import { AI_CHARACTERS } from "@shared/characters";
import { t } from "@/i18n";

export type GuideId = "sage" | "phoenix" | "nova" | "echo";

export type Guide = {
  id: GuideId;
  name: string;
  short: string;
  role: string;
  emoji: string;
  color: string;
  blurb: string;
  greetings: string[];
  starters: string[];
};

type Meta = Omit<Guide, "id" | "name" | "blurb">;

// Text fields are getters so they follow the current language each time they are read.
const META: Record<GuideId, Meta> = {
  sage: {
    get short() { return t("Sage"); }, get role() { return t("The wise owl"); }, emoji: "🦉", color: "#6a55e0",
    get greetings() { return [t("Hoo-hoo! Ready to learn something amazing?"), t("Curious minds are my favourite!"), t("Let's find out something new today!")]; },
    get starters() { return [t("Tell me a cool fact"), t("Why do we need sleep?"), t("How do airplanes fly?"), t("Help me learn about volcanoes")]; },
  },
  phoenix: {
    get short() { return t("Phoenix"); }, get role() { return t("The creative firebird"); }, emoji: "🦅", color: "#e8603a",
    get greetings() { return [t("Let's make something colourful!"), t("My feathers are tingling with ideas!"), t("Ready to create?")]; },
    get starters() { return [t("Help me invent a new animal"), t("Let's make up a song"), t("Give me a drawing idea"), t("Tell me a short funny story")]; },
  },
  nova: {
    get short() { return t("Nova"); }, get role() { return t("The science robot"); }, emoji: "🤖", color: "#2b7de0",
    get greetings() { return [t("Beep boop! Science time!"), t("Let's explore the universe!"), t("Ready for an experiment?")]; },
    get starters() { return [t("How big is the Sun?"), t("Why is the sky blue?"), t("How do magnets work?"), t("What lives in the deep ocean?")]; },
  },
  echo: {
    get short() { return t("Echo"); }, get role() { return t("The friendly fox"); }, emoji: "🦊", color: "#e8861f",
    get greetings() { return [t("Hi friend! How are you today?"), t("I'm here to listen."), t("Tell me what's on your mind!")]; },
    get starters() { return [t("I had a tricky day"), t("How can I make a new friend?"), t("Help me feel brave"), t("Tell me something kind")]; },
  },
};

export const GUIDES: Guide[] = AI_CHARACTERS.map(c => {
  const meta = META[c.id as GuideId];
  return Object.create(meta, {
    id: { value: c.id as GuideId, enumerable: true },
    name: { get: () => t(c.name), enumerable: true },
    blurb: { get: () => t(c.description), enumerable: true },
  }) as Guide;
});
export const guideById = (id: string | null | undefined): Guide => GUIDES.find(g => g.id === id) ?? GUIDES[0];

export const GAME_META = {
  math: { get name() { return t("Number Ninjas"); }, icon: "🥷", color: "var(--c-math)", get blurb() { return t("Quick maths, big points"); } },
  spelling: { get name() { return t("Spelling Bee"); }, icon: "🐝", color: "var(--c-spelling)", get blurb() { return t("Listen, then spell it right"); } },
  quiz: { get name() { return t("Quiz Time"); }, icon: "🧠", color: "var(--c-quiz)", get blurb() { return t("Facts about our world"); } },
} as const;

export const MOOD_META: Record<string, { label: string; emoji: string; color: string; reply: string }> = {
  happy: { get label() { return t("Happy"); }, emoji: "😄", color: "#ffd23f", get reply() { return t("That's wonderful! Happy feelings are worth sharing."); } },
  excited: { get label() { return t("Excited"); }, emoji: "🤩", color: "#ff9f1c", get reply() { return t("Wow, so much energy! What are you excited about?"); } },
  calm: { get label() { return t("Calm"); }, emoji: "😌", color: "#7bd3c4", get reply() { return t("Calm is a great feeling. Enjoy it!"); } },
  tired: { get label() { return t("Tired"); }, emoji: "😴", color: "#9db4ff", get reply() { return t("Rest is important. A drink of water and a stretch can help."); } },
  worried: { get label() { return t("Worried"); }, emoji: "😟", color: "#b79cff", get reply() { return t("It's okay to feel worried. Let's try a calm breathing break together."); } },
  sad: { get label() { return t("Sad"); }, emoji: "😢", color: "#7fb2ff", get reply() { return t("I'm sorry you feel sad. Talking to someone you trust can really help."); } },
  angry: { get label() { return t("Angry"); }, emoji: "😠", color: "#ff7b6b", get reply() { return t("Big feelings are okay. Let's breathe together to help them settle."); } },
};
