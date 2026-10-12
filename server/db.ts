import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
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
  await db.insert(chatMessages).values(message);
  return message;
}

export async function getSessionMessages(sessionId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(chatMessages).where(eq(chatMessages.sessionId, sessionId)).orderBy(chatMessages.createdAt);
}

export async function getAllUserMessages(userId: string) {
  const db = await getDb();
  if (!db) return [];
  const sessions = await getUserChatSessions(userId);
  const sessionIds = sessions.map(s => s.id);
  if (sessionIds.length === 0) return [];
  
  const { inArray } = await import("drizzle-orm");
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
