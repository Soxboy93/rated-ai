import { normalizeArabic } from "@shared/arabic";
import type { Lang } from "@shared/jordan";
import { ENV } from "./_core/env";

export type SafetyLevel = "safe" | "review" | "blocked";
export type SafetyCategory = "self_harm" | "sexual" | "violence" | "dangerous_activity" | "personal_info";

export type SafetyVerdict = {
  level: SafetyLevel;
  category?: SafetyCategory;
  /** Reply to show the child instead of calling the model, when set. */
  reply?: string;
};

// JS \b only knows ASCII letters, so Arabic words get explicit boundaries: not preceded or followed by an Arabic
// letter (an optional one-letter prefix such as و "and", ب, ل or the future marker س is allowed before the word).
const AR = "\\u0621-\\u064A";
const arWord = (alternatives: string) => new RegExp(`(?<![${AR}])[وفبلس]?(?:${alternatives})(?![${AR}])`);
const arPhrase = (source: string) => new RegExp(`(?<![${AR}])${source}(?![${AR}])`);

type Rule = {
  category: SafetyCategory;
  level: SafetyLevel;
  /** Applied to the text as typed. */
  patterns: RegExp[];
  /** Applied to Arabic-normalised text (no diacritics, unified letter forms, Western digits). */
  arPatterns: RegExp[];
  reply: Record<Lang, string>;
};

/**
 * Baseline keyword/pattern screening for English and Arabic. This is a first line of defence only: it will miss
 * paraphrases, spelling variants and dialects, and can produce false positives. Enable LLM_MODERATION=1 to add the
 * provider's moderation model on top. The Arabic lists were written without a native-speaker review and have not been
 * tested against real children's messages: they must be reviewed and extended before a school pilot.
 */
const RULES: Rule[] = [
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
    arPatterns: [
      arPhrase("(?:اقتل|اذبح|اوذي|اذي|اجرح|اضر|ااذي)\\s+(?:نفسي|حالي|ذاتي)"),
      arWord("انتحار|انتحر|انتحرت|اتنحر|ننتحر"),
      arPhrase("(?:اريد|ابي|ابغي|بدي|نفسي|ودي|اتمني|عايز|عاوز)\\s+(?:ان\\s+|لو\\s+)?(?:اموت|متت|انتحر|اختفي)"),
      arPhrase("(?:لا اريد|ما بدي|مش عايز|مش عاوز|مابدي|لا ابي|ما ابي|ما ابغي|لا ابغي)\\s+(?:ان\\s+)?(?:اعيش|احيا|اكمل حياتي|ابقي حي)"),
      arPhrase("(?:انهي|انهاء|اوقف|اخلص)\\s+حياتي"),
      arPhrase("(?:تعبت من الحياه|كرهت حياتي|كرهت نفسي واريد)"),
    ],
    reply: {
      en: "I'm really glad you told me. Those feelings are important, and you don't have to handle them alone. Please talk to a grown-up you trust right now, like a parent, a teacher, or a school counselor. If you are in danger, ask an adult to call your local emergency number.",
      ar: "أنا سعيد لأنك أخبرتني. مشاعرك مهمة، ولا يجب أن تتحمّلها وحدك. من فضلك تحدّث الآن مع شخص بالغ تثق به، مثل أحد والديك أو معلّمك أو مرشد المدرسة. وإذا كنت في خطر، اطلب من شخص بالغ الاتصال بالطوارئ فوراً.",
    },
  },
  {
    category: "sexual",
    level: "blocked",
    patterns: [/\b(porn\w*|nsfw|erotic|sexting|send\s+nudes?|have\s+sex)\b/i],
    arPatterns: [arWord("سكس|اباحي|اباحيه|نيك|قحبه|شرموطه|شرموط"), arPhrase("(?:صور|افلام|فيديوهات)\\s+(?:عاريه|اباحيه|جنسيه)")],
    reply: {
      en: "That's not something I can talk about. Let's explore something else! What would you like to learn today?",
      ar: "هذا ليس موضوعاً يمكنني الحديث عنه. لنستكشف شيئاً آخر! ماذا تحب أن تتعلّم اليوم؟",
    },
  },
  {
    category: "violence",
    level: "blocked",
    patterns: [/\bhow\s+(do\s+i|to|can\s+i)\s+(kill|murder|stab|shoot|poison)\b/i, /\bmake\s+(a\s+)?(bomb|weapon|gun)\b/i],
    arPatterns: [
      arPhrase("كيف\\s+(?:اصنع|اعمل|اسوي|اجهز|اركب)\\s+(?:قنبله|سلاح|مسدس|متفجرات|ديناميت|سم)"),
      arPhrase("كيف\\s+(?:اقتل|اذبح|اطعن|اسمم|اطلق\\s+النار\\s+علي|اخنق)"),
    ],
    reply: {
      en: "I can't help with hurting people or making weapons. Want to try a fun science experiment that's safe instead?",
      ar: "لا أستطيع المساعدة في إيذاء الآخرين أو صنع الأسلحة. هل تحب تجربة علمية ممتعة وآمنة بدلاً من ذلك؟",
    },
  },
  {
    category: "dangerous_activity",
    level: "blocked",
    patterns: [/\bhow\s+(do\s+i|to|can\s+i)\s+(buy|get|make)\s+(drugs|weed|cocaine|alcohol|vodka)\b/i],
    arPatterns: [arPhrase("كيف\\s+(?:اشتري|احصل\\s+علي|اصنع|اعمل|اجيب|اجرب)\\s+(?:مخدرات|حشيش|كوكايين|حبوب\\s+مخدره|كحول|خمر|ويسكي|سجاير|سجايي|شيشه|فيب)")],
    reply: {
      en: "That's not safe for me to help with. Let's pick another topic!",
      ar: "هذا ليس آمناً لأساعدك فيه. لنختر موضوعاً آخر!",
    },
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
    arPatterns: [
      /(?<!\d)(?:\+?962|00962|0)?7[789]\d{7}(?!\d)/, // Jordanian mobile numbers (Zain 77, Orange 78, Umniah 79)
      /\b\d{3}[\s.-]?\d{3}[\s.-]?\d{4}\b/,
      /[\w.+-]+@[\w-]+\.[\w.-]+/,
      arPhrase("(?:عنواني|اسكن في|اسكن ب|ساكن في|ساكنه في|بيتنا في|بيتي في|منزلنا في)"),
    ],
    reply: {
      en: "Let's keep personal details like phone numbers, emails, and addresses private. Please don't share them online. What else would you like to talk about?",
      ar: "لنُبقِ التفاصيل الشخصية مثل أرقام الهاتف والبريد الإلكتروني والعنوان سرّية. من فضلك لا تشاركها على الإنترنت. عن ماذا تحب أن نتحدث؟",
    },
  },
];

export function screenText(text: string, lang: Lang = "en"): SafetyVerdict {
  const normalized = normalizeArabic(text);
  // Evaluate in severity order: the first matching rule wins. Both languages are always checked, because children mix them.
  for (const rule of RULES) {
    if (rule.patterns.some(p => p.test(text)) || rule.arPatterns.some(p => p.test(normalized))) {
      return { level: rule.level, category: rule.category, reply: rule.reply[lang] };
    }
  }
  return { level: "safe" };
}

/** Optional provider-side moderation (OpenAI-compatible /moderations). Fails open to the heuristic result. */
export async function screenWithProvider(text: string, lang: Lang = "en"): Promise<SafetyVerdict> {
  const local = screenText(text, lang);
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
      return { level: selfHarm ? "review" : "blocked", category: rule.category, reply: rule.reply[lang] };
    }
  } catch (error) {
    console.warn("[Safety] Provider moderation unavailable, using local screening only:", String(error));
  }
  return local;
}

export const SAFE_FALLBACK_REPLY =
  "Hmm, I can't share that. Let's try a different question! What else are you curious about?";

export const safeFallbackReply = (lang: Lang) =>
  lang === "ar" ? "عذراً، لا أستطيع مشاركة ذلك. لنجرّب سؤالاً آخر! ما الذي تحب أن تعرفه؟" : SAFE_FALLBACK_REPLY;
