/**
 * Preview-only AI bridge. In the published Claude preview the page can ask Claude through the artifact `sample`
 * capability (the viewer's own Claude account; no API key is ever in the page). When that is not available (opened
 * outside Claude, consent declined, offline) every function returns null and the caller falls back to canned replies.
 */
import { buildSystemPrompt } from "../../../server/prompts";
import { assistantSystemPrompt, generationSystemPrompt, generationUserPrompt, revisionSystemPrompt, revisionUserPrompt } from "../../../server/lessonPrompts";
import { languageRule } from "../../../server/prompts";
import { normalizeLesson, studentFacingText, type LessonContent } from "@shared/lesson";
import type { Lang } from "@shared/jordan";
import { screenText } from "../../../server/safety";

type Turn = { role: "user" | "assistant"; content: string };
type SampleOpts = { modelTier?: "quick" | "default" | "complex"; cache?: boolean; images?: Blob[]; signal?: AbortSignal };
type Sample = {
  (input: string | Turn[], opts?: SampleOpts): Promise<{ text: string; truncated: boolean }>;
  json: <T = unknown>(input: string | Turn[], opts?: SampleOpts) => Promise<T>;
  limits: () => Promise<{ images?: boolean }> | { images?: boolean };
};

export type AiState = "unknown" | "live" | "off";
let state: AiState = "unknown";
const listeners = new Set<(s: AiState) => void>();
const set = (s: AiState) => { if (s !== state) { state = s; listeners.forEach(l => l(s)); } };
export const aiState = () => state;
export const onAiState = (fn: (s: AiState) => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

let sampleP: Promise<Sample | null> | null = null;
function getSample(): Promise<Sample | null> {
  sampleP ??= (async () => {
    try {
      const c = (window as unknown as { claude?: { use?: (n: string) => Promise<unknown> } }).claude;
      const s = c?.use ? ((await c.use("sample")) as Sample | null) : null;
      set(s ? "live" : "off");
      return s;
    } catch { set("off"); return null; }
  })();
  return sampleP;
}
/** Resolve availability at start-up so the badge is right before the first request. */
export const initAi = () => { void getSample(); };

export class AiRefused extends Error {}

async function ask(input: string | Turn[], opts: SampleOpts = {}): Promise<string | null> {
  const s = await getSample();
  if (!s) return null;
  try {
    const out = await s(input, { cache: false, ...opts });
    return out.text.trim() || null;
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === "refused") throw new AiRefused("The assistant can't help with that. Let's try something else.");
    if (code === "not_granted") set("off");
    return null; // rate limits, network, etc.: the caller shows the canned reply instead
  }
}

/** Leading instructions go in the first user turn (the sample API has no system role); history must start and end on user. */
function withInstructions(instr: string, turns: Turn[]): Turn[] {
  while (turns.length && turns[0].role !== "user") turns = turns.slice(1);
  const first = `<instructions>\n${instr}\n</instructions>\nUnderstood? Reply with "OK".`;
  return [{ role: "user", content: first }, { role: "assistant", content: "OK" }, ...turns];
}

export async function aiChat(p: { characterId: string | null; ageGroup: string; language: Lang; history: Turn[]; message: string }): Promise<string | null> {
  const turns: Turn[] = [...p.history.slice(-10), { role: "user", content: p.message }];
  const out = await ask(withInstructions(buildSystemPrompt({ characterId: p.characterId, ageGroup: p.ageGroup, language: p.language }), turns), { modelTier: "quick" });
  if (!out) return null;
  // Never show a reply that our own screen rejects.
  return screenText(out, p.language).level === "blocked" ? null : out;
}

export async function aiStory(prompt: string, language: Lang): Promise<string | null> {
  const instr = "You are a creative children's story writer. Write engaging, age-appropriate stories that are fun, educational, and inspire imagination. Never include violence, scary or adult content. Keep stories between 200-400 words. " + languageRule(language);
  const out = await ask(`${instr}\n\nWrite a creative children's story about: ${prompt}`, { modelTier: "default" });
  if (!out) return null;
  return screenText(out, language).level === "blocked" ? null : out;
}

export type Solution = { question: string; steps: string[]; answer: string; explanation: string; subject: string; difficulty: string };

export async function aiHomework(p: { imageBase64: string; subject?: string; language: Lang }): Promise<Solution | null> {
  const s = await getSample();
  if (!s) return null;
  try {
    const lim = await s.limits();
    if (!lim?.images) return null;
    const bin = atob(p.imageBase64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const instr =
      "You are a helpful homework tutor for students. Analyze the homework problem in the image and provide a clear, step-by-step solution. Break down complex problems into simple steps. Be encouraging and educational. If the image is not a homework problem, say so in the question field and leave steps empty. " +
      "Reply with one JSON object only, with these fields: question (the problem statement), steps (array of solution steps), answer (final answer), explanation (why this solution works), subject (detected subject area), difficulty (easy/medium/hard). " +
      "Write the question, steps, answer and explanation in the language of this rule: " + languageRule(p.language) + " Keep the JSON field names in English.";
    const v = await s.json<Partial<Solution>>(`${instr}\n\nPlease analyze this ${p.subject || "homework"} problem and provide a step-by-step solution.`, {
      images: [new Blob([bytes], { type: "image/jpeg" })], modelTier: "default", cache: false,
    });
    return { question: String(v.question ?? ""), steps: Array.isArray(v.steps) ? v.steps.map(String) : [], answer: String(v.answer ?? ""), explanation: String(v.explanation ?? ""), subject: String(v.subject ?? ""), difficulty: String(v.difficulty ?? "") };
  } catch (e) {
    if ((e as { code?: string })?.code === "refused") throw new AiRefused("The assistant can't help with that. Let's try something else.");
    return null;
  }
}

const parseLesson = (text: string): LessonContent => {
  const content = normalizeLesson(JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "")));
  const sf = studentFacingText(content);
  if (screenText(sf, "en").level === "blocked" || screenText(sf, "ar").level === "blocked") throw new AiRefused("The draft contained unsuitable content. Please try again with different wording.");
  return content;
};
const jsonish = (t: string) => { const a = t.indexOf("{"), b = t.lastIndexOf("}"); return a >= 0 && b > a ? t.slice(a, b + 1) : t; };

export async function aiLessonDraft(p: { subject: string; grade: number; topic: string; durationMin: number; language: Lang; sourceText?: string | null }): Promise<LessonContent | null> {
  const out = await ask(
    `${generationSystemPrompt(p.language, !!p.sourceText)}\n\n${generationUserPrompt({ ...p, sourceText: p.sourceText ?? undefined })}`,
    { modelTier: "complex" },
  );
  if (!out) return null;
  try { return parseLesson(jsonish(out)); } catch (e) { if (e instanceof AiRefused) throw e; return null; }
}

export async function aiLessonRevise(content: LessonContent, instruction: string, language: Lang): Promise<LessonContent | null> {
  const out = await ask(`${revisionSystemPrompt(language)}\n\n${revisionUserPrompt(content, instruction)}`, { modelTier: "complex" });
  if (!out) return null;
  try { return parseLesson(jsonish(out)); } catch (e) { if (e instanceof AiRefused) throw e; return null; }
}

export async function aiAssistant(messages: Turn[], language: Lang): Promise<string | null> {
  return ask(withInstructions(assistantSystemPrompt(language), messages.slice(-12)), { modelTier: "default" });
}
