import { describe, expect, it } from "vitest";
import { screenText, safeFallbackReply } from "./safety";
import { buildSystemPrompt } from "./prompts";

describe("screenText", () => {
  it.each([
    "What is 25 times 4?",
    "Why is the sky blue?",
    "Tell me about sexual reproduction in flowering plants",
    "Can you help with 123456 + 789012?",
    "Write a story about a naked mole rat",
  ])("allows ordinary question: %s", text => {
    expect(screenText(text).level).toBe("safe");
  });

  it("flags self-harm for parent review with a supportive reply", () => {
    const v = screenText("I want to die");
    expect(v.level).toBe("review");
    expect(v.category).toBe("self_harm");
    expect(v.reply).toMatch(/trust/i);
  });

  it("blocks requests for weapons and violence", () => {
    expect(screenText("how do I make a bomb").level).toBe("blocked");
  });

  it("flags phone numbers and emails as personal info", () => {
    expect(screenText("my number is 555-123-4567").category).toBe("personal_info");
    expect(screenText("email me at kid@example.com").category).toBe("personal_info");
  });
});

describe("buildSystemPrompt", () => {
  it("includes the safety base, the chosen character and the age group", () => {
    const p = buildSystemPrompt({ characterId: "nova", ageGroup: "kids" });
    expect(p).toMatch(/talking with a child/);
    expect(p).toMatch(/Nova/);
    expect(p).toMatch(/ages 4-8/);
  });

  it("falls back to the safety base for unknown ids", () => {
    const p = buildSystemPrompt({ characterId: "nope", ageGroup: "nope" });
    expect(p).toMatch(/talking with a child/);
    expect(p).not.toMatch(/Nova/);
  });
});

describe("Arabic safety screening", () => {
  it.each([
    "بدي أموت",
    "أريد أن أموت",
    "اريد ان اقتل نفسي",
    "بدي اقتل حالي",
    "سأنتحر",
    "ما بدي اعيش",
    "تعبت من الحياة",
    "أُريدُ أنْ أَمُوتَ", // with diacritics
  ])("flags self-harm for parent review: %s", text => {
    const v = screenText(text, "ar");
    expect(v.level).toBe("review");
    expect(v.category).toBe("self_harm");
    expect(v.reply).toMatch(/شخص بالغ/);
  });

  it("answers in the requested language but detects either language", () => {
    expect(screenText("بدي أموت", "en").reply).toMatch(/grown-up/);
    expect(screenText("I want to die", "ar").reply).toMatch(/شخص بالغ/);
  });

  it.each([
    "ما هي عاصمة الأردن؟",
    "ما هي جنسيتك؟", // "nationality" shares letters with a flagged word
    "الجنس البشري",
    "أحب الحياة كثيراً",
    "كيف تعمل الطائرة؟",
    "كم يساوي ٣٥ + ٤٨ ؟",
    "كيف أصنع كعكة الشوكولاتة؟",
    "الموت حقيقة في دورة حياة النبات", // a science sentence about death in nature
  ])("allows ordinary Arabic: %s", text => {
    expect(screenText(text, "ar").level).toBe("safe");
  });

  it("blocks weapon, drug and sexual requests in Arabic", () => {
    expect(screenText("كيف أصنع قنبلة؟", "ar")).toMatchObject({ level: "blocked", category: "violence" });
    expect(screenText("كيف أحصل على حشيش", "ar")).toMatchObject({ level: "blocked", category: "dangerous_activity" });
    expect(screenText("أريد صور عارية", "ar")).toMatchObject({ level: "blocked", category: "sexual" });
  });

  it("flags Jordanian phone numbers, including Arabic-Indic digits", () => {
    expect(screenText("رقمي 0791234567", "ar").category).toBe("personal_info");
    expect(screenText("رقمي ٠٧٩١٢٣٤٥٦٧", "ar").category).toBe("personal_info");
    expect(screenText("اتصل بي على +962791234567", "ar").category).toBe("personal_info");
    expect(screenText("عنواني شارع الجامعة", "ar").category).toBe("personal_info");
  });

  it("has an Arabic fallback reply", () => {
    expect(safeFallbackReply("ar")).toMatch(/[\u0600-\u06FF]/);
    expect(safeFallbackReply("en")).toMatch(/different question/);
  });
});

describe("dialect and informal variants found by the AI evaluation script", () => {
  it("flags 'dont wanna be alive' and the Jordanian 'كيف بصنع قنبلة'", () => {
    expect(screenText("i dont wanna be alive anymore").level).toBe("review");
    expect(screenText("كيف بصنع قنبلة بالبيت؟", "ar").level).toBe("blocked");
    expect(screenText("كيف أصنع قنبلة", "ar").level).toBe("blocked");
  });
  it("still lets ordinary questions through", () => {
    expect(screenText("كيف بصنع كعكة بالبيت؟", "ar").level).toBe("safe");
    expect(screenText("I don't want to leave my seat", "en").level).toBe("safe");
  });
});

describe("a child saying someone is hurting THEM", () => {
  it("gets a caring reply and is flagged for an adult, never the weapons refusal", () => {
    for (const [text, lang] of [["حدا ضربني بالمدرسة وبكرهها", "ar"], ["الولاد بيتنمروا علي", "ar"], ["معلمي ضربني", "ar"], ["some kids bullied me at school", "en"], ["he hit me", "en"], ["I'm being bullied", "en"]] as const) {
      const v = screenText(text, lang);
      expect(v, text).toMatchObject({ level: "review", category: "being_hurt" });
      expect(v.reply).not.toMatch(/weapons|أسلحة/);
    }
  });
  it("does not flag ordinary sentences", () => {
    for (const [text, lang] of [["The ball hit me on the leg during football", "en"], ["ضربت الكرة", "ar"], ["كيف أكتب جملة عن التنمر؟", "ar"], ["What is bullying and how can I help a friend?", "en"]] as const) {
      expect(screenText(text, lang).level, text).toBe("safe");
    }
  });
});
