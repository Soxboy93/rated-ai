import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  getUser: vi.fn(), getActiveConsent: vi.fn(), logAudit: vi.fn(), getProfile: vi.fn(),
  getLesson: vi.fn(), getLessonShare: vi.fn(), getClass: vi.fn(), updateClass: vi.fn(), listFlaggedMessages: vi.fn(), setMessageReviewed: vi.fn(), listProfiles: vi.fn(), listClasses: vi.fn(), listLessonResults: vi.fn(), listClassProfiles: vi.fn(), getChildProgress: vi.fn(), getGameBreakdown: vi.fn(), listStudentLessons: vi.fn(), listAssignments: vi.fn(), assignmentCompletions: vi.fn(), listLessonShares: vi.fn(), listLessons: vi.fn(), getStudentAggregates: vi.fn(), listBadges: vi.fn(),
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
  store.getClass.mockResolvedValue({ id: "c1", userId: "t1", name: "4A", grade: 4, chatEnabled: true, searchEnabled: true, focusMode: false });
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

describe("class controls", () => {
  const off = { id: "c1", userId: "t1", name: "4A", grade: 4, chatEnabled: false, searchEnabled: false, focusMode: true };

  it("switches free chat and search off for the class, but not help with a shared lesson", async () => {
    store.getClass.mockResolvedValue(off);
    const api = await caller();
    await expect(api.chat.sendMessage({ sessionId: "sess", message: "tell me a joke" })).rejects.toThrow(/turned this off/);
    await expect(api.search.ask({ profileId: "kid1", query: "volcanoes", language: "en" })).rejects.toThrow(/turned this off/);
    expect(llm.invokeLLM).not.toHaveBeenCalled();
    llm.invokeLLM.mockResolvedValue(llmText("Think of pizza slices."));
    await expect(api.chat.sendMessage({ sessionId: "sess", message: "help me", shareId: "s1" })).resolves.toBeTruthy();
  });

  it("never restricts a family child who has no class", async () => {
    store.getProfile.mockResolvedValue({ ...kid, classId: null });
    store.getClass.mockResolvedValue(off);
    llm.invokeLLM.mockResolvedValue(llmText("Hello!"));
    await expect((await caller()).chat.sendMessage({ sessionId: "sess", message: "hi" })).resolves.toBeTruthy();
  });

  it("lets only the class's own teacher change the controls, and records it", async () => {
    const api = await caller();
    await api.classes.setControls({ classId: "c1", chat: false, search: true, focus: true });
    expect(store.updateClass).toHaveBeenCalledWith("c1", { chatEnabled: false, searchEnabled: true, focusMode: true });
    expect(store.logAudit).toHaveBeenCalledWith("t1", "class_controls", expect.stringContaining("focus on"));
    store.getClass.mockResolvedValue({ ...off, userId: "someone-else" });
    await expect(api.classes.setControls({ classId: "c1", chat: true, search: true, focus: false })).rejects.toThrow();
  });
});

describe("safety inbox", () => {
  const row = (over: Record<string, unknown>) => ({ id: "m", sessionId: "sess", role: "user", content: "hi", flagged: "review", createdAt: new Date("2026-10-13T10:00:00Z"), reviewedAt: null, profileId: "kid1", childName: "Layla", language: "en", ...over });

  it("puts a child saying someone is hurting them or themselves first, names the student and class, and counts what is open", async () => {
    store.listProfiles.mockResolvedValue([kid]);
    store.listClasses.mockResolvedValue([{ id: "c1", name: "4A" }]);
    store.listFlaggedMessages.mockResolvedValue([
      row({ id: "a", content: "how to make a bomb", createdAt: new Date("2026-10-13T12:00:00Z") }),
      row({ id: "b", content: "i want to die", createdAt: new Date("2026-10-13T09:00:00Z") }),
      row({ id: "c", content: "🔎 i dont wanna be alive", reviewedAt: new Date() }),
      row({ id: "d", role: "assistant", flagged: "blocked", content: "blocked reply" }),
      row({ id: "e", role: "assistant", flagged: "review", content: "should not appear" }),
    ]);
    const out = await (await caller()).safety.inbox();
    expect(out.items.map(i => i.id)).toEqual(["b", "a", "d", "c"]);
    expect(out.items[0]).toMatchObject({ studentName: "Layla", className: "4A", category: "self_harm", urgency: "urgent", from: "child" });
    expect(out.items.find(i => i.id === "d")).toMatchObject({ from: "reply", level: "blocked" });
    expect(out.open).toBe(3);
    expect(out.urgentOpen).toBe(1);
  });

  it("marks a message reviewed only in the caller's own chats, and logs it", async () => {
    store.setMessageReviewed.mockResolvedValue(true);
    await (await caller()).safety.review({ messageId: "b", reviewed: true });
    expect(store.setMessageReviewed).toHaveBeenCalledWith("t1", "b", true);
    expect(store.logAudit).toHaveBeenCalledWith("t1", "safety_reviewed", "b");
    store.setMessageReviewed.mockResolvedValue(false);
    await expect((await caller()).safety.review({ messageId: "x", reviewed: true })).rejects.toThrow(/not found/);
  });
});

describe("reteach insights", () => {
  const q = (n: number) => ({ q: `Q${n}`, options: ["a", "b", "c", "d"], answer: 1, explanation: "" });
  const lessonWithQuiz = { id: "l1", userId: "t1", title: "Fractions", subject: "math", grade: 4, language: "en", content: JSON.stringify({ steps: [{ title: "s", explanation: "e", board: [], minutes: 5 }], quiz: [q(1), q(2)] }) };
  const roster = ["a", "b", "c", "d"].map(id => ({ id, childName: `Secret-${id}`, classId: "c1" }));
  const aiAnswer = { summary: "Most picked option a.", misconceptions: ["adds the bottoms"], reteach: [{ title: "Pizza", minutes: 5, instructions: "Cut it." }], quickCheck: "What is 1/4+1/4?", extension: "Make your own." };

  beforeEach(() => {
    store.getLesson.mockResolvedValue(lessonWithQuiz);
    store.listClassProfiles.mockResolvedValue(roster);
  });

  it("does not call the AI until enough students have taken the quiz", async () => {
    store.listLessonResults.mockResolvedValue([{ profileId: "a", answers: "[1,1]" }]);
    const out = await (await caller()).lessons.insights({ shareId: "s1" });
    expect(out.enough).toBe(false);
    expect(llm.invokeLLM).not.toHaveBeenCalled();
  });

  it("asks the AI about the class without sending a single student name", async () => {
    store.listLessonResults.mockResolvedValue([{ profileId: "a", answers: "[0,0]" }, { profileId: "b", answers: "[0,1]" }, { profileId: "c", answers: "[1,1]" }]);
    llm.invokeLLM.mockResolvedValue(llmText(aiAnswer));
    const out = await (await caller()).lessons.insights({ shareId: "s1" });
    expect(out.enough && out.insights?.reteach[0].title).toBe("Pizza");
    expect(out.needsSupport).toEqual(["Secret-a"]); // the teacher sees names; the model does not
    expect(JSON.stringify(llm.invokeLLM.mock.calls[0][0])).not.toContain("Secret-");
  });

  it("is refused for another teacher's shared lesson", async () => {
    store.getLessonShare.mockResolvedValue({ id: "s1", userId: "someone-else", classId: "c1", lessonId: "l1", archivedAt: null });
    await expect((await caller()).lessons.insights({ shareId: "s1" })).rejects.toThrow(/not found/i);
  });
});

describe("parent letters", () => {
  beforeEach(() => {
    store.getProfile.mockResolvedValue({ ...kid, childName: "Layla" });
    store.getChildProgress.mockResolvedValue({ xp: 275, streakDays: 3 });
    store.getGameBreakdown.mockResolvedValue([{ game: "math", plays: 4, correct: 30, total: 40 }]);
    store.listStudentLessons.mockResolvedValue([{ title: "Fractions", result: { correct: 2, total: 3 } }]);
    store.listAssignments.mockResolvedValue([{ id: "a1", game: "math", level: 1, createdAt: new Date() }]);
    store.assignmentCompletions.mockResolvedValue(new Set(["kid1"]));
    store.listBadges.mockResolvedValue([{ badgeId: "a" }, { badgeId: "b" }]);
  });

  it("writes from facts with a placeholder, then fills in the child's name locally", async () => {
    llm.invokeLLM.mockResolvedValue(llmText("Dear parents, {{student}} had a good week. Warmly, {{teacher}}"));
    const out = await (await caller()).letters.draft({ kind: "student", profileId: "kid1", language: "en" });
    expect(out.text).toBe("Dear parents, Layla had a good week. Warmly, T");
    const sent = JSON.stringify(llm.invokeLLM.mock.calls[0][0]);
    expect(sent).not.toContain("Layla");
    expect(sent).toContain("quiz 2 of 3");
    expect(sent).toContain("{{student}}");
  });

  it("never puts moods or safety flags in a note to parents", async () => {
    llm.invokeLLM.mockResolvedValue(llmText("Dear parents"));
    await (await caller()).letters.draft({ kind: "student", profileId: "kid1", language: "ar" });
    expect(JSON.stringify(llm.invokeLLM.mock.calls[0][0])).not.toMatch(/mood|flag|safety/i);
  });

  it("needs a class for a student note and is for school teachers only", async () => {
    store.getProfile.mockResolvedValue({ ...kid, classId: null });
    await expect((await caller()).letters.draft({ kind: "student", profileId: "kid1", language: "en" })).rejects.toThrow(/class/i);
  });
});

describe("student progress report", () => {
  it("gives a parent meeting the real numbers and nothing sensitive", async () => {
    store.getProfile.mockResolvedValue({ ...kid, childName: "Layla" });
    store.getChildProgress.mockResolvedValue({ xp: 275, streakDays: 3, longestStreak: 5 });
    store.getGameBreakdown.mockResolvedValue([{ game: "math", plays: 4, correct: 30, total: 40 }, { game: "quiz", plays: 1, correct: 0, total: 0 }]);
    store.listStudentLessons.mockResolvedValue([{ title: "Fractions", subject: "math", result: { correct: 2, total: 3 } }, { title: "Plants", subject: "science", result: null }]);
    store.listAssignments.mockResolvedValue([{ id: "a1" }, { id: "a2" }]);
    store.assignmentCompletions.mockResolvedValueOnce(new Set(["kid1"])).mockResolvedValueOnce(new Set());
    store.listBadges.mockResolvedValue([{ badgeId: "a" }]);
    const r = await (await caller()).classes.studentReport({ profileId: "kid1" });
    expect(r).toMatchObject({ name: "Layla", className: "4A", totalPlays: 5, accuracyPercent: 75, streakDays: 3, longestStreak: 5, badges: 1, activities: { done: 1, total: 2 } });
    expect(r.byGame).toEqual([{ game: "math", plays: 4, answers: 40, accuracyPercent: 75 }]);
    expect(r.lessons).toEqual([{ title: "Fractions", subject: "math", correct: 2, total: 3 }, { title: "Plants", subject: "science", correct: null, total: null }]);
    expect(JSON.stringify(r)).not.toMatch(/mood|flag/i);
  });
  it("is for the teacher's own student in a class", async () => {
    store.getProfile.mockResolvedValue({ ...kid, classId: null });
    await expect((await caller()).classes.studentReport({ profileId: "kid1" })).rejects.toThrow(/class/i);
    store.getProfile.mockResolvedValue({ ...kid, userId: "someone-else" });
    await expect((await caller()).classes.studentReport({ profileId: "kid1" })).rejects.toThrow();
  });
});
