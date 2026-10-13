/**
 * In-browser stand-in for the server, used ONLY by the preview build (VITE_DEMO). It answers the same tRPC calls the
 * real UI makes, with in-memory data, and reuses the real shared logic (game XP, streaks, badges, safety screening).
 * What is NOT real here: accounts, the database, the AI model (chat/story/homework replies are canned), image
 * generation, and anything persistent. Nothing leaves the page.
 */
import superjson from "superjson";
import { consentVersionFor } from "@shared/consent";
import { buildClassOverview, type StudentAggregate } from "@shared/classroom";
import { ageGroupForGrade, type AccountType, type Lang } from "@shared/jordan";
import { AI_CHARACTERS } from "@shared/characters";
import {
  BADGES, badgeById, earnedBadgeIds, effectiveStreak, levelFromXp, levelProgress, levelTitle, nextStreak,
  resolvePlayDay, xpForPlay, type GameId, type ProgressStats,
} from "@shared/gamification";
import { screenText, safeFallbackReply } from "../../../server/safety";
import { gradeQuiz, normalizeLesson, studentView, SOURCE_REQUIRED_SUBJECTS, MIN_SOURCE_CHARS, type LessonContent } from "@shared/lesson";
import { UNAUTHED_ERR_MSG } from "@shared/const";
import { aiAssistant, aiChat, aiHomework, aiLessonDraft, aiLessonRevise, aiStory, AiRefused } from "./ai";

class DemoError extends Error {
  constructor(public code: string, message: string) { super(message); }
}
const HTTP: Record<string, number> = { UNAUTHORIZED: 401, FORBIDDEN: 403, NOT_FOUND: 404, BAD_REQUEST: 400, CONFLICT: 409, TOO_MANY_REQUESTS: 429, INTERNAL_SERVER_ERROR: 500 };
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const dayMs = 86_400_000;
const isoLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

type Profile = { id: string; userId: string; childName: string; ageGroup: "kids" | "tweens" | "teens"; selectedCharacter: string | null; classId: string | null; createdAt: Date };
type Cls = { id: string; name: string; grade: number };
type Lesson = { id: string; title: string; subject: string; grade: number; language: Lang; topic: string; durationMin: number; sourceText: string | null; content: LessonContent; updatedAt: Date };
type Share = { id: string; lessonId: string; classId: string; dueDate: string | null; createdAt: Date; archived: boolean };
type Assignment = { id: string; classId: string; game: GameId; level: number; note: string | null; dueDate: string | null; createdAt: Date; archived: boolean };
type Play = { id: string; profileId: string; game: GameId; level: number; correct: number; total: number; xpEarned: number; createdAt: Date };
type Msg = { id: string; sessionId: string; role: "user" | "assistant"; content: string; flagged: "safe" | "review" | "blocked"; createdAt: Date };
type Session = { id: string; userId: string; profileId: string; childName: string; characterId: string | null; ageGroup: string; language: Lang; createdAt: Date };

function fresh() {
  return {
    user: null as null | { id: string; email: string; name: string | null; role: "user"; loginMethod: string; accountType: AccountType; language: Lang | null; createdAt: Date; lastSignedIn: Date },
    consent: null as null | { version: string; grantedAt: Date },
    classes: [] as Cls[],
    lessons: [] as Lesson[],
    shares: [] as Share[],
    lessonResults: [] as Array<{ shareId: string; profileId: string; answers: number[]; correct: number; total: number }>,
    assignments: [] as Assignment[],
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
const accountType = (): AccountType => S.user?.accountType ?? "family";
const requiredVersion = () => consentVersionFor(accountType());
const requireConsent = () => { requireUser(); if (!S.consent || S.consent.version !== requiredVersion()) throw new DemoError("FORBIDDEN", "Parental consent required (10004)"); };
const requireSchool = () => { if (accountType() !== "school") throw new DemoError("FORBIDDEN", "This is only available to school accounts."); };
const klass = (id: string) => { const c = S.classes.find(x => x.id === id); if (!c) throw new DemoError("NOT_FOUND", "Class not found"); return c; };
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

const doneBy = (a: Assignment, profileId: string) => S.plays.some(p => p.profileId === profileId && p.game === a.game && p.level >= a.level && p.createdAt >= a.createdAt);
function assignmentsFor(profileId: string) {
  const classId = S.profiles.find(p => p.id === profileId)?.classId;
  if (!classId) return [];
  return S.assignments.filter(a => a.classId === classId && !a.archived).map(a => ({ id: a.id, game: a.game, level: a.level, note: a.note, dueDate: a.dueDate, done: doneBy(a, profileId) }));
}

function lessonsFor(profileId: string) {
  const classId = S.profiles.find(p => p.id === profileId)?.classId;
  if (!classId) return [];
  return S.shares.filter(sh => sh.classId === classId && !sh.archived).map(sh => {
    const l = S.lessons.find(x => x.id === sh.lessonId)!;
    const r = S.lessonResults.find(x => x.shareId === sh.id && x.profileId === profileId);
    return { shareId: sh.id, title: l.title, subject: l.subject, dueDate: sh.dueDate, done: !!r, result: r ? { correct: r.correct, total: r.total } : null };
  });
}

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
    assignments: assignmentsFor(profileId),
    lessons: lessonsFor(profileId),
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

const AR_TOPICS: Array<[RegExp, string]> = [
  [/سماء|زرق/, "تبدو السماء زرقاء لأن ضوء الشمس مكوّن من ألوان كثيرة، والضوء الأزرق هو الأكثر تشتتاً في الهواء!"],
  [/شمس/, "الشمس كرة ضخمة من الغاز الساخن المتوهّج. وتتسع لأكثر من مليون كرة أرضية!"],
  [/نوم/, "النوم يمنح جسمك ودماغك راحة. وأثناء النوم يرتّب دماغك ما تعلّمته اليوم."],
  [/بركان|براكين/, "البركان جبل فيه فتحة في الأعلى. تخرج منها الحمم، وهي صخور منصهرة من أعماق الأرض!"],
  [/طائر|طير|طيران/, "أجنحة الطائرة منحنية فيتحرك الهواء فوقها أسرع، وهذا يرفع الطائرة إلى السماء."],
  [/صديق|أصدقاء/, "يمكنك أن تلقي التحية على طفل جديد وتسأله عمّا يحب أن يلعب. اللطف والإصغاء ينفعان دائماً!"],
  [/يوم صعب|شجاع|خائف/, "شكراً لأنك أخبرتني. تمرّ على الجميع أيام صعبة. خذ ثلاثة أنفاس بطيئة معي، وتذكّر أنك تستطيع دائماً أن تتحدث إلى شخص بالغ تثق به."],
];
const OPENER_AR: Record<string, string> = { sage: "هو-هو! ", phoenix: "✨ ", nova: "بيب بوب! ", echo: "" };
function demoReplyAr(text: string, characterId: string | null) {
  const hit = AR_TOPICS.find(([re]) => re.test(text));
  return (OPENER_AR[characterId ?? ""] ?? "") + (hit ? hit[1] : "هذا سؤال رائع! (ردّ تجريبي: في التطبيق الحقيقي يجيب مرشدك عن هذا بنموذج الذكاء الاصطناعي.)");
}

function demoReply(text: string, characterId: string | null, age: string, lang: Lang = "en") {
  if (lang === "ar") return demoReplyAr(text, characterId);
  const hit = TOPICS.find(([re]) => re.test(text));
  const body = hit ? (age === "kids" ? hit[1].kids : hit[1].older) : "That's a great thing to wonder about! (Preview reply: in the live app your guide answers this with the AI model, in the style you've chosen.)";
  return (OPENER[characterId ?? ""] ?? "") + body;
}

/* --------------------------------------------------------------- lessons */
/** A canned lesson about the requested topic. The live app has the AI model write a real one from the request. */
function cannedLesson(topic: string, lang: Lang, source: string | null): LessonContent {
  const ar = lang === "ar";
  return normalizeLesson(ar ? {
    objectives: [`أن يفهم الطالب فكرة: ${topic}`, "أن يطبّق الفكرة على مثال بسيط", "أن يشرح بكلماته ما تعلّمه"],
    warmup: { title: "سؤال افتتاحي", script: `اسأل الطلاب: ماذا تعرفون عن «${topic}»؟ اجمع إجاباتهم على اللوح دون تصحيح.`, minutes: 5 },
    steps: [
      { title: "نقدّم الفكرة", explanation: `اشرح الفكرة الرئيسية في «${topic}» بجملتين، ثم اطلب من طالبين إعادتها بكلماتهما.`, board: ["الفكرة الرئيسية", "كلمة جديدة نكتبها"], minutes: 10 },
      { title: "مثال محلول", explanation: "حلّ مثالاً أمام الطلاب وأنت تفكّر بصوت عالٍ.", board: ["الخطوة 1", "الخطوة 2", "الناتج"], minutes: 10 },
      { title: "نتدرّب معاً", explanation: "يحلّ الطلاب مثالين في أزواج وأنت تتجوّل بينهم.", board: [], minutes: 10 },
    ],
    examples: [{ prompt: "3/8 + 2/8 = ؟", solution: "5/8" }],
    activities: [{ title: "تمرين الأزواج", mode: "pair", instructions: "يكتب كل طالب سؤالاً لزميله ثم يتبادلان الحل.", minutes: 10 }],
    quiz: [
      { q: "1/4 + 2/4 = ؟", options: ["3/8", "3/4", "2/4", "1/2"], answer: 1, explanation: "نجمع البسطين ونُبقي المقام." },
      { q: "2/5 + 2/5 = ؟", options: ["4/10", "4/5", "2/5", "1/5"], answer: 1, explanation: "المقام لا يتغيّر." },
      { q: "3/9 + 4/9 = ؟", options: ["7/18", "7/9", "12/9", "1/9"], answer: 1, explanation: "3 + 4 = 7 والمقام 9." },
    ],
    differentiation: { support: "استخدم الرسم والأشكال لتمثيل الأجزاء.", extension: "اطلب من الطلاب اختراع مسألة كلامية." },
    misconceptions: ["جمع المقامين مع بعضهما"],
    homework: "حلّ ثلاث مسائل من الكتاب.",
    studentSummary: [`فكرة اليوم: ${topic}.`, "حين يكون المقام واحداً نجمع البسطين فقط."],
  } : {
    objectives: [`Understand the idea of: ${topic}`, "Apply it to a simple example", "Explain it in their own words"],
    warmup: { title: "Opening question", script: `Ask the class: what do you already know about "${topic}"? Collect answers on the board without correcting them.`, minutes: 5 },
    steps: [
      { title: "Introduce the idea", explanation: `Explain the main idea of "${topic}" in two sentences, then ask two students to say it back in their own words.`, board: ["The main idea", "A new word to write down"], minutes: 10 },
      { title: "A worked example", explanation: "Solve one example in front of the class while thinking aloud.", board: ["Step 1", "Step 2", "Answer"], minutes: 10 },
      { title: "Practise together", explanation: "Students solve two examples in pairs while you walk around.", board: [], minutes: 10 },
    ],
    examples: [{ prompt: "3/8 + 2/8 = ?", solution: "5/8" }],
    activities: [{ title: "Partner challenge", mode: "pair", instructions: "Each student writes a question for their partner, then they swap and solve.", minutes: 10 }],
    quiz: [
      { q: "1/4 + 2/4 = ?", options: ["3/8", "3/4", "2/4", "1/2"], answer: 1, explanation: "Add the tops and keep the bottom." },
      { q: "2/5 + 2/5 = ?", options: ["4/10", "4/5", "2/5", "1/5"], answer: 1, explanation: "The denominator stays the same." },
      { q: "3/9 + 4/9 = ?", options: ["7/18", "7/9", "12/9", "1/9"], answer: 1, explanation: "3 + 4 = 7 and the bottom is 9." },
    ],
    differentiation: { support: "Use drawings and shapes to show the parts.", extension: "Ask students to invent a word problem." },
    misconceptions: ["Adding the two denominators together"],
    homework: "Solve three problems from the textbook.",
    studentSummary: [`Today's idea: ${topic}.`, "When the bottom number is the same, add only the tops."],
  });
}
const lessonOf = (id: string) => { const l = S.lessons.find(x => x.id === id); if (!l) throw new DemoError("NOT_FOUND", "Lesson not found"); return l; };
const shareOf = (id: string) => { const sh = S.shares.find(x => x.id === id); if (!sh) throw new DemoError("NOT_FOUND", "Shared lesson not found"); return sh; };

/* ------------------------------------------------------------- handlers */
type Handler = (input: any) => any;
const H: Record<string, Handler> = {
  "system.health": () => ({ ok: true }),

  "auth.me": () => S.user,
  "auth.register": ({ email, name, accountType: type, language }) => {
    S.user = { id: "demo-parent", email, name: name ?? null, role: "user", loginMethod: "email", accountType: type ?? "family", language: language ?? null, createdAt: new Date(), lastSignedIn: new Date() };
    S.profiles = []; S.progress.clear(); S.plays = []; S.badges.clear(); S.moods = []; S.classes = []; S.assignments = []; S.lessons = []; S.shares = []; S.lessonResults = [];
    if (S.user.accountType === "school") seedSchool(language ?? "en"); else seed();
    return S.user;
  },
  "auth.login": ({ email }) => {
    S.user = { id: "demo-parent", email, name: null, role: "user", loginMethod: "email", accountType: S.user?.accountType ?? "family", language: S.user?.language ?? null, createdAt: new Date(), lastSignedIn: new Date() };
    return S.user;
  },
  "auth.setLanguage": ({ language }) => { requireUser(); S.user!.language = language; return { success: true }; },
  "auth.logout": () => { S.user = null; S.unlocked = false; return { success: true }; },

  "consent.status": () => {
    requireUser();
    return { version: requiredVersion(), accountType: accountType(), granted: !!S.consent && S.consent.version === requiredVersion(), grantedVersion: S.consent?.version ?? null, grantedAt: S.consent?.grantedAt ?? null, contactEmail: null };
  },
  "consent.grant": ({ version }) => {
    requireUser();
    if (version !== requiredVersion()) throw new DemoError("BAD_REQUEST", "The consent wording has changed. Please reload the page and read it again.");
    S.consent = { version: requiredVersion(), grantedAt: new Date() }; log("consent_granted", requiredVersion()); return { success: true };
  },
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

  "profiles.list": () => { requireUser(); return S.profiles.map(({ id, childName, ageGroup, selectedCharacter, classId }) => ({ id, childName, ageGroup, selectedCharacter, classId })); },
  "profiles.create": ({ childName, ageGroup, selectedCharacter, classId }) => {
    requireParent(); requireConsent();
    if (screenText(childName).level !== "safe") throw new DemoError("BAD_REQUEST", "Please use just a first name or nickname.");
    if (S.profiles.length >= (accountType() === "school" ? 400 : 6)) throw new DemoError("BAD_REQUEST", accountType() === "school" ? "An account can have up to 400 students." : "You can add up to 6 children.");
    let age = ageGroup;
    if (classId) { requireSchool(); age ??= ageGroupForGrade(klass(classId).grade); }
    if (!age) throw new DemoError("BAD_REQUEST", "Choose an age group.");
    const p: Profile = { id: uid(), userId: "demo-parent", childName, ageGroup: age, selectedCharacter: selectedCharacter ?? null, classId: classId ?? null, createdAt: new Date() };
    S.profiles.push(p); log("profile_created", childName); return { id: p.id };
  },
  "profiles.importRoster": ({ classId, names }) => {
    requireParent(); requireConsent(); requireSchool();
    const cls = klass(classId);
    const existing = new Set(S.profiles.filter(p => p.classId === classId).map(p => p.childName.toLowerCase()));
    const created: string[] = [];
    const skipped: Array<{ name: string; reason: "empty" | "too_long" | "contact_details" | "duplicate" | "class_full" }> = [];
    for (const raw of names as string[]) {
      const name = raw.replace(/\s+/g, " ").trim();
      if (!name) { skipped.push({ name: raw, reason: "empty" }); continue; }
      if (name.length > 50) { skipped.push({ name, reason: "too_long" }); continue; }
      if (screenText(name).level !== "safe") { skipped.push({ name, reason: "contact_details" }); continue; }
      if (existing.has(name.toLowerCase())) { skipped.push({ name, reason: "duplicate" }); continue; }
      if (existing.size >= 60) { skipped.push({ name, reason: "class_full" }); continue; }
      S.profiles.push({ id: uid(), userId: "demo-parent", childName: name, ageGroup: ageGroupForGrade(cls.grade), selectedCharacter: null, classId, createdAt: new Date() });
      existing.add(name.toLowerCase()); created.push(name);
    }
    log("roster_imported", `${cls.name}: ${created.length} added, ${skipped.length} skipped`);
    return { created: created.length, skipped };
  },

  "classes.list": () => { requireUser(); return S.classes.map(c => ({ id: c.id, name: c.name, grade: c.grade, studentCount: S.profiles.filter(p => p.classId === c.id).length })); },
  "classes.create": ({ name, grade }) => {
    requireParent(); requireConsent(); requireSchool();
    if (screenText(name).level !== "safe") throw new DemoError("BAD_REQUEST", "Please use just a first name or nickname.");
    if (S.classes.length >= 20) throw new DemoError("BAD_REQUEST", "You can have up to 20 classes.");
    const c: Cls = { id: uid(), name, grade }; S.classes.push(c); log("class_created", name); return { id: c.id };
  },
  "classes.update": ({ classId, ...rest }) => { requireParent(); requireSchool(); Object.assign(klass(classId), Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined))); return { success: true }; },
  "classes.delete": ({ classId }) => {
    requireParent(); requireSchool(); const c = klass(classId);
    S.profiles.forEach(p => { if (p.classId === classId) p.classId = null; });
    const sids = S.shares.filter(x => x.classId === classId).map(x => x.id);
    S.lessonResults = S.lessonResults.filter(r => !sids.includes(r.shareId)); S.shares = S.shares.filter(x => x.classId !== classId);
    S.assignments = S.assignments.filter(a => a.classId !== classId); S.classes = S.classes.filter(x => x.id !== classId);
    log("class_deleted", c.name); return { success: true };
  },
  "classes.overview": ({ classId, localDay }) => {
    requireParent(); requireSchool(); const c = klass(classId);
    const open = S.assignments.filter(a => a.classId === classId && !a.archived);
    const aggregates: StudentAggregate[] = S.profiles.filter(p => p.classId === classId).map(p => {
      const row = S.progress.get(p.id);
      const plays: StudentAggregate["plays"] = {};
      let last: Date | null = null;
      for (const pl of S.plays.filter(x => x.profileId === p.id)) {
        const g = plays[pl.game] ?? { plays: 0, correct: 0, total: 0 };
        g.plays++; g.correct += pl.correct; g.total += pl.total; plays[pl.game] = g;
        if (!last || pl.createdAt > last) last = pl.createdAt;
      }
      const sids = S.sessions.filter(s => s.profileId === p.id).map(s => s.id);
      const moods = S.moods.filter(m => m.profileId === p.id).sort((a, b) => +b.createdAt - +a.createdAt);
      return {
        profileId: p.id, childName: p.childName, ageGroup: p.ageGroup, xp: row?.xp ?? 0, streakDays: row?.streakDays ?? 0, lastPlayDate: row?.lastPlayDate ?? null,
        plays, lastPlayedAt: last, flaggedMessages: S.messages.filter(m => sids.includes(m.sessionId) && m.role === "user" && m.flagged !== "safe").length,
        flaggedMoods: moods.filter(m => m.flagged !== "safe").length, lastMood: moods[0]?.mood ?? null, assignmentsDone: open.filter(a => doneBy(a, p.id)).length,
      };
    });
    return { class: { id: c.id, name: c.name, grade: c.grade }, ...buildClassOverview(aggregates, open.length, resolvePlayDay(localDay, new Date())) };
  },
  "lessons.list": () => { requireParent(); requireSchool(); return [...S.lessons].sort((a, b) => +b.updatedAt - +a.updatedAt).map(l => ({ id: l.id, title: l.title, subject: l.subject, grade: l.grade, language: l.language, topic: l.topic, durationMin: l.durationMin, createdAt: l.updatedAt, updatedAt: l.updatedAt, sharedWith: S.shares.filter(x => x.lessonId === l.id && !x.archived).length })); },
  "lessons.get": ({ lessonId }) => { requireParent(); requireSchool(); const l = lessonOf(lessonId); return { id: l.id, title: l.title, subject: l.subject, grade: l.grade, language: l.language, topic: l.topic, durationMin: l.durationMin, hasSource: !!l.sourceText, content: l.content, updatedAt: l.updatedAt }; },
  "lessons.generate": async ({ subject, grade, topic, durationMin, language, sourceText }) => {
    requireParent(); requireConsent(); requireSchool();
    if ((SOURCE_REQUIRED_SUBJECTS as readonly string[]).includes(subject) && (sourceText?.length ?? 0) < MIN_SOURCE_CHARS) throw new DemoError("BAD_REQUEST", "For this subject, paste the textbook passage you are teaching from so the lesson stays faithful to it.");
    const l: Lesson = { id: uid(), title: topic.slice(0, 200), subject, grade, language, topic, durationMin, sourceText: sourceText ?? null, content: (await ai(() => aiLessonDraft({ subject, grade, topic, durationMin, language, sourceText }))) ?? cannedLesson(topic, language, sourceText ?? null), updatedAt: new Date() };
    S.lessons.push(l); log("lesson_created", topic.slice(0, 100)); return { id: l.id };
  },
  "lessons.revise": async ({ lessonId, instruction }) => {
    requireParent(); requireConsent(); requireSchool(); const l = lessonOf(lessonId);
    const ar = l.language === "ar";
    const revised = await ai(() => aiLessonRevise(l.content, instruction, l.language));
    if (revised) l.content = revised;
    else if (/short|قصر/i.test(instruction)) l.content = normalizeLesson({ ...l.content, steps: l.content.steps.slice(0, 2), activities: [] });
    else l.content = normalizeLesson({ ...l.content, quiz: [...l.content.quiz, { q: ar ? "1/6 + 2/6 = ؟" : "1/6 + 2/6 = ?", options: ["3/12", "3/6", "2/6", "1/6"], answer: 1, explanation: ar ? "نجمع البسطين." : "Add the tops." }] });
    l.updatedAt = new Date(); return { success: true };
  },
  "lessons.update": ({ lessonId, title, content }) => {
    requireParent(); requireConsent(); requireSchool(); const l = lessonOf(lessonId);
    if (title) l.title = title;
    if (content !== undefined) { try { l.content = normalizeLesson(content); } catch { throw new DemoError("BAD_REQUEST", "A lesson needs at least one teaching step."); } }
    l.updatedAt = new Date(); return { success: true };
  },
  "lessons.delete": ({ lessonId }) => {
    requireParent(); requireSchool(); const l = lessonOf(lessonId);
    const sids = S.shares.filter(x => x.lessonId === l.id).map(x => x.id);
    S.lessonResults = S.lessonResults.filter(r => !sids.includes(r.shareId)); S.shares = S.shares.filter(x => x.lessonId !== l.id); S.lessons = S.lessons.filter(x => x.id !== l.id);
    log("lesson_deleted", l.title.slice(0, 100)); return { success: true };
  },
  "lessons.share": ({ lessonId, classId, dueDate }) => {
    requireParent(); requireConsent(); requireSchool(); const l = lessonOf(lessonId); const c = klass(classId);
    if (l.content.quiz.length === 0) throw new DemoError("BAD_REQUEST", "Add at least one quiz question before sharing this lesson with students.");
    const open = S.shares.filter(x => x.classId === classId && !x.archived);
    if (open.some(x => x.lessonId === lessonId)) throw new DemoError("CONFLICT", "This lesson is already shared with that class.");
    if (open.length >= 10) throw new DemoError("BAD_REQUEST", "A class can have up to 10 shared lessons. Archive one first.");
    const sh: Share = { id: uid(), lessonId, classId, dueDate: dueDate ?? null, createdAt: new Date(), archived: false };
    S.shares.push(sh); log("lesson_shared", `${l.title.slice(0, 60)} → ${c.name}`); return { id: sh.id };
  },
  "lessons.shares": ({ classId }) => {
    requireParent(); requireSchool();
    return S.shares.filter(x => !x.archived && (!classId || x.classId === classId)).map(sh => ({ id: sh.id, lessonId: sh.lessonId, classId: sh.classId, dueDate: sh.dueDate, createdAt: sh.createdAt, lessonTitle: S.lessons.find(l => l.id === sh.lessonId)?.title ?? "", className: S.classes.find(c => c.id === sh.classId)?.name ?? "" }));
  },
  "lessons.archiveShare": ({ shareId }) => { requireParent(); requireSchool(); shareOf(shareId).archived = true; return { success: true }; },
  "lessons.results": ({ shareId }) => {
    requireParent(); requireSchool(); const sh = shareOf(shareId); const l = lessonOf(sh.lessonId);
    const students = S.profiles.filter(p => p.classId === sh.classId);
    const graded = S.lessonResults.filter(r => r.shareId === shareId).map(r => ({ profileId: r.profileId, ...gradeQuiz(l.content.quiz, r.answers) }));
    return {
      lessonTitle: l.title, studentCount: students.length, doneCount: graded.length,
      questions: l.content.quiz.map((q, i) => ({ q: q.q, percentCorrect: graded.length ? Math.round((graded.filter(g => g.perQuestion[i]).length / graded.length) * 100) : null })),
      students: students.map(st => { const g = graded.find(x => x.profileId === st.id); return { profileId: st.id, childName: st.childName, correct: g?.correct ?? null, total: g?.total ?? l.content.quiz.length }; }),
    };
  },
  "assistant.ask": async ({ messages, language }) => {
    requireParent(); requireConsent(); requireSchool();
    const last = String(messages[messages.length - 1]?.content ?? "");
    const live = await ai(() => aiAssistant(messages, language));
    if (live) return { reply: live };
    return { reply: language === "ar"
      ? `اقتراح تجريبي: ابدأ بمثال من حياة الطلاب اليومية، ثم اطلب منهم تفسيره بكلماتهم. (ردّ تجريبي: في التطبيق الحقيقي يجيب المساعد عن سؤالك «${last.slice(0, 60)}» بالذكاء الاصطناعي.)`
      : `Preview suggestion: start with an example from the students' everyday life, then ask them to explain it in their own words. (Preview reply: in the live app the companion answers "${last.slice(0, 60)}" with the AI model.)` };
  },
  "studentLessons.get": ({ profileId, shareId }) => {
    requireConsent(); const p = profile(profileId); const sh = shareOf(shareId);
    if (sh.archived || sh.classId !== p.classId) throw new DemoError("NOT_FOUND", "Lesson not found");
    const l = lessonOf(sh.lessonId); const r = S.lessonResults.find(x => x.shareId === shareId && x.profileId === profileId);
    return { title: l.title, subject: l.subject, language: l.language, ...studentView(l.content), result: r ? { correct: r.correct, total: r.total } : null };
  },
  "studentLessons.submit": ({ profileId, shareId, answers, localDay }) => {
    requireConsent(); const p = profile(profileId); const sh = shareOf(shareId);
    if (sh.archived || sh.classId !== p.classId) throw new DemoError("NOT_FOUND", "Lesson not found");
    const l = lessonOf(sh.lessonId);
    if (answers.length !== l.content.quiz.length) throw new DemoError("BAD_REQUEST", "Answer every question.");
    const g = gradeQuiz(l.content.quiz, answers);
    const review = l.content.quiz.map((q, i) => ({ correctAnswer: q.answer, explanation: q.explanation, right: g.perQuestion[i] }));
    const first = S.lessonResults.find(x => x.shareId === shareId && x.profileId === profileId);
    if (first) return { already: true, correct: first.correct, total: first.total, review, xpEarned: 0, xp: null, leveledUp: false, newBadges: [] };
    S.lessonResults.push({ shareId, profileId, answers, correct: g.correct, total: g.total });
    const out = recordPlay(profileId, "quiz", 1, g.correct, g.total, resolvePlayDay(localDay, new Date()));
    return { already: false, correct: g.correct, total: g.total, review, xpEarned: out.xpEarned, xp: out.xp, leveledUp: out.leveledUp, newBadges: named(out.newBadges) };
  },
  "assignments.list": ({ classId }) => {
    requireParent(); requireSchool(); klass(classId);
    const ids = S.profiles.filter(p => p.classId === classId).map(p => p.id);
    return S.assignments.filter(a => a.classId === classId && !a.archived).map(a => ({ id: a.id, game: a.game, level: a.level, note: a.note, dueDate: a.dueDate, createdAt: a.createdAt, doneCount: ids.filter(id => doneBy(a, id)).length, studentCount: ids.length }));
  },
  "assignments.create": ({ classId, game, level, note, dueDate }) => {
    requireParent(); requireConsent(); requireSchool(); klass(classId);
    if (note && screenText(note).level !== "safe") throw new DemoError("BAD_REQUEST", "Please remove contact details or unsuitable words from the note.");
    if (S.assignments.filter(a => a.classId === classId && !a.archived).length >= 10) throw new DemoError("BAD_REQUEST", "A class can have up to 10 open activities. Archive one first.");
    S.assignments.push({ id: uid(), classId, game, level, note: note ?? null, dueDate: dueDate ?? null, createdAt: new Date(), archived: false });
    log("assignment_created", `${klass(classId).name}: ${game} L${level}`); return { id: S.assignments[S.assignments.length - 1].id };
  },
  "assignments.archive": ({ assignmentId }) => {
    requireParent(); requireSchool(); const a = S.assignments.find(x => x.id === assignmentId);
    if (!a) throw new DemoError("NOT_FOUND", "Activity not found"); a.archived = true; return { success: true };
  },
  "profiles.update": ({ profileId, ...rest }) => { requireParent(); requireConsent(); Object.assign(profile(profileId), Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined))); return { success: true }; },
  "profiles.delete": ({ profileId }) => {
    requireParent(); const p = profile(profileId);
    const sids = S.sessions.filter(s => s.profileId === profileId).map(s => s.id);
    S.messages = S.messages.filter(m => !sids.includes(m.sessionId)); S.sessions = S.sessions.filter(s => s.profileId !== profileId);
    S.plays = S.plays.filter(x => x.profileId !== profileId); S.moods = S.moods.filter(m => m.profileId !== profileId);
    S.lessonResults = S.lessonResults.filter(r => r.profileId !== profileId);
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
  "progress.checkin": ({ profileId, mood, note, language }) => {
    requireConsent(); profile(profileId);
    const verdict = note ? screenText(note, language ?? "en") : { level: "safe" as const };
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

  "chat.createSession": ({ profileId, characterId, language }) => {
    requireConsent(); const p = profile(profileId);
    const s: Session = { id: uid(), userId: "demo-parent", profileId, childName: p.childName, characterId: characterId ?? p.selectedCharacter, ageGroup: p.ageGroup, language: language ?? "en", createdAt: new Date() };
    S.sessions.push(s); return { sessionId: s.id };
  },
  "chat.getMessages": ({ sessionId }) => { requireUser(); return S.messages.filter(m => m.sessionId === sessionId).sort((a, b) => +a.createdAt - +b.createdAt); },
  "chat.getAllSessions": () => { requireUser(); return S.sessions; },
  "chat.sendMessage": async ({ sessionId, message }) => {
    requireConsent();
    const s = S.sessions.find(x => x.id === sessionId); if (!s) throw new DemoError("NOT_FOUND", "Chat session not found");
    const v = screenText(message, s.language); const now = Date.now();
    const history = S.messages.filter(m => m.sessionId === sessionId && m.flagged === "safe").sort((a, b) => +a.createdAt - +b.createdAt).map(m => ({ role: m.role, content: m.content }));
    S.messages.push({ id: uid(), sessionId, role: "user", content: message, flagged: v.level, createdAt: new Date(now) });
    // Flagged messages never reach the model; only safe ones are sent to Claude.
    const reply = v.level !== "safe" ? (v.reply as string)
      : (await ai(() => aiChat({ characterId: s.characterId, ageGroup: s.ageGroup, language: s.language, history, message }))) ?? demoReply(message, s.characterId, s.ageGroup, s.language);
    S.messages.push({ id: uid(), sessionId, role: "assistant", content: reply, flagged: "safe", createdAt: new Date(now + 1) });
    return { message: reply, flagged: v.level };
  },

  "creative.generateStory": async ({ prompt, language }) => {
    requireConsent();
    if (screenText(prompt, language ?? "en").level !== "safe") throw new DemoError("BAD_REQUEST", language === "ar" ? safeFallbackReply("ar") : "That's not something I can write about. Let's try a different idea!");
    const live = await ai(() => aiStory(prompt, language ?? "en"));
    if (live) return { content: live };
    if (language === "ar") return { content: `كان يا ما كان، ${prompt}.\n\nفي صباح مشرق حدث شيء مفاجئ. ظهرت مشكلة صغيرة تحتاج إلى حل ذكي ولطيف. فأخذ بطلنا نفَساً عميقاً وابتسم وقرّر أن يحاول.\n\nوفي الطريق انضم إليه أصدقاء جدد، وعملوا معاً حتى وجدوا الحل. وتعلّم الجميع أن الفضول والشجاعة يجعلان العالم أجمل.\n\nوانتهت الحكاية.\n\n(قصة تجريبية: في التطبيق الحقيقي يكتب الذكاء الاصطناعي قصة جديدة في كل مرة.)` };
    return { content: `Once upon a time, there was ${prompt}.\n\nOne bright morning, something surprising happened. A small problem appeared, and it needed a clever, kind answer. With a deep breath and a big smile, our hero decided to try.\n\nAlong the way, new friends joined the adventure. Together they worked it out, and everyone learned that being curious and brave makes the world a little bit brighter.\n\nThe end.\n\n(Preview story: in the live app the AI writes a new story every time.)` };
  },
  "creative.generateIllustration": () => { requireConsent(); throw new DemoError("INTERNAL_SERVER_ERROR", "Could not create the picture right now."); },
  "creative.generateAvatar": () => { requireConsent(); throw new DemoError("INTERNAL_SERVER_ERROR", "Pictures need the live app."); },
  "homework.analyzeHomework": async ({ language, imageData, subject }) => {
    requireConsent();
    const live = await ai(() => aiHomework({ imageBase64: imageData, subject, language: language ?? "en" }));
    if (live && live.steps.length) return live;
    if (language === "ar") return { question: "ما ناتج 12 + 15؟", steps: ["فكّك كل عدد إلى عشرات وآحاد: 12 = 10 + 2 و 15 = 10 + 5.", "اجمع العشرات: 10 + 10 = 20.", "اجمع الآحاد: 2 + 5 = 7.", "اجمع الناتجين: 20 + 7 = 27."], answer: "27", explanation: "تفكيك الأعداد إلى عشرات وآحاد يسهّل الجمع. (تجريبي: في التطبيق الحقيقي يقرأ المساعد صورة واجبك الفعلية.)", subject: "الرياضيات", difficulty: "easy" };
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
  "reports.generateReport": ({ language } = {} as any) => {
    requireConsent();
    if (language === "ar") { S.report = { id: uid(), childName: S.profiles[0]?.childName ?? "طالب", totalMessages: S.messages.length, totalSessions: S.sessions.length, strengths: "يطرح أسئلة فضولية عن العلوم والحيوانات. (نص تجريبي.)", weaknesses: "يمكنه استكشاف التاريخ والجغرافيا أكثر.", recommendations: "جرّبوا موضوعاً جديداً كل أسبوع واطرحوا سؤال متابعة." }; return S.report; }
    S.report = { id: uid(), childName: S.profiles[0]?.childName ?? "Student", totalMessages: S.messages.length, totalSessions: S.sessions.length, strengths: "Asks curious questions about science and animals. (Preview text.)", weaknesses: "Could explore more about history and geography.", recommendations: "Try a new topic each week and ask a follow-up question." };
    return S.report;
  },
  "summaries.getLatest": () => S.summary,
  "summaries.generate": ({ language } = {} as any) => {
    requireConsent();
    const end = new Date();
    if (language === "ar") { S.summary = { id: uid(), weekStart: new Date(+end - 7 * dayMs), weekEnd: end, totalMessages: S.messages.length, totalSessions: S.sessions.length, topicsCovered: "الفضاء والحيوانات والعلوم اليومية. (نص تجريبي.)", strengths: "فضولي ويواصل طرح أسئلة المتابعة.", areasToImprove: "جرّب أسئلة أطول وأكثر تفصيلاً.", recommendations: "اقرؤوا كتاباً علمياً معاً في نهاية الأسبوع." }; return S.summary; }
    S.summary = { id: uid(), weekStart: new Date(+end - 7 * dayMs), weekEnd: end, totalMessages: S.messages.length, totalSessions: S.sessions.length, topicsCovered: "Space, animals and everyday science. (Preview text.)", strengths: "Curious and keeps asking follow-up questions.", areasToImprove: "Try longer, more detailed questions.", recommendations: "Explore a science book together this weekend." };
    return S.summary;
  },
  "account.auditLog": () => { requireParent(); return S.audit; },
  "account.delete": () => { S = fresh(); seed(); return { success: true }; },
};

/* ----------------------------------------------------------------- seed */
/** Example data so the parent area and trophy room are not empty on first open. */
function seed() {
  const p: Profile = { id: "p-alex", userId: "demo-parent", childName: "Alex", ageGroup: "kids", selectedCharacter: "nova", classId: null, createdAt: new Date() };
  S.profiles.push(p);
  const d = (n: number) => new Date(Date.now() - n * dayMs);
  recordPlay(p.id, "math", 1, 8, 10, isoLocal(d(2)), d(2));
  recordPlay(p.id, "quiz", 1, 6, 8, isoLocal(d(1)), d(1));
  recordPlay(p.id, "spelling", 1, 8, 8, isoLocal(d(1)), d(1));
  S.moods.push({ profileId: p.id, mood: "happy", note: null, flagged: "safe", createdAt: d(2) }, { profileId: p.id, mood: "worried", note: null, flagged: "safe", createdAt: d(1) });
  award(p.id);
}
seed();

/** Example class for the school preview: made-up first names, varied activity, so the teacher screens are not empty. */
function seedSchool(lang: Lang) {
  const cls: Cls = { id: "c-4a", name: lang === "ar" ? "الرابع أ" : "4A", grade: 4 };
  S.classes.push(cls);
  const names = lang === "ar" ? ["ليلى", "عمر", "سارة", "يوسف", "مريم", "أحمد", "نور", "خالد"] : ["Layla", "Omar", "Sara", "Yousef", "Maryam", "Ahmad", "Noor", "Khaled"];
  const guides = ["sage", "phoenix", "nova", "echo"];
  const d = (n: number) => new Date(Date.now() - n * dayMs);
  names.forEach((childName, i) => {
    S.profiles.push({ id: `p-s${i}`, userId: "demo-parent", childName, ageGroup: "tweens", selectedCharacter: guides[i % 4], classId: cls.id, createdAt: new Date() });
  });
  const play = (i: number, game: GameId, correct: number, total: number, daysAgo: number) => recordPlay(`p-s${i}`, game, 1, correct, total, isoLocal(d(daysAgo)), d(daysAgo));
  play(0, "math", 9, 10, 0); play(0, "quiz", 7, 8, 1); play(0, "spelling", 8, 8, 2);
  play(1, "math", 6, 10, 1); play(1, "patterns", 5, 8, 3);
  play(2, "quiz", 8, 8, 0); play(2, "memory", 6, 6, 1); play(2, "math", 10, 10, 2);
  play(3, "math", 3, 10, 2); play(3, "math", 4, 10, 3); play(3, "patterns", 2, 8, 3);
  play(4, "spelling", 7, 8, 4); play(4, "quiz", 6, 8, 5);
  play(5, "math", 5, 10, 12);
  play(6, "memory", 6, 6, 0); play(6, "patterns", 7, 8, 1);
  S.moods.push({ profileId: "p-s3", mood: "sad", note: null, flagged: "safe", createdAt: d(2) });
  S.moods.push({ profileId: "p-s6", mood: "happy", note: null, flagged: "safe", createdAt: d(1) });
  S.assignments.push({ id: "a-1", classId: cls.id, game: "math", level: 1, note: lang === "ar" ? "حاولوا أن تحصلوا على 8 من 10" : "Try to get 8 out of 10", dueDate: null, createdAt: d(3), archived: false });
  names.forEach((_, i) => award(`p-s${i}`));
  // One sample lesson, already shared, with results from five students (made-up), so the Results panel is not empty.
  const topic = lang === "ar" ? "جمع الكسور ذات المقام الواحد" : "Adding fractions with the same denominator";
  const lesson: Lesson = { id: "l-1", title: topic, subject: "math", grade: 4, language: lang, topic, durationMin: 45, sourceText: null, content: cannedLesson(topic, lang, null), updatedAt: d(1) };
  S.lessons.push(lesson);
  S.shares.push({ id: "sh-1", lessonId: lesson.id, classId: cls.id, dueDate: null, createdAt: d(1), archived: false });
  const picks: number[][] = [[1, 1, 1], [1, 1, 0], [1, 0, 1], [1, 1, 1], [0, 1, 0]];
  picks.forEach((answers, i) => { const g = gradeQuiz(lesson.content.quiz, answers); S.lessonResults.push({ shareId: "sh-1", profileId: `p-s${i}`, answers, correct: g.correct, total: g.total }); });
}

/** Runs a live-AI call; a refusal becomes the same friendly error the real server returns, anything else falls back to canned. */
async function ai<T>(fn: () => Promise<T | null>): Promise<T | null> {
  try { return await fn(); }
  catch (e) { if (e instanceof AiRefused) throw new DemoError("BAD_REQUEST", e.message); return null; }
}

/* ---------------------------------------------------------------- fetch */
export const resetDemo = () => { S = fresh(); seed(); };

/** Drop-in replacement for window.fetch that answers tRPC batch calls from the in-memory handlers. */
export async function demoFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, "http://demo.local");
  const paths = decodeURIComponent(url.pathname.replace(/^.*\/api\/trpc\//, "")).split(",");
  const raw = (init?.method ?? "GET").toUpperCase() === "GET" ? url.searchParams.get("input") : (init?.body as string | null);
  const batch = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  const results = await Promise.all(paths.map(async (path, i) => {
    try {
      const h = H[path];
      if (!h) throw new DemoError("NOT_FOUND", `No procedure found on path "${path}"`);
      const arg = batch[i] === undefined ? undefined : superjson.deserialize(batch[i] as any);
      return { result: { data: superjson.serialize((await h(arg)) ?? null) } };
    } catch (e) {
      const err = e instanceof DemoError ? e : new DemoError("INTERNAL_SERVER_ERROR", e instanceof Error ? e.message : "Error");
      return { error: superjson.serialize({ message: err.message, code: -32603, data: { code: err.code, httpStatus: HTTP[err.code] ?? 500, path } }) };
    }
  }));
  await new Promise(r => setTimeout(r, 60)); // feel like a network call
  return new Response(JSON.stringify(results), { status: 200, headers: { "content-type": "application/json" } });
}

void BADGES; void AI_CHARACTERS;
