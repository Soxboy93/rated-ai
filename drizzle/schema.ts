import { longtext, mysqlEnum, mysqlTable, text, timestamp, unique, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: text("name"),
  email: varchar("email", { length: 320 }).unique(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  // "family": a parent with their own children. "school": a teacher running one or more classes.
  accountType: mysqlEnum("accountType", ["family", "school"]).default("family").notNull(),
  // Preferred interface language; null means "follow the device".
  language: mysqlEnum("language", ["ar", "en"]),
  createdAt: timestamp("createdAt").defaultNow(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow(),
  // Set by an administrator: the account cannot sign in or use the app until it is cleared.
  suspendedAt: timestamp("suspendedAt", { fsp: 3 }),
  suspendedReason: varchar("suspendedReason", { length: 200 }),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Chat sessions table - tracks individual chat sessions
 */
export const chatSessions = mysqlTable("chatSessions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  childName: varchar("childName", { length: 100 }),
  // Which child profile this chat belongs to (null for chats created before profiles existed).
  profileId: varchar("profileId", { length: 64 }),
  // Language the child is chatting in; decides the AI's reply language and the safety replies.
  language: mysqlEnum("language", ["ar", "en"]),
  characterId: varchar("characterId", { length: 50 }),
  ageGroup: mysqlEnum("ageGroup", ["kids", "tweens", "teens"]),
  createdAt: timestamp("createdAt").defaultNow(),
  lastMessageAt: timestamp("lastMessageAt").defaultNow(),
});

export type ChatSession = typeof chatSessions.$inferSelect;
export type InsertChatSession = typeof chatSessions.$inferInsert;

/**
 * Chat messages table - stores all messages in conversations
 */
export const chatMessages = mysqlTable("chatMessages", {
  id: varchar("id", { length: 64 }).primaryKey(),
  sessionId: varchar("sessionId", { length: 64 }).notNull(),
  role: mysqlEnum("role", ["user", "assistant", "system"]).notNull(),
  content: text("content").notNull(),
  // Millisecond precision so a reply never ties with the message it answers.
  createdAt: timestamp("createdAt", { fsp: 3 }).defaultNow(),
  flagged: mysqlEnum("flagged", ["safe", "review", "blocked"]).default("safe"),
  // Set when a teacher or parent has looked at a flagged message and dealt with it.
  reviewedAt: timestamp("reviewedAt", { fsp: 3 }),
});

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;

/**
 * Parental settings table - stores parent passwords and preferences
 */
export const parentalSettings = mysqlTable("parentalSettings", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  dailyLimit: varchar("dailyLimit", { length: 10 }).default("30"),
  allowedHours: text("allowedHours"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

export type ParentalSettings = typeof parentalSettings.$inferSelect;
export type InsertParentalSettings = typeof parentalSettings.$inferInsert;

/**
 * User profiles table - stores child profiles with age groups
 */
export const userProfiles = mysqlTable("userProfiles", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  childName: varchar("childName", { length: 100 }).notNull(),
  ageGroup: mysqlEnum("ageGroup", ["kids", "tweens", "teens"]).notNull(),
  selectedCharacter: varchar("selectedCharacter", { length: 50 }),
  avatar: varchar("avatar", { length: 10 }),
  // School accounts: the class this student belongs to (null for family children and unassigned students).
  classId: varchar("classId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow(),
});

export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = typeof userProfiles.$inferInsert;

import { boolean, int } from "drizzle-orm/mysql-core";

/**
 * Homework submissions table - tracks homework help requests
 */
export const homeworkSubmissions = mysqlTable("homeworkSubmissions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  sessionId: varchar("sessionId", { length: 64 }),
  userId: varchar("userId", { length: 64 }).notNull(),
  subject: varchar("subject", { length: 50 }),
  question: text("question"),
  imageUrl: text("imageUrl"),
  solution: text("solution"),
  steps: text("steps"), // JSON array of solution steps
  difficulty: varchar("difficulty", { length: 20 }),
  completed: boolean("completed").default(false),
  createdAt: timestamp("createdAt").defaultNow(),
});

export type HomeworkSubmission = typeof homeworkSubmissions.$inferSelect;
export type InsertHomeworkSubmission = typeof homeworkSubmissions.$inferInsert;

// Report Cards - AI-generated progress reports
// Smart Moments - "Caught Being Smart" feature
// Progress Metrics - Daily/weekly progress tracking
// Weekly Summary Emails
// Study Reminders
// Curriculum Standards - Common Core alignment
// Teacher Accounts
// Classroom Management
// Peer Challenges
// School Integrations
// Accessibility Settings
export const accessibilitySettings = mysqlTable("accessibility_settings", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull().unique(),
  dyslexiaMode: int("dyslexiaMode").default(0), // OpenDyslexic font, increased spacing
  adhdMode: int("adhdMode").default(0), // Reduced distractions, focus mode
  autismMode: int("autismMode").default(0), // Predictable patterns, clear structure
  fontSize: varchar("fontSize", { length: 20 }).default("medium"), // small, medium, large, xlarge
  highContrast: int("highContrast").default(0),
  textToSpeech: int("textToSpeech").default(0),
  reducedMotion: int("reducedMotion").default(0),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

export type AccessibilitySettings = typeof accessibilitySettings.$inferSelect;
export type InsertAccessibilitySettings = typeof accessibilitySettings.$inferInsert;

// College Prep
// SAT/ACT Practice Questions
/**
 * Parental consent records. One active row (revokedAt null) per parent account.
 * textSha256 is the hash of the exact consent wording shown (see shared/consent.ts).
 */
export const parentalConsents = mysqlTable("parental_consents", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  version: varchar("version", { length: 40 }).notNull(),
  textSha256: varchar("textSha256", { length: 64 }).notNull(),
  // Language of the wording that was shown (the hash covers that exact text).
  language: varchar("language", { length: 2 }),
  grantedAt: timestamp("grantedAt", { fsp: 3 }).defaultNow(),
  revokedAt: timestamp("revokedAt", { fsp: 3 }),
});

export type ParentalConsent = typeof parentalConsents.$inferSelect;
export type InsertParentalConsent = typeof parentalConsents.$inferInsert;

/** Record of privacy-relevant actions (consent, profiles, exports, deletion) shown to the parent. */
export const auditEvents = mysqlTable("audit_events", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  action: varchar("action", { length: 60 }).notNull(),
  detail: varchar("detail", { length: 255 }),
  createdAt: timestamp("createdAt", { fsp: 3 }).defaultNow(),
});

export type AuditEvent = typeof auditEvents.$inferSelect;


/** One row per child: XP and streak. Updated only by the server when a finished game is submitted. */
export const childProgress = mysqlTable("child_progress", {
  profileId: varchar("profileId", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  xp: int("xp").notNull().default(0),
  streakDays: int("streakDays").notNull().default(0),
  longestStreak: int("longestStreak").notNull().default(0),
  // 'YYYY-MM-DD' in the child's own calendar day (see resolvePlayDay)
  lastPlayDate: varchar("lastPlayDate", { length: 10 }),
  updatedAt: timestamp("updatedAt", { fsp: 3 }).defaultNow(),
});

/** Every finished mini-game round. Results are reported by the client and only sanity-checked by the server. */
export const gamePlays = mysqlTable("game_plays", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  profileId: varchar("profileId", { length: 64 }).notNull(),
  game: varchar("game", { length: 20 }).notNull(),
  level: int("level").notNull().default(1),
  correct: int("correct").notNull(),
  total: int("total").notNull(),
  durationMs: int("durationMs").notNull().default(0),
  xpEarned: int("xpEarned").notNull().default(0),
  createdAt: timestamp("createdAt", { fsp: 3 }).defaultNow(),
});

export const childBadges = mysqlTable(
  "child_badges",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("userId", { length: 64 }).notNull(),
    profileId: varchar("profileId", { length: 64 }).notNull(),
    badgeId: varchar("badgeId", { length: 40 }).notNull(),
    earnedAt: timestamp("earnedAt", { fsp: 3 }).defaultNow(),
  },
  t => [unique("child_badges_profile_badge").on(t.profileId, t.badgeId)]
);

/** Mood check-ins a child does for themselves; visible to the parent. */
export const moodCheckins = mysqlTable("mood_checkins", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  profileId: varchar("profileId", { length: 64 }).notNull(),
  mood: varchar("mood", { length: 20 }).notNull(),
  note: varchar("note", { length: 200 }),
  flagged: mysqlEnum("flagged", ["safe", "review", "blocked"]).default("safe"),
  createdAt: timestamp("createdAt", { fsp: 3 }).defaultNow(),
});


/** A class run by a teacher (school accounts). Students are userProfiles rows with classId set. */
export const schoolClasses = mysqlTable("school_classes", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  grade: int("grade").notNull(),
  // Teacher controls. Chat and search can be switched off; focus mode shows students only the lessons and activities set for them.
  chatEnabled: boolean("chatEnabled").notNull().default(true),
  searchEnabled: boolean("searchEnabled").notNull().default(true),
  focusMode: boolean("focusMode").notNull().default(false),
  createdAt: timestamp("createdAt", { fsp: 3 }).defaultNow(),
});

/** A lesson plan a teacher drafted with the companion (AI-assisted, teacher-reviewed). `content` is a LessonContent JSON. */
export const lessons = mysqlTable("lessons", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  subject: varchar("subject", { length: 30 }).notNull(),
  grade: int("grade").notNull(),
  language: varchar("language", { length: 2 }).notNull(),
  topic: varchar("topic", { length: 300 }).notNull(),
  durationMin: int("durationMin").notNull().default(45),
  sourceText: text("sourceText"),
  content: longtext("content").notNull(),
  createdAt: timestamp("createdAt", { fsp: 3 }).defaultNow(),
  updatedAt: timestamp("updatedAt", { fsp: 3 }).defaultNow(),
});

/** A lesson shared with a class: students see its summary and take its quiz. */
export const lessonShares = mysqlTable("lesson_shares", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  classId: varchar("classId", { length: 64 }).notNull(),
  lessonId: varchar("lessonId", { length: 64 }).notNull(),
  dueDate: varchar("dueDate", { length: 10 }),
  createdAt: timestamp("createdAt", { fsp: 3 }).defaultNow(),
  archivedAt: timestamp("archivedAt", { fsp: 3 }),
});

/** One student's graded attempt at a shared lesson quiz (first attempt only). Graded on the server. */
export const lessonResults = mysqlTable(
  "lesson_results",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("userId", { length: 64 }).notNull(),
    shareId: varchar("shareId", { length: 64 }).notNull(),
    profileId: varchar("profileId", { length: 64 }).notNull(),
    answers: text("answers").notNull(),
    correct: int("correct").notNull(),
    total: int("total").notNull(),
    createdAt: timestamp("createdAt", { fsp: 3 }).defaultNow(),
  },
  t => [unique("lesson_results_share_profile").on(t.shareId, t.profileId)]
);
