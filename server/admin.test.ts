import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  getUser: vi.fn(), getUserByEmail: vi.fn(), createUser: vi.fn(), touchUserSignIn: vi.fn(), logAudit: vi.fn(), getActiveConsent: vi.fn(),
  adminOverview: vi.fn(), adminListAccounts: vi.fn(), adminSearchStudents: vi.fn(), adminListActions: vi.fn(),
  listClasses: vi.fn(), listProfiles: vi.fn(), listLessons: vi.fn(), listAuditEvents: vi.fn(), getStudentAggregates: vi.fn(),
  getProfile: vi.fn(), getClass: vi.fn(), getProfileChats: vi.fn(), getChildProgress: vi.fn(), listBadges: vi.fn(), getGameBreakdown: vi.fn(), getRecentPlays: vi.fn(), listMoodCheckins: vi.fn(), listAssignments: vi.fn(), listStudentLessons: vi.fn(),
  setUserSuspended: vi.fn(), setUserPasswordHash: vi.fn(), clearParentalPin: vi.fn(), deleteAllUserData: vi.fn(),
}));
vi.mock("./db", () => store);

import { COOKIE_NAME } from "@shared/const";
import { appRouter } from "./routers";
import { authenticateRequest, hashPassword, signSession, signUnlock } from "./_core/auth";
import { resetRateLimits } from "./_core/rateLimit";

const admin = { id: "a1", email: "boss@rated.test", name: "Boss", role: "admin" as const, accountType: "school" as const, loginMethod: "email", language: null, createdAt: null, lastSignedIn: null, suspendedAt: null, suspendedReason: null };
const teacher = { ...admin, id: "t1", email: "teacher@school.test", name: "T", role: "user" as const };
const parent = { ...teacher, id: "p1", email: "parent@home.test", accountType: "family" as const };

async function caller(user: typeof admin | typeof teacher | null, unlocked = true) {
  const cookie = user && unlocked ? `parent_unlock=${await signUnlock(user.id)}` : "";
  return appRouter.createCaller({ req: { headers: { cookie }, ip: "1.2.3.4", protocol: "http" }, res: { cookie: vi.fn(), clearCookie: vi.fn() }, user } as any);
}

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimits();
  store.getUser.mockImplementation(async (id: string) => ({ a1: admin, t1: { ...teacher, passwordHash: "SECRET-HASH" }, p1: { ...parent, passwordHash: "SECRET-HASH" }, a2: { ...admin, id: "a2", email: "other@rated.test" } } as any)[id]);
  store.listClasses.mockResolvedValue([{ id: "c1", name: "4A", grade: 4, chatEnabled: true, searchEnabled: false, focusMode: false }]);
  store.listProfiles.mockResolvedValue([{ id: "kid1", childName: "Layla", ageGroup: "tweens", classId: "c1", userId: "t1" }]);
  store.listLessons.mockResolvedValue([{ id: "l1", title: "Fractions", subject: "math", grade: 4, updatedAt: new Date() }]);
  store.listAuditEvents.mockResolvedValue([]);
  store.getActiveConsent.mockResolvedValue({ version: "v1", language: "ar", grantedAt: new Date() });
  store.getStudentAggregates.mockResolvedValue([{ profileId: "kid1", xp: 120, lastPlayedAt: null, flaggedMessages: 1 }]);
  store.getProfile.mockResolvedValue({ id: "kid1", userId: "t1", childName: "Layla", ageGroup: "tweens", classId: "c1" });
  store.getClass.mockResolvedValue({ id: "c1", name: "4A", grade: 4 });
  store.getProfileChats.mockResolvedValue([{ id: "s", messages: [{ id: "m", role: "user", content: "hello" }] }]);
  store.getChildProgress.mockResolvedValue({ xp: 120, streakDays: 1, longestStreak: 2 });
  for (const f of [store.listBadges, store.getGameBreakdown, store.getRecentPlays, store.listMoodCheckins, store.listAssignments, store.listStudentLessons]) f.mockResolvedValue([]);
});

describe("who can use the admin console", () => {
  it("refuses everyone who is not an administrator, even with a PIN unlock", async () => {
    await expect((await caller(teacher)).admin.overview()).rejects.toThrow(/permission/);
    await expect((await caller(null)).admin.overview()).rejects.toThrow();
  });

  it("also needs the PIN unlock, so a stolen session cookie alone is not enough", async () => {
    await expect((await caller(admin, false)).admin.overview()).rejects.toThrow(/locked/i);
    store.adminOverview.mockResolvedValue({ students: 3 });
    await expect((await caller(admin)).admin.overview()).resolves.toEqual({ students: 3 });
  });

  it("is not granted by signing up with an administrator's email", async () => {
    store.getUserByEmail.mockResolvedValue(undefined);
    store.getUser.mockResolvedValueOnce({ ...parent, id: "new" });
    const api = await caller(null);
    await api.auth.register({ email: "boss@rated.test", password: "long enough pw", accountType: "family", language: "en" }).catch(() => {});
    const row = store.createUser.mock.calls[0]?.[0];
    expect(row?.role).toBeUndefined();
  });
});

describe("suspended accounts", () => {
  it("cannot sign in, and an existing session stops working at once", async () => {
    store.getUserByEmail.mockResolvedValue({ ...teacher, passwordHash: await hashPassword("correct horse battery"), suspendedAt: new Date() });
    await expect((await caller(null)).auth.login({ email: "teacher@school.test", password: "correct horse battery" })).rejects.toThrow(/suspended/);
    store.getUser.mockResolvedValue({ ...teacher });
    expect(await authenticateRequest({ headers: { cookie: `${COOKIE_NAME}=${await signSession("t1")}` } } as any)).not.toBeNull();
    store.getUser.mockResolvedValue({ ...teacher, suspendedAt: new Date() });
    const req = { headers: { cookie: `${COOKIE_NAME}=${await signSession("t1")}` } } as any;
    expect(await authenticateRequest(req)).toBeNull();
    store.getUser.mockResolvedValue({ ...admin, suspendedAt: new Date() });
    expect(await authenticateRequest({ headers: { cookie: `${COOKIE_NAME}=${await signSession("a1")}` } } as any)).not.toBeNull(); // an admin cannot lock themselves out
  });
});

describe("looking at accounts and students", () => {
  it("shows an account without its password hash, and records the look on both sides", async () => {
    const out = await (await caller(admin)).admin.account({ userId: "t1" });
    expect(JSON.stringify(out)).not.toContain("SECRET-HASH");
    expect(out.students[0]).toMatchObject({ childName: "Layla", xp: 120 });
    expect(out.classes[0]).toMatchObject({ search: false });
    expect(store.logAudit).toHaveBeenCalledWith("a1", "admin_viewed_account", "teacher@school.test");
    expect(store.logAudit).toHaveBeenCalledWith("t1", "support_viewed_account", "by boss@rated.test");
  });

  it("logs reading a child's conversations as its own event", async () => {
    const api = await caller(admin);
    await api.admin.student({ profileId: "kid1" });
    expect(store.logAudit).toHaveBeenCalledWith("t1", "support_viewed_student", "by boss@rated.test: Layla");
    expect(store.getProfileChats).not.toHaveBeenCalled();
    const chats = await api.admin.studentChats({ profileId: "kid1" });
    expect(chats[0].messages[0].content).toBe("hello");
    expect(store.logAudit).toHaveBeenCalledWith("t1", "support_read_chats", "by boss@rated.test: Layla");
  });
});

describe("managing accounts", () => {
  it("suspends and reactivates, with a reason, and logs it", async () => {
    const api = await caller(admin);
    await api.admin.suspend({ userId: "t1", suspended: true, reason: "Asked to close" });
    expect(store.setUserSuspended).toHaveBeenCalledWith("t1", true, "Asked to close");
    await api.admin.suspend({ userId: "t1", suspended: false });
    expect(store.setUserSuspended).toHaveBeenLastCalledWith("t1", false, null);
    expect(store.logAudit).toHaveBeenCalledWith("t1", "support_suspended", "by boss@rated.test: Asked to close");
  });

  it("cannot change an administrator, including itself", async () => {
    const api = await caller(admin);
    await expect(api.admin.suspend({ userId: "a1", suspended: true })).rejects.toThrow(/Administrator accounts/);
    await expect(api.admin.suspend({ userId: "a2", suspended: true })).rejects.toThrow(/Administrator accounts/);
    await expect(api.admin.setPassword({ userId: "a2", password: "new password 1" })).rejects.toThrow();
    await expect(api.admin.deleteAccount({ userId: "a2", confirmEmail: "other@rated.test" })).rejects.toThrow();
    expect(store.setUserSuspended).not.toHaveBeenCalled();
  });

  it("sets a temporary password as a hash (never stored or logged in plain text) and can clear a PIN", async () => {
    const api = await caller(admin);
    await api.admin.setPassword({ userId: "p1", password: "temporary pass 9" });
    const hash = store.setUserPasswordHash.mock.calls[0][1];
    expect(hash).not.toContain("temporary pass 9");
    expect(JSON.stringify(store.logAudit.mock.calls)).not.toContain("temporary pass 9");
    await api.admin.resetPin({ userId: "p1" });
    expect(store.clearParentalPin).toHaveBeenCalledWith("p1");
  });

  it("deletes an account only when the exact email is typed, and keeps the record under the administrator", async () => {
    const api = await caller(admin);
    await expect(api.admin.deleteAccount({ userId: "t1", confirmEmail: "wrong@x.test" })).rejects.toThrow(/exactly/);
    expect(store.deleteAllUserData).not.toHaveBeenCalled();
    await api.admin.deleteAccount({ userId: "t1", confirmEmail: " Teacher@School.test " });
    expect(store.deleteAllUserData).toHaveBeenCalledWith("t1");
    expect(store.logAudit).toHaveBeenCalledWith("a1", "admin_deleted_account", "teacher@school.test (school)");
  });
});
