import { and, eq, desc, inArray, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import * as schema from "../drizzle/schema";
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
    ] as const;
    for (const table of byUserId) {
      await tx.delete(table).where(eq((table as any).userId, userId));
    }
    await tx.delete(schema.peerChallenges).where(eq(schema.peerChallenges.creatorId, userId));
    await tx.delete(schema.classrooms).where(eq(schema.classrooms.teacherId, userId));
    await tx.delete(users).where(eq(users.id, userId));
  });
}
