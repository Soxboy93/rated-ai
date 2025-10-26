import { mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow(),
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
  createdAt: timestamp("createdAt").defaultNow(),
  flagged: mysqlEnum("flagged", ["safe", "review", "blocked"]).default("safe"),
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
  createdAt: timestamp("createdAt").defaultNow(),
});

export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = typeof userProfiles.$inferInsert;

/**
 * Learning progress table - tracks progress in learning modules
 */
export const learningProgress = mysqlTable("learningProgress", {
  id: varchar("id", { length: 64 }).primaryKey(),
  profileId: varchar("profileId", { length: 64 }).notNull(),
  module: varchar("module", { length: 50 }).notNull(),
  progress: varchar("progress", { length: 10 }).default("0"),
  lastAccessed: timestamp("lastAccessed").defaultNow(),
});

export type LearningProgress = typeof learningProgress.$inferSelect;
export type InsertLearningProgress = typeof learningProgress.$inferInsert;

/**
 * Achievements table - tracks badges and milestones
 */
export const achievements = mysqlTable("achievements", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  title: varchar("title", { length: 100 }).notNull(),
  description: text("description"),
  badgeImage: text("badgeImage"),
  earnedAt: timestamp("earnedAt").defaultNow(),
});

export type Achievement = typeof achievements.$inferSelect;
export type InsertAchievement = typeof achievements.$inferInsert;

/**
 * Story creations table - stores AI-generated stories with illustrations
 */
export const storyCreations = mysqlTable("storyCreations", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  content: text("content").notNull(),
  illustrations: text("illustrations"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export type StoryCreation = typeof storyCreations.$inferSelect;
export type InsertStoryCreation = typeof storyCreations.$inferInsert;

/**
 * Mood tracking table - tracks emotional states
 */
export const moodEntries = mysqlTable("moodEntries", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  mood: varchar("mood", { length: 20 }).notNull(),
  emoji: varchar("emoji", { length: 10 }).notNull(),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export type MoodEntry = typeof moodEntries.$inferSelect;
export type InsertMoodEntry = typeof moodEntries.$inferInsert;


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

/**
 * Reading sessions table - tracks reading practice sessions
 */
export const readingSessions = mysqlTable("readingSessions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  text: text("text"),
  audioUrl: text("audioUrl"),
  transcription: text("transcription"),
  readingLevel: varchar("readingLevel", { length: 20 }),
  accuracy: int("accuracy"), // percentage
  wordsPerMinute: int("wordsPerMinute"),
  comprehensionScore: int("comprehensionScore"),
  feedback: text("feedback"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export type ReadingSession = typeof readingSessions.$inferSelect;
export type InsertReadingSession = typeof readingSessions.$inferInsert;

/**
 * Virtual pets table - tracks user's virtual learning companion
 */
export const virtualPets = mysqlTable("virtualPets", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 100 }),
  type: varchar("type", { length: 50 }), // dragon, unicorn, robot, etc.
  level: int("level").default(1),
  experience: int("experience").default(0),
  happiness: int("happiness").default(100),
  hunger: int("hunger").default(0),
  evolution: varchar("evolution", { length: 50 }).default("baby"),
  lastFed: timestamp("lastFed").defaultNow(),
  createdAt: timestamp("createdAt").defaultNow(),
});

export type VirtualPet = typeof virtualPets.$inferSelect;
export type InsertVirtualPet = typeof virtualPets.$inferInsert;

/**
 * Family challenges table - stores learning challenges for families
 */
export const familyChallenges = mysqlTable("familyChallenges", {
  id: varchar("id", { length: 64 }).primaryKey(),
  title: varchar("title", { length: 200 }),
  description: text("description"),
  type: varchar("type", { length: 50 }), // trivia, math_race, story_writing
  difficulty: varchar("difficulty", { length: 20 }),
  questions: text("questions"), // JSON array
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),
  active: boolean("active").default(true),
  createdAt: timestamp("createdAt").defaultNow(),
});

export type FamilyChallenge = typeof familyChallenges.$inferSelect;
export type InsertFamilyChallenge = typeof familyChallenges.$inferInsert;

/**
 * Challenge participants table - tracks who participates in challenges
 */
export const challengeParticipants = mysqlTable("challengeParticipants", {
  id: varchar("id", { length: 64 }).primaryKey(),
  challengeId: varchar("challengeId", { length: 64 }),
  userId: varchar("userId", { length: 64 }),
  userName: varchar("userName", { length: 100 }),
  score: int("score").default(0),
  completed: boolean("completed").default(false),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export type ChallengeParticipant = typeof challengeParticipants.$inferSelect;
export type InsertChallengeParticipant = typeof challengeParticipants.$inferInsert;

/**
 * Learning streaks table - tracks daily learning streaks
 */
export const learningStreaks = mysqlTable("learningStreaks", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull().unique(),
  currentStreak: int("currentStreak").default(0),
  longestStreak: int("longestStreak").default(0),
  lastActivityDate: timestamp("lastActivityDate").defaultNow(),
  freezesAvailable: int("freezesAvailable").default(2),
  totalPoints: int("totalPoints").default(0),
  createdAt: timestamp("createdAt").defaultNow(),
});

export type LearningStreak = typeof learningStreaks.$inferSelect;
export type InsertLearningStreak = typeof learningStreaks.$inferInsert;

/**
 * Quests table - stores available learning quests
 */
export const quests = mysqlTable("quests", {
  id: varchar("id", { length: 64 }).primaryKey(),
  title: varchar("title", { length: 200 }),
  description: text("description"),
  category: varchar("category", { length: 50 }),
  difficulty: int("difficulty").default(1),
  requiredLevel: int("requiredLevel").default(1),
  rewards: text("rewards"), // JSON
  tasks: text("tasks"), // JSON array of tasks
  active: boolean("active").default(true),
  createdAt: timestamp("createdAt").defaultNow(),
});

export type Quest = typeof quests.$inferSelect;
export type InsertQuest = typeof quests.$inferInsert;

/**
 * User quests progress table - tracks individual quest progress
 */
export const userQuests = mysqlTable("userQuests", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  questId: varchar("questId", { length: 64 }),
  progress: int("progress").default(0),
  completed: boolean("completed").default(false),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export type UserQuest = typeof userQuests.$inferSelect;
export type InsertUserQuest = typeof userQuests.$inferInsert;

