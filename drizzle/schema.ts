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
