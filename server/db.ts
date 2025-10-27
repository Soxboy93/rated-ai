import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, chatSessions, InsertChatSession, chatMessages, InsertChatMessage, parentalSettings, InsertParentalSettings, homeworkSubmissions, virtualPets, reportCards, smartMoments, progressMetrics, weeklySummaries, studyReminders } from "../drizzle/schema";
import { ENV } from './_core/env';

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

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.id) {
    throw new Error("User ID is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      id: user.id,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role === undefined) {
      if (user.id === ENV.ownerId) {
        user.role = 'admin';
        values.role = 'admin';
        updateSet.role = 'admin';
      }
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUser(id: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);

  return result.length > 0 ? result[0] : undefined;
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
  return db.select().from(chatSessions).where(eq(chatSessions.userId, userId));
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
  return db.select().from(chatMessages).where(eq(chatMessages.sessionId, sessionId));
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

export async function getAllChatSessions() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(chatSessions).orderBy(desc(chatSessions.createdAt));
}

export async function getAllChatMessages() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(chatMessages).orderBy(desc(chatMessages.createdAt));
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

export async function getAllHomeworkSubmissions() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(homeworkSubmissions).orderBy(desc(homeworkSubmissions.createdAt));
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

