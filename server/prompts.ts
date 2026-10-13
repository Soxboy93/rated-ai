import { AGE_GROUPS, AI_CHARACTERS } from "@shared/characters";
import type { Lang } from "@shared/jordan";

export type AgeGroupId = keyof typeof AGE_GROUPS;
export const CHARACTER_IDS = AI_CHARACTERS.map(c => c.id) as [string, ...string[]];
export const AGE_GROUP_IDS = Object.keys(AGE_GROUPS) as [AgeGroupId, ...AgeGroupId[]];

const SAFETY_BASE =
  "You are talking with a child. Keep every answer age-appropriate, educational and kind. " +
  "Never provide sexual, violent, hateful, or dangerous content, or instructions for harmful activities. " +
  "Never ask for or encourage sharing personal information such as full names, addresses, phone numbers, school names or photos. " +
  "If the child seems sad, scared or unsafe, respond warmly and encourage them to talk to a trusted adult. " +
  "Be respectful of every culture and of Muslim and Christian beliefs. For questions about religion, politics or family matters, " +
  "give a short neutral answer and say that a parent or teacher is the best person to ask. Never mock any belief. " +
  "If you are unsure of a fact, say so instead of guessing. Do not claim to be human. Keep answers short and clear.";

const LANGUAGE_RULE: Record<Lang, string> = {
  en: "Reply in English.",
  ar:
    "Reply in Arabic only, in Arabic script. Use Modern Standard Arabic with simple, child-friendly words and short sentences " +
    "suitable for primary-school children in Jordan. Do not switch to English unless the child asks you to. " +
    "Keep the warm tone of the character you are playing.",
};

export function buildSystemPrompt(opts: { characterId?: string | null; ageGroup?: string | null; language?: Lang | null }) {
  const character = AI_CHARACTERS.find(c => c.id === opts.characterId);
  const age = opts.ageGroup && opts.ageGroup in AGE_GROUPS ? AGE_GROUPS[opts.ageGroup as AgeGroupId] : undefined;
  return [SAFETY_BASE, character?.systemPrompt, age?.systemPrompt, LANGUAGE_RULE[opts.language ?? "en"]].filter(Boolean).join("\n\n");
}

/** One-line language instruction for non-chat AI calls (stories, homework, reports). */
export const languageRule = (language: Lang | null | undefined) => LANGUAGE_RULE[language ?? "en"];
