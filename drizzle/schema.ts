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



// Report Cards - AI-generated progress reports
export const reportCards = mysqlTable("reportCards", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  childName: varchar("childName", { length: 255 }),
  periodStart: timestamp("periodStart"),
  periodEnd: timestamp("periodEnd"),
  overallGrade: varchar("overallGrade", { length: 10 }),
  mathGrade: varchar("mathGrade", { length: 10 }),
  scienceGrade: varchar("scienceGrade", { length: 10 }),
  englishGrade: varchar("englishGrade", { length: 10 }),
  historyGrade: varchar("historyGrade", { length: 10 }),
  strengths: text("strengths"),
  weaknesses: text("weaknesses"),
  recommendations: text("recommendations"),
  totalMessages: int("totalMessages"),
  totalSessions: int("totalSessions"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export type ReportCard = typeof reportCards.$inferSelect;
export type InsertReportCard = typeof reportCards.$inferInsert;

// Smart Moments - "Caught Being Smart" feature
export const smartMoments = mysqlTable("smartMoments", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  childName: varchar("childName", { length: 255 }),
  question: text("question"),
  aiResponse: text("aiResponse"),
  category: varchar("category", { length: 100 }),
  parentNotified: boolean("parentNotified").default(false),
  parentReply: text("parentReply"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export type SmartMoment = typeof smartMoments.$inferSelect;
export type InsertSmartMoment = typeof smartMoments.$inferInsert;

// Progress Metrics - Daily/weekly progress tracking
export const progressMetrics = mysqlTable("progressMetrics", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  date: timestamp("date").defaultNow(),
  mathScore: int("mathScore"),
  scienceScore: int("scienceScore"),
  englishScore: int("englishScore"),
  historyScore: int("historyScore"),
  readingLevel: varchar("readingLevel", { length: 50 }),
  totalMessages: int("totalMessages"),
  totalMinutes: int("totalMinutes"),
  achievementsEarned: int("achievementsEarned"),
});

export type ProgressMetric = typeof progressMetrics.$inferSelect;
export type InsertProgressMetric = typeof progressMetrics.$inferInsert;


// Weekly Summary Emails
export const weeklySummaries = mysqlTable("weekly_summaries", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  weekStart: timestamp("weekStart").notNull(),
  weekEnd: timestamp("weekEnd").notNull(),
  totalMessages: int("totalMessages").notNull(),
  totalSessions: int("totalSessions").notNull(),
  topicsCovered: text("topicsCovered"),
  strengths: text("strengths"),
  areasToImprove: text("areasToImprove"),
  recommendations: text("recommendations"),
  emailSent: boolean("emailSent").default(false),
  createdAt: timestamp("createdAt").defaultNow(),
});

export type WeeklySummary = typeof weeklySummaries.$inferSelect;
export type InsertWeeklySummary = typeof weeklySummaries.$inferInsert;

// Study Reminders
export const studyReminders = mysqlTable("study_reminders", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  preferredTime: varchar("preferredTime", { length: 10 }), // "14:30" format
  enabled: boolean("enabled").default(true),
  streak: int("streak").default(0),
  lastStudyDate: timestamp("lastStudyDate"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export type StudyReminder = typeof studyReminders.$inferSelect;
export type InsertStudyReminder = typeof studyReminders.$inferInsert;



// Curriculum Standards - Common Core alignment
export const curriculumStandards = mysqlTable("curriculum_standards", {
  id: varchar("id", { length: 64 }).primaryKey(),
  messageId: varchar("messageId", { length: 64 }).notNull(),
  standardCode: varchar("standardCode", { length: 50 }).notNull(), // e.g., "CCSS.MATH.3.OA.A.1"
  standardDescription: text("standardDescription"),
  subject: varchar("subject", { length: 50 }), // Math, Science, English, etc.
  gradeLevel: varchar("gradeLevel", { length: 20 }), // K, 1-12
  createdAt: timestamp("createdAt").defaultNow(),
});

export type CurriculumStandard = typeof curriculumStandards.$inferSelect;
export type InsertCurriculumStandard = typeof curriculumStandards.$inferInsert;

// Teacher Accounts
export const teachers = mysqlTable("teachers", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  school: varchar("school", { length: 200 }),
  gradeLevel: varchar("gradeLevel", { length: 50 }),
  createdAt: timestamp("createdAt").defaultNow(),
});

export type Teacher = typeof teachers.$inferSelect;
export type InsertTeacher = typeof teachers.$inferInsert;

// Classroom Management
export const classrooms = mysqlTable("classrooms", {
  id: varchar("id", { length: 64 }).primaryKey(),
  teacherId: varchar("teacherId", { length: 64 }).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  gradeLevel: varchar("gradeLevel", { length: 50 }),
  subject: varchar("subject", { length: 100 }),
  studentCount: int("studentCount").default(0),
  createdAt: timestamp("createdAt").defaultNow(),
});

export type Classroom = typeof classrooms.$inferSelect;
export type InsertClassroom = typeof classrooms.$inferInsert;

// Peer Challenges
export const peerChallenges = mysqlTable("peer_challenges", {
  id: varchar("id", { length: 64 }).primaryKey(),
  creatorId: varchar("creatorId", { length: 64 }).notNull(),
  challengerId: varchar("challengerId", { length: 64 }),
  challengeType: varchar("challengeType", { length: 50 }), // "math_race", "trivia", "spelling"
  subject: varchar("subject", { length: 50 }),
  difficulty: varchar("difficulty", { length: 20 }),
  creatorScore: int("creatorScore").default(0),
  challengerScore: int("challengerScore").default(0),
  status: varchar("status", { length: 20 }).default("pending"), // pending, active, completed
  winnerId: varchar("winnerId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow(),
  completedAt: timestamp("completedAt"),
});

export type PeerChallenge = typeof peerChallenges.$inferSelect;
export type InsertPeerChallenge = typeof peerChallenges.$inferInsert;



// School Integrations
export const schoolIntegrations = mysqlTable("school_integrations", {
  id: varchar("id", { length: 64 }).primaryKey(),
  schoolId: varchar("schoolId", { length: 64 }).notNull(),
  platform: varchar("platform", { length: 50 }).notNull(), // "google_classroom", "canvas", "schoology"
  apiKey: text("apiKey"),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  isActive: int("isActive").default(1),
  lastSyncAt: timestamp("lastSyncAt"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export type SchoolIntegration = typeof schoolIntegrations.$inferSelect;
export type InsertSchoolIntegration = typeof schoolIntegrations.$inferInsert;

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
export const collegePrepProgress = mysqlTable("college_prep_progress", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  testType: varchar("testType", { length: 20 }).notNull(), // "SAT", "ACT", "AP"
  subject: varchar("subject", { length: 50 }), // Math, Reading, Writing, Science
  currentScore: int("currentScore"),
  targetScore: int("targetScore"),
  practiceTests: int("practiceTests").default(0),
  questionsAnswered: int("questionsAnswered").default(0),
  correctAnswers: int("correctAnswers").default(0),
  weakAreas: text("weakAreas"), // JSON array of topics
  strongAreas: text("strongAreas"), // JSON array of topics
  lastPracticeAt: timestamp("lastPracticeAt"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

export type CollegePrepProgress = typeof collegePrepProgress.$inferSelect;
export type InsertCollegePrepProgress = typeof collegePrepProgress.$inferInsert;

// SAT/ACT Practice Questions
export const practiceQuestions = mysqlTable("practice_questions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  testType: varchar("testType", { length: 20 }).notNull(),
  subject: varchar("subject", { length: 50 }).notNull(),
  difficulty: varchar("difficulty", { length: 20 }), // easy, medium, hard
  question: text("question").notNull(),
  options: text("options"), // JSON array
  correctAnswer: varchar("correctAnswer", { length: 10 }),
  explanation: text("explanation"),
  topic: varchar("topic", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow(),
});

export type PracticeQuestion = typeof practiceQuestions.$inferSelect;
export type InsertPracticeQuestion = typeof practiceQuestions.$inferInsert;



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

/** An activity a teacher sets for a class: play a game (at least a given level). */
export const classAssignments = mysqlTable("class_assignments", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  classId: varchar("classId", { length: 64 }).notNull(),
  game: varchar("game", { length: 20 }).notNull(),
  level: int("level").notNull().default(1),
  note: varchar("note", { length: 200 }),
  dueDate: varchar("dueDate", { length: 10 }),
  createdAt: timestamp("createdAt", { fsp: 3 }).defaultNow(),
  archivedAt: timestamp("archivedAt", { fsp: 3 }),
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
