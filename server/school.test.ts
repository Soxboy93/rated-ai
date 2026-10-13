import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  getUser: vi.fn(), getUserByEmail: vi.fn(), createUser: vi.fn(), touchUserSignIn: vi.fn(),
  getActiveConsent: vi.fn(), createConsent: vi.fn(), revokeConsent: vi.fn(), logAudit: vi.fn(),
  getProfile: vi.fn(), listProfiles: vi.fn(), createProfile: vi.fn(), updateProfile: vi.fn(), countUserProfiles: vi.fn(),
  listClasses: vi.fn(), getClass: vi.fn(), createClass: vi.fn(), updateClass: vi.fn(), deleteClass: vi.fn(),
  countClassStudents: vi.fn(), listClassProfiles: vi.fn(),
  listAssignments: vi.fn(), getAssignment: vi.fn(), createAssignment: vi.fn(), archiveAssignment: vi.fn(), assignmentCompletions: vi.fn(),
  getStudentAggregates: vi.fn(),
  getChatSession: vi.fn(), createChatSession: vi.fn(), createChatMessage: vi.fn(), getSessionMessages: vi.fn(), updateSessionLastMessage: vi.fn(),
  getChildProgress: vi.fn(), listBadges: vi.fn(), getGameBreakdown: vi.fn(), getRecentPlays: vi.fn(), listMoodCheckins: vi.fn(),
  setUserLanguage: vi.fn(), listStudentLessons: vi.fn(),
}));
const llm = vi.hoisted(() => ({ invokeLLM: vi.fn() }));
vi.mock("./db", () => store);
vi.mock("./_core/llm", () => llm);

import { appRouter } from "./routers";
import { hashPassword, signUnlock } from "./_core/auth";
import { resetRateLimits } from "./_core/rateLimit";
import { consentVersionFor } from "@shared/consent";

const teacher = { id: "t1", email: "t@school.test", name: "T", role: "user" as const, accountType: "school" as const, loginMethod: "email", createdAt: null, lastSignedIn: null };
const parent = { ...teacher, id: "p1", accountType: "family" as const };
const myClass = { id: "c1", userId: "t1", name: "Grade 5A", grade: 5, createdAt: new Date() };

async function caller(user: typeof teacher | typeof parent | null = teacher, opts: { unlocked?: boolean } = {}) {
  const cookie = opts.unlocked && user ? `parent_unlock=${await signUnlock(user.id)}` : "";
  const res = { cookie: vi.fn(), clearCookie: vi.fn() };
  const ctx = { req: { headers: { cookie }, ip: "1.2.3.4", protocol: "http" }, res, user } as any;
  return { api: appRouter.createCaller(ctx), res };
}

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimits();
  store.getActiveConsent.mockResolvedValue({ id: "c", version: consentVersionFor("school") });
  store.getClass.mockResolvedValue(myClass);
  store.listClasses.mockResolvedValue([myClass]);
  store.listProfiles.mockResolvedValue([]);
  store.listClassProfiles.mockResolvedValue([]);
  store.listAssignments.mockResolvedValue([]);
  store.assignmentCompletions.mockResolvedValue(new Set());
  store.countUserProfiles.mockResolvedValue(0);
  store.countClassStudents.mockResolvedValue(0);
  store.getStudentAggregates.mockResolvedValue([]);
  store.listStudentLessons.mockResolvedValue([]);
});

describe("account types and consent", () => {
  it("registers a school account and stores the type and language", async () => {
    store.getUserByEmail.mockResolvedValue(undefined);
    store.getUser.mockImplementation(async (id: string) => ({ ...teacher, id, passwordHash: "x" }));
    const { api } = await caller(null);
    await api.auth.register({ email: "T@School.test", password: "correct horse", accountType: "school", language: "ar" });
    expect(store.createUser).toHaveBeenCalledWith(expect.objectContaining({ accountType: "school", language: "ar", email: "t@school.test" }));
  });

  it("requires the school wording: consent given for the family wording does not count", async () => {
    store.getActiveConsent.mockResolvedValue({ id: "c", version: consentVersionFor("family") });
    const { api } = await caller();
    expect((await api.consent.status()).granted).toBe(false);
    await expect(api.classes.create({ name: "5A", grade: 5 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("records school consent with the right version and a hash of the Arabic wording when read in Arabic", async () => {
    store.getActiveConsent.mockResolvedValue(null);
    const { api } = await caller();
    await api.consent.grant({ version: consentVersionFor("school"), language: "ar", confirmParent: true });
    const row = store.createConsent.mock.calls[0][0];
    expect(row).toMatchObject({ version: "2026-10-school-draft-1", language: "ar" });
    // a different language means different wording, so a different hash
    store.createConsent.mockClear();
    await api.consent.grant({ version: consentVersionFor("school"), language: "en", confirmParent: true });
    expect(store.createConsent.mock.calls[0][0].textSha256).not.toBe(row.textSha256);
  });

  it("rejects consent for the wrong wording version", async () => {
    store.getActiveConsent.mockResolvedValue(null);
    await expect((await caller()).api.consent.grant({ version: consentVersionFor("family"), language: "en", confirmParent: true })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("classes", () => {
  it("family accounts cannot use school features", async () => {
    store.getActiveConsent.mockResolvedValue({ id: "c", version: consentVersionFor("family") });
    const { api } = await caller(parent, { unlocked: true });
    await expect(api.classes.create({ name: "5A", grade: 5 })).rejects.toMatchObject({ code: "FORBIDDEN", message: /school accounts/ });
    await expect(api.classes.overview({ classId: "c1" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("creating a class needs the teacher PIN", async () => {
    await expect((await caller(teacher)).api.classes.create({ name: "5A", grade: 5 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await (await caller(teacher, { unlocked: true })).api.classes.create({ name: "Grade 5A", grade: 5 });
    expect(store.createClass).toHaveBeenCalledWith(expect.objectContaining({ userId: "t1", name: "Grade 5A", grade: 5 }));
  });

  it("limits classes per teacher and validates the grade", async () => {
    const { api } = await caller(teacher, { unlocked: true });
    await expect(api.classes.create({ name: "x", grade: 13 })).rejects.toThrow();
    store.listClasses.mockResolvedValue(Array.from({ length: 20 }, (_, i) => ({ ...myClass, id: `c${i}` })));
    await expect(api.classes.create({ name: "21st", grade: 5 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("cannot touch another teacher's class", async () => {
    store.getClass.mockResolvedValue({ ...myClass, userId: "someone-else" });
    const { api } = await caller(teacher, { unlocked: true });
    await expect(api.classes.overview({ classId: "c1" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(api.classes.delete({ classId: "c1" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(api.assignments.create({ classId: "c1", game: "math", level: 1 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(store.deleteClass).not.toHaveBeenCalled();
  });

  it("lists classes with student counts without needing the PIN (the picker uses it)", async () => {
    store.listProfiles.mockResolvedValue([{ id: "s1", classId: "c1" }, { id: "s2", classId: "c1" }, { id: "s3", classId: null }]);
    const out = await (await caller()).api.classes.list();
    expect(out).toEqual([{ id: "c1", name: "Grade 5A", grade: 5, studentCount: 2 }]);
  });

  it("builds the overview from the aggregates and flags students who need attention", async () => {
    store.listClassProfiles.mockResolvedValue([{ id: "s1", childName: "Lina", ageGroup: "tweens" }]);
    store.getStudentAggregates.mockResolvedValue([
      { profileId: "s1", childName: "Lina", ageGroup: "tweens", xp: 100, streakDays: 0, lastPlayDate: null, plays: { math: { plays: 3, correct: 6, total: 30 } }, lastPlayedAt: new Date(Date.now() - 10 * 86_400_000), flaggedMessages: 1, flaggedMoods: 0, lastMood: "sad", assignmentsDone: 0 },
    ]);
    const out = await (await caller(teacher, { unlocked: true })).api.classes.overview({ classId: "c1" });
    expect(out.summary).toMatchObject({ studentCount: 1, activeThisWeek: 0, attentionCount: 1 });
    expect(out.students[0].attention).toEqual(["inactive", "low_accuracy", "flagged"]);
    expect(out.students[0].accuracy).toBeCloseTo(0.2);
  });
});

describe("students and roster import", () => {
  it("adds a student to a class and takes the age group from the grade", async () => {
    await (await caller(teacher, { unlocked: true })).api.profiles.create({ childName: "Omar", classId: "c1" });
    expect(store.createProfile).toHaveBeenCalledWith(expect.objectContaining({ childName: "Omar", classId: "c1", ageGroup: "tweens" }));
  });

  it("imports a roster: skips duplicates, contact details and overlong names, and reports why", async () => {
    store.listClassProfiles.mockResolvedValue([{ childName: "Lina" }]);
    const out = await (await caller(teacher, { unlocked: true })).api.profiles.importRoster({
      classId: "c1",
      names: ["Omar", "  Sara  ", "lina", "call 0791234567", "", "x".repeat(60), "أحمد", "Omar"],
    });
    expect(out.created).toBe(3); // Omar, Sara, أحمد
    expect(out.skipped.map(s => s.reason).sort()).toEqual(["contact_details", "duplicate", "duplicate", "empty", "too_long"].sort());
    expect(store.createProfile).toHaveBeenCalledTimes(3);
    expect(store.createProfile.mock.calls.map(c => c[0].childName)).toEqual(["Omar", "Sara", "أحمد"]);
  });

  it("stops at the class size limit", async () => {
    store.listClassProfiles.mockResolvedValue(Array.from({ length: 59 }, (_, i) => ({ childName: `S${i}` })));
    const out = await (await caller(teacher, { unlocked: true })).api.profiles.importRoster({ classId: "c1", names: ["A", "B", "C"] });
    expect(out.created).toBe(1);
    expect(out.skipped.every(s => s.reason === "class_full")).toBe(true);
  });

  it("family accounts cannot import a roster", async () => {
    store.getActiveConsent.mockResolvedValue({ id: "c", version: consentVersionFor("family") });
    await expect((await caller(parent, { unlocked: true })).api.profiles.importRoster({ classId: "c1", names: ["A"] })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("assignments", () => {
  it("creates an activity and screens the note students will read", async () => {
    const { api } = await caller(teacher, { unlocked: true });
    await api.assignments.create({ classId: "c1", game: "math", level: 2, note: "Practise times tables", dueDate: "2026-11-01" });
    expect(store.createAssignment).toHaveBeenCalledWith(expect.objectContaining({ classId: "c1", game: "math", level: 2, dueDate: "2026-11-01" }));
    await expect(api.assignments.create({ classId: "c1", game: "math", level: 1, note: "call me on 0791234567" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(api.assignments.create({ classId: "c1", game: "chess" as any, level: 1 })).rejects.toThrow();
  });

  it("limits open activities per class", async () => {
    store.listAssignments.mockResolvedValue(Array.from({ length: 10 }, (_, i) => ({ id: `a${i}` })));
    await expect((await caller(teacher, { unlocked: true })).api.assignments.create({ classId: "c1", game: "quiz", level: 1 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("a student sees their class's activities and whether they are done", async () => {
    store.getProfile.mockResolvedValue({ id: "s1", userId: "t1", classId: "c1", childName: "Lina", ageGroup: "tweens" });
    store.getChildProgress.mockResolvedValue({ xp: 0, streakDays: 0, longestStreak: 0, lastPlayDate: null });
    store.listBadges.mockResolvedValue([]); store.getGameBreakdown.mockResolvedValue([]); store.getRecentPlays.mockResolvedValue([]); store.listMoodCheckins.mockResolvedValue([]);
    store.listAssignments.mockResolvedValue([{ id: "a1", game: "math", level: 1, note: "Times tables", dueDate: null, createdAt: new Date() }]);
    store.assignmentCompletions.mockResolvedValue(new Set(["s1"]));
    const out = await (await caller(teacher)).api.progress.get({ profileId: "s1" });
    expect(out.assignments).toEqual([{ id: "a1", game: "math", level: 1, note: "Times tables", dueDate: null, done: true }]);
  });

  it("archiving needs ownership", async () => {
    store.getAssignment.mockResolvedValue({ id: "a1", userId: "someone-else" });
    await expect((await caller(teacher, { unlocked: true })).api.assignments.archive({ assignmentId: "a1" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(store.archiveAssignment).not.toHaveBeenCalled();
  });
});

describe("Arabic chat", () => {
  const session = { id: "s1", userId: "t1", profileId: "p1", language: "ar", characterId: "sage", ageGroup: "tweens" };
  beforeEach(() => { store.getChatSession.mockResolvedValue(session); });

  it("tells the model to answer in Arabic", async () => {
    store.getSessionMessages.mockResolvedValue([{ role: "user", content: "لماذا السماء زرقاء؟", flagged: "safe" }]);
    llm.invokeLLM.mockResolvedValue({ choices: [{ message: { content: "لأن ضوء الشمس يتشتت." } }] });
    const out = await (await caller()).api.chat.sendMessage({ sessionId: "s1", message: "لماذا السماء زرقاء؟" });
    expect(out.message).toBe("لأن ضوء الشمس يتشتت.");
    expect(llm.invokeLLM.mock.calls[0][0].messages[0].content).toMatch(/Reply in Arabic only/);
  });

  it("answers a worrying Arabic message in Arabic without calling the model", async () => {
    const out = await (await caller()).api.chat.sendMessage({ sessionId: "s1", message: "بدي أموت" });
    expect(llm.invokeLLM).not.toHaveBeenCalled();
    expect(out.flagged).toBe("review");
    expect(out.message).toMatch(/شخص بالغ/);
  });

  it("replaces a blocked model reply with an Arabic fallback", async () => {
    store.getSessionMessages.mockResolvedValue([]);
    llm.invokeLLM.mockResolvedValue({ choices: [{ message: { content: "طبعاً، كيف أصنع قنبلة: ..." } }] });
    const out = await (await caller()).api.chat.sendMessage({ sessionId: "s1", message: "احكِ لي قصة" });
    expect(out.message).not.toMatch(/قنبلة/);
    expect(out.message).toMatch(/[؀-ۿ]/);
  });

  it("creates sessions in the chosen language and saves the account language", async () => {
    store.getProfile.mockResolvedValue({ id: "p1", userId: "t1", childName: "Lina", ageGroup: "tweens", selectedCharacter: null });
    const { api } = await caller();
    await api.chat.createSession({ profileId: "p1", language: "ar" });
    expect(store.createChatSession).toHaveBeenCalledWith(expect.objectContaining({ language: "ar" }));
    await api.auth.setLanguage({ language: "ar" });
    expect(store.setUserLanguage).toHaveBeenCalledWith("t1", "ar");
    await expect(api.auth.setLanguage({ language: "fr" as any })).rejects.toThrow();
  });
});
