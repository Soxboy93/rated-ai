import { AI_CHARACTERS } from "@shared/characters";

export type GuideId = "sage" | "phoenix" | "nova" | "echo";

export type Guide = {
  id: GuideId;
  name: string;
  short: string;
  role: string;
  art: string;
  color: string;
  blurb: string;
  greetings: string[];
  starters: string[];
};

const META: Record<GuideId, Omit<Guide, "id" | "name" | "blurb">> = {
  sage: {
    short: "Sage", role: "The wise owl", art: "/art/sage.webp", color: "#6a45e0",
    greetings: ["Hoo-hoo! Ready to learn something amazing?", "Curious minds are my favourite!", "Let's find out something new today!"],
    starters: ["Tell me a cool fact", "Why do we need sleep?", "How do airplanes fly?", "Help me learn about volcanoes"],
  },
  phoenix: {
    short: "Phoenix", role: "The creative firebird", art: "/art/phoenix.webp", color: "#f2603a",
    greetings: ["Let's make something colourful!", "My feathers are tingling with ideas!", "Ready to create?"],
    starters: ["Help me invent a new animal", "Let's make up a song", "Give me a drawing idea", "Tell me a short funny story"],
  },
  nova: {
    short: "Nova", role: "The science robot", art: "/art/nova.webp", color: "#2b7de0",
    greetings: ["Beep boop! Science time!", "Let's explore the universe!", "Ready for an experiment?"],
    starters: ["How big is the Sun?", "Why is the sky blue?", "How do magnets work?", "What lives in the deep ocean?"],
  },
  echo: {
    short: "Echo", role: "The friendly fox", art: "/art/echo.webp", color: "#f08a24",
    greetings: ["Hi friend! How are you today?", "I'm here to listen.", "Tell me what's on your mind!"],
    starters: ["I had a tricky day", "How can I make a new friend?", "Help me feel brave", "Tell me something kind"],
  },
};

export const GUIDES: Guide[] = AI_CHARACTERS.map(c => ({ id: c.id as GuideId, name: c.name, blurb: c.description, ...META[c.id as GuideId] }));
export const guideById = (id: string | null | undefined): Guide => GUIDES.find(g => g.id === id) ?? GUIDES[0];

export const GAME_META = {
  math: { name: "Number Ninjas", icon: "🥷", color: "var(--c-math)", blurb: "Quick maths, big points" },
  spelling: { name: "Spelling Bee", icon: "🐝", color: "var(--c-spelling)", blurb: "Listen, then spell it right" },
  quiz: { name: "Quiz Time", icon: "🧠", color: "var(--c-quiz)", blurb: "Facts about our world" },
  memory: { name: "Memory Match", icon: "🃏", color: "var(--c-memory)", blurb: "Flip cards and find pairs" },
  patterns: { name: "Pattern Pals", icon: "🧩", color: "var(--c-patterns)", blurb: "What comes next?" },
} as const;

export const MOOD_META: Record<string, { label: string; emoji: string; color: string; reply: string }> = {
  happy: { label: "Happy", emoji: "😄", color: "#ffd23f", reply: "That's wonderful! Happy feelings are worth sharing." },
  excited: { label: "Excited", emoji: "🤩", color: "#ff9f1c", reply: "Wow, so much energy! What are you excited about?" },
  calm: { label: "Calm", emoji: "😌", color: "#7bd3c4", reply: "Calm is a great feeling. Enjoy it!" },
  tired: { label: "Tired", emoji: "😴", color: "#9db4ff", reply: "Rest is important. A drink of water and a stretch can help." },
  worried: { label: "Worried", emoji: "😟", color: "#b79cff", reply: "It's okay to feel worried. Let's try a calm breathing break together." },
  sad: { label: "Sad", emoji: "😢", color: "#7fb2ff", reply: "I'm sorry you feel sad. Talking to someone you trust can really help." },
  angry: { label: "Angry", emoji: "😠", color: "#ff7b6b", reply: "Big feelings are okay. Let's breathe together to help them settle." },
};
