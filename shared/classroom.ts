/** Pure helpers that turn raw per-student numbers into the class overview a teacher sees. */
import type { GameId } from "./gamification";
import { GAME_IDS, effectiveStreak, levelFromXp } from "./gamification";

export type StudentAggregate = {
  profileId: string;
  childName: string;
  ageGroup: string;
  xp: number;
  streakDays: number;
  lastPlayDate: string | null;
  plays: Partial<Record<GameId, { plays: number; correct: number; total: number }>>;
  lastPlayedAt: Date | null;
  flaggedMessages: number;
  flaggedMoods: number;
  lastMood: string | null;
};

export type StudentRow = {
  profileId: string;
  childName: string;
  ageGroup: string;
  xp: number;
  level: number;
  streakDays: number;
  totalPlays: number;
  /** Fraction 0..1 of answers right across all games, or null when the student has not played. */
  accuracy: number | null;
  lastPlayedAt: Date | null;
  daysSincePlay: number | null;
  flaggedMessages: number;
  flaggedMoods: number;
  lastMood: string | null;
  /** Why a teacher might want to check in (empty when nothing stands out). */
  attention: Array<"inactive" | "low_accuracy" | "flagged">;
};

export type ClassOverview = {
  students: StudentRow[];
  summary: {
    studentCount: number;
    activeThisWeek: number;
    totalPlays: number;
    accuracyByGame: Partial<Record<GameId, number>>;
    attentionCount: number;
  };
};

const dayMs = 86_400_000;
export const MIN_ANSWERS_FOR_ACCURACY_FLAG = 20;

export function buildClassOverview(aggregates: StudentAggregate[], today: string, now = new Date()): ClassOverview {
  const students: StudentRow[] = aggregates.map(a => {
    const plays = Object.values(a.plays);
    const totalPlays = plays.reduce((n, p) => n + (p?.plays ?? 0), 0);
    const correct = plays.reduce((n, p) => n + (p?.correct ?? 0), 0);
    const total = plays.reduce((n, p) => n + (p?.total ?? 0), 0);
    const accuracy = total > 0 ? correct / total : null;
    const daysSincePlay = a.lastPlayedAt ? Math.floor((now.getTime() - a.lastPlayedAt.getTime()) / dayMs) : null;
    const attention: StudentRow["attention"] = [];
    if (daysSincePlay === null || daysSincePlay >= 7) attention.push("inactive");
    if (accuracy !== null && total >= MIN_ANSWERS_FOR_ACCURACY_FLAG && accuracy < 0.5) attention.push("low_accuracy");
    if (a.flaggedMessages + a.flaggedMoods > 0) attention.push("flagged");
    return {
      profileId: a.profileId,
      childName: a.childName,
      ageGroup: a.ageGroup,
      xp: a.xp,
      level: levelFromXp(a.xp),
      streakDays: effectiveStreak(a.lastPlayDate, a.streakDays, today),
      totalPlays,
      accuracy,
      lastPlayedAt: a.lastPlayedAt,
      daysSincePlay,
      flaggedMessages: a.flaggedMessages,
      flaggedMoods: a.flaggedMoods,
      lastMood: a.lastMood,
      attention,
    };
  });

  const accuracyByGame: ClassOverview["summary"]["accuracyByGame"] = {};
  for (const game of GAME_IDS) {
    let correct = 0, total = 0;
    for (const a of aggregates) { correct += a.plays[game]?.correct ?? 0; total += a.plays[game]?.total ?? 0; }
    if (total > 0) accuracyByGame[game] = correct / total;
  }

  return {
    students,
    summary: {
      studentCount: students.length,
      activeThisWeek: students.filter(s => s.daysSincePlay !== null && s.daysSincePlay < 7).length,
      totalPlays: students.reduce((n, s) => n + s.totalPlays, 0),
      accuracyByGame,
      attentionCount: students.filter(s => s.attention.length > 0).length,
    },
  };
}

const ROSTER_HEADERS = /^(name|names|student|students|student name|first name|الاسم|الأسماء|اسم الطالب|الطالب|الطلاب)$/i;

/**
 * Turns pasted text or the contents of a .csv/.txt file into a list of student names. One name per line; when a
 * line has several comma, semicolon or tab separated cells, only the first is used (a spreadsheet's name column).
 * A header row such as "Name" or "الاسم" is dropped. The server still screens every name.
 */
export function parseRosterText(text: string): string[] {
  const names = text
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .map(line => line.split(/[,;\t،؛]/)[0].replace(/^["'\s]+|["'\s]+$/g, "").replace(/\s+/g, " "))
    .filter(Boolean);
  if (names.length && ROSTER_HEADERS.test(names[0])) names.shift();
  return names;
}
