import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  getUser: vi.fn(), getActiveConsent: vi.fn(), logAudit: vi.fn(), getProfile: vi.fn(),
  getLesson: vi.fn(), getLessonShare: vi.fn(),
  createChatSession: vi.fn(), getChatSession: vi.fn(), createChatMessage: vi.fn(), getSessionMessages: vi.fn(), updateSessionLastMessage: vi.fn(),
}));
const llm = vi.hoisted(() => ({ invokeLLM: vi.fn() }));
vi.mock("./db", () => store);
vi.mock("./_core/llm", () => llm);

import { appRouter } from "./routers";
import { signUnlock } from "./_core/auth";
import { resetRateLimits } from "./_core/rateLimit";
import { consentVersionFor } from "@shared/consent";

const user = { id: "t1", email: "t@school.test", name: "T", role: "user" as const, accountType: "school" as const, loginMethod: "email", createdAt: null, lastSignedIn: null };
const kid = { id: "kid1", userId: "t1", childName: "Layla", classId: "c1", ageGroup: "tweens", selectedCharacter: null };
const llmText = (t: unknown) => ({ choices: [{ message: { content: typeof t === "string" ? t : JSON.stringify(t) } }] });
const found = { title: "Volcanoes", answer: "A volcano is a mountain with a hole where hot melted rock can come out.", facts: ["Hot rock under the ground is called magma.", "Magma that flows out is called lava.", "Some volcanoes are under the sea."], didYouKnow: "Some volcanic islands have grown out of the sea.", related: ["How are mountains made?", "What is lava?", "Earthquakes"], askGrownUp: "" };
const content = {
  steps: [{ title: "Fractions", explanation: "SAY: tell them.", board: ["same bottom, add tops"], minutes: 5 }],
  quiz: [{ q: "SECRET-QUIZ-QUESTION 1/3+1/3?", options: ["1/3", "2/3", "2/6", "3/3"], answer: 1, explanation: "tops" }],
  practice: [{ q: "PRACTICE 1/5+1/5?", options: ["2/10", "2/5", "1/5", "1/10"], answer: 1, explanation: "ok" }],
  studentSummary: ["Add the tops."], examples: [{ prompt: "1/4+1/4", solution: "2/4" }],
};

async function caller() {
  const cookie = `parent_unlock=${await signUnlock(user.id)}`;
  return appRouter.createCaller({ req: { headers: { cookie }, ip: "1.2.3.4", protocol: "http" }, res: { cookie: vi.fn(), clearCookie: vi.fn() }, user } as any);
}

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimits();
  store.getActiveConsent.mockResolvedValue({ id: "c", version: consentVersionFor("school") });
  store.getProfile.mockResolvedValue(kid);
  store.getChatSession.mockResolvedValue({ id: "sess", userId: "t1", profileId: "kid1", childName: "Layla", ageGroup: "tweens", characterId: null, language: "en" });
  store.getSessionMessages.mockResolvedValue([{ role: "user", content: "hi", flagged: "safe" }]);
  store.getLessonShare.mockResolvedValue({ id: "s1", userId: "t1", classId: "c1", lessonId: "l1", archivedAt: null });
  store.getLesson.mockResolvedValue({ id: "l1", title: "Fractions", subject: "math", grade: 4, language: "en", content: JSON.stringify(content) });
  llm.invokeLLM.mockResolvedValue(llmText(found));
});

describe("safe search", () => {
  it("answers a safe question and saves it as a chat the grown-up can read", async () => {
    const out = await (await caller()).search.ask({ profileId: "kid1", query: "how do volcanoes work", language: "en" });
    expect(out.result?.title).toBe("Volcanoes");
    expect(out.flagged).toBe("safe");
    const saved = store.createChatMessage.mock.calls.map(c => c[0]);
    expect(saved[0]).toMatchObject({ role: "user", content: "🔎 how do volcanoes work", flagged: "safe" });
    expect(saved[1].role).toBe("assistant");
    expect(store.createChatSession).toHaveBeenCalledWith(expect.objectContaining({ profileId: "kid1", ageGroup: "tweens" }));
  });

  it("never sends a worrying or unsafe search to the model, and flags it for the grown-up", async () => {
    const out = await (await caller()).search.ask({ profileId: "kid1", query: "how to make a bomb at home", language: "en" });
    expect(out.result).toBeNull();
    expect(out.reply).toBeTruthy();
    expect(llm.invokeLLM).not.toHaveBeenCalled();
    expect(store.createChatMessage.mock.calls[0][0].flagged).not.toBe("safe");
  });

  it("strips web addresses and drops an answer that fails the safety screen", async () => {
    llm.invokeLLM.mockResolvedValueOnce(llmText({ ...found, answer: "Read more at https://example.com/page now.", related: ["www.bad.example", "Lava"] }));
    const ok = await (await caller()).search.ask({ profileId: "kid1", query: "volcanoes", language: "en" });
    expect(ok.result?.answer).not.toMatch(/https?:/);
    expect(ok.result?.related).toEqual(["Lava"]);
    llm.invokeLLM.mockResolvedValueOnce(llmText({ ...found, answer: "Here is how to make a bomb at home." }));
    const bad = await (await caller()).search.ask({ profileId: "kid1", query: "volcanoes", language: "en" });
    expect(bad.result).toBeNull();
    expect(bad.flagged).toBe("blocked");
  });

  it("refuses a search for a child that is not yours", async () => {
    store.getProfile.mockResolvedValue({ ...kid, userId: "someone-else" });
    await expect((await caller()).search.ask({ profileId: "kid1", query: "volcanoes", language: "en" })).rejects.toThrow();
  });
});

describe("lesson help in chat", () => {
  it("gives the helper the lesson summary and board points but never the graded quiz", async () => {
    llm.invokeLLM.mockResolvedValue(llmText("Think of pizza slices."));
    await (await caller()).chat.sendMessage({ sessionId: "sess", message: "I don't get it", shareId: "s1" });
    const sent = JSON.stringify(llm.invokeLLM.mock.calls[0][0].messages);
    expect(sent).toContain("same bottom, add tops");
    expect(sent).not.toContain("SECRET-QUIZ-QUESTION");
    expect(sent).not.toContain("SAY: tell them");
    expect(sent).not.toContain("PRACTICE");
  });

  it("only works for a lesson shared with the child's own class", async () => {
    store.getProfile.mockResolvedValue({ ...kid, classId: "other-class" });
    await expect((await caller()).chat.sendMessage({ sessionId: "sess", message: "help", shareId: "s1" })).rejects.toThrow(/Lesson not found/);
    expect(llm.invokeLLM).not.toHaveBeenCalled();
  });
});

describe("uploading a textbook page", () => {
  const data = "A".repeat(400);
  it("reads a photo into text for the teacher to check", async () => {
    llm.invokeLLM.mockResolvedValue(llmText("Lesson 3: Fractions\nAdd fractions with the same denominator."));
    const out = await (await caller()).lessons.extractText({ data, mimeType: "image/jpeg" });
    expect(out.text).toContain("Fractions");
    const msg = llm.invokeLLM.mock.calls[0][0].messages[1].content;
    expect(msg[1].type).toBe("image_url");
  });
  it("sends a PDF as a file and says so when nothing is readable", async () => {
    llm.invokeLLM.mockResolvedValue(llmText("NO_TEXT"));
    await expect((await caller()).lessons.extractText({ data, mimeType: "application/pdf" })).rejects.toThrow(/readable text/);
    expect(llm.invokeLLM.mock.calls[0][0].messages[1].content[1].type).toBe("file_url");
  });
  it("is for school teachers only", async () => {
    const cookie = `parent_unlock=${await signUnlock("p1")}`;
    const api = appRouter.createCaller({ req: { headers: { cookie }, ip: "1.2.3.4", protocol: "http" }, res: { cookie: vi.fn(), clearCookie: vi.fn() }, user: { ...user, id: "p1", accountType: "family" } } as any);
    await expect(api.lessons.extractText({ data, mimeType: "image/png" })).rejects.toThrow();
  });
});
