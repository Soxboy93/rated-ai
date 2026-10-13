import { and, eq, desc, gte, inArray, isNull, ne, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import * as schema from "../drizzle/schema";
import { BADGES, earnedBadgeIds, levelFromXp, nextStreak, xpForPlay, type GameId, type ProgressStats } from "../shared/gamification";
import type { StudentAggregate } from "../shared/classroom";
import { InsertUser, users, accessibilitySettings, InsertAccessibilitySettings, chatSessions, InsertChatSession, chatMessages, InsertChatMessage, parentalSettings, InsertParentalSettings, homeworkSubmissions, virtualPets, reportCards, smartMoments, progressMetrics, weeklySummaries, studyReminders, classrooms, curriculumStandards, peerChallenges, teachers } from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function createUser(user: InsertUser) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(users).values(user);
}

export async function getUser(id: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function touchUserSignIn(id: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, id));
}

// Chat Sessions
export async function createChatSession(session: InsertChatSession) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(chatSessions).values(session);
  return session;
}

export async function getChatSession(id: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(chatSessions).where(eq(chatSessions.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserChatSessions(userId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(chatSessions).where(eq(chatSessions.userId, userId)).orderBy(desc(chatSessions.createdAt));
}

export async function updateSessionLastMessage(sessionId: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(chatSessions)
    .set({ lastMessageAt: new Date() })
    .where(eq(chatSessions.id, sessionId));
}

// Chat Messages
export async function createChatMessage(message: InsertChatMessage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(chatMessages).values({ ...message, createdAt: message.createdAt ?? new Date() });
  return message;
}

export async function getSessionMessages(sessionId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(chatMessages).where(eq(chatMessages.sessionId, sessionId)).orderBy(chatMessages.createdAt, chatMessages.role); // role breaks same-millisecond ties: user before assistant
}

export async function getAllUserMessages(userId: string) {
  const db = await getDb();
  if (!db) return [];
  const sessions = await getUserChatSessions(userId);
  const sessionIds = sessions.map(s => s.id);
  if (sessionIds.length === 0) return [];
  
  return db.select().from(chatMessages).where(inArray(chatMessages.sessionId, sessionIds));
}

/** Flagged messages across everything this account owns, newest first, with the student they belong to. */
export async function listFlaggedMessages(userId: string, limit = 300) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: chatMessages.id, sessionId: chatMessages.sessionId, role: chatMessages.role, content: chatMessages.content,
      flagged: chatMessages.flagged, createdAt: chatMessages.createdAt, reviewedAt: chatMessages.reviewedAt,
      profileId: chatSessions.profileId, childName: chatSessions.childName, language: chatSessions.language,
    })
    .from(chatMessages)
    .innerJoin(chatSessions, eq(chatSessions.id, chatMessages.sessionId))
    .where(and(eq(chatSessions.userId, userId), ne(chatMessages.flagged, "safe")))
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit);
}

/** Plays per calendar day for these students since a date (the server's local day), for the school's weekly chart. */
export async function getPlayDayCounts(profileIds: string[], since: Date) {
  const db = await getDb();
  if (!db || profileIds.length === 0) return [];
  const rows = await db
    .select({ day: sql<string>`DATE_FORMAT(${schema.gamePlays.createdAt}, '%Y-%m-%d')`, plays: sql<string>`COUNT(*)` })
    .from(schema.gamePlays)
    .where(and(inArray(schema.gamePlays.profileId, profileIds), gte(schema.gamePlays.createdAt, since)))
    .groupBy(sql`DATE_FORMAT(${schema.gamePlays.createdAt}, '%Y-%m-%d')`);
  return rows.map(r => ({ day: r.day, plays: Number(r.plays) }));
}

/** Quiz results for every lesson shared by this account, with the class each belongs to. */
export async function listAllLessonResultRows(userId: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ classId: schema.lessonShares.classId, correct: schema.lessonResults.correct, total: schema.lessonResults.total })
    .from(schema.lessonResults)
    .innerJoin(schema.lessonShares, eq(schema.lessonShares.id, schema.lessonResults.shareId))
    .where(and(eq(schema.lessonResults.userId, userId), isNull(schema.lessonShares.archivedAt)));
}

/** Marks a flagged message reviewed (or not). Only messages in this account's own chats can be changed. */
export async function setMessageReviewed(userId: string, messageId: string, reviewed: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db
    .select({ id: chatMessages.id })
    .from(chatMessages)
    .innerJoin(chatSessions, eq(chatSessions.id, chatMessages.sessionId))
    .where(and(eq(chatMessages.id, messageId), eq(chatSessions.userId, userId)))
    .limit(1);
  if (!row) return false;
  await db.update(chatMessages).set({ reviewedAt: reviewed ? new Date() : null }).where(eq(chatMessages.id, messageId));
  return true;
}

// Parental Settings
export async function createParentalSettings(settings: InsertParentalSettings) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(parentalSettings).values(settings);
  return settings;
}

export async function getParentalSettings(userId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(parentalSettings).where(eq(parentalSettings.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateParentalSettings(userId: string, updates: Partial<InsertParentalSettings>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(parentalSettings)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(parentalSettings.userId, userId));
}


// Homework Submissions
export async function createHomeworkSubmission(submission: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(homeworkSubmissions).values(submission);
  return submission;
}

export async function getUserHomeworkSubmissions(userId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(homeworkSubmissions).where(eq(homeworkSubmissions.userId, userId)).orderBy(desc(homeworkSubmissions.createdAt));
}



// Virtual Pets
export async function createVirtualPet(pet: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(virtualPets).values(pet);
  return pet;
}

export async function getUserPet(userId: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(virtualPets).where(eq(virtualPets.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateVirtualPet(petId: string, updates: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(virtualPets).set(updates).where(eq(virtualPets.id, petId));
}



// Report Cards
export async function createReportCard(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(reportCards).values(data);
  return data;
}

export async function getLatestReportCard(userId: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db
    .select()
    .from(reportCards)
    .where(eq(reportCards.userId, userId))
    .orderBy(desc(reportCards.createdAt))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

// Smart Moments
export async function createSmartMoment(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(smartMoments).values(data);
  return data;
}

export async function getSmartMoments(userId: string) {
  const db = await getDb();
  if (!db) return [];
  
  return db
    .select()
    .from(smartMoments)
    .where(eq(smartMoments.userId, userId))
    .orderBy(desc(smartMoments.createdAt));
}

// Progress Metrics
export async function createProgressMetric(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(progressMetrics).values(data);
  return data;
}

export async function getProgressMetrics(userId: string, days: number = 30) {
  const db = await getDb();
  if (!db) return [];
  
  return db
    .select()
    .from(progressMetrics)
    .where(eq(progressMetrics.userId, userId))
    .orderBy(desc(progressMetrics.date));
}



// Weekly Summaries
export async function createWeeklySummary(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(weeklySummaries).values(data);
  return data;
}

export async function getLatestWeeklySummary(userId: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db
    .select()
    .from(weeklySummaries)
    .where(eq(weeklySummaries.userId, userId))
    .orderBy(desc(weeklySummaries.createdAt))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

// Study Reminders
export async function createStudyReminder(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(studyReminders).values(data);
  return data;
}

export async function getStudyReminder(userId: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db
    .select()
    .from(studyReminders)
    .where(eq(studyReminders.userId, userId))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

export async function updateStudyStreak(userId: string, streak: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(studyReminders)
    .set({ streak, lastStudyDate: new Date() })
    .where(eq(studyReminders.userId, userId));
}

// Export table references for routers
export { weeklySummaries, studyReminders };



// Teacher & Classroom Management
export async function createClassroom(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(classrooms).values(data);
  return data;
}

export async function getClassroomsByTeacher(teacherId: string) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select()
    .from(classrooms)
    .where(eq(classrooms.teacherId, teacherId))
    .orderBy(desc(classrooms.createdAt));
  
  return result;
}

// Curriculum Standards
export async function addCurriculumStandard(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(curriculumStandards).values(data);
  return data;
}

export async function getStandardsByMessage(messageId: string) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select()
    .from(curriculumStandards)
    .where(eq(curriculumStandards.messageId, messageId));
  
  return result;
}

// Peer Challenges
export async function createPeerChallenge(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(peerChallenges).values(data);
  return data;
}

export async function getPeerChallenges(userId: string) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select()
    .from(peerChallenges)
    .where(eq(peerChallenges.creatorId, userId))
    .orderBy(desc(peerChallenges.createdAt));
  
  return result;
}

// Export table references
export { classrooms, curriculumStandards, peerChallenges, teachers };



// Accessibility Settings
export async function getAccessibilitySettings(userId: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(accessibilitySettings).where(eq(accessibilitySettings.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function upsertAccessibilitySettings(data: InsertAccessibilitySettings) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { id: _id, userId: _userId, ...updates } = data;
  await db.insert(accessibilitySettings).values(data).onDuplicateKeyUpdate({ set: { ...updates, updatedAt: new Date() } });
}


// ---------------------------------------------------------------------------
// Parental consent
// ---------------------------------------------------------------------------
export async function getActiveConsent(userId: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(schema.parentalConsents)
    .where(and(eq(schema.parentalConsents.userId, userId), isNull(schema.parentalConsents.revokedAt)))
    .orderBy(desc(schema.parentalConsents.grantedAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function createConsent(data: schema.InsertParentalConsent) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(schema.parentalConsents).values({ ...data, grantedAt: new Date() });
}

export async function revokeConsent(userId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(schema.parentalConsents)
    .set({ revokedAt: new Date() })
    .where(and(eq(schema.parentalConsents.userId, userId), isNull(schema.parentalConsents.revokedAt)));
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------
export async function logAudit(userId: string, action: string, detail?: string) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(schema.auditEvents).values({
      id: crypto.randomUUID(),
      userId,
      action,
      detail: detail?.slice(0, 255),
      createdAt: new Date(),
    });
  } catch (error) {
    // An audit write must never break the action being recorded, but it must not fail silently either.
    console.error("[Audit] failed to record", action, error);
  }
}

export async function listAuditEvents(userId: string, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(schema.auditEvents)
    .where(eq(schema.auditEvents.userId, userId))
    .orderBy(desc(schema.auditEvents.createdAt))
    .limit(limit);
}

// ---------------------------------------------------------------------------
// Child profiles
// ---------------------------------------------------------------------------
export async function listProfiles(userId: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(schema.userProfiles)
    .where(eq(schema.userProfiles.userId, userId))
    .orderBy(schema.userProfiles.createdAt, schema.userProfiles.childName);
}

export async function getProfile(id: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.id, id)).limit(1);
  return rows[0];
}

export async function createProfile(data: schema.InsertUserProfile) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(schema.userProfiles).values(data);
}

export async function updateProfile(id: string, updates: Partial<schema.InsertUserProfile>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(schema.userProfiles).set(updates).where(eq(schema.userProfiles.id, id));
}

/** Chats of one child, with their messages, for export. */
export async function getProfileChats(userId: string, profileId: string) {
  const db = await getDb();
  if (!db) return [];
  const sessions = await db
    .select()
    .from(chatSessions)
    .where(and(eq(chatSessions.userId, userId), eq(chatSessions.profileId, profileId)))
    .orderBy(chatSessions.createdAt);
  if (sessions.length === 0) return [];
  const messages = await db
    .select()
    .from(chatMessages)
    .where(inArray(chatMessages.sessionId, sessions.map(s => s.id)))
    .orderBy(chatMessages.createdAt, chatMessages.role);
  return sessions.map(session => ({ ...session, messages: messages.filter(m => m.sessionId === session.id) }));
}

/** Permanently delete one child profile and all of that child's chats. */
export async function deleteProfileData(userId: string, profileId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.transaction(async tx => {
    const sessions = await tx
      .select({ id: chatSessions.id })
      .from(chatSessions)
      .where(and(eq(chatSessions.userId, userId), eq(chatSessions.profileId, profileId)));
    const ids = sessions.map(s => s.id);
    if (ids.length > 0) {
      await tx.delete(chatMessages).where(inArray(chatMessages.sessionId, ids));
      await tx.delete(chatSessions).where(inArray(chatSessions.id, ids));
    }
    await tx.delete(schema.learningProgress).where(eq(schema.learningProgress.profileId, profileId));
    await tx.delete(schema.childBadges).where(eq(schema.childBadges.profileId, profileId));
    await tx.delete(schema.gamePlays).where(eq(schema.gamePlays.profileId, profileId));
    await tx.delete(schema.moodCheckins).where(eq(schema.moodCheckins.profileId, profileId));
    await tx.delete(schema.lessonResults).where(eq(schema.lessonResults.profileId, profileId));
    await tx.delete(schema.childProgress).where(eq(schema.childProgress.profileId, profileId));
    await tx
      .delete(schema.userProfiles)
      .where(and(eq(schema.userProfiles.id, profileId), eq(schema.userProfiles.userId, userId)));
  });
}

/** Permanently delete a parent account and every row that belongs to it. */
export async function deleteAllUserData(userId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.transaction(async tx => {
    const sessions = await tx.select({ id: chatSessions.id }).from(chatSessions).where(eq(chatSessions.userId, userId));
    const sessionIds = sessions.map(s => s.id);
    if (sessionIds.length > 0) {
      await tx.delete(chatMessages).where(inArray(chatMessages.sessionId, sessionIds));
    }
    const profiles = await tx.select({ id: schema.userProfiles.id }).from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId));
    if (profiles.length > 0) {
      await tx.delete(schema.learningProgress).where(inArray(schema.learningProgress.profileId, profiles.map(p => p.id)));
    }
    await tx.delete(chatSessions).where(eq(chatSessions.userId, userId));
    // Tables keyed by userId
    const byUserId = [
      schema.userProfiles, schema.parentalSettings, schema.homeworkSubmissions, schema.virtualPets,
      schema.reportCards, schema.weeklySummaries, schema.accessibilitySettings, schema.achievements,
      schema.storyCreations, schema.moodEntries, schema.readingSessions, schema.learningStreaks,
      schema.userQuests, schema.smartMoments, schema.progressMetrics, schema.studyReminders,
      schema.collegePrepProgress, schema.challengeParticipants, schema.parentalConsents, schema.auditEvents,
      schema.childProgress, schema.gamePlays, schema.childBadges, schema.moodCheckins, schema.schoolClasses, schema.classAssignments,
      schema.lessons, schema.lessonShares, schema.lessonResults,
    ] as const;
    for (const table of byUserId) {
      await tx.delete(table).where(eq((table as any).userId, userId));
    }
    await tx.delete(schema.peerChallenges).where(eq(schema.peerChallenges.creatorId, userId));
    await tx.delete(schema.classrooms).where(eq(schema.classrooms.teacherId, userId));
    await tx.delete(users).where(eq(users.id, userId));
  });
}


// ---------------------------------------------------------------------------
// Games, XP, streaks, badges and mood check-ins
// ---------------------------------------------------------------------------
type Tx = Parameters<Parameters<NonNullable<Awaited<ReturnType<typeof getDb>>>["transaction"]>[0]>[0];

async function readStats(tx: Tx, profileId: string, progress: { xp: number; streakDays: number; longestStreak: number }): Promise<ProgressStats> {
  const rows = await tx
    .select({
      game: schema.gamePlays.game,
      plays: sql<string>`COUNT(*)`,
      perfect: sql<string>`COALESCE(SUM(CASE WHEN ${schema.gamePlays.correct} = ${schema.gamePlays.total} THEN 1 ELSE 0 END), 0)`,
    })
    .from(schema.gamePlays)
    .where(eq(schema.gamePlays.profileId, profileId))
    .groupBy(schema.gamePlays.game);
  const [mood] = await tx.select({ n: sql<string>`COUNT(*)` }).from(schema.moodCheckins).where(eq(schema.moodCheckins.profileId, profileId));
  const playsByGame: Partial<Record<GameId, number>> = {};
  let totalPlays = 0, perfectPlays = 0;
  for (const r of rows) {
    playsByGame[r.game as GameId] = Number(r.plays);
    totalPlays += Number(r.plays);
    perfectPlays += Number(r.perfect);
  }
  return { ...progress, totalPlays, perfectPlays, playsByGame, moodCheckins: Number(mood?.n ?? 0) };
}

/** Insert any badges the child now qualifies for; returns the ids that are new. */
async function awardBadges(tx: Tx, userId: string, profileId: string, stats: ProgressStats): Promise<string[]> {
  const have = new Set((await tx.select({ id: schema.childBadges.badgeId }).from(schema.childBadges).where(eq(schema.childBadges.profileId, profileId))).map(r => r.id));
  const fresh = earnedBadgeIds(stats).filter(id => !have.has(id));
  for (const badgeId of fresh) {
    await tx.insert(schema.childBadges).values({ id: crypto.randomUUID(), userId, profileId, badgeId, earnedAt: new Date() });
  }
  return fresh;
}

async function lockProgress(tx: Tx, userId: string, profileId: string) {
  await tx.insert(schema.childProgress).values({ profileId, userId }).onDuplicateKeyUpdate({ set: { profileId } });
  const [row] = await tx.select().from(schema.childProgress).where(eq(schema.childProgress.profileId, profileId)).for("update");
  return row;
}

export async function getChildProgress(profileId: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(schema.childProgress).where(eq(schema.childProgress.profileId, profileId)).limit(1);
  return rows[0] ?? null;
}

export async function recordPlay(input: {
  userId: string; profileId: string; game: GameId; level: number; correct: number; total: number; durationMs: number; day: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.transaction(async tx => {
    const row = await lockProgress(tx, input.userId, input.profileId);
    const xpEarned = xpForPlay(input.correct, input.total);
    const before = row.xp;
    const xp = before + xpEarned;
    const streakDays = nextStreak(row.lastPlayDate, row.streakDays, input.day);
    const longestStreak = Math.max(row.longestStreak, streakDays);
    await tx.insert(schema.gamePlays).values({
      id: crypto.randomUUID(), userId: input.userId, profileId: input.profileId, game: input.game, level: input.level,
      correct: input.correct, total: input.total, durationMs: input.durationMs, xpEarned, createdAt: new Date(),
    });
    await tx
      .update(schema.childProgress)
      .set({ xp, streakDays, longestStreak, lastPlayDate: input.day, updatedAt: new Date() })
      .where(eq(schema.childProgress.profileId, input.profileId));
    const stats = await readStats(tx, input.profileId, { xp, streakDays, longestStreak });
    const newBadges = await awardBadges(tx, input.userId, input.profileId, stats);
    return { xpEarned, xp, leveledUp: levelFromXp(xp) > levelFromXp(before), streakDays, longestStreak, newBadges };
  });
}

export async function addMoodCheckin(input: { userId: string; profileId: string; mood: string; note?: string; flagged: "safe" | "review" | "blocked" }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.transaction(async tx => {
    const row = await lockProgress(tx, input.userId, input.profileId);
    await tx.insert(schema.moodCheckins).values({
      id: crypto.randomUUID(), userId: input.userId, profileId: input.profileId, mood: input.mood,
      note: input.note, flagged: input.flagged, createdAt: new Date(),
    });
    const stats = await readStats(tx, input.profileId, row);
    return { newBadges: await awardBadges(tx, input.userId, input.profileId, stats) };
  });
}

export async function countRecentMoodCheckins(profileId: string, since: Date) {
  const db = await getDb();
  if (!db) return 0;
  const [r] = await db
    .select({ n: sql<string>`COUNT(*)` })
    .from(schema.moodCheckins)
    .where(and(eq(schema.moodCheckins.profileId, profileId), gte(schema.moodCheckins.createdAt, since)));
  return Number(r?.n ?? 0);
}

export async function listMoodCheckins(profileId: string, limit = 14) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(schema.moodCheckins).where(eq(schema.moodCheckins.profileId, profileId)).orderBy(desc(schema.moodCheckins.createdAt)).limit(limit);
}

export async function listBadges(profileId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(schema.childBadges).where(eq(schema.childBadges.profileId, profileId)).orderBy(schema.childBadges.earnedAt);
}

export async function getRecentPlays(profileId: string, limit = 10) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(schema.gamePlays).where(eq(schema.gamePlays.profileId, profileId)).orderBy(desc(schema.gamePlays.createdAt)).limit(limit);
}

/** Plays, perfect rounds and accuracy per game, for the parent overview and the trophy room. */
export async function getGameBreakdown(profileId: string) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      game: schema.gamePlays.game,
      plays: sql<string>`COUNT(*)`,
      correct: sql<string>`SUM(${schema.gamePlays.correct})`,
      total: sql<string>`SUM(${schema.gamePlays.total})`,
    })
    .from(schema.gamePlays)
    .where(eq(schema.gamePlays.profileId, profileId))
    .groupBy(schema.gamePlays.game);
  return rows.map(r => ({ game: r.game as GameId, plays: Number(r.plays), correct: Number(r.correct), total: Number(r.total) }));
}

export async function getProfileProgressExport(profileId: string) {
  const db = await getDb();
  if (!db) return { progress: null, plays: [], badges: [], moods: [] };
  const [progress, plays, badges, moods] = await Promise.all([
    getChildProgress(profileId),
    db.select().from(schema.gamePlays).where(eq(schema.gamePlays.profileId, profileId)).orderBy(schema.gamePlays.createdAt),
    listBadges(profileId),
    db.select().from(schema.moodCheckins).where(eq(schema.moodCheckins.profileId, profileId)).orderBy(schema.moodCheckins.createdAt),
  ]);
  return { progress, plays, badges, moods };
}

export { BADGES };


// ---------------------------------------------------------------------------
// Classes, assignments and the teacher's class overview (school accounts)
// ---------------------------------------------------------------------------
export async function listClasses(userId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(schema.schoolClasses).where(eq(schema.schoolClasses.userId, userId)).orderBy(schema.schoolClasses.grade, schema.schoolClasses.name);
}

export async function getClass(id: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(schema.schoolClasses).where(eq(schema.schoolClasses.id, id)).limit(1);
  return rows[0];
}

export async function createClass(data: typeof schema.schoolClasses.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(schema.schoolClasses).values({ ...data, createdAt: new Date() });
}

export async function updateClass(id: string, updates: Partial<typeof schema.schoolClasses.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(schema.schoolClasses).set(updates).where(eq(schema.schoolClasses.id, id));
}

/** Delete a class and its assignments; its students stay but become unassigned. */
export async function deleteClass(userId: string, classId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.transaction(async tx => {
    await tx.update(schema.userProfiles).set({ classId: null }).where(and(eq(schema.userProfiles.userId, userId), eq(schema.userProfiles.classId, classId)));
    await tx.delete(schema.classAssignments).where(and(eq(schema.classAssignments.userId, userId), eq(schema.classAssignments.classId, classId)));
    const shares = await tx.select({ id: schema.lessonShares.id }).from(schema.lessonShares).where(and(eq(schema.lessonShares.userId, userId), eq(schema.lessonShares.classId, classId)));
    if (shares.length > 0) {
      await tx.delete(schema.lessonResults).where(inArray(schema.lessonResults.shareId, shares.map(x => x.id)));
      await tx.delete(schema.lessonShares).where(inArray(schema.lessonShares.id, shares.map(x => x.id)));
    }
    await tx.delete(schema.schoolClasses).where(and(eq(schema.schoolClasses.id, classId), eq(schema.schoolClasses.userId, userId)));
  });
}

export async function countClassStudents(classId: string) {
  const db = await getDb();
  if (!db) return 0;
  const [r] = await db.select({ n: sql<string>`COUNT(*)` }).from(schema.userProfiles).where(eq(schema.userProfiles.classId, classId));
  return Number(r?.n ?? 0);
}

export async function listClassProfiles(userId: string, classId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(schema.userProfiles).where(and(eq(schema.userProfiles.userId, userId), eq(schema.userProfiles.classId, classId))).orderBy(schema.userProfiles.childName);
}

export async function listAssignments(userId: string, classId: string, includeArchived = false) {
  const db = await getDb();
  if (!db) return [];
  const where = and(eq(schema.classAssignments.userId, userId), eq(schema.classAssignments.classId, classId), includeArchived ? undefined : isNull(schema.classAssignments.archivedAt));
  return db.select().from(schema.classAssignments).where(where).orderBy(desc(schema.classAssignments.createdAt));
}

export async function getAssignment(id: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(schema.classAssignments).where(eq(schema.classAssignments.id, id)).limit(1);
  return rows[0];
}

export async function createAssignment(data: typeof schema.classAssignments.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(schema.classAssignments).values({ ...data, createdAt: new Date() });
}

export async function archiveAssignment(id: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(schema.classAssignments).set({ archivedAt: new Date() }).where(eq(schema.classAssignments.id, id));
}

/** Profile ids that completed an assignment: played that game at the assigned level or higher after it was set. */
export async function assignmentCompletions(assignment: { game: string; level: number; createdAt: Date | null }, profileIds: string[]) {
  const db = await getDb();
  if (!db || profileIds.length === 0) return new Set<string>();
  const rows = await db
    .selectDistinct({ profileId: schema.gamePlays.profileId })
    .from(schema.gamePlays)
    .where(and(inArray(schema.gamePlays.profileId, profileIds), eq(schema.gamePlays.game, assignment.game), gte(schema.gamePlays.level, assignment.level), gte(schema.gamePlays.createdAt, assignment.createdAt ?? new Date(0))));
  return new Set(rows.map(r => r.profileId));
}

/** Per-student numbers for a whole class in a handful of queries (not one per student). */
export async function getStudentAggregates(profiles: Array<{ id: string; childName: string; ageGroup: string }>, assignments: Array<{ game: string; level: number; createdAt: Date | null }>): Promise<StudentAggregate[]> {
  const db = await getDb();
  if (!db || profiles.length === 0) return [];
  const ids = profiles.map(p => p.id);
  const [progress, plays, flaggedChat, moodRows] = await Promise.all([
    db.select().from(schema.childProgress).where(inArray(schema.childProgress.profileId, ids)),
    db
      .select({
        profileId: schema.gamePlays.profileId,
        game: schema.gamePlays.game,
        plays: sql<string>`COUNT(*)`,
        correct: sql<string>`SUM(${schema.gamePlays.correct})`,
        total: sql<string>`SUM(${schema.gamePlays.total})`,
        last: sql<Date | string | null>`MAX(${schema.gamePlays.createdAt})`,
      })
      .from(schema.gamePlays)
      .where(inArray(schema.gamePlays.profileId, ids))
      .groupBy(schema.gamePlays.profileId, schema.gamePlays.game),
    db
      .select({ profileId: schema.chatSessions.profileId, n: sql<string>`COUNT(*)` })
      .from(schema.chatMessages)
      .innerJoin(schema.chatSessions, eq(schema.chatSessions.id, schema.chatMessages.sessionId))
      .where(and(inArray(schema.chatSessions.profileId, ids), ne(schema.chatMessages.flagged, "safe")))
      .groupBy(schema.chatSessions.profileId),
    db.select().from(schema.moodCheckins).where(inArray(schema.moodCheckins.profileId, ids)).orderBy(desc(schema.moodCheckins.createdAt)),
  ]);

  const doneSets = await Promise.all(assignments.map(a => assignmentCompletions(a, ids)));

  return profiles.map(p => {
    const pr = progress.find(r => r.profileId === p.id);
    const rows = plays.filter(r => r.profileId === p.id);
    const agg: StudentAggregate["plays"] = {};
    let last: Date | null = null;
    for (const r of rows) {
      agg[r.game as GameId] = { plays: Number(r.plays), correct: Number(r.correct), total: Number(r.total) };
      const when = r.last ? new Date(r.last as string) : null;
      if (when && (!last || when > last)) last = when;
    }
    const moods = moodRows.filter(m => m.profileId === p.id);
    return {
      profileId: p.id,
      childName: p.childName,
      ageGroup: p.ageGroup,
      xp: pr?.xp ?? 0,
      streakDays: pr?.streakDays ?? 0,
      lastPlayDate: pr?.lastPlayDate ?? null,
      plays: agg,
      lastPlayedAt: last,
      flaggedMessages: Number(flaggedChat.find(r => r.profileId === p.id)?.n ?? 0),
      flaggedMoods: moods.filter(m => m.flagged && m.flagged !== "safe").length,
      lastMood: moods[0]?.mood ?? null,
      assignmentsDone: doneSets.filter(set => set.has(p.id)).length,
    };
  });
}

export async function countUserProfiles(userId: string) {
  const db = await getDb();
  if (!db) return 0;
  const [r] = await db.select({ n: sql<string>`COUNT(*)` }).from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId));
  return Number(r?.n ?? 0);
}

export async function setUserLanguage(userId: string, language: "ar" | "en") {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ language }).where(eq(users.id, userId));
}

/* ------------------------------------------------------------------ lessons (teacher companion) */

export async function listLessons(userId: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: schema.lessons.id, title: schema.lessons.title, subject: schema.lessons.subject, grade: schema.lessons.grade,
      language: schema.lessons.language, topic: schema.lessons.topic, durationMin: schema.lessons.durationMin,
      createdAt: schema.lessons.createdAt, updatedAt: schema.lessons.updatedAt,
    })
    .from(schema.lessons)
    .where(eq(schema.lessons.userId, userId))
    .orderBy(desc(schema.lessons.updatedAt));
}

export async function getLesson(id: string) {
  const db = await getDb();
  if (!db) return undefined;
  const [row] = await db.select().from(schema.lessons).where(eq(schema.lessons.id, id)).limit(1);
  return row;
}

export async function countLessons(userId: string) {
  const db = await getDb();
  if (!db) return 0;
  const [r] = await db.select({ n: sql<string>`COUNT(*)` }).from(schema.lessons).where(eq(schema.lessons.userId, userId));
  return Number(r?.n ?? 0);
}

export async function createLesson(row: typeof schema.lessons.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = new Date();
  await db.insert(schema.lessons).values({ ...row, createdAt: now, updatedAt: now });
}

export async function updateLesson(id: string, patch: { title?: string; content?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(schema.lessons).set({ ...patch, updatedAt: new Date() }).where(eq(schema.lessons.id, id));
}

export async function deleteLesson(userId: string, id: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.transaction(async tx => {
    const shares = await tx.select({ id: schema.lessonShares.id }).from(schema.lessonShares).where(and(eq(schema.lessonShares.userId, userId), eq(schema.lessonShares.lessonId, id)));
    if (shares.length > 0) {
      await tx.delete(schema.lessonResults).where(inArray(schema.lessonResults.shareId, shares.map(x => x.id)));
      await tx.delete(schema.lessonShares).where(inArray(schema.lessonShares.id, shares.map(x => x.id)));
    }
    await tx.delete(schema.lessons).where(and(eq(schema.lessons.id, id), eq(schema.lessons.userId, userId)));
  });
}

export async function createLessonShare(row: { id: string; userId: string; classId: string; lessonId: string; dueDate?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(schema.lessonShares).values({ ...row, createdAt: new Date() });
}

export async function getLessonShare(id: string) {
  const db = await getDb();
  if (!db) return undefined;
  const [row] = await db.select().from(schema.lessonShares).where(eq(schema.lessonShares.id, id)).limit(1);
  return row;
}

/** Open (not archived) shares for a teacher, optionally one class, newest first. */
export async function listLessonShares(userId: string, classId?: string) {
  const db = await getDb();
  if (!db) return [];
  const where = and(eq(schema.lessonShares.userId, userId), isNull(schema.lessonShares.archivedAt), classId ? eq(schema.lessonShares.classId, classId) : undefined);
  return db.select().from(schema.lessonShares).where(where).orderBy(desc(schema.lessonShares.createdAt));
}

export async function archiveLessonShare(id: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(schema.lessonShares).set({ archivedAt: new Date() }).where(eq(schema.lessonShares.id, id));
}

export async function listLessonResults(shareId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(schema.lessonResults).where(eq(schema.lessonResults.shareId, shareId));
}

export async function getLessonResult(shareId: string, profileId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const [row] = await db.select().from(schema.lessonResults).where(and(eq(schema.lessonResults.shareId, shareId), eq(schema.lessonResults.profileId, profileId))).limit(1);
  return row;
}

/** Stores the first attempt only. Returns false when this student already has a result for the share. */
export async function insertLessonResult(row: { id: string; userId: string; shareId: string; profileId: string; answers: string; correct: number; total: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  try {
    await db.insert(schema.lessonResults).values({ ...row, createdAt: new Date() });
    return true;
  } catch (e: any) {
    if (e?.code === "ER_DUP_ENTRY" || e?.cause?.code === "ER_DUP_ENTRY" || /Duplicate entry/i.test(String(e?.message))) return false;
    throw e;
  }
}

/** What a student sees on their home screen: the open lessons shared with their class, and their own results. */
export async function listStudentLessons(classId: string, profileId: string) {
  const db = await getDb();
  if (!db) return [];
  const shares = await db.select().from(schema.lessonShares).where(and(eq(schema.lessonShares.classId, classId), isNull(schema.lessonShares.archivedAt))).orderBy(desc(schema.lessonShares.createdAt));
  if (shares.length === 0) return [];
  const lessonRows = await db
    .select({ id: schema.lessons.id, title: schema.lessons.title, subject: schema.lessons.subject, language: schema.lessons.language, content: schema.lessons.content })
    .from(schema.lessons)
    .where(inArray(schema.lessons.id, Array.from(new Set(shares.map(x => x.lessonId)))));
  const results = await db.select().from(schema.lessonResults).where(and(eq(schema.lessonResults.profileId, profileId), inArray(schema.lessonResults.shareId, shares.map(x => x.id))));
  return shares.flatMap(sh => {
    const l = lessonRows.find(x => x.id === sh.lessonId);
    if (!l) return [];
    const r = results.find(x => x.shareId === sh.id);
    return [{ shareId: sh.id, lessonId: l.id, title: l.title, subject: l.subject, language: l.language, dueDate: sh.dueDate, content: l.content, result: r ? { correct: r.correct, total: r.total } : null }];
  });
}

// ---------------------------------------------------------------------------
// Administration (superadmin console). Read-mostly; every caller must log what it looked at.
// ---------------------------------------------------------------------------
export async function setUserRole(id: string, role: "user" | "admin") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ role }).where(eq(users.id, id));
}

export async function setUserSuspended(id: string, suspended: boolean, reason: string | null) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ suspendedAt: suspended ? new Date() : null, suspendedReason: suspended ? reason : null }).where(eq(users.id, id));
}

export async function setUserPasswordHash(id: string, passwordHash: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ passwordHash }).where(eq(users.id, id));
}

/** Removes the account's PIN so its owner can choose a new one. */
export async function clearParentalPin(userId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(schema.parentalSettings).where(eq(schema.parentalSettings.userId, userId));
}

export type AdminAccountRow = {
  id: string; email: string | null; name: string | null; accountType: "family" | "school"; role: "user" | "admin"; language: "ar" | "en" | null;
  createdAt: Date | null; lastSignedIn: Date | null; suspendedAt: Date | null; students: number; classes: number; lessons: number; flaggedOpen: number;
};

/** One page of accounts with their sizes. `search` matches email or name; paging is by offset. */
export async function adminListAccounts(opts: { search?: string; type?: "family" | "school"; status?: "active" | "suspended" | "admin"; limit: number; offset: number }): Promise<{ rows: AdminAccountRow[]; total: number }> {
  const db = await getDb();
  if (!db) return { rows: [], total: 0 };
  const like = opts.search ? `%${opts.search.replace(/[%_\\]/g, m => `\\${m}`)}%` : null;
  const where = and(
    like ? sql`(${users.email} LIKE ${like} OR ${users.name} LIKE ${like})` : undefined,
    opts.type ? eq(users.accountType, opts.type) : undefined,
    opts.status === "suspended" ? sql`${users.suspendedAt} IS NOT NULL` : undefined,
    opts.status === "active" ? and(isNull(users.suspendedAt), eq(users.role, "user")) : undefined,
    opts.status === "admin" ? eq(users.role, "admin") : undefined,
  );
  const [{ n }] = await db.select({ n: sql<string>`COUNT(*)` }).from(users).where(where);
  const rows = await db
    .select({
      id: users.id, email: users.email, name: users.name, accountType: users.accountType, role: users.role, language: users.language,
      createdAt: users.createdAt, lastSignedIn: users.lastSignedIn, suspendedAt: users.suspendedAt,
      students: sql<string>`(SELECT COUNT(*) FROM ${schema.userProfiles} p WHERE p.userId = users.id)`,
      classes: sql<string>`(SELECT COUNT(*) FROM ${schema.schoolClasses} c WHERE c.userId = users.id)`,
      lessons: sql<string>`(SELECT COUNT(*) FROM ${schema.lessons} l WHERE l.userId = users.id)`,
      flaggedOpen: sql<string>`(SELECT COUNT(*) FROM ${chatMessages} m JOIN ${chatSessions} s ON s.id = m.sessionId WHERE s.userId = users.id AND m.flagged <> 'safe' AND m.reviewedAt IS NULL AND (m.role = 'user' OR m.flagged = 'blocked'))`,
    })
    .from(users)
    .where(where)
    .orderBy(desc(users.createdAt))
    .limit(opts.limit)
    .offset(opts.offset);
  return { total: Number(n), rows: rows.map(r => ({ ...r, students: Number(r.students), classes: Number(r.classes), lessons: Number(r.lessons), flaggedOpen: Number(r.flaggedOpen) })) };
}

/** Whole-platform counts for the admin overview. */
export async function adminOverview(now = new Date()) {
  const db = await getDb();
  if (!db) return { accounts: { family: 0, school: 0, admin: 0, suspended: 0 }, students: 0, signedInLast7Days: 0, playsLast7Days: 0, lessons: 0, flaggedOpen: 0, newAccountsLast30Days: 0 };
  const week = new Date(now.getTime() - 7 * 86_400_000), month = new Date(now.getTime() - 30 * 86_400_000);
  const one = async (q: Promise<Array<{ n: string }>>) => Number((await q)[0]?.n ?? 0);
  const [family, school, admin, suspended, students, active, plays, lessons, flagged, fresh] = await Promise.all([
    one(db.select({ n: sql<string>`COUNT(*)` }).from(users).where(and(eq(users.accountType, "family"), eq(users.role, "user")))),
    one(db.select({ n: sql<string>`COUNT(*)` }).from(users).where(and(eq(users.accountType, "school"), eq(users.role, "user")))),
    one(db.select({ n: sql<string>`COUNT(*)` }).from(users).where(eq(users.role, "admin"))),
    one(db.select({ n: sql<string>`COUNT(*)` }).from(users).where(sql`${users.suspendedAt} IS NOT NULL`)),
    one(db.select({ n: sql<string>`COUNT(*)` }).from(schema.userProfiles)),
    one(db.select({ n: sql<string>`COUNT(*)` }).from(users).where(gte(users.lastSignedIn, week))),
    one(db.select({ n: sql<string>`COUNT(*)` }).from(schema.gamePlays).where(gte(schema.gamePlays.createdAt, week))),
    one(db.select({ n: sql<string>`COUNT(*)` }).from(schema.lessons)),
    one(db.select({ n: sql<string>`COUNT(*)` }).from(chatMessages).where(and(ne(chatMessages.flagged, "safe"), isNull(chatMessages.reviewedAt), sql`(${chatMessages.role} = 'user' OR ${chatMessages.flagged} = 'blocked')`))),
    one(db.select({ n: sql<string>`COUNT(*)` }).from(users).where(gte(users.createdAt, month))),
  ]);
  return { accounts: { family, school, admin, suspended }, students, signedInLast7Days: active, playsLast7Days: plays, lessons, flaggedOpen: flagged, newAccountsLast30Days: fresh };
}

/** Students across every account, found by name; with the owning account's email and class. */
export async function adminSearchStudents(search: string, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  const like = `%${search.replace(/[%_\\]/g, m => `\\${m}`)}%`;
  return db
    .select({
      id: schema.userProfiles.id, childName: schema.userProfiles.childName, ageGroup: schema.userProfiles.ageGroup, userId: schema.userProfiles.userId,
      ownerEmail: users.email, ownerType: users.accountType, className: schema.schoolClasses.name, createdAt: schema.userProfiles.createdAt,
    })
    .from(schema.userProfiles)
    .innerJoin(users, eq(users.id, schema.userProfiles.userId))
    .leftJoin(schema.schoolClasses, eq(schema.schoolClasses.id, schema.userProfiles.classId))
    .where(search ? sql`${schema.userProfiles.childName} LIKE ${like}` : undefined)
    .orderBy(desc(schema.userProfiles.createdAt))
    .limit(limit);
}

/** Recent administrator actions, newest first (written under the administrator's own id). */
export async function adminListActions(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ id: schema.auditEvents.id, adminId: schema.auditEvents.userId, adminEmail: users.email, action: schema.auditEvents.action, detail: schema.auditEvents.detail, createdAt: schema.auditEvents.createdAt })
    .from(schema.auditEvents)
    .leftJoin(users, eq(users.id, schema.auditEvents.userId))
    .where(sql`${schema.auditEvents.action} LIKE 'admin\\_%'`)
    .orderBy(desc(schema.auditEvents.createdAt))
    .limit(limit);
}
