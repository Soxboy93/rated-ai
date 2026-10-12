import { ENV } from "./_core/env";

export type SafetyLevel = "safe" | "review" | "blocked";
export type SafetyCategory =
  | "self_harm"
  | "sexual"
  | "violence"
  | "dangerous_activity"
  | "personal_info";

export type SafetyVerdict = {
  level: SafetyLevel;
  category?: SafetyCategory;
  /** Reply to show the child instead of calling the model, when set. */
  reply?: string;
};

/**
 * Baseline keyword/pattern screening. This is a first line of defence only:
 * it will miss paraphrases and can produce false positives. Enable
 * LLM_MODERATION=1 to add the provider's moderation model on top.
 */
const RULES: Array<{ category: SafetyCategory; level: SafetyLevel; patterns: RegExp[]; reply: string }> = [
  {
    category: "self_harm",
    level: "review",
    patterns: [
      /\b(kill|hurt|harm|cut)\s+(myself|me)\b/i,
      /\bsuicid(e|al)\b/i,
      /\b(want|wanna|going)\s+to\s+die\b/i,
      /\bdon'?t\s+want\s+to\s+(live|be\s+alive)\b/i,
      /\bend\s+my\s+life\b/i,
    ],
    reply:
      "I'm really glad you told me. Those feelings are important, and you don't have to handle them alone. Please talk to a grown-up you trust right now, like a parent, a teacher, or a school counselor. If you are in danger, ask an adult to call your local emergency number.",
  },
  {
    category: "sexual",
    level: "blocked",
    patterns: [/\b(porn\w*|nsfw|erotic|sexting|send\s+nudes?|have\s+sex)\b/i],
    reply: "That's not something I can talk about. Let's explore something else! What would you like to learn today?",
  },
  {
    category: "violence",
    level: "blocked",
    patterns: [/\bhow\s+(do\s+i|to|can\s+i)\s+(kill|murder|stab|shoot|poison)\b/i, /\bmake\s+(a\s+)?(bomb|weapon|gun)\b/i],
    reply: "I can't help with hurting people or making weapons. Want to try a fun science experiment that's safe instead?",
  },
  {
    category: "dangerous_activity",
    level: "blocked",
    patterns: [/\bhow\s+(do\s+i|to|can\s+i)\s+(buy|get|make)\s+(drugs|weed|cocaine|alcohol|vodka)\b/i],
    reply: "That's not safe for me to help with. Let's pick another topic!",
  },
  {
    category: "personal_info",
    level: "review",
    patterns: [
      /\b\d{3}[\s.-]?\d{3}[\s.-]?\d{4}\b/, // 10-digit phone-number-like
      /\+\d{1,3}[\s-]?\d{6,}/, // international phone-number-like
      /[\w.+-]+@[\w-]+\.[\w.-]+/, // email
      /\bmy\s+(home\s+)?address\s+is\b/i,
      /\bi\s+live\s+at\b/i,
    ],
    reply:
      "Let's keep personal details like phone numbers, emails, and addresses private. Please don't share them online. What else would you like to talk about?",
  },
];

export function screenText(text: string): SafetyVerdict {
  // Evaluate in severity order: the first matching rule wins.
  for (const rule of RULES) {
    if (rule.patterns.some(p => p.test(text))) {
      return { level: rule.level, category: rule.category, reply: rule.reply };
    }
  }
  return { level: "safe" };
}

/** Optional provider-side moderation (OpenAI-compatible /moderations). Fails open to the heuristic result. */
export async function screenWithProvider(text: string): Promise<SafetyVerdict> {
  const local = screenText(text);
  if (local.level !== "safe" || !ENV.providerModeration || !ENV.llmApiKey) return local;
  try {
    const res = await fetch(`${ENV.llmApiUrl}/moderations`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${ENV.llmApiKey}` },
      body: JSON.stringify({ input: text }),
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const data = (await res.json()) as { results?: Array<{ flagged: boolean; categories: Record<string, boolean> }> };
    const result = data.results?.[0];
    if (result?.flagged) {
      const selfHarm = Object.entries(result.categories).some(([k, v]) => v && k.startsWith("self-harm"));
      const rule = RULES.find(r => r.category === (selfHarm ? "self_harm" : "violence"))!;
      return { level: selfHarm ? "review" : "blocked", category: rule.category, reply: rule.reply };
    }
  } catch (error) {
    console.warn("[Safety] Provider moderation unavailable, using local screening only:", String(error));
  }
  return local;
}

export const SAFE_FALLBACK_REPLY =
  "Hmm, I can't share that. Let's try a different question! What else are you curious about?";
