import { describe, expect, it } from "vitest";
import { screenText } from "./safety";
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
