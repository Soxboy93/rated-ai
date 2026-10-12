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
import { CONSENT_VERSION } from "@shared/consent";

const userA = { id: "user-a", email: "a@example.com", name: "A", role: "user" as const, loginMethod: "email", createdAt: null, lastSignedIn: null };
const activeConsent = { id: "c1", userId: "user-a", version: CONSENT_VERSION, grantedAt: new Date() };

async function caller(opts: { unlocked?: boolean; user?: typeof userA | null } = {}) {
  const cookie = opts.unlocked ? `parent_unlock=${await signUnlock("user-a")}` : "";
  const res = { cookie: vi.fn(), clearCookie: vi.fn() };
  const ctx = { req: { headers: { cookie }, ip: "1.2.3.4", protocol: "http" }, res, user: opts.user === undefined ? userA : opts.user } as any;
  return { api: appRouter.createCaller(ctx), res };
}

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimits();
  store.getActiveConsent.mockResolvedValue(activeConsent);
  store.listProfiles.mockResolvedValue([]);
});

describe("consent gate", () => {
  it("blocks chat and the other AI features until a parent has consented", async () => {
    store.getActiveConsent.mockResolvedValue(null);
    const { api } = await caller();
    await expect(api.chat.createSession({ profileId: "p1" })).rejects.toMatchObject({ code: "FORBIDDEN", message: expect.stringMatching(/consent/i) });
    await expect(api.chat.sendMessage({ sessionId: "s1", message: "hi" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(api.creative.generateStory({ prompt: "a dragon" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(llm.invokeLLM).not.toHaveBeenCalled();
  });

  it("records consent with the version and a hash of the wording, once", async () => {
    store.getActiveConsent.mockResolvedValue(null);
    const { api } = await caller();
    await api.consent.grant({ version: CONSENT_VERSION, confirmParent: true });
    expect(store.createConsent).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-a", version: CONSENT_VERSION, textSha256: expect.stringMatching(/^[0-9a-f]{64}$/) }));
    expect(store.logAudit).toHaveBeenCalledWith("user-a", "consent_granted", CONSENT_VERSION);

    store.createConsent.mockClear();
    store.getActiveConsent.mockResolvedValue(activeConsent);
    await api.consent.grant({ version: CONSENT_VERSION, confirmParent: true });
    expect(store.createConsent).not.toHaveBeenCalled();
  });

  it("treats consent given for older wording as missing and asks again", async () => {
    store.getActiveConsent.mockResolvedValue({ ...activeConsent, version: "2025-old" });
    const { api } = await caller();
    expect((await api.consent.status()).granted).toBe(false);
    await expect(api.chat.createSession({ profileId: "p1" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await api.consent.grant({ version: CONSENT_VERSION, confirmParent: true });
    expect(store.revokeConsent).toHaveBeenCalledWith("user-a");
    expect(store.createConsent).toHaveBeenCalledWith(expect.objectContaining({ version: CONSENT_VERSION }));
  });

  it("refuses consent without the parent confirmation or for an outdated wording", async () => {
    const { api } = await caller();
    await expect(api.consent.grant({ version: CONSENT_VERSION, confirmParent: false as any })).rejects.toThrow();
    await expect(api.consent.grant({ version: "old" as any, confirmParent: true })).rejects.toThrow();
  });

  it("withdrawing consent needs the PIN and is audited", async () => {
    await expect((await caller()).api.consent.withdraw()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(store.revokeConsent).not.toHaveBeenCalled();
    await (await caller({ unlocked: true })).api.consent.withdraw();
    expect(store.revokeConsent).toHaveBeenCalledWith("user-a");
    expect(store.logAudit).toHaveBeenCalledWith("user-a", "consent_withdrawn");
  });
});

describe("child profiles", () => {
  it("only a PIN-unlocked parent can add a child", async () => {
    await expect((await caller()).api.profiles.create({ childName: "Mia", ageGroup: "kids" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(store.createProfile).not.toHaveBeenCalled();
  });

  it("creates a profile, audits it, and rejects contact details in the name field", async () => {
    const { api } = await caller({ unlocked: true });
    const { id } = await api.profiles.create({ childName: "Mia", ageGroup: "tweens", selectedCharacter: "nova" });
    expect(store.createProfile).toHaveBeenCalledWith(expect.objectContaining({ id, userId: "user-a", childName: "Mia", ageGroup: "tweens" }));
    await expect(api.profiles.create({ childName: "mia@example.com", ageGroup: "kids" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(api.profiles.create({ childName: "call 555-123-4567", ageGroup: "kids" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("limits a family to six children", async () => {
    store.listProfiles.mockResolvedValue(Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, userId: "user-a" })));
    await expect((await caller({ unlocked: true })).api.profiles.create({ childName: "Sam", ageGroup: "kids" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("lists only safe fields, scoped to the account, without needing the PIN", async () => {
    store.listProfiles.mockResolvedValue([{ id: "p1", userId: "user-a", childName: "Mia", ageGroup: "kids", selectedCharacter: "sage", avatar: null, createdAt: new Date() }]);
    const list = await (await caller()).api.profiles.list();
    expect(store.listProfiles).toHaveBeenCalledWith("user-a");
    expect(Object.keys(list[0]).sort()).toEqual(["ageGroup", "childName", "id", "selectedCharacter"]);
  });

  it("cannot modify, export or delete another family's child", async () => {
    store.getProfile.mockResolvedValue({ id: "p9", userId: "someone-else", childName: "X" });
    const { api } = await caller({ unlocked: true });
    await expect(api.profiles.update({ profileId: "p9", childName: "Y" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(api.profiles.export({ profileId: "p9" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(api.profiles.delete({ profileId: "p9" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(store.deleteProfileData).not.toHaveBeenCalled();
    expect(store.getProfileChats).not.toHaveBeenCalled();
  });

  it("deleting a child needs the PIN, then removes the profile and its chats", async () => {
    store.getProfile.mockResolvedValue({ id: "p1", userId: "user-a", childName: "Mia" });
    await expect((await caller()).api.profiles.delete({ profileId: "p1" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(store.deleteProfileData).not.toHaveBeenCalled();
    await (await caller({ unlocked: true })).api.profiles.delete({ profileId: "p1" });
    expect(store.deleteProfileData).toHaveBeenCalledWith("user-a", "p1");
    expect(store.logAudit).toHaveBeenCalledWith("user-a", "profile_deleted", "Mia");
  });

  it("deleting a child still works after consent was withdrawn", async () => {
    store.getActiveConsent.mockResolvedValue(null);
    store.getProfile.mockResolvedValue({ id: "p1", userId: "user-a", childName: "Mia" });
    await (await caller({ unlocked: true })).api.profiles.delete({ profileId: "p1" });
    expect(store.deleteProfileData).toHaveBeenCalled();
  });

  it("exports a child's profile and conversations and audits the export", async () => {
    store.getProfile.mockResolvedValue({ id: "p1", userId: "user-a", childName: "Mia", ageGroup: "kids", selectedCharacter: "sage", createdAt: new Date() });
    store.getProfileChats.mockResolvedValue([{ id: "s1", messages: [{ role: "user", content: "hi" }] }]);
    const out = await (await caller({ unlocked: true })).api.profiles.export({ profileId: "p1" });
    expect(out.profile.childName).toBe("Mia");
    expect(out.chats[0].messages[0].content).toBe("hi");
    expect(store.getProfileChats).toHaveBeenCalledWith("user-a", "p1");
    expect(store.logAudit).toHaveBeenCalledWith("user-a", "profile_exported", "Mia");
  });
});

describe("chat sessions use the profile", () => {
  it("takes the age group from the profile, not from the request", async () => {
    store.getProfile.mockResolvedValue({ id: "p1", userId: "user-a", childName: "Mia", ageGroup: "kids", selectedCharacter: "sage" });
    const { api } = await caller();
    await api.chat.createSession({ profileId: "p1", characterId: "nova", ageGroup: "teens" } as any);
    expect(store.createChatSession).toHaveBeenCalledWith(expect.objectContaining({ profileId: "p1", childName: "Mia", ageGroup: "kids", characterId: "nova" }));
  });

  it("falls back to the profile's favourite guide", async () => {
    store.getProfile.mockResolvedValue({ id: "p1", userId: "user-a", childName: "Mia", ageGroup: "kids", selectedCharacter: "sage" });
    await (await caller()).api.chat.createSession({ profileId: "p1" });
    expect(store.createChatSession).toHaveBeenCalledWith(expect.objectContaining({ characterId: "sage" }));
  });

  it("cannot start a chat as another family's child", async () => {
    store.getProfile.mockResolvedValue({ id: "p9", userId: "someone-else", childName: "X", ageGroup: "teens" });
    await expect((await caller()).api.chat.createSession({ profileId: "p9" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(store.createChatSession).not.toHaveBeenCalled();
  });
});

describe("account deletion", () => {
  it("needs the PIN and the correct password, and deletes nothing otherwise", async () => {
    store.getUser.mockResolvedValue({ ...userA, passwordHash: await hashPassword("correct horse") });
    await expect((await caller()).api.account.delete({ password: "correct horse", confirm: "DELETE" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const { api } = await caller({ unlocked: true });
    await expect(api.account.delete({ password: "wrong", confirm: "DELETE" })).rejects.toMatchObject({ code: "FORBIDDEN", message: "Password is incorrect" });
    await expect(api.account.delete({ password: "correct horse", confirm: "nope" as any })).rejects.toThrow();
    expect(store.deleteAllUserData).not.toHaveBeenCalled();
  });

  it("deletes everything for the account and signs the browser out", async () => {
    store.getUser.mockResolvedValue({ ...userA, passwordHash: await hashPassword("correct horse") });
    const { api, res } = await caller({ unlocked: true });
    await api.account.delete({ password: "correct horse", confirm: "DELETE" });
    expect(store.deleteAllUserData).toHaveBeenCalledWith("user-a");
    expect(res.clearCookie).toHaveBeenCalledWith("app_session_id", expect.anything());
    expect(res.clearCookie).toHaveBeenCalledWith("parent_unlock", expect.anything());
  });
});
