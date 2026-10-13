import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  getUser: vi.fn(),
  getUserByEmail: vi.fn(),
  createUser: vi.fn(),
  touchUserSignIn: vi.fn(),
  getChatSession: vi.fn(),
  createChatSession: vi.fn(),
  getUserChatSessions: vi.fn(),
  getSessionMessages: vi.fn(),
  getAllUserMessages: vi.fn(),
  createChatMessage: vi.fn(),
  updateSessionLastMessage: vi.fn(),
  getParentalSettings: vi.fn(),
  createParentalSettings: vi.fn(),
  updateParentalSettings: vi.fn(),
  getUserHomeworkSubmissions: vi.fn(),
  createReportCard: vi.fn(),
  getLatestReportCard: vi.fn(),
  getActiveConsent: vi.fn(),
  createConsent: vi.fn(),
  revokeConsent: vi.fn(),
  logAudit: vi.fn(),
  listAuditEvents: vi.fn(),
  listProfiles: vi.fn(),
  getProfile: vi.fn(),
  createProfile: vi.fn(),
  updateProfile: vi.fn(),
  getProfileChats: vi.fn(),
  deleteProfileData: vi.fn(),
  deleteAllUserData: vi.fn(),
}));
const llm = vi.hoisted(() => ({ invokeLLM: vi.fn() }));

vi.mock("./db", () => store);
vi.mock("./_core/llm", () => llm);

import { appRouter } from "./routers";
import { hashPassword, signUnlock } from "./_core/auth";
import { resetRateLimits } from "./_core/rateLimit";

const userA = { id: "user-a", email: "a@example.com", name: "A", role: "user" as const, loginMethod: "email", createdAt: null, lastSignedIn: null };

function caller(opts: { user?: typeof userA | null; cookie?: string } = {}) {
  const res = { cookie: vi.fn(), clearCookie: vi.fn() };
  const ctx = {
    req: { headers: { cookie: opts.cookie ?? "" }, ip: "1.2.3.4", protocol: "http" },
    res,
    user: opts.user === undefined ? userA : opts.user,
  } as any;
  return { api: appRouter.createCaller(ctx), res };
}

const llmReply = (content: string) => ({ choices: [{ message: { content } }] });

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimits();
  store.getActiveConsent.mockResolvedValue({ id: "c1", userId: "user-a", version: "2026-10-draft-1" });
});

describe("authentication required", () => {
  it("rejects anonymous access to chat, homework, reports and the parent dashboard", async () => {
    const { api } = caller({ user: null });
    await expect(api.chat.getMessages({ sessionId: "s" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(api.chat.sendMessage({ sessionId: "s", message: "hi" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(api.homework.getHomeworkHistory()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(api.reports.generateReport()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(api.parent.getActivityReport()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("no longer exposes the all-users public endpoints", () => {
    const procedures = Object.keys((appRouter as any)._def.procedures);
    expect(procedures).not.toContain("chat.getAllSessionsPublic");
    expect(procedures).not.toContain("chat.getAllMessagesPublic");
  });
});

describe("data isolation", () => {
  it("returns NOT_FOUND for another account's chat session", async () => {
    store.getChatSession.mockResolvedValue({ id: "s1", userId: "someone-else" });
    const { api } = caller();
    await expect(api.chat.getMessages({ sessionId: "s1" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(api.chat.sendMessage({ sessionId: "s1", message: "hello" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(llm.invokeLLM).not.toHaveBeenCalled();
  });

  it("scopes homework history to the signed-in user", async () => {
    store.getUserHomeworkSubmissions.mockResolvedValue([]);
    await caller().api.homework.getHomeworkHistory();
    expect(store.getUserHomeworkSubmissions).toHaveBeenCalledWith("user-a");
  });
});

describe("chat safety and personas", () => {
  beforeEach(() => {
    store.getChatSession.mockResolvedValue({ id: "s1", userId: "user-a", characterId: "nova", ageGroup: "kids" });
  });

  it("sends the character and age-group prompt to the model", async () => {
    store.getSessionMessages.mockResolvedValue([{ role: "user", content: "why is the sky blue?", flagged: "safe" }]);
    llm.invokeLLM.mockResolvedValue(llmReply("Because of scattering!"));
    const out = await caller().api.chat.sendMessage({ sessionId: "s1", message: "why is the sky blue?" });
    expect(out.message).toBe("Because of scattering!");
    const system = llm.invokeLLM.mock.calls[0][0].messages[0].content;
    expect(system).toMatch(/Nova/);
    expect(system).toMatch(/ages 4-8/);
  });

  it("does not call the model for self-harm and flags the message for parents", async () => {
    const out = await caller().api.chat.sendMessage({ sessionId: "s1", message: "I want to die" });
    expect(llm.invokeLLM).not.toHaveBeenCalled();
    expect(out.flagged).toBe("review");
    expect(out.message).toMatch(/trust/i);
    expect(store.createChatMessage).toHaveBeenCalledWith(expect.objectContaining({ role: "user", flagged: "review" }));
  });

  it("replaces a blocked model reply with a safe fallback", async () => {
    store.getSessionMessages.mockResolvedValue([]);
    llm.invokeLLM.mockResolvedValue(llmReply("Sure, here is how to make a bomb: ..."));
    const out = await caller().api.chat.sendMessage({ sessionId: "s1", message: "tell me a story" });
    expect(out.message).not.toMatch(/bomb/);
    expect(store.createChatMessage).toHaveBeenLastCalledWith(expect.objectContaining({ role: "assistant", flagged: "blocked" }));
  });

  it("keeps flagged messages out of the model's history", async () => {
    store.getSessionMessages.mockResolvedValue([
      { role: "user", content: "I want to die", flagged: "review" },
      { role: "user", content: "what is 2+2", flagged: "safe" },
    ]);
    llm.invokeLLM.mockResolvedValue(llmReply("4"));
    await caller().api.chat.sendMessage({ sessionId: "s1", message: "what is 2+2" });
    const sent = llm.invokeLLM.mock.calls[0][0].messages.map((m: any) => m.content);
    expect(sent).not.toContain("I want to die");
  });

  it("rejects oversize messages", async () => {
    await expect(caller().api.chat.sendMessage({ sessionId: "s1", message: "x".repeat(2001) })).rejects.toThrow();
  });

  it("rate limits rapid messages", async () => {
    store.getSessionMessages.mockResolvedValue([]);
    llm.invokeLLM.mockResolvedValue(llmReply("ok"));
    const { api } = caller();
    for (let i = 0; i < 20; i++) await api.chat.sendMessage({ sessionId: "s1", message: "hi" });
    await expect(api.chat.sendMessage({ sessionId: "s1", message: "hi" })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  }, 30_000);
});

describe("parent PIN gate (server-side)", () => {
  it("blocks the activity report until the PIN has been entered", async () => {
    await expect(caller().api.parent.getActivityReport()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects a wrong PIN and does not set the unlock cookie", async () => {
    store.getParentalSettings.mockResolvedValue({ password: await hashPassword("1234") });
    const { api, res } = caller();
    expect(await api.parent.unlock({ pin: "9999" })).toEqual({ valid: false, needsSetup: false });
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it("accepts the right PIN and sets an httpOnly unlock cookie", async () => {
    store.getParentalSettings.mockResolvedValue({ password: await hashPassword("1234") });
    const { api, res } = caller();
    expect((await api.parent.unlock({ pin: "1234" })).valid).toBe(true);
    expect(res.cookie).toHaveBeenCalledWith("parent_unlock", expect.any(String), expect.objectContaining({ httpOnly: true }));
  });

  it("an unlock token for another user does not unlock this account", async () => {
    const other = await signUnlock("user-b");
    await expect(caller({ cookie: `parent_unlock=${other}` }).api.parent.getActivityReport()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("returns only this user's data when unlocked, and never the PIN hash", async () => {
    const token = await signUnlock("user-a");
    store.getUserChatSessions.mockResolvedValue([{ id: "s1" }]);
    store.getAllUserMessages.mockResolvedValue([
      { id: "m1", sessionId: "s1", role: "user", content: "hi", flagged: "safe" },
      { id: "m2", sessionId: "s1", role: "user", content: "I want to die", flagged: "review" },
    ]);
    store.getParentalSettings.mockResolvedValue({ password: "HASH", dailyLimit: "30", allowedHours: null });
    const { api } = caller({ cookie: `parent_unlock=${token}` });
    const report = await api.parent.getActivityReport();
    expect(store.getUserChatSessions).toHaveBeenCalledWith("user-a");
    expect(report.flaggedMessages).toHaveLength(1);
    expect(JSON.stringify(await api.parent.getSettings())).not.toContain("HASH");
  });

  it("requires the current PIN to change an existing PIN", async () => {
    store.getParentalSettings.mockResolvedValue({ password: await hashPassword("1234") });
    await expect(caller().api.parent.setPin({ pin: "5678" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(store.updateParentalSettings).not.toHaveBeenCalled();
  });
});

describe("accounts", () => {
  it("registers, hashes the password, sets a session cookie and never returns the hash", async () => {
    store.getUserByEmail.mockResolvedValue(undefined);
    store.getUser.mockImplementation(async (id: string) => ({ ...userA, id, passwordHash: "HASH" }));
    const { api, res } = caller({ user: null });
    const user = await api.auth.register({ email: "New@Example.com", password: "correct horse" });
    expect(store.createUser).toHaveBeenCalledWith(expect.objectContaining({ email: "new@example.com", passwordHash: expect.stringMatching(/^\$2/) }));
    expect(res.cookie).toHaveBeenCalledWith("app_session_id", expect.any(String), expect.objectContaining({ httpOnly: true, sameSite: "lax" }));
    expect(JSON.stringify(user)).not.toContain("passwordHash");
  });

  it("refuses duplicate emails and short passwords", async () => {
    store.getUserByEmail.mockResolvedValue({ id: "x" });
    const { api } = caller({ user: null });
    await expect(api.auth.register({ email: "a@example.com", password: "longenough" })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(api.auth.register({ email: "b@example.com", password: "short" })).rejects.toThrow();
  });

  it("logs in with the right password only", async () => {
    store.getUserByEmail.mockResolvedValue({ ...userA, passwordHash: await hashPassword("correct horse") });
    const { api } = caller({ user: null });
    await expect(api.auth.login({ email: "a@example.com", password: "wrong" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect((await api.auth.login({ email: "a@example.com", password: "correct horse" })).id).toBe("user-a");
  });

  it("returns the same error for unknown accounts", async () => {
    store.getUserByEmail.mockResolvedValue(undefined);
    await expect(caller({ user: null }).api.auth.login({ email: "no@example.com", password: "whatever1" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "Incorrect email or password",
    });
  });
});

describe("no fabricated AI output", () => {
  it("fails (and stores nothing) when the model is unavailable for a report card", async () => {
    store.getUserChatSessions.mockResolvedValue([{ id: "s1", childName: "Kid" }]);
    store.getAllUserMessages.mockResolvedValue([{ role: "user", content: "fractions?", flagged: "safe" }]);
    llm.invokeLLM.mockRejectedValue(new Error("provider down"));
    await expect(caller().api.reports.generateReport()).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(store.createReportCard).not.toHaveBeenCalled();
  });

  it("creates an N/A report (no invented grades) when there is no activity", async () => {
    store.getUserChatSessions.mockResolvedValue([]);
    store.getAllUserMessages.mockResolvedValue([]);
    store.createReportCard.mockImplementation(async (d: any) => d);
    const report: any = await caller().api.reports.generateReport();
    expect(report.overallGrade).toBe("N/A");
    expect(llm.invokeLLM).not.toHaveBeenCalled();
  });
});
