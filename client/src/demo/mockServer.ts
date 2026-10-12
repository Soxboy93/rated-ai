/**
 * In-browser stand-in for the server, used ONLY by the preview build (VITE_DEMO). It answers the same tRPC calls the
 * real UI makes, with in-memory data, and reuses the real shared logic (game XP, streaks, badges, safety screening).
 * What is NOT real here: accounts, the database, the AI model (chat/story/homework replies are canned), image
 * generation, and anything persistent. Nothing leaves the page.
 */
import superjson from "superjson";
import { CONSENT_VERSION } from "@shared/consent";
import { AI_CHARACTERS } from "@shared/characters";
import {
  BADGES, badgeById, earnedBadgeIds, effectiveStreak, levelFromXp, levelProgress, levelTitle, nextStreak,
  resolvePlayDay, xpForPlay, type GameId, type ProgressStats,
} from "@shared/gamification";
import { screenText } from "../../../server/safety";
import { UNAUTHED_ERR_MSG } from "@shared/const";

class DemoError extends Error {
  constructor(public code: string, message: string) { super(message); }
}
const HTTP: Record<string, number> = { UNAUTHORIZED: 401, FORBIDDEN: 403, NOT_FOUND: 404, BAD_REQUEST: 400, CONFLICT: 409, TOO_MANY_REQUESTS: 429, INTERNAL_SERVER_ERROR: 500 };
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const dayMs = 86_400_000;
const isoLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

type Profile = { id: string; userId: string; childName: string; ageGroup: "kids" | "tweens" | "teens"; selectedCharacter: string | null; createdAt: Date };
type Play = { id: string; profileId: string; game: GameId; level: number; correct: number; total: number; xpEarned: number; createdAt: Date };
type Msg = { id: string; sessionId: string; role: "user" | "assistant"; content: string; flagged: "safe" | "review" | "blocked"; createdAt: Date };
type Session = { id: string; userId: string; profileId: string; childName: string; characterId: string | null; ageGroup: string; createdAt: Date };

function fresh() {
  return {
    user: null as null | { id: string; email: string; name: string | null; role: "user"; loginMethod: string; createdAt: Date; lastSignedIn: Date },
    consent: null as null | { version: string; grantedAt: Date },
    pin: null as string | null,
    unlocked: false,
    profiles: [] as Profile[],
    progress: new Map<string, { xp: number; streakDays: number; longestStreak: number; lastPlayDate: string | null }>(),
    plays: [] as Play[],
    badges: new Map<string, Array<{ badgeId: string; earnedAt: Date }>>(),
    moods: [] as Array<{ profileId: string; mood: string; note: string | null; flagged: string; createdAt: Date }>,
    sessions: [] as Session[],
    messages: [] as Msg[],
    pet: null as null | Record<string, any>,
    a11y: { dyslexiaMode: 0, adhdMode: 0, autismMode: 0, fontSize: "medium", highContrast: 0, textToSpeech: 0, reducedMotion: 0 } as Record<string, any>,
    audit: [] as Array<{ id: string; action: string; detail: string | null; createdAt: Date }>,
    summary: null as any,
    report: null as any,
  };
}
let S = fresh();

const log = (action: string, detail?: string) => S.audit.unshift({ id: uid(), action, detail: detail ?? null, createdAt: new Date() });
const requireUser = () => { if (!S.user) throw new DemoError("UNAUTHORIZED", UNAUTHED_ERR_MSG); return S.user; };
const requireConsent = () => { requireUser(); if (!S.consent || S.consent.version !== CONSENT_VERSION) throw new DemoError("FORBIDDEN", "Parental consent required (10004)"); };
const requireParent = () => { requireUser(); if (!S.unlocked) throw new DemoError("FORBIDDEN", "Parent mode is locked (10003)"); };
const profile = (id: string) => {
  const p = S.profiles.find(x => x.id === id);
  if (!p) throw new DemoError("NOT_FOUND", "Child profile not found");
  return p;
};

/* ------------------------------------------------------------- progress */
function statsFor(profileId: string): ProgressStats {
  const pr = S.progress.get(profileId) ?? { xp: 0, streakDays: 0, longestStreak: 0, lastPlayDate: null };
  const plays = S.plays.filter(p => p.profileId === profileId);
  const playsByGame: Partial<Record<GameId, number>> = {};
  plays.forEach(p => { playsByGame[p.game] = (playsByGame[p.game] ?? 0) + 1; });
  return {
    xp: pr.xp, streakDays: pr.streakDays, longestStreak: pr.longestStreak, totalPlays: plays.length,
    perfectPlays: plays.filter(p => p.correct === p.total).length, playsByGame,
    moodCheckins: S.moods.filter(m => m.profileId === profileId).length,
  };
}
function award(profileId: string): string[] {
  const have = S.badges.get(profileId) ?? [];
  const fresh = earnedBadgeIds(statsFor(profileId)).filter(id => !have.some(b => b.badgeId === id));
  S.badges.set(profileId, [...have, ...fresh.map(badgeId => ({ badgeId, earnedAt: new Date() }))]);
  return fresh;
}
function recordPlay(profileId: string, game: GameId, level: number, correct: number, total: number, day: string, at = new Date()) {
  const row = S.progress.get(profileId) ?? { xp: 0, streakDays: 0, longestStreak: 0, lastPlayDate: null };
  const xpEarned = xpForPlay(correct, total);
  const before = row.xp;
  row.xp += xpEarned;
  row.streakDays = nextStreak(row.lastPlayDate, row.streakDays, day);
  row.longestStreak = Math.max(row.longestStreak, row.streakDays);
  row.lastPlayDate = day;
  S.progress.set(profileId, row);
  S.plays.push({ id: uid(), profileId, game, level, correct, total, xpEarned, createdAt: at });
  const newBadges = award(profileId);
  return { xpEarned, xp: row.xp, leveledUp: levelFromXp(row.xp) > levelFromXp(before), streakDays: row.streakDays, longestStreak: row.longestStreak, newBadges };
}
const named = (ids: string[]) => ids.map(id => ({ id, name: badgeById(id)?.name ?? id, icon: badgeById(id)?.icon ?? "🏅" }));

function snapshot(profileId: string, clientDay?: string) {
  const today = resolvePlayDay(clientDay, new Date());
  const row = S.progress.get(profileId);
  const lp = levelProgress(row?.xp ?? 0);
  const plays = S.plays.filter(p => p.profileId === profileId);
  const breakdown = (["math", "spelling", "quiz", "memory", "patterns"] as GameId[])
    .map(game => { const g = plays.filter(p => p.game === game); return { game, plays: g.length, correct: g.reduce((n, p) => n + p.correct, 0), total: g.reduce((n, p) => n + p.total, 0) }; })
    .filter(g => g.plays > 0);
  const moods = S.moods.filter(m => m.profileId === profileId).sort((a, b) => +b.createdAt - +a.createdAt);
  return {
    xp: row?.xp ?? 0, level: lp.level, title: levelTitle(lp.level), levelStart: lp.start, levelNext: lp.next, levelFraction: lp.fraction,
    streakDays: effectiveStreak(row?.lastPlayDate ?? null, row?.streakDays ?? 0, today), longestStreak: row?.longestStreak ?? 0,
    playedToday: row?.lastPlayDate === today, badges: S.badges.get(profileId) ?? [], breakdown, totalPlays: plays.length,
    recent: plays.slice(-8).reverse().map(p => ({ game: p.game, correct: p.correct, total: p.total, xpEarned: p.xpEarned, createdAt: p.createdAt })),
    lastMood: moods[0]?.mood ?? null, lastMoodAt: moods[0]?.createdAt ?? null,
  };
}

/* ----------------------------------------------------------------- chat */
const TOPICS: Array<[RegExp, { kids: string; older: string }]> = [
  [/sky|blue/i, { kids: "The sky looks blue because sunlight is made of many colours, and the blue light bounces around the most. It's like blue sparkles all over the sky!", older: "Sunlight contains every colour. Air molecules scatter short blue wavelengths far more than long red ones (Rayleigh scattering), so blue light reaches your eyes from every direction." }],
  [/sun/i, { kids: "The Sun is a giant ball of hot, glowing gas. It's so big that about one million Earths could fit inside it!", older: "The Sun is a star about 109 times wider than Earth. Nuclear fusion in its core turns hydrogen into helium and releases the energy that lights our planet." }],
  [/sleep/i, { kids: "Sleep gives your body and brain a rest. While you sleep, your brain tidies up what you learned today.", older: "During sleep your brain consolidates memories and your body repairs itself. Most children and teens do best with 8 to 11 hours." }],
  [/volcano/i, { kids: "A volcano is a mountain with a hole at the top. Hot melted rock called lava can push up from deep inside the Earth and come out!", older: "Volcanoes form where magma from the mantle reaches the surface, often at the edges of tectonic plates. Eruptions can be gentle lava flows or explosive blasts." }],
  [/airplane|plane|fly/i, { kids: "Airplane wings are curved so air moves faster over the top, which helps lift the plane up into the sky. Whoosh!", older: "Wings generate lift because of their shape and angle: they push air downward, and the pressure difference plus Newton's third law lifts the aircraft." }],
  [/magnet/i, { kids: "Magnets pull on some metals like iron. Every magnet has two ends, called poles, and opposite poles stick together!", older: "Magnetism comes from moving electric charges. In magnets, the tiny magnetic fields of many atoms line up, creating north and south poles." }],
  [/ocean|sea|fish/i, { kids: "The deep ocean is dark and cold, but amazing animals live there. Some, like anglerfish, make their own light!", older: "Below about 200 metres sunlight fades. Deep-sea animals have adaptations like bioluminescence and slow metabolisms to survive the cold and pressure." }],
  [/friend/i, { kids: "A good way to make a friend is to say hello and ask what they like to play. Being kind and a good listener works every time!", older: "Start small: ask questions, share an interest, and be reliable. Friendships grow through shared time and kindness." }],
  [/brave|tricky|scared|hard day/i, { kids: "Thank you for telling me. Tricky days happen to everyone. Take three slow breaths with me, and remember you can always talk to a grown-up you trust.", older: "That sounds tough, and it's okay to feel that way. Try a few slow breaths, and consider talking to someone you trust about it." }],
  [/song|story|invent|animal|draw/i, { kids: "Let's make something! How about a happy rainbow penguin who loves to dance? What colour are its dancing shoes?", older: "Here's a creative spark: invent a creature that lives where two habitats meet, like a reef and a river. What does it eat, and what's its superpower?" }],
  [/fact/i, { kids: "Here's a fact: octopuses have three hearts! Two work for the gills and one for the body.", older: "Fact: a day on Venus is longer than its year. Venus spins so slowly that one rotation takes about 243 Earth days, while its orbit takes about 225." }],
];
const OPENER: Record<string, string> = { sage: "Hoo-hoo! ", phoenix: "✨ ", nova: "Beep boop! ", echo: "" };

function demoReply(text: string, characterId: string | null, age: string) {
  const hit = TOPICS.find(([re]) => re.test(text));
  const body = hit ? (age === "kids" ? hit[1].kids : hit[1].older) : "That's a great thing to wonder about! (Preview reply: in the live app your guide answers this with the AI model, in the style you've chosen.)";
  return (OPENER[characterId ?? ""] ?? "") + body;
}

/* ------------------------------------------------------------- handlers */
type Handler = (input: any) => any;
const H: Record<string, Handler> = {
  "system.health": () => ({ ok: true }),

  "auth.me": () => S.user,
  "auth.register": ({ email, name }) => {
    S.user = { id: "demo-parent", email, name: name ?? null, role: "user", loginMethod: "email", createdAt: new Date(), lastSignedIn: new Date() };
    return S.user;
  },
  "auth.login": ({ email }) => {
    S.user = { id: "demo-parent", email, name: null, role: "user", loginMethod: "email", createdAt: new Date(), lastSignedIn: new Date() };
    return S.user;
  },
  "auth.logout": () => { S.user = null; S.unlocked = false; return { success: true }; },

  "consent.status": () => {
    requireUser();
    return { version: CONSENT_VERSION, granted: !!S.consent && S.consent.version === CONSENT_VERSION, grantedVersion: S.consent?.version ?? null, grantedAt: S.consent?.grantedAt ?? null, contactEmail: null };
  },
  "consent.grant": () => { requireUser(); S.consent = { version: CONSENT_VERSION, grantedAt: new Date() }; log("consent_granted", CONSENT_VERSION); return { success: true }; },
  "consent.withdraw": () => { requireParent(); S.consent = null; log("consent_withdrawn"); return { success: true }; },

  "parent.status": () => { requireUser(); return { hasPin: !!S.pin, unlocked: S.unlocked }; },
  "parent.setPin": ({ pin, currentPin }) => {
    requireUser();
    if (S.pin && currentPin !== S.pin) throw new DemoError("FORBIDDEN", "Current PIN is incorrect");
    S.pin = pin; S.unlocked = true; log(S.pin ? "pin_changed" : "pin_set"); return { success: true };
  },
  "parent.unlock": ({ pin }) => {
    requireUser();
    if (!S.pin) return { valid: false, needsSetup: true };
    const valid = pin === S.pin; if (valid) S.unlocked = true;
    return { valid, needsSetup: false };
  },
  "parent.lock": () => { S.unlocked = false; return { success: true }; },
  "parent.getSettings": () => { requireParent(); return { dailyLimit: "30", allowedHours: null }; },
  "parent.updateSettings": () => { requireParent(); return { success: true }; },
  "parent.getActivityReport": () => {
    requireParent();
    const sessions = [...S.sessions].sort((a, b) => +b.createdAt - +a.createdAt);
    return { sessions, messages: S.messages, flaggedMessages: S.messages.filter(m => m.flagged !== "safe"), totalSessions: sessions.length, totalMessages: S.messages.length };
  },

  "profiles.list": () => { requireUser(); return S.profiles.map(({ id, childName, ageGroup, selectedCharacter }) => ({ id, childName, ageGroup, selectedCharacter })); },
  "profiles.create": ({ childName, ageGroup, selectedCharacter }) => {
    requireParent(); requireConsent();
    if (screenText(childName).level !== "safe") throw new DemoError("BAD_REQUEST", "Please use just a first name or nickname.");
    if (S.profiles.length >= 6) throw new DemoError("BAD_REQUEST", "You can add up to 6 children.");
    const p: Profile = { id: uid(), userId: "demo-parent", childName, ageGroup, selectedCharacter: selectedCharacter ?? null, createdAt: new Date() };
    S.profiles.push(p); log("profile_created", childName); return { id: p.id };
  },
  "profiles.update": ({ profileId, ...rest }) => { requireParent(); requireConsent(); Object.assign(profile(profileId), Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined))); return { success: true }; },
  "profiles.delete": ({ profileId }) => {
    requireParent(); const p = profile(profileId);
    const sids = S.sessions.filter(s => s.profileId === profileId).map(s => s.id);
    S.messages = S.messages.filter(m => !sids.includes(m.sessionId)); S.sessions = S.sessions.filter(s => s.profileId !== profileId);
    S.plays = S.plays.filter(x => x.profileId !== profileId); S.moods = S.moods.filter(m => m.profileId !== profileId);
    S.progress.delete(profileId); S.badges.delete(profileId); S.profiles = S.profiles.filter(x => x.id !== profileId);
    log("profile_deleted", p.childName); return { success: true };
  },
  "profiles.export": ({ profileId }) => {
    requireParent(); const p = profile(profileId); log("profile_exported", p.childName);
    return { exportedAt: new Date().toISOString(), profile: p, chats: [], progress: { progress: S.progress.get(profileId) ?? null, plays: S.plays.filter(x => x.profileId === profileId), badges: S.badges.get(profileId) ?? [], moods: S.moods.filter(m => m.profileId === profileId) } };
  },

  "progress.get": ({ profileId, localDay }) => { requireConsent(); profile(profileId); return snapshot(profileId, localDay); },
  "progress.submitPlay": ({ profileId, game, level, correct, total, localDay }) => {
    requireConsent(); profile(profileId);
    if (correct > total) throw new DemoError("BAD_REQUEST", "correct cannot exceed total");
    const out = recordPlay(profileId, game, level, correct, total, resolvePlayDay(localDay, new Date()));
    return { ...out, newBadges: named(out.newBadges) };
  },
  "progress.checkin": ({ profileId, mood, note }) => {
    requireConsent(); profile(profileId);
    const verdict = note ? screenText(note) : { level: "safe" as const };
    S.moods.push({ profileId, mood, note: note ?? null, flagged: verdict.level, createdAt: new Date() });
    const fresh = award(profileId);
    return { flagged: verdict.level, reply: verdict.level === "safe" ? null : ("reply" in verdict ? verdict.reply ?? null : null), newBadges: named(fresh) };
  },
  "progress.overview": () => {
    requireParent();
    return S.profiles.map(p => ({
      profile: { id: p.id, childName: p.childName, ageGroup: p.ageGroup },
      progress: snapshot(p.id),
      moods: S.moods.filter(m => m.profileId === p.id).sort((a, b) => +b.createdAt - +a.createdAt).slice(0, 14).map(m => ({ mood: m.mood, note: m.note, flagged: m.flagged, createdAt: m.createdAt })),
    }));
  },

  "accessibility.getSettings": () => ({ ...S.a11y }),
  "accessibility.updateSettings": i => { S.a11y = { dyslexiaMode: +i.dyslexiaMode, adhdMode: +i.adhdMode, autismMode: +i.autismMode, fontSize: i.fontSize, highContrast: +i.highContrast, textToSpeech: +i.textToSpeech, reducedMotion: +i.reducedMotion }; return { success: true }; },

  "chat.createSession": ({ profileId, characterId }) => {
    requireConsent(); const p = profile(profileId);
    const s: Session = { id: uid(), userId: "demo-parent", profileId, childName: p.childName, characterId: characterId ?? p.selectedCharacter, ageGroup: p.ageGroup, createdAt: new Date() };
    S.sessions.push(s); return { sessionId: s.id };
  },
  "chat.getMessages": ({ sessionId }) => { requireUser(); return S.messages.filter(m => m.sessionId === sessionId).sort((a, b) => +a.createdAt - +b.createdAt); },
  "chat.getAllSessions": () => { requireUser(); return S.sessions; },
  "chat.sendMessage": ({ sessionId, message }) => {
    requireConsent();
    const s = S.sessions.find(x => x.id === sessionId); if (!s) throw new DemoError("NOT_FOUND", "Chat session not found");
    const v = screenText(message); const now = Date.now();
    S.messages.push({ id: uid(), sessionId, role: "user", content: message, flagged: v.level, createdAt: new Date(now) });
    const reply = v.level !== "safe" ? (v.reply as string) : demoReply(message, s.characterId, s.ageGroup);
    S.messages.push({ id: uid(), sessionId, role: "assistant", content: reply, flagged: "safe", createdAt: new Date(now + 1) });
    return { message: reply, flagged: v.level };
  },

  "creative.generateStory": ({ prompt }) => {
    requireConsent();
    if (screenText(prompt).level !== "safe") throw new DemoError("BAD_REQUEST", "That's not something I can write about. Let's try a different idea!");
    return { content: `Once upon a time, there was ${prompt}.\n\nOne bright morning, something surprising happened. A small problem appeared, and it needed a clever, kind answer. With a deep breath and a big smile, our hero decided to try.\n\nAlong the way, new friends joined the adventure. Together they worked it out, and everyone learned that being curious and brave makes the world a little bit brighter.\n\nThe end.\n\n(Preview story: in the live app the AI writes a new story every time.)` };
  },
  "creative.generateIllustration": () => { requireConsent(); throw new DemoError("INTERNAL_SERVER_ERROR", "Pictures need the live app. The preview can't paint them."); },
  "creative.generateAvatar": () => { requireConsent(); throw new DemoError("INTERNAL_SERVER_ERROR", "Pictures need the live app."); },
  "homework.analyzeHomework": () => {
    requireConsent();
    return { question: "What is 12 + 15?", steps: ["Split each number into tens and ones: 12 = 10 + 2 and 15 = 10 + 5.", "Add the tens: 10 + 10 = 20.", "Add the ones: 2 + 5 = 7.", "Put them together: 20 + 7 = 27."], answer: "27", explanation: "Splitting numbers into tens and ones makes adding easier. (Preview: the live app reads your actual photo.)", subject: "Maths", difficulty: "easy" };
  },
  "homework.getHomeworkHistory": () => [],

  "pet.getMyPet": () => { requireUser(); return S.pet; },
  "pet.createPet": ({ type, name }) => { requireConsent(); S.pet = { id: uid(), name, type, level: 1, experience: 0, happiness: 100, hunger: 0, evolution: "baby" }; return { success: true }; },
  "pet.feedPet": () => { if (!S.pet) return { success: false }; S.pet.hunger = Math.max(0, S.pet.hunger - 30); S.pet.happiness = Math.min(100, S.pet.happiness + 10); return { success: true }; },
  "pet.playWithPet": () => {
    if (!S.pet) return { success: false };
    S.pet.experience += 20; S.pet.level = Math.floor(S.pet.experience / 100) + 1;
    S.pet.evolution = S.pet.level >= 10 ? "adult" : S.pet.level >= 5 ? "teen" : S.pet.level >= 2 ? "child" : "baby";
    S.pet.happiness = Math.min(100, S.pet.happiness + 15); S.pet.hunger = Math.min(100, S.pet.hunger + 5); return { success: true };
  },

  "reports.getLatestReport": () => S.report,
  "reports.generateReport": () => {
    requireConsent();
    S.report = { id: uid(), childName: S.profiles[0]?.childName ?? "Student", totalMessages: S.messages.length, totalSessions: S.sessions.length, strengths: "Asks curious questions about science and animals. (Preview text.)", weaknesses: "Could explore more about history and geography.", recommendations: "Try a new topic each week and ask a follow-up question." };
    return S.report;
  },
  "summaries.getLatest": () => S.summary,
  "summaries.generate": () => {
    requireConsent();
    const end = new Date(); S.summary = { id: uid(), weekStart: new Date(+end - 7 * dayMs), weekEnd: end, totalMessages: S.messages.length, totalSessions: S.sessions.length, topicsCovered: "Space, animals and everyday science. (Preview text.)", strengths: "Curious and keeps asking follow-up questions.", areasToImprove: "Try longer, more detailed questions.", recommendations: "Explore a science book together this weekend." };
    return S.summary;
  },
  "account.auditLog": () => { requireParent(); return S.audit; },
  "account.delete": () => { S = fresh(); seed(); return { success: true }; },
};

/* ----------------------------------------------------------------- seed */
/** Example data so the parent area and trophy room are not empty on first open. */
function seed() {
  const p: Profile = { id: "p-alex", userId: "demo-parent", childName: "Alex", ageGroup: "kids", selectedCharacter: "nova", createdAt: new Date() };
  S.profiles.push(p);
  const d = (n: number) => new Date(Date.now() - n * dayMs);
  recordPlay(p.id, "math", 1, 8, 10, isoLocal(d(2)), d(2));
  recordPlay(p.id, "quiz", 1, 6, 8, isoLocal(d(1)), d(1));
  recordPlay(p.id, "spelling", 1, 8, 8, isoLocal(d(1)), d(1));
  S.moods.push({ profileId: p.id, mood: "happy", note: null, flagged: "safe", createdAt: d(2) }, { profileId: p.id, mood: "worried", note: null, flagged: "safe", createdAt: d(1) });
  award(p.id);
}
seed();

/* ---------------------------------------------------------------- fetch */
export const resetDemo = () => { S = fresh(); seed(); };

/** Drop-in replacement for window.fetch that answers tRPC batch calls from the in-memory handlers. */
export async function demoFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, "http://demo.local");
  const paths = decodeURIComponent(url.pathname.replace(/^.*\/api\/trpc\//, "")).split(",");
  const raw = (init?.method ?? "GET").toUpperCase() === "GET" ? url.searchParams.get("input") : (init?.body as string | null);
  const batch = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  const results = paths.map((path, i) => {
    try {
      const h = H[path];
      if (!h) throw new DemoError("NOT_FOUND", `No procedure found on path "${path}"`);
      const arg = batch[i] === undefined ? undefined : superjson.deserialize(batch[i] as any);
      return { result: { data: superjson.serialize(h(arg) ?? null) } };
    } catch (e) {
      const err = e instanceof DemoError ? e : new DemoError("INTERNAL_SERVER_ERROR", e instanceof Error ? e.message : "Error");
      return { error: superjson.serialize({ message: err.message, code: -32603, data: { code: err.code, httpStatus: HTTP[err.code] ?? 500, path } }) };
    }
  });
  await new Promise(r => setTimeout(r, 60)); // feel like a network call
  return new Response(JSON.stringify(results), { status: 200, headers: { "content-type": "application/json" } });
}

void BADGES; void AI_CHARACTERS;
