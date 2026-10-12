import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  getActiveConsent: vi.fn(),
  getProfile: vi.fn(),
  listProfiles: vi.fn(),
  getChildProgress: vi.fn(),
  listBadges: vi.fn(),
  getGameBreakdown: vi.fn(),
  getRecentPlays: vi.fn(),
  listMoodCheckins: vi.fn(),
  recordPlay: vi.fn(),
  addMoodCheckin: vi.fn(),
  countRecentMoodCheckins: vi.fn(),
}));
vi.mock("./db", () => store);
vi.mock("./_core/llm", () => ({ invokeLLM: vi.fn() }));

import { appRouter } from "./routers";
import { signUnlock } from "./_core/auth";
import { resetRateLimits } from "./_core/rateLimit";
import { CONSENT_VERSION } from "@shared/consent";

const userA = { id: "user-a", email: "a@example.com", name: "A", role: "user" as const, loginMethod: "email", createdAt: null, lastSignedIn: null };
const ownProfile = { id: "p1", userId: "user-a", childName: "Mia", ageGroup: "kids" };

async function caller(opts: { unlocked?: boolean } = {}) {
  const cookie = opts.unlocked ? `parent_unlock=${await signUnlock("user-a")}` : "";
  const ctx = { req: { headers: { cookie }, ip: "1.2.3.4", protocol: "http" }, res: { cookie: vi.fn(), clearCookie: vi.fn() }, user: userA } as any;
  return appRouter.createCaller(ctx);
}
const play = (over: Record<string, unknown> = {}) => ({ profileId: "p1", game: "math" as const, level: 1, correct: 8, total: 10, durationMs: 30_000, ...over });

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimits();
  store.getActiveConsent.mockResolvedValue({ id: "c", userId: "user-a", version: CONSENT_VERSION });
  store.getProfile.mockResolvedValue(ownProfile);
  store.getChildProgress.mockResolvedValue({ xp: 125, streakDays: 3, longestStreak: 3, lastPlayDate: new Date().toISOString().slice(0, 10) });
  store.listBadges.mockResolvedValue([{ badgeId: "first_play", earnedAt: new Date() }]);
  store.getGameBreakdown.mockResolvedValue([{ game: "math", plays: 2, correct: 15, total: 20 }]);
  store.getRecentPlays.mockResolvedValue([]);
  store.listMoodCheckins.mockResolvedValue([]);
  store.countRecentMoodCheckins.mockResolvedValue(0);
  store.recordPlay.mockResolvedValue({ xpEarned: 85, xp: 210, leveledUp: true, streakDays: 4, longestStreak: 4, newBadges: ["perfect_round"] });
  store.addMoodCheckin.mockResolvedValue({ newBadges: ["mood_first"] });
});

describe("progress", () => {
  it("requires consent and an owned child", async () => {
    store.getActiveConsent.mockResolvedValue(null);
    await expect((await caller()).progress.get({ profileId: "p1" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    store.getActiveConsent.mockResolvedValue({ version: CONSENT_VERSION });
    store.getProfile.mockResolvedValue({ ...ownProfile, userId: "someone-else" });
    await expect((await caller()).progress.get({ profileId: "p1" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("returns level, title, streak and badges derived from the stored XP", async () => {
    const out = await (await caller()).progress.get({ profileId: "p1" });
    expect(out.xp).toBe(125);
    expect(out.level).toBe(2);
    expect(out.title).toBe("Explorer");
    expect(out.streakDays).toBe(3);
    expect(out.playedToday).toBe(true);
    expect(out.badges).toHaveLength(1);
    expect(out.levelFraction).toBeGreaterThan(0);
    expect(out.levelFraction).toBeLessThan(1);
  });

  it("shows a lapsed streak as zero", async () => {
    store.getChildProgress.mockResolvedValue({ xp: 10, streakDays: 5, longestStreak: 5, lastPlayDate: "2020-01-01" });
    const out = await (await caller()).progress.get({ profileId: "p1" });
    expect(out.streakDays).toBe(0);
    expect(out.longestStreak).toBe(5);
  });
});

describe("submitPlay", () => {
  it("records a valid round and names the new badges", async () => {
    const out = await (await caller()).progress.submitPlay(play({ localDay: new Date().toISOString().slice(0, 10) }));
    expect(store.recordPlay).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-a", profileId: "p1", game: "math", correct: 8, total: 10 }));
    expect(out.xpEarned).toBe(85);
    expect(out.leveledUp).toBe(true);
    expect(out.newBadges).toEqual([{ id: "perfect_round", name: "Perfect Round", icon: "🌟" }]);
  });

  it("rejects impossible or forged results without recording anything", async () => {
    const api = await caller();
    await expect(api.progress.submitPlay(play({ correct: 11 }))).rejects.toThrow(); // more correct than questions
    await expect(api.progress.submitPlay(play({ total: 500, correct: 1 }))).rejects.toThrow(); // too many questions
    await expect(api.progress.submitPlay(play({ durationMs: 100 }))).rejects.toMatchObject({ code: "BAD_REQUEST" }); // inhuman speed
    await expect(api.progress.submitPlay(play({ game: "hack" as any }))).rejects.toThrow();
    await expect(api.progress.submitPlay(play({ level: 9 }))).rejects.toThrow();
    expect(store.recordPlay).not.toHaveBeenCalled();
  });

  it("cannot score for another family's child or without consent", async () => {
    store.getProfile.mockResolvedValue({ ...ownProfile, userId: "someone-else" });
    await expect((await caller()).progress.submitPlay(play())).rejects.toMatchObject({ code: "NOT_FOUND" });
    store.getProfile.mockResolvedValue(ownProfile);
    store.getActiveConsent.mockResolvedValue(null);
    await expect((await caller()).progress.submitPlay(play())).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(store.recordPlay).not.toHaveBeenCalled();
  });

  it("ignores a client day far from the server day", async () => {
    await (await caller()).progress.submitPlay(play({ localDay: "2035-01-01" }));
    const day = store.recordPlay.mock.calls[0][0].day as string;
    expect(day).toBe(new Date().toISOString().slice(0, 10));
  });

  it("rate limits bursts of results", async () => {
    const api = await caller();
    for (let i = 0; i < 30; i++) await api.progress.submitPlay(play());
    await expect(api.progress.submitPlay(play())).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });
});

describe("mood check-ins", () => {
  it("stores a normal check-in and reports a new badge", async () => {
    const out = await (await caller()).progress.checkin({ profileId: "p1", mood: "happy", note: "We had pizza" });
    expect(store.addMoodCheckin).toHaveBeenCalledWith(expect.objectContaining({ mood: "happy", flagged: "safe", profileId: "p1" }));
    expect(out.flagged).toBe("safe");
    expect(out.reply).toBeNull();
    expect(out.newBadges[0].id).toBe("mood_first");
  });

  it("flags a worrying note for the parent and replies kindly", async () => {
    const out = await (await caller()).progress.checkin({ profileId: "p1", mood: "sad", note: "I want to die" });
    expect(store.addMoodCheckin).toHaveBeenCalledWith(expect.objectContaining({ flagged: "review" }));
    expect(out.flagged).toBe("review");
    expect(out.reply).toMatch(/trust/i);
  });

  it("rejects unknown moods and limits check-ins per day", async () => {
    const api = await caller();
    await expect(api.progress.checkin({ profileId: "p1", mood: "evil" as any })).rejects.toThrow();
    store.countRecentMoodCheckins.mockResolvedValue(10);
    await expect(api.progress.checkin({ profileId: "p1", mood: "happy" })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });
});

describe("parent overview", () => {
  it("is PIN-locked and returns one entry per child", async () => {
    await expect((await caller()).progress.overview()).rejects.toMatchObject({ code: "FORBIDDEN" });
    store.listProfiles.mockResolvedValue([ownProfile]);
    store.listMoodCheckins.mockResolvedValue([{ mood: "sad", note: "x", flagged: "safe", createdAt: new Date() }]);
    const out = await (await caller({ unlocked: true })).progress.overview();
    expect(out).toHaveLength(1);
    expect(out[0].profile.childName).toBe("Mia");
    expect(out[0].moods[0].mood).toBe("sad");
  });
});
