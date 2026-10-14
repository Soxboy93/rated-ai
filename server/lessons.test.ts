import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  getUser: vi.fn(), getActiveConsent: vi.fn(), logAudit: vi.fn(), getProfile: vi.fn(),
  listClasses: vi.fn(), getClass: vi.fn(), listClassProfiles: vi.fn(),
  listLessons: vi.fn(), getLesson: vi.fn(), countLessons: vi.fn(), createLesson: vi.fn(), updateLesson: vi.fn(), deleteLesson: vi.fn(),
  createLessonShare: vi.fn(), getLessonShare: vi.fn(), listLessonShares: vi.fn(), archiveLessonShare: vi.fn(),
  listLessonResults: vi.fn(), getLessonResult: vi.fn(), insertLessonResult: vi.fn(), listStudentLessons: vi.fn(), recordPlay: vi.fn(),
}));
const llm = vi.hoisted(() => ({ invokeLLM: vi.fn() }));
vi.mock("./db", () => store);
vi.mock("./_core/llm", () => llm);

import { appRouter } from "./routers";
import { signUnlock } from "./_core/auth";
import { resetRateLimits } from "./_core/rateLimit";
import { consentVersionFor } from "@shared/consent";
import { LLMRefusalError } from "./_core/anthropic";

const teacher = { id: "t1", email: "t@school.test", name: "T", role: "user" as const, accountType: "school" as const, loginMethod: "email", createdAt: null, lastSignedIn: null };
const other = { ...teacher, id: "t2" };
const parent = { ...teacher, id: "p1", accountType: "family" as const };

const quiz = [
  { q: "1/3 + 1/3 = ?", options: ["1/3", "2/3", "2/6", "3/3"], answer: 1, explanation: "Add the tops." },
  { q: "2/7 + 3/7 = ?", options: ["5/14", "5/7", "6/7", "1/7"], answer: 1, explanation: "Same bottom." },
];
const practice = [{ q: "1/5 + 1/5 = ?", options: ["2/10", "2/5", "1/5", "1/10"], answer: 1, explanation: "Tops add, bottom stays." }];
const draft = { steps: [{ title: "Add", explanation: "SAY: add the tops slowly.", board: ["1/4+2/4=3/4"], minutes: 8 }], quiz, practice, studentSummary: ["Add the tops."], homework: "p.40" };
const llmJson = (o: unknown) => ({ choices: [{ message: { content: typeof o === "string" ? o : JSON.stringify(o) } }] });
const lessonRow = (over: Record<string, unknown> = {}) => ({ id: "l1", userId: "t1", title: "Fractions", subject: "math", grade: 4, language: "en", topic: "Fractions", durationMin: 45, sourceText: null, content: JSON.stringify(draft), updatedAt: new Date(), ...over });
const share = { id: "s1", userId: "t1", classId: "c1", lessonId: "l1", dueDate: null, archivedAt: null, createdAt: new Date() };
const student = { id: "kid1", userId: "t1", childName: "Layla", classId: "c1", ageGroup: "tweens", selectedCharacter: null };

async function caller(user: typeof teacher | typeof parent = teacher, unlocked = true) {
  const cookie = unlocked ? `parent_unlock=${await signUnlock(user.id)}` : "";
  const ctx = { req: { headers: { cookie }, ip: "1.2.3.4", protocol: "http" }, res: { cookie: vi.fn(), clearCookie: vi.fn() }, user } as any;
  return appRouter.createCaller(ctx);
}

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimits();
  store.getActiveConsent.mockResolvedValue({ id: "c", version: consentVersionFor("school") });
  store.getClass.mockResolvedValue({ id: "c1", userId: "t1", name: "4A", grade: 4 });
  store.listClasses.mockResolvedValue([{ id: "c1", userId: "t1", name: "4A", grade: 4 }]);
  store.countLessons.mockResolvedValue(0);
  store.listLessons.mockResolvedValue([]);
  store.listLessonShares.mockResolvedValue([]);
  store.getLesson.mockResolvedValue(lessonRow());
  store.getProfile.mockResolvedValue(student);
  store.getLessonShare.mockResolvedValue(share);
  store.getLessonResult.mockResolvedValue(undefined);
  store.insertLessonResult.mockResolvedValue(true);
  store.recordPlay.mockResolvedValue({ xpEarned: 125, xp: 125, leveledUp: false, streakDays: 1, longestStreak: 1, newBadges: ["first_play"] });
  llm.invokeLLM.mockResolvedValue(llmJson(draft));
});

const request = { subject: "math" as const, grade: 4, topic: "Adding fractions", durationMin: 45, language: "en" as const };

describe("lesson generation", () => {
  it("is for school accounts only", async () => {
    await expect((await caller(parent)).lessons.generate(request)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect((await caller(teacher, false)).lessons.generate(request)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("stores a normalised draft for the teacher and puts the textbook text in the prompt as data", async () => {
    const out = await (await caller()).lessons.generate({ ...request, sourceText: "Fractions have a numerator and a denominator. ".repeat(4) });
    expect(out.id).toBeTruthy();
    const saved = store.createLesson.mock.calls[0][0];
    expect(saved).toMatchObject({ userId: "t1", subject: "math", grade: 4, language: "en" });
    expect(JSON.parse(saved.content).quiz).toHaveLength(2);
    const messages = llm.invokeLLM.mock.calls[0][0].messages;
    expect(messages[0].content).toContain("ONLY as reference material");
    expect(messages[1].content).toContain("<source_text>");
  });

  it("refuses religious-education lessons without a textbook passage, so nothing is invented", async () => {
    await expect((await caller()).lessons.generate({ ...request, subject: "islamic" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(llm.invokeLLM).not.toHaveBeenCalled();
  });

  it("stores nothing when the model returns junk or an unsuitable quiz", async () => {
    llm.invokeLLM.mockResolvedValueOnce(llmJson("not json at all"));
    await expect((await caller()).lessons.generate(request)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    llm.invokeLLM.mockResolvedValueOnce(llmJson({ ...draft, studentSummary: ["how to make a bomb"] }));
    await expect((await caller()).lessons.generate(request)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(store.createLesson).not.toHaveBeenCalled();
  });

  it("shows a calm message when the model declines, and stores nothing", async () => {
    llm.invokeLLM.mockRejectedValueOnce(new LLMRefusalError("general_harms"));
    await expect((await caller()).lessons.generate(request)).rejects.toMatchObject({ code: "BAD_REQUEST", message: "The assistant can't help with that. Let's try something else." });
    expect(store.createLesson).not.toHaveBeenCalled();
  });

  it("rate-limits generation", async () => {
    const api = await caller();
    for (let i = 0; i < 12; i++) await api.lessons.generate(request);
    await expect(api.lessons.generate(request)).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });
});

describe("lesson ownership and editing", () => {
  it("hides other teachers' lessons", async () => {
    await expect((await caller(other)).lessons.get({ lessonId: "l1" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect((await caller(other)).lessons.delete({ lessonId: "l1" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(store.deleteLesson).not.toHaveBeenCalled();
  });

  it("re-validates hand edits: a broken quiz question is dropped, a lesson with no steps is refused", async () => {
    const api = await caller();
    await api.lessons.update({ lessonId: "l1", content: { ...draft, quiz: [...quiz, { q: "bad", options: ["a", "a", "b", "c"], answer: 0 }] } });
    expect(JSON.parse(store.updateLesson.mock.calls[0][1].content).quiz).toHaveLength(2);
    await expect(api.lessons.update({ lessonId: "l1", content: { steps: [] } })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("revises with the teacher's instruction and keeps it as data in the user message", async () => {
    await (await caller()).lessons.revise({ lessonId: "l1", instruction: "Make it easier" });
    const messages = llm.invokeLLM.mock.calls[0][0].messages;
    expect(messages[1].content).toContain("Make it easier");
    expect(store.updateLesson).toHaveBeenCalled();
  });
});

describe("sharing with a class", () => {
  it("needs a quiz, an owned class, and no duplicate share", async () => {
    const api = await caller();
    await api.lessons.share({ lessonId: "l1", classId: "c1" });
    expect(store.createLessonShare).toHaveBeenCalledWith(expect.objectContaining({ userId: "t1", classId: "c1", lessonId: "l1" }));
    store.listLessonShares.mockResolvedValue([share]);
    await expect(api.lessons.share({ lessonId: "l1", classId: "c1" })).rejects.toMatchObject({ code: "CONFLICT" });
    store.listLessonShares.mockResolvedValue([]);
    store.getLesson.mockResolvedValue(lessonRow({ content: JSON.stringify({ ...draft, quiz: [] }) }));
    await expect(api.lessons.share({ lessonId: "l1", classId: "c1" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    store.getClass.mockResolvedValue({ id: "c9", userId: "someone-else", name: "X", grade: 4 });
    store.getLesson.mockResolvedValue(lessonRow());
    await expect(api.lessons.share({ lessonId: "l1", classId: "c9" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("students taking a shared lesson", () => {
  it("shows the graded quiz without answers, learn cards from the board, and the practice game with answers, never the teacher script", async () => {
    const out = await (await caller()).studentLessons.get({ profileId: "kid1", shareId: "s1" });
    expect(out.quiz).toHaveLength(2);
    expect(out.quiz.every(q => !("answer" in q) && !("explanation" in q))).toBe(true);
    expect(out.cards).toEqual([{ title: "Add", points: ["1/4+2/4=3/4"] }]);
    expect(out.practice).toHaveLength(1);
    expect(out.practice[0].answer).toBe(1);
    expect(JSON.stringify(out)).not.toContain("SAY:"); // the teacher's script
  });

  it("is only available to students of that class, and not once archived", async () => {
    const api = await caller();
    store.getProfile.mockResolvedValue({ ...student, classId: "c2" });
    await expect(api.studentLessons.get({ profileId: "kid1", shareId: "s1" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    store.getProfile.mockResolvedValue(student);
    store.getLessonShare.mockResolvedValue({ ...share, archivedAt: new Date() });
    await expect(api.studentLessons.get({ profileId: "kid1", shareId: "s1" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("grades on the server, awards XP once, and returns the right answers only after submitting", async () => {
    const out = await (await caller()).studentLessons.submit({ profileId: "kid1", shareId: "s1", answers: [1, 0], durationMs: 20000 });
    expect(out).toMatchObject({ already: false, correct: 1, total: 2, xpEarned: 125 });
    expect(out.review[1]).toMatchObject({ correctAnswer: 1, right: false });
    expect(store.insertLessonResult).toHaveBeenCalledWith(expect.objectContaining({ correct: 1, total: 2, answers: "[1,0]" }));
    expect(store.recordPlay).toHaveBeenCalledWith(expect.objectContaining({ game: "quiz", correct: 1, total: 2 }));
  });

  it("counts only the first attempt: a repeat gives no XP and keeps the first score", async () => {
    store.insertLessonResult.mockResolvedValue(false);
    store.getLessonResult.mockResolvedValue({ correct: 1, total: 2 });
    const out = await (await caller()).studentLessons.submit({ profileId: "kid1", shareId: "s1", answers: [1, 1], durationMs: 20000 });
    expect(out).toMatchObject({ already: true, correct: 1, total: 2, xpEarned: 0 });
    expect(store.recordPlay).not.toHaveBeenCalled();
  });

  it("rejects wrong-length answers and impossibly fast submissions", async () => {
    const api = await caller();
    await expect(api.studentLessons.submit({ profileId: "kid1", shareId: "s1", answers: [1], durationMs: 20000 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(api.studentLessons.submit({ profileId: "kid1", shareId: "s1", answers: [1, 1], durationMs: 10 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(store.insertLessonResult).not.toHaveBeenCalled();
  });
});

describe("class results for the teacher", () => {
  it("reports percent right per question and who has not done it", async () => {
    store.listClassProfiles.mockResolvedValue([student, { ...student, id: "kid2", childName: "Omar" }, { ...student, id: "kid3", childName: "Sara" }]);
    store.listLessonResults.mockResolvedValue([
      { profileId: "kid1", answers: "[1,1]" },
      { profileId: "kid2", answers: "[1,0]" },
    ]);
    const out = await (await caller()).lessons.results({ shareId: "s1" });
    expect(out).toMatchObject({ studentCount: 3, doneCount: 2 });
    expect(out.questions.map(q => q.percentCorrect)).toEqual([100, 50]);
    expect(out.students.find(s => s.childName === "Sara")?.correct).toBeNull();
    expect(out.students.find(s => s.childName === "Omar")?.correct).toBe(1);
    await expect((await caller(other)).lessons.results({ shareId: "s1" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
