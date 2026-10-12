import { AGE_GROUPS, AI_CHARACTERS } from "@shared/characters";

export type AgeGroupId = keyof typeof AGE_GROUPS;
export const CHARACTER_IDS = AI_CHARACTERS.map(c => c.id) as [string, ...string[]];
export const AGE_GROUP_IDS = Object.keys(AGE_GROUPS) as [AgeGroupId, ...AgeGroupId[]];

const SAFETY_BASE =
  "You are talking with a child. Keep every answer age-appropriate, educational and kind. " +
  "Never provide sexual, violent, hateful, or dangerous content, or instructions for harmful activities. " +
  "Never ask for or encourage sharing personal information such as full names, addresses, phone numbers, school names or photos. " +
  "If the child seems sad, scared or unsafe, respond warmly and encourage them to talk to a trusted adult. " +
  "If you are unsure of a fact, say so instead of guessing. Do not claim to be human. Keep answers short and clear.";

export function buildSystemPrompt(opts: { characterId?: string | null; ageGroup?: string | null }) {
  const character = AI_CHARACTERS.find(c => c.id === opts.characterId);
  const age = opts.ageGroup && opts.ageGroup in AGE_GROUPS ? AGE_GROUPS[opts.ageGroup as AgeGroupId] : undefined;
  return [SAFETY_BASE, character?.systemPrompt, age?.systemPrompt].filter(Boolean).join("\n\n");
}
