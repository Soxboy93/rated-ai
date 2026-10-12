/** XP, levels, streaks and badges. Pure functions shared by the server (authoritative) and the client (display). */

export type GameId = "math" | "spelling" | "quiz" | "memory" | "patterns";
export const GAME_IDS: readonly GameId[] = ["math", "spelling", "quiz", "memory", "patterns"];

export const MOODS = ["happy", "excited", "calm", "tired", "worried", "sad", "angry"] as const;
export type Mood = (typeof MOODS)[number];

export const MAX_QUESTIONS_PER_PLAY = 20;
export const MIN_MS_PER_QUESTION = 400; // a human cannot answer faster; blocks trivially forged results

/** XP for one finished round. Capped so a forged request cannot mint unlimited XP. */
export function xpForPlay(correct: number, total: number): number {
  const c = Math.max(0, Math.min(correct, total));
  const perfect = total > 0 && c === total ? 20 : 0;
  return Math.min(c * 10 + perfect + 5, total * 10 + 25);
}

/** Level n starts at 40*(n-1)^2 XP: 40, 160, 360, 640, ... */
export function levelFromXp(xp: number): number {
  return 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 40));
}
export const xpForLevel = (level: number) => 40 * (level - 1) * (level - 1);

export function levelProgress(xp: number) {
  const level = levelFromXp(xp);
  const start = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return { level, start, next, into: xp - start, span: next - start, fraction: (xp - start) / (next - start) };
}

const LEVEL_TITLES = ["Newcomer", "Explorer", "Adventurer", "Trailblazer", "Brainiac", "Genius", "Champion", "Legend"];
export const levelTitle = (level: number) => LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)];

/** 'YYYY-MM-DD' of a Date in UTC. */
export const isoDay = (d: Date) => d.toISOString().slice(0, 10);

const dayNumber = (iso: string) => Math.floor(Date.parse(iso + "T00:00:00Z") / 86_400_000);

/** New streak after playing on `today`, given the last day played. */
export function nextStreak(lastPlayDate: string | null, streak: number, today: string): number {
  if (!lastPlayDate) return 1;
  const gap = dayNumber(today) - dayNumber(lastPlayDate);
  if (gap <= 0) return Math.max(streak, 1); // same day (or clock skew): unchanged
  if (gap === 1) return streak + 1;
  return 1;
}

/**
 * The client sends its local calendar day so streaks follow the child's own midnight. Trust it only if it is
 * within a day of the server's UTC day (covers every timezone); otherwise fall back to the server day.
 */
export function resolvePlayDay(clientDay: string | undefined, serverNow: Date): string {
  const server = isoDay(serverNow);
  if (!clientDay || !/^\d{4}-\d{2}-\d{2}$/.test(clientDay) || Number.isNaN(Date.parse(clientDay))) return server;
  return Math.abs(dayNumber(clientDay) - dayNumber(server)) <= 1 ? clientDay : server;
}

export type ProgressStats = {
  xp: number;
  streakDays: number;
  longestStreak: number;
  totalPlays: number;
  perfectPlays: number;
  playsByGame: Partial<Record<GameId, number>>;
  moodCheckins: number;
};

export type Badge = { id: string; name: string; description: string; icon: string; test: (s: ProgressStats) => boolean };

const played = (s: ProgressStats, g: GameId) => s.playsByGame[g] ?? 0;

export const BADGES: readonly Badge[] = [
  { id: "first_play", name: "First Steps", description: "Finish your first game", icon: "👣", test: s => s.totalPlays >= 1 },
  { id: "perfect_round", name: "Perfect Round", description: "Get every question right", icon: "🌟", test: s => s.perfectPlays >= 1 },
  { id: "perfect_five", name: "Perfect Five", description: "Get 5 perfect rounds", icon: "🏅", test: s => s.perfectPlays >= 5 },
  { id: "streak_3", name: "On a Roll", description: "Play 3 days in a row", icon: "🔥", test: s => s.longestStreak >= 3 },
  { id: "streak_7", name: "Week Warrior", description: "Play 7 days in a row", icon: "🗓️", test: s => s.longestStreak >= 7 },
  { id: "plays_10", name: "Game On", description: "Finish 10 games", icon: "🎮", test: s => s.totalPlays >= 10 },
  { id: "plays_50", name: "Super Player", description: "Finish 50 games", icon: "🚀", test: s => s.totalPlays >= 50 },
  { id: "math_5", name: "Number Ninja", description: "Play Number Ninjas 5 times", icon: "🥷", test: s => played(s, "math") >= 5 },
  { id: "spelling_5", name: "Word Wizard", description: "Play Spelling Bee 5 times", icon: "🧙", test: s => played(s, "spelling") >= 5 },
  { id: "quiz_5", name: "Quiz Whiz", description: "Play Quiz Time 5 times", icon: "🧠", test: s => played(s, "quiz") >= 5 },
  { id: "memory_5", name: "Memory Master", description: "Play Memory Match 5 times", icon: "🐘", test: s => played(s, "memory") >= 5 },
  { id: "patterns_5", name: "Pattern Pro", description: "Play Pattern Pals 5 times", icon: "🧩", test: s => played(s, "patterns") >= 5 },
  { id: "explorer", name: "Explorer", description: "Try all five games", icon: "🧭", test: s => GAME_IDS.every(g => played(s, g) >= 1) },
  { id: "level_5", name: "Level 5", description: "Reach level 5", icon: "⭐", test: s => levelFromXp(s.xp) >= 5 },
  { id: "level_10", name: "Level 10", description: "Reach level 10", icon: "👑", test: s => levelFromXp(s.xp) >= 10 },
  { id: "mood_first", name: "Feelings Friend", description: "Do your first mood check-in", icon: "💛", test: s => s.moodCheckins >= 1 },
  { id: "mood_7", name: "Check-in Champ", description: "Do 7 mood check-ins", icon: "🌈", test: s => s.moodCheckins >= 7 },
];

export const badgeById = (id: string) => BADGES.find(b => b.id === id);

/** IDs of every badge the stats qualify for. */
export const earnedBadgeIds = (stats: ProgressStats) => BADGES.filter(b => b.test(stats)).map(b => b.id);

/** Streak to show today: a streak is alive if the child played today or yesterday, otherwise it has lapsed to 0. */
export function effectiveStreak(lastPlayDate: string | null, streak: number, today: string): number {
  if (!lastPlayDate) return 0;
  return dayNumber(today) - dayNumber(lastPlayDate) <= 1 ? streak : 0;
}
