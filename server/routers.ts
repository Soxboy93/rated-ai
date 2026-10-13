import { COOKIE_NAME } from "@shared/const";
import {
  GAME_IDS,
  MAX_QUESTIONS_PER_PLAY,
  MIN_MS_PER_QUESTION,
  MOODS,
  badgeById,
  effectiveStreak,
  levelProgress,
  levelTitle,
  resolvePlayDay,
} from "@shared/gamification";
import { consentFor, consentVersionFor } from "@shared/consent";
import { buildClassOverview } from "@shared/classroom";
import {
  MAX_CLASSES_PER_TEACHER,
  MAX_FAMILY_CHILDREN,
  MAX_STUDENTS_PER_CLASS,
  MAX_STUDENTS_PER_SCHOOL_ACCOUNT,
  ageGroupForGrade,
  type AccountType,
  type Lang,
} from "@shared/jordan";
import { TRPCError } from "@trpc/server";
import { createHash, randomUUID } from "crypto";
import { z } from "zod";
import * as db from "./db";
import {
  UNLOCK_COOKIE_NAME,
  SESSION_TTL_MS,
  UNLOCK_TTL_MS,
  hashPassword,
  isParentUnlocked,
  signSession,
  signUnlock,
  toSessionUser,
  verifyPassword,
} from "./_core/auth";
import { ENV } from "./_core/env";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM } from "./_core/llm";
import { LLMRefusalError } from "./_core/anthropic";
import { checkRateLimit } from "./_core/rateLimit";
import { systemRouter } from "./_core/systemRouter";
import {
  consentedParentProcedure,
  consentedProcedure,
  parentProcedure,
  protectedProcedure,
  publicProcedure,
  router,
} from "./_core/trpc";
import { AGE_GROUP_IDS, CHARACTER_IDS, buildSystemPrompt, languageRule } from "./prompts";
import { assistantSystemPrompt, generationSystemPrompt, generationUserPrompt, revisionSystemPrompt, revisionUserPrompt } from "./lessonPrompts";
import { lessonJsonSchema, LESSON_SUBJECTS, MAX_SOURCE_CHARS, MIN_SOURCE_CHARS, SOURCE_REQUIRED_SUBJECTS, gradeQuiz, normalizeLesson, studentFacingText, studentView, type LessonContent } from "@shared/lesson";
import { safeFallbackReply, screenText, screenWithProvider } from "./safety";

const MAX_CHAT_MESSAGE_CHARS = 2000;
const MAX_HISTORY_MESSAGES = 20;
// ~5 MB of image data once base64-encoded
const MAX_IMAGE_BASE64_CHARS = 7_000_000;

const AI_UNAVAILABLE = "The assistant is unavailable right now. Please try again in a moment.";

const emailSchema = z.string().trim().toLowerCase().email().max(320);
const pinSchema = z.string().min(4).max(64);

// bcrypt-compares against this when an account doesn't exist so login timing doesn't reveal accounts.
let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= hashPassword("not-a-real-password"));

const clientIp = (req: { ip?: string }) => req.ip ?? "unknown";

async function requireOwnedSession(sessionId: string, userId: string) {
  const session = await db.getChatSession(sessionId);
  if (!session || session.userId !== userId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Chat session not found" });
  }
  return session;
}

async function requireOwnedProfile(profileId: string, userId: string) {
  const profile = await db.getProfile(profileId);
  if (!profile || profile.userId !== userId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Child profile not found" });
  }
  return profile;
}

const langSchema = z.enum(["ar", "en"]);

async function requireOwnedClass(classId: string, userId: string) {
  const cls = await db.getClass(classId);
  if (!cls || cls.userId !== userId) throw new TRPCError({ code: "NOT_FOUND", message: "Class not found" });
  return cls;
}
async function assertRoomForProfiles(user: { id: string; accountType?: string | null }, adding: number) {
  const count = await db.countUserProfiles(user.id);
  const limit = user.accountType === "school" ? MAX_STUDENTS_PER_SCHOOL_ACCOUNT : MAX_FAMILY_CHILDREN;
  if (count + adding > limit) {
    throw new TRPCError({ code: "BAD_REQUEST", message: user.accountType === "school" ? `An account can have up to ${limit} students.` : `You can add up to ${limit} children.` });
  }
}
async function assertRoomInClass(classId: string, adding: number) {
  if ((await db.countClassStudents(classId)) + adding > MAX_STUDENTS_PER_CLASS) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `A class can have up to ${MAX_STUDENTS_PER_CLASS} students.` });
  }
}
const accountTypeOf = (user: { accountType?: string | null }): AccountType => (user.accountType === "school" ? "school" : "family");
const consentTextHash = (type: AccountType, lang: Lang) => {
  const c = consentFor(type, lang);
  return createHash("sha256")
    .update(JSON.stringify({ v: consentVersionFor(type), l: lang, t: c.title, p: c.points, s: c.statement }))
    .digest("hex");
};
const requireSchool = (user: { accountType?: string | null }) => {
  if (accountTypeOf(user) !== "school") throw new TRPCError({ code: "FORBIDDEN", message: "This is only available to school accounts." });
};

const childNameSchema = z.string().trim().min(1).max(50);
function assertNameAllowed(name: string) {
  // A name field must not be used to store contact details.
  if (screenText(name).level !== "safe") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Please use just a first name or nickname." });
  }
}

/** Everything the kid UI needs to draw a child's progress. */
async function progressSnapshot(profileId: string, clientDay?: string) {
  const today = resolvePlayDay(clientDay, new Date());
  const profileRow = await db.getProfile(profileId);
  const [row, badges, breakdown, recent, moods, assignments, lessonShares] = await Promise.all([
    db.getChildProgress(profileId),
    db.listBadges(profileId),
    db.getGameBreakdown(profileId),
    db.getRecentPlays(profileId, 8),
    db.listMoodCheckins(profileId, 1),
    // Activities the teacher set for this student's class, and whether they have done each one.
    profileRow?.classId
      ? db.listAssignments(profileRow.userId, profileRow.classId).then(list =>
          Promise.all(list.map(async a => ({ id: a.id, game: a.game, level: a.level, note: a.note, dueDate: a.dueDate, done: (await db.assignmentCompletions(a, [profileId])).has(profileId) })))
        )
      : Promise.resolve([] as Array<{ id: string; game: string; level: number; note: string | null; dueDate: string | null; done: boolean }>),
    // Lessons the teacher shared with this student's class (title and whether the quiz is done; never the answers).
    profileRow?.classId ? db.listStudentLessons(profileRow.classId, profileId) : Promise.resolve([]),
  ]);
  const xp = row?.xp ?? 0;
  const lp = levelProgress(xp);
  return {
    xp,
    level: lp.level,
    title: levelTitle(lp.level),
    levelStart: lp.start,
    levelNext: lp.next,
    levelFraction: lp.fraction,
    streakDays: effectiveStreak(row?.lastPlayDate ?? null, row?.streakDays ?? 0, today),
    longestStreak: row?.longestStreak ?? 0,
    playedToday: row?.lastPlayDate === today,
    badges: badges.map(b => ({ badgeId: b.badgeId, earnedAt: b.earnedAt })),
    breakdown,
    totalPlays: breakdown.reduce((n, g) => n + g.plays, 0),
    recent: recent.map(r => ({ game: r.game, correct: r.correct, total: r.total, xpEarned: r.xpEarned, createdAt: r.createdAt })),
    lastMood: moods[0]?.mood ?? null,
    lastMoodAt: moods[0]?.createdAt ?? null,
    assignments,
    lessons: lessonShares.map(l => ({ shareId: l.shareId, title: l.title, subject: l.subject, dueDate: l.dueDate, done: !!l.result, result: l.result })),
  };
}

/** Reject disallowed child input to the creative tools before it reaches the model. */
async function assertPromptAllowed(text: string, lang: Lang = "en") {
  const verdict = await screenWithProvider(text, lang);
  if (verdict.level !== "safe") {
    throw new TRPCError({ code: "BAD_REQUEST", message: verdict.reply ?? safeFallbackReply(lang) });
  }
}

function parseJson<T>(raw: unknown): T {
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: AI_UNAVAILABLE });
  }
}

async function llm(params: Parameters<typeof invokeLLM>[0]) {
  try {
    return await invokeLLM(params);
  } catch (error) {
    if (error instanceof LLMRefusalError) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "The assistant can't help with that. Let's try something else." });
    }
    console.error("[LLM] request failed:", error);
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: AI_UNAVAILABLE });
  }
}

const textOf = (response: Awaited<ReturnType<typeof invokeLLM>>) => {
  const content = response.choices[0]?.message.content;
  return typeof content === "string" ? content : "";
};


/* ------------------------------------------------------------------ teacher companion helpers */

async function requireOwnedLesson(lessonId: string, userId: string) {
  const row = await db.getLesson(lessonId);
  if (!row || row.userId !== userId) throw new TRPCError({ code: "NOT_FOUND", message: "Lesson not found" });
  return row;
}

const parseContent = (raw: string): LessonContent => {
  try {
    return normalizeLesson(JSON.parse(raw));
  } catch {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "This lesson could not be read." });
  }
};

/** AI output that children will read is screened before it is stored, same as any other generated text. */
function assertLessonSuitable(content: LessonContent) {
  if (screenText(studentFacingText(content), "en").level === "blocked" || screenText(studentFacingText(content), "ar").level === "blocked") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "The draft contained unsuitable content. Please try again with different wording." });
  }
}

const MAX_LESSONS_PER_TEACHER = 100;
const lessonInput = {
  title: z.string().trim().min(1).max(200),
};
const unreadable = () => new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The assistant could not write a usable lesson. Please try again." });

/** Asks the model for a lesson as JSON and coerces it; one bad answer from the model never reaches the database. */
async function draftLesson(params: Parameters<typeof invokeLLM>[0]): Promise<LessonContent> {
  // Claude (and OpenAI) can be held to the exact lesson shape; other compatible servers only get "return JSON".
  const strict = ENV.llmProvider === "anthropic" || process.env.LLM_JSON_SCHEMA === "1";
  const response = await llm({
    ...params,
    task: "lesson",
    response_format: strict ? { type: "json_schema", json_schema: { name: "lesson", schema: lessonJsonSchema as unknown as Record<string, unknown>, strict: true } } : { type: "json_object" },
  });
  let content: LessonContent;
  try {
    content = normalizeLesson(JSON.parse(textOf(response).replace(/^```(?:json)?\s*|\s*```$/g, "")));
  } catch {
    throw unreadable();
  }
  assertLessonSuitable(content);
  return content;
}

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),

    register: publicProcedure
      .input(
        z.object({
          email: emailSchema,
          password: z.string().min(8).max(128),
          name: z.string().trim().max(100).optional(),
          accountType: z.enum(["family", "school"]).default("family"),
          language: langSchema.optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        checkRateLimit(`register:${clientIp(ctx.req)}`, 10, 60 * 60 * 1000);
        if (await db.getUserByEmail(input.email)) {
          throw new TRPCError({ code: "CONFLICT", message: "An account with this email already exists" });
        }
        const id = randomUUID();
        try {
          await db.createUser({
            id,
            email: input.email,
            name: input.name || null,
            passwordHash: await hashPassword(input.password),
            loginMethod: "email",
            accountType: input.accountType,
            language: input.language,
            role: ENV.adminEmails.includes(input.email) ? "admin" : "user",
            lastSignedIn: new Date(),
          });
        } catch {
          throw new TRPCError({ code: "CONFLICT", message: "An account with this email already exists" });
        }
        ctx.res.cookie(COOKIE_NAME, await signSession(id), {
          ...getSessionCookieOptions(ctx.req),
          maxAge: SESSION_TTL_MS,
        });
        const user = await db.getUser(id);
        return user ? toSessionUser(user) : null;
      }),

    login: publicProcedure
      .input(z.object({ email: emailSchema, password: z.string().min(1).max(128) }))
      .mutation(async ({ ctx, input }) => {
        checkRateLimit(`login:${clientIp(ctx.req)}:${input.email}`, 10, 15 * 60 * 1000);
        const user = await db.getUserByEmail(input.email);
        const valid = await verifyPassword(input.password, user?.passwordHash ?? (await getDummyHash()));
        if (!user || !user.passwordHash || !valid) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Incorrect email or password" });
        }
        await db.touchUserSignIn(user.id);
        ctx.res.cookie(COOKIE_NAME, await signSession(user.id), {
          ...getSessionCookieOptions(ctx.req),
          maxAge: SESSION_TTL_MS,
        });
        return toSessionUser(user);
      }),

    setLanguage: protectedProcedure.input(z.object({ language: langSchema })).mutation(async ({ ctx, input }) => {
      await db.setUserLanguage(ctx.user.id, input.language);
      return { success: true };
    }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const options = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...options, maxAge: -1 });
      ctx.res.clearCookie(UNLOCK_COOKIE_NAME, { ...options, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  chat: router({
    createSession: consentedProcedure
      .input(
        z.object({
          profileId: z.string().max(64),
          characterId: z.enum(CHARACTER_IDS).optional(),
          language: langSchema.default("en"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const profile = await requireOwnedProfile(input.profileId, ctx.user.id);
        const sessionId = randomUUID();
        await db.createChatSession({
          id: sessionId,
          userId: ctx.user.id,
          profileId: profile.id,
          childName: profile.childName,
          // Age group always comes from the parent-managed profile, never from the child's request.
          ageGroup: profile.ageGroup,
          characterId: input.characterId ?? profile.selectedCharacter ?? undefined,
          language: input.language,
        });
        return { sessionId };
      }),

    sendMessage: consentedProcedure
      .input(
        z.object({
          sessionId: z.string().max(64),
          message: z.string().trim().min(1).max(MAX_CHAT_MESSAGE_CHARS),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const session = await requireOwnedSession(input.sessionId, ctx.user.id);
        checkRateLimit(`chat:${ctx.user.id}`, 20, 60 * 1000);

        const lang: Lang = session.language === "ar" ? "ar" : "en";
        const verdict = await screenWithProvider(input.message, lang);
        await db.createChatMessage({
          id: randomUUID(),
          sessionId: session.id,
          role: "user",
          content: input.message,
          flagged: verdict.level,
        });

        // Flagged input never reaches the model; the child gets a safe canned reply.
        if (verdict.level !== "safe") {
          const reply = verdict.reply ?? safeFallbackReply(lang);
          await db.createChatMessage({
            id: randomUUID(),
            sessionId: session.id,
            role: "assistant",
            content: reply,
            flagged: "safe",
          });
          await db.updateSessionLastMessage(session.id);
          return { message: reply, flagged: verdict.level };
        }

        const history = (await db.getSessionMessages(session.id))
          .filter(m => m.flagged === "safe" || m.flagged === null)
          .slice(-MAX_HISTORY_MESSAGES);

        const response = await llm({
          task: "chat",
          messages: [
            { role: "system", content: buildSystemPrompt({ ...session, language: lang }) },
            ...history.map(m => ({ role: m.role, content: m.content })),
          ],
        });

        let assistantMessage = textOf(response) || (lang === "ar" ? "عذراً، لم أفهم ذلك." : "I'm sorry, I couldn't understand that.");
        let outputFlag: "safe" | "blocked" = "safe";
        if (screenText(assistantMessage, lang).level === "blocked") {
          assistantMessage = safeFallbackReply(lang);
          outputFlag = "blocked";
        }

        await db.createChatMessage({
          id: randomUUID(),
          sessionId: session.id,
          role: "assistant",
          content: assistantMessage,
          flagged: outputFlag,
        });
        await db.updateSessionLastMessage(session.id);
        return { message: assistantMessage, flagged: "safe" as const };
      }),

    getMessages: protectedProcedure
      .input(z.object({ sessionId: z.string().max(64) }))
      .query(async ({ ctx, input }) => {
        await requireOwnedSession(input.sessionId, ctx.user.id);
        return db.getSessionMessages(input.sessionId);
      }),

    getAllSessions: protectedProcedure.query(({ ctx }) => db.getUserChatSessions(ctx.user.id)),
  }),

  creative: router({
    generateStory: consentedProcedure
      .input(z.object({ prompt: z.string().trim().min(1).max(500), language: langSchema.default("en") }))
      .mutation(async ({ ctx, input }) => {
        checkRateLimit(`creative:${ctx.user.id}`, 10, 60 * 1000);
        await assertPromptAllowed(input.prompt, input.language);
        const response = await llm({
          task: "chat",
          messages: [
            {
              role: "system",
              content:
                "You are a creative children's story writer. Write engaging, age-appropriate stories that are fun, educational, and inspire imagination. Never include violence, scary or adult content. Keep stories between 200-400 words. " +
                languageRule(input.language),
            },
            { role: "user", content: `Write a creative children's story about: ${input.prompt}` },
          ],
        });
        let content = textOf(response) || (input.language === "ar" ? "كان يا ما كان..." : "Once upon a time...");
        if (screenText(content, input.language).level === "blocked") content = safeFallbackReply(input.language);
        return { content };
      }),

    generateIllustration: consentedProcedure
      .input(z.object({ prompt: z.string().trim().min(1).max(500), language: langSchema.default("en") }))
      .mutation(async ({ ctx, input }) => {
        checkRateLimit(`image:${ctx.user.id}`, 5, 60 * 1000);
        await assertPromptAllowed(input.prompt, input.language);
        const { generateImage } = await import("./_core/imageGeneration");
        try {
          const result = await generateImage({
            prompt: `Child-friendly, colorful storybook illustration (no text, nothing scary): ${input.prompt}`,
          });
          return { imageUrl: result.url };
        } catch (error) {
          console.error("[Image] generation failed:", error);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not create the picture right now." });
        }
      }),

    generateAvatar: consentedProcedure
      .input(z.object({ childName: z.string().trim().min(1).max(50), style: z.string().trim().min(1).max(50) }))
      .mutation(async ({ ctx, input }) => {
        checkRateLimit(`image:${ctx.user.id}`, 5, 60 * 1000);
        await assertPromptAllowed(`${input.childName} ${input.style}`);
        const { generateImage } = await import("./_core/imageGeneration");
        try {
          const result = await generateImage({
            prompt: `Cute cartoon avatar for a child, ${input.style} style, friendly, colorful, simple design, profile picture, no text`,
          });
          return { avatarUrl: result.url };
        } catch (error) {
          console.error("[Image] generation failed:", error);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not create the picture right now." });
        }
      }),
  }),

  homework: router({
    analyzeHomework: consentedProcedure
      .input(
        z.object({
          imageData: z.string().max(MAX_IMAGE_BASE64_CHARS), // base64 encoded image
          subject: z.string().trim().max(50).optional(),
          language: langSchema.default("en"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        checkRateLimit(`homework:${ctx.user.id}`, 10, 60 * 1000);
        const response = await llm({
          task: "vision",
          messages: [
            {
              role: "system",
              content:
                "You are a helpful homework tutor for students. Analyze the homework problem in the image and provide a clear, step-by-step solution. Break down complex problems into simple steps. Be encouraging and educational. If the image is not a homework problem, say so in the question field and leave steps empty. Format your response as JSON with these fields: question (the problem statement), steps (array of solution steps), answer (final answer), explanation (why this solution works), subject (detected subject area), difficulty (easy/medium/hard). " +
                "Write the question, steps, answer and explanation in the language of this rule: " +
                languageRule(input.language) +
                " Keep the JSON field names in English.",
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Please analyze this ${input.subject || "homework"} problem and provide a step-by-step solution.`,
                },
                { type: "image_url", image_url: { url: `data:image/jpeg;base64,${input.imageData}` } },
              ],
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "homework_solution",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  question: { type: "string", description: "The homework problem statement" },
                  steps: { type: "array", items: { type: "string" }, description: "Step-by-step solution" },
                  answer: { type: "string", description: "Final answer" },
                  explanation: { type: "string", description: "Why this solution works" },
                  subject: { type: "string", description: "Detected subject area" },
                  difficulty: { type: "string", description: "Difficulty level" },
                },
                required: ["question", "steps", "answer", "explanation", "subject", "difficulty"],
                additionalProperties: false,
              },
            },
          },
        });

        const content = parseJson<{
          question: string;
          steps: string[];
          answer: string;
          explanation: string;
          subject: string;
          difficulty: string;
        }>(textOf(response));

        await db.createHomeworkSubmission({
          id: randomUUID(),
          userId: ctx.user.id,
          subject: String(content.subject ?? "").slice(0, 50),
          question: content.question,
          solution: content.answer,
          steps: JSON.stringify(content.steps ?? []),
          difficulty: String(content.difficulty ?? "").slice(0, 20),
          completed: true,
        });

        return content;
      }),

    getHomeworkHistory: protectedProcedure.query(({ ctx }) => db.getUserHomeworkSubmissions(ctx.user.id)),
  }),

  pet: router({
    getMyPet: protectedProcedure.query(({ ctx }) => db.getUserPet(ctx.user.id)),

    createPet: protectedProcedure
      .input(z.object({ type: z.string().trim().min(1).max(50), name: z.string().trim().min(1).max(50) }))
      .mutation(async ({ ctx, input }) => {
        if (await db.getUserPet(ctx.user.id)) {
          throw new TRPCError({ code: "CONFLICT", message: "You already have a pet" });
        }
        await db.createVirtualPet({
          id: randomUUID(),
          userId: ctx.user.id,
          type: input.type,
          name: input.name,
          level: 1,
          experience: 0,
          happiness: 100,
          hunger: 0,
          evolution: "baby",
        });
        return { success: true };
      }),

    feedPet: protectedProcedure.mutation(async ({ ctx }) => {
      const pet = await db.getUserPet(ctx.user.id);
      if (!pet) return { success: false };
      await db.updateVirtualPet(pet.id, {
        hunger: Math.max(0, (pet.hunger || 0) - 30),
        happiness: Math.min(100, (pet.happiness || 100) + 10),
        lastFed: new Date(),
      });
      return { success: true };
    }),

    playWithPet: protectedProcedure.mutation(async ({ ctx }) => {
      const pet = await db.getUserPet(ctx.user.id);
      if (!pet) return { success: false };

      const newExperience = (pet.experience || 0) + 20;
      const newLevel = Math.floor(newExperience / 100) + 1;
      let evolution = pet.evolution || "baby";
      if (newLevel >= 10) evolution = "adult";
      else if (newLevel >= 5) evolution = "teen";
      else if (newLevel >= 2) evolution = "child";

      await db.updateVirtualPet(pet.id, {
        experience: newExperience,
        level: newLevel,
        happiness: Math.min(100, (pet.happiness || 100) + 15),
        hunger: Math.min(100, (pet.hunger || 0) + 5),
        evolution,
      });
      return { success: true };
    }),
  }),

  reports: router({
    getLatestReport: protectedProcedure.query(({ ctx }) => db.getLatestReportCard(ctx.user.id)),

    generateReport: protectedProcedure.input(z.object({ language: langSchema.default("en") }).default({ language: "en" })).mutation(async ({ ctx, input }) => {
      checkRateLimit(`report:${ctx.user.id}`, 3, 60 * 1000);
      const sessions = await db.getUserChatSessions(ctx.user.id);
      const messages = await db.getAllUserMessages(ctx.user.id);
      const base = {
        id: randomUUID(),
        userId: ctx.user.id,
        childName: sessions[0]?.childName || "Student",
        periodStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        periodEnd: new Date(),
        totalMessages: messages.length,
        totalSessions: sessions.length,
      };

      if (messages.length === 0) {
        return db.createReportCard({
          ...base,
          overallGrade: "N/A",
          mathGrade: "N/A",
          scienceGrade: "N/A",
          englishGrade: "N/A",
          historyGrade: "N/A",
          strengths: "No learning activity recorded yet. Start chatting to build your report!",
          weaknesses: "N/A",
          recommendations: "Begin your learning journey by asking questions about topics that interest you.",
        });
      }

      const conversationSample = messages
        .filter(m => m.role === "user" && m.flagged === "safe")
        .slice(-50)
        .map(m => m.content.slice(0, 300))
        .join("\n");

      const response = await llm({
        task: "summary",
        messages: [
          {
            role: "system",
            content:
              "You summarise a child's learning conversations for a parent. Grades are rough estimates from topics discussed, not assessments. Use A+ to C- or N/A where there is no evidence for a subject. Write the text fields in the language of this rule: " + languageRule(input.language),
          },
          {
            role: "user",
            content: `Student messages:\n${conversationSample}\n\nProvide grades for Math, Science, English, History, an overall grade, strengths (2-3 sentences), areas for improvement (2-3 sentences) and recommendations (2-3 sentences).`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "report_card",
            strict: true,
            schema: {
              type: "object",
              properties: {
                overallGrade: { type: "string" },
                mathGrade: { type: "string" },
                scienceGrade: { type: "string" },
                englishGrade: { type: "string" },
                historyGrade: { type: "string" },
                strengths: { type: "string" },
                weaknesses: { type: "string" },
                recommendations: { type: "string" },
              },
              required: [
                "overallGrade",
                "mathGrade",
                "scienceGrade",
                "englishGrade",
                "historyGrade",
                "strengths",
                "weaknesses",
                "recommendations",
              ],
              additionalProperties: false,
            },
          },
        },
      });

      const analysis = parseJson<Record<string, string>>(textOf(response));
      // No fabricated fallback: if the model fails, the request fails and nothing is stored.
      return db.createReportCard({
        ...base,
        overallGrade: analysis.overallGrade,
        mathGrade: analysis.mathGrade,
        scienceGrade: analysis.scienceGrade,
        englishGrade: analysis.englishGrade,
        historyGrade: analysis.historyGrade,
        strengths: analysis.strengths,
        weaknesses: analysis.weaknesses,
        recommendations: analysis.recommendations,
      });
    }),
  }),

  summaries: router({
    getLatest: protectedProcedure.query(({ ctx }) => db.getLatestWeeklySummary(ctx.user.id)),

    generate: protectedProcedure.input(z.object({ language: langSchema.default("en") }).default({ language: "en" })).mutation(async ({ ctx, input }) => {
      checkRateLimit(`summary:${ctx.user.id}`, 3, 60 * 1000);
      const weekEnd = new Date();
      const weekStart = new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

      const sessions = (await db.getUserChatSessions(ctx.user.id)).filter(
        s => s.createdAt && new Date(s.createdAt) >= weekStart
      );
      const messages = (await db.getAllUserMessages(ctx.user.id)).filter(
        m => m.createdAt && new Date(m.createdAt) >= weekStart
      );
      const childMessages = messages.filter(m => m.role === "user" && m.flagged === "safe");
      if (childMessages.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No learning activity in the last 7 days yet." });
      }

      const response = await llm({
        task: "summary",
        messages: [
          {
            role: "system",
            content:
              "You are an educational progress analyst writing a short, positive, factual summary for a parent from their child's messages. Only mention things evidenced in the messages. Write in the language of this rule: " + languageRule(input.language),
          },
          {
            role: "user",
            content: `Child's messages this week:\n${childMessages
              .slice(-50)
              .map(m => m.content.slice(0, 300))
              .join("\n")}\n\nProvide topics covered, strengths demonstrated, areas to improve, and recommendations for next week (2-3 sentences each).`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "weekly_summary",
            strict: true,
            schema: {
              type: "object",
              properties: {
                topicsCovered: { type: "string" },
                strengths: { type: "string" },
                areasToImprove: { type: "string" },
                recommendations: { type: "string" },
              },
              required: ["topicsCovered", "strengths", "areasToImprove", "recommendations"],
              additionalProperties: false,
            },
          },
        },
      });

      const parsed = parseJson<Record<string, string>>(textOf(response));
      const summary = {
        id: randomUUID(),
        userId: ctx.user.id,
        weekStart,
        weekEnd,
        totalMessages: messages.length,
        totalSessions: sessions.length,
        topicsCovered: parsed.topicsCovered,
        strengths: parsed.strengths,
        areasToImprove: parsed.areasToImprove,
        recommendations: parsed.recommendations,
        emailSent: false,
      };
      await db.createWeeklySummary(summary);
      return summary;
    }),
  }),

  accessibility: router({
    getSettings: protectedProcedure.query(async ({ ctx }) => {
      const saved = await db.getAccessibilitySettings(ctx.user.id);
      return {
        dyslexiaMode: saved?.dyslexiaMode ?? 0,
        adhdMode: saved?.adhdMode ?? 0,
        autismMode: saved?.autismMode ?? 0,
        fontSize: saved?.fontSize ?? "medium",
        highContrast: saved?.highContrast ?? 0,
        textToSpeech: saved?.textToSpeech ?? 0,
        reducedMotion: saved?.reducedMotion ?? 0,
      };
    }),

    updateSettings: protectedProcedure
      .input(
        z.object({
          dyslexiaMode: z.boolean(),
          adhdMode: z.boolean(),
          autismMode: z.boolean(),
          fontSize: z.enum(["small", "medium", "large", "xlarge"]),
          highContrast: z.boolean(),
          textToSpeech: z.boolean(),
          reducedMotion: z.boolean(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await db.upsertAccessibilitySettings({
          id: randomUUID(),
          userId: ctx.user.id,
          dyslexiaMode: input.dyslexiaMode ? 1 : 0,
          adhdMode: input.adhdMode ? 1 : 0,
          autismMode: input.autismMode ? 1 : 0,
          fontSize: input.fontSize,
          highContrast: input.highContrast ? 1 : 0,
          textToSpeech: input.textToSpeech ? 1 : 0,
          reducedMotion: input.reducedMotion ? 1 : 0,
        });
        return { success: true };
      }),
  }),

  progress: router({
    // The kid UI polls this after every game; it is not PIN-locked (the child sees their own stars).
    get: consentedProcedure
      .input(z.object({ profileId: z.string().max(64), localDay: z.string().max(10).optional() }))
      .query(async ({ ctx, input }) => {
        await requireOwnedProfile(input.profileId, ctx.user.id);
        return progressSnapshot(input.profileId, input.localDay);
      }),

    // Called once when a round ends. Results come from the client, so the server only checks they are possible.
    submitPlay: consentedProcedure
      .input(
        z
          .object({
            profileId: z.string().max(64),
            game: z.enum(GAME_IDS),
            level: z.number().int().min(1).max(3),
            correct: z.number().int().min(0).max(MAX_QUESTIONS_PER_PLAY),
            total: z.number().int().min(1).max(MAX_QUESTIONS_PER_PLAY),
            durationMs: z.number().int().min(0).max(60 * 60 * 1000),
            localDay: z.string().max(10).optional(),
          })
          .refine(v => v.correct <= v.total, { message: "correct cannot exceed total" })
      )
      .mutation(async ({ ctx, input }) => {
        await requireOwnedProfile(input.profileId, ctx.user.id);
        checkRateLimit(`play:${ctx.user.id}`, 30, 60 * 1000);
        if (input.durationMs < input.total * MIN_MS_PER_QUESTION) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "That round finished too fast to be real." });
        }
        const result = await db.recordPlay({
          userId: ctx.user.id,
          profileId: input.profileId,
          game: input.game,
          level: input.level,
          correct: input.correct,
          total: input.total,
          durationMs: input.durationMs,
          day: resolvePlayDay(input.localDay, new Date()),
        });
        return { ...result, newBadges: result.newBadges.map(id => ({ id, name: badgeById(id)?.name ?? id, icon: badgeById(id)?.icon ?? "🏅" })) };
      }),

    // Mood check-in the child does for themselves. Notes are screened like chat messages.
    checkin: consentedProcedure
      .input(
        z.object({
          profileId: z.string().max(64),
          mood: z.enum(MOODS),
          note: z.string().trim().max(200).optional(),
          language: langSchema.default("en"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await requireOwnedProfile(input.profileId, ctx.user.id);
        checkRateLimit(`mood:${ctx.user.id}`, 10, 60 * 1000);
        if ((await db.countRecentMoodCheckins(input.profileId, new Date(Date.now() - 24 * 60 * 60 * 1000))) >= 10) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "You've checked in a lot today. Come back tomorrow!" });
        }
        const verdict = input.note ? screenText(input.note, input.language) : { level: "safe" as const };
        const { newBadges } = await db.addMoodCheckin({
          userId: ctx.user.id,
          profileId: input.profileId,
          mood: input.mood,
          note: input.note,
          flagged: verdict.level,
        });
        return {
          flagged: verdict.level,
          // A worrying note gets the same supportive reply as chat, and the parent sees it flagged.
          reply: verdict.level === "safe" ? null : ("reply" in verdict ? verdict.reply ?? null : null),
          newBadges: newBadges.map(id => ({ id, name: badgeById(id)?.name ?? id, icon: badgeById(id)?.icon ?? "🏅" })),
        };
      }),

    // Parent view: real numbers per child, no AI involved.
    overview: parentProcedure.query(async ({ ctx }) => {
      const profiles = await db.listProfiles(ctx.user.id);
      return Promise.all(
        profiles.map(async p => ({
          profile: { id: p.id, childName: p.childName, ageGroup: p.ageGroup },
          progress: await progressSnapshot(p.id),
          moods: (await db.listMoodCheckins(p.id, 14)).map(m => ({ mood: m.mood, note: m.note, flagged: m.flagged, createdAt: m.createdAt })),
        }))
      );
    }),
  }),

  consent: router({
    status: protectedProcedure.query(async ({ ctx }) => {
      const type = accountTypeOf(ctx.user);
      const required = consentVersionFor(type);
      const active = await db.getActiveConsent(ctx.user.id);
      return {
        version: required,
        accountType: type,
        granted: !!active && active.version === required,
        grantedVersion: active?.version ?? null,
        grantedAt: active?.grantedAt ?? null,
        contactEmail: ENV.privacyContactEmail || null,
      };
    }),

    grant: protectedProcedure
      .input(z.object({ version: z.string().max(60), language: langSchema.default("en"), confirmParent: z.literal(true) }))
      .mutation(async ({ ctx, input }) => {
        const type = accountTypeOf(ctx.user);
        const required = consentVersionFor(type);
        if (input.version !== required) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "The consent wording has changed. Please reload the page and read it again." });
        }
        const active = await db.getActiveConsent(ctx.user.id);
        if (!active || active.version !== required) {
          if (active) await db.revokeConsent(ctx.user.id); // supersede consent given for older wording
          await db.createConsent({
            id: randomUUID(),
            userId: ctx.user.id,
            version: required,
            language: input.language,
            textSha256: consentTextHash(type, input.language),
          });
          await db.logAudit(ctx.user.id, "consent_granted", `${required} (${input.language})`);
        }
        return { success: true };
      }),

    // Stops all chat and AI features until consent is granted again. Data is kept; delete it separately.
    withdraw: parentProcedure.mutation(async ({ ctx }) => {
      await db.revokeConsent(ctx.user.id);
      await db.logAudit(ctx.user.id, "consent_withdrawn");
      return { success: true };
    }),
  }),

  profiles: router({
    // Not PIN-locked: the child picks their own profile on the start screen.
    list: protectedProcedure.query(async ({ ctx }) => {
      const rows = await db.listProfiles(ctx.user.id);
      return rows.map(p => ({
        id: p.id,
        childName: p.childName,
        ageGroup: p.ageGroup,
        selectedCharacter: p.selectedCharacter,
        classId: p.classId,
      }));
    }),

    create: consentedParentProcedure
      .input(
        z.object({
          childName: childNameSchema,
          ageGroup: z.enum(AGE_GROUP_IDS).optional(),
          classId: z.string().max(64).optional(),
          selectedCharacter: z.enum(CHARACTER_IDS).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        assertNameAllowed(input.childName);
        await assertRoomForProfiles(ctx.user, 1);
        let ageGroup = input.ageGroup;
        if (input.classId) {
          requireSchool(ctx.user);
          const cls = await requireOwnedClass(input.classId, ctx.user.id);
          await assertRoomInClass(cls.id, 1);
          ageGroup ??= ageGroupForGrade(cls.grade);
        }
        if (!ageGroup) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose an age group." });
        const id = randomUUID();
        await db.createProfile({
          id,
          userId: ctx.user.id,
          childName: input.childName,
          ageGroup,
          classId: input.classId,
          selectedCharacter: input.selectedCharacter,
        });
        await db.logAudit(ctx.user.id, "profile_created", input.childName);
        return { id };
      }),

    // School accounts: add many students to a class from a pasted or uploaded list of names.
    importRoster: consentedParentProcedure
      .input(z.object({ classId: z.string().max(64), names: z.array(z.string().max(200)).min(1).max(MAX_STUDENTS_PER_CLASS) }))
      .mutation(async ({ ctx, input }) => {
        requireSchool(ctx.user);
        const cls = await requireOwnedClass(input.classId, ctx.user.id);
        const existing = new Set((await db.listClassProfiles(ctx.user.id, cls.id)).map(p => p.childName.toLowerCase()));
        let roomClass = MAX_STUDENTS_PER_CLASS - existing.size;
        let roomAccount = MAX_STUDENTS_PER_SCHOOL_ACCOUNT - (await db.countUserProfiles(ctx.user.id));
        const created: string[] = [];
        const skipped: Array<{ name: string; reason: "empty" | "too_long" | "contact_details" | "duplicate" | "class_full" }> = [];
        for (const raw of input.names) {
          const name = raw.replace(/\s+/g, " ").trim();
          if (!name) { skipped.push({ name: raw, reason: "empty" }); continue; }
          if (name.length > 50) { skipped.push({ name, reason: "too_long" }); continue; }
          if (screenText(name).level !== "safe") { skipped.push({ name, reason: "contact_details" }); continue; }
          if (existing.has(name.toLowerCase())) { skipped.push({ name, reason: "duplicate" }); continue; }
          if (roomClass <= 0 || roomAccount <= 0) { skipped.push({ name, reason: "class_full" }); continue; }
          await db.createProfile({ id: randomUUID(), userId: ctx.user.id, childName: name, ageGroup: ageGroupForGrade(cls.grade), classId: cls.id });
          existing.add(name.toLowerCase());
          created.push(name);
          roomClass--; roomAccount--;
        }
        await db.logAudit(ctx.user.id, "roster_imported", `${cls.name}: ${created.length} added, ${skipped.length} skipped`);
        return { created: created.length, skipped };
      }),

    update: consentedParentProcedure
      .input(
        z.object({
          profileId: z.string().max(64),
          childName: childNameSchema.optional(),
          ageGroup: z.enum(AGE_GROUP_IDS).optional(),
          selectedCharacter: z.enum(CHARACTER_IDS).optional(),
          classId: z.string().max(64).nullable().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const profile = await requireOwnedProfile(input.profileId, ctx.user.id);
        if (input.childName) assertNameAllowed(input.childName);
        if (input.classId) {
          requireSchool(ctx.user);
          const cls = await requireOwnedClass(input.classId, ctx.user.id);
          if (cls.id !== profile.classId) await assertRoomInClass(cls.id, 1);
        }
        const { profileId: _id, ...updates } = input;
        await db.updateProfile(profile.id, updates);
        await db.logAudit(ctx.user.id, "profile_updated", profile.childName);
        return { success: true };
      }),

    // Permanently deletes the profile and all of that child's chats.
    delete: parentProcedure
      .input(z.object({ profileId: z.string().max(64) }))
      .mutation(async ({ ctx, input }) => {
        const profile = await requireOwnedProfile(input.profileId, ctx.user.id);
        await db.deleteProfileData(ctx.user.id, profile.id);
        await db.logAudit(ctx.user.id, "profile_deleted", profile.childName);
        return { success: true };
      }),

    export: parentProcedure
      .input(z.object({ profileId: z.string().max(64) }))
      .mutation(async ({ ctx, input }) => {
        const profile = await requireOwnedProfile(input.profileId, ctx.user.id);
        const chats = await db.getProfileChats(ctx.user.id, profile.id);
        const progress = await db.getProfileProgressExport(profile.id);
        await db.logAudit(ctx.user.id, "profile_exported", profile.childName);
        return {
          exportedAt: new Date().toISOString(),
          profile: {
            childName: profile.childName,
            ageGroup: profile.ageGroup,
            selectedCharacter: profile.selectedCharacter,
            createdAt: profile.createdAt,
          },
          chats,
          progress,
        };
      }),
  }),

  // ------------------------------------------------------------------ school accounts
  classes: router({
    // Not PIN-locked: the student picker filters by class.
    list: protectedProcedure.query(async ({ ctx }) => {
      const [classes, profiles] = await Promise.all([db.listClasses(ctx.user.id), db.listProfiles(ctx.user.id)]);
      return classes.map(c => ({ id: c.id, name: c.name, grade: c.grade, studentCount: profiles.filter(p => p.classId === c.id).length }));
    }),

    create: consentedParentProcedure
      .input(z.object({ name: z.string().trim().min(1).max(100), grade: z.number().int().min(1).max(12) }))
      .mutation(async ({ ctx, input }) => {
        requireSchool(ctx.user);
        assertNameAllowed(input.name);
        if ((await db.listClasses(ctx.user.id)).length >= MAX_CLASSES_PER_TEACHER) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `You can have up to ${MAX_CLASSES_PER_TEACHER} classes.` });
        }
        const id = randomUUID();
        await db.createClass({ id, userId: ctx.user.id, name: input.name, grade: input.grade });
        await db.logAudit(ctx.user.id, "class_created", input.name);
        return { id };
      }),

    update: consentedParentProcedure
      .input(z.object({ classId: z.string().max(64), name: z.string().trim().min(1).max(100).optional(), grade: z.number().int().min(1).max(12).optional() }))
      .mutation(async ({ ctx, input }) => {
        requireSchool(ctx.user);
        const cls = await requireOwnedClass(input.classId, ctx.user.id);
        if (input.name) assertNameAllowed(input.name);
        const { classId: _id, ...updates } = input;
        await db.updateClass(cls.id, updates);
        return { success: true };
      }),

    // Removes the class and its assignments. Students are kept, unassigned.
    delete: parentProcedure.input(z.object({ classId: z.string().max(64) })).mutation(async ({ ctx, input }) => {
      requireSchool(ctx.user);
      const cls = await requireOwnedClass(input.classId, ctx.user.id);
      await db.deleteClass(ctx.user.id, cls.id);
      await db.logAudit(ctx.user.id, "class_deleted", cls.name);
      return { success: true };
    }),

    // The teacher's view of a whole class: real numbers per student, no AI involved.
    overview: parentProcedure
      .input(z.object({ classId: z.string().max(64), localDay: z.string().max(10).optional() }))
      .query(async ({ ctx, input }) => {
        requireSchool(ctx.user);
        const cls = await requireOwnedClass(input.classId, ctx.user.id);
        const [profiles, assignments] = await Promise.all([db.listClassProfiles(ctx.user.id, cls.id), db.listAssignments(ctx.user.id, cls.id)]);
        const aggregates = await db.getStudentAggregates(profiles, assignments);
        return {
          class: { id: cls.id, name: cls.name, grade: cls.grade },
          ...buildClassOverview(aggregates, assignments.length, resolvePlayDay(input.localDay, new Date())),
        };
      }),
  }),

  assignments: router({
    list: parentProcedure.input(z.object({ classId: z.string().max(64) })).query(async ({ ctx, input }) => {
      requireSchool(ctx.user);
      const cls = await requireOwnedClass(input.classId, ctx.user.id);
      const [assignments, profiles] = await Promise.all([db.listAssignments(ctx.user.id, cls.id), db.listClassProfiles(ctx.user.id, cls.id)]);
      const ids = profiles.map(p => p.id);
      return Promise.all(
        assignments.map(async a => ({
          id: a.id,
          game: a.game,
          level: a.level,
          note: a.note,
          dueDate: a.dueDate,
          createdAt: a.createdAt,
          doneCount: (await db.assignmentCompletions(a, ids)).size,
          studentCount: ids.length,
        }))
      );
    }),

    create: consentedParentProcedure
      .input(
        z.object({
          classId: z.string().max(64),
          game: z.enum(GAME_IDS),
          level: z.number().int().min(1).max(3),
          note: z.string().trim().max(200).optional(),
          dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        requireSchool(ctx.user);
        const cls = await requireOwnedClass(input.classId, ctx.user.id);
        // Students read the note, so it gets the same screening as anything else shown to them.
        if (input.note && screenText(input.note).level !== "safe") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Please remove contact details or unsuitable words from the note." });
        }
        if ((await db.listAssignments(ctx.user.id, cls.id)).length >= 10) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "A class can have up to 10 open activities. Archive one first." });
        }
        const id = randomUUID();
        await db.createAssignment({ id, userId: ctx.user.id, classId: cls.id, game: input.game, level: input.level, note: input.note, dueDate: input.dueDate });
        await db.logAudit(ctx.user.id, "assignment_created", `${cls.name}: ${input.game} L${input.level}`);
        return { id };
      }),

    archive: parentProcedure.input(z.object({ assignmentId: z.string().max(64) })).mutation(async ({ ctx, input }) => {
      requireSchool(ctx.user);
      const a = await db.getAssignment(input.assignmentId);
      if (!a || a.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND", message: "Activity not found" });
      await db.archiveAssignment(a.id);
      return { success: true };
    }),
  }),

  // ------------------------------------------------------------------ teacher companion
  lessons: router({
    list: parentProcedure.query(async ({ ctx }) => {
      requireSchool(ctx.user);
      const [rows, shares] = await Promise.all([db.listLessons(ctx.user.id), db.listLessonShares(ctx.user.id)]);
      return rows.map(l => ({ ...l, sharedWith: shares.filter(x => x.lessonId === l.id).length }));
    }),

    get: parentProcedure.input(z.object({ lessonId: z.string().max(64) })).query(async ({ ctx, input }) => {
      requireSchool(ctx.user);
      const row = await requireOwnedLesson(input.lessonId, ctx.user.id);
      return {
        id: row.id, title: row.title, subject: row.subject, grade: row.grade, language: row.language as Lang, topic: row.topic,
        durationMin: row.durationMin, hasSource: !!row.sourceText, content: parseContent(row.content), updatedAt: row.updatedAt,
      };
    }),

    generate: consentedParentProcedure
      .input(
        z.object({
          subject: z.enum(LESSON_SUBJECTS),
          grade: z.number().int().min(1).max(12),
          topic: z.string().trim().min(3).max(300),
          durationMin: z.number().int().min(15).max(90).default(45),
          language: langSchema,
          notes: z.string().trim().max(500).optional(),
          sourceText: z.string().trim().max(MAX_SOURCE_CHARS).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        requireSchool(ctx.user);
        checkRateLimit(`lesson-gen:${ctx.user.id}`, 12, 60 * 60 * 1000);
        if (SOURCE_REQUIRED_SUBJECTS.includes(input.subject) && (input.sourceText?.length ?? 0) < MIN_SOURCE_CHARS) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "For this subject, paste the textbook passage you are teaching from so the lesson stays faithful to it." });
        }
        if ((await db.countLessons(ctx.user.id)) >= MAX_LESSONS_PER_TEACHER) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "You can keep up to 100 lessons. Delete one first." });
        }
        const content = await draftLesson({
          messages: [
            { role: "system", content: generationSystemPrompt(input.language, !!input.sourceText) },
            { role: "user", content: generationUserPrompt(input) },
          ],
        });
        const id = randomUUID();
        await db.createLesson({
          id, userId: ctx.user.id, title: input.topic.slice(0, 200), subject: input.subject, grade: input.grade, language: input.language,
          topic: input.topic, durationMin: input.durationMin, sourceText: input.sourceText || null, content: JSON.stringify(content),
        });
        await db.logAudit(ctx.user.id, "lesson_created", input.topic.slice(0, 100));
        return { id };
      }),

    // "Make it simpler", "add two more questions", "shorter": the model rewrites the lesson following the instruction.
    revise: consentedParentProcedure
      .input(z.object({ lessonId: z.string().max(64), instruction: z.string().trim().min(3).max(500) }))
      .mutation(async ({ ctx, input }) => {
        requireSchool(ctx.user);
        checkRateLimit(`lesson-gen:${ctx.user.id}`, 12, 60 * 60 * 1000);
        const row = await requireOwnedLesson(input.lessonId, ctx.user.id);
        const content = await draftLesson({
          messages: [
            { role: "system", content: revisionSystemPrompt(row.language === "ar" ? "ar" : "en") },
            { role: "user", content: revisionUserPrompt(parseContent(row.content), input.instruction) },
          ],
        });
        await db.updateLesson(row.id, { content: JSON.stringify(content) });
        return { success: true };
      }),

    // The teacher's own edits. Content is re-validated, so a hand-edited quiz can never be malformed.
    update: consentedParentProcedure
      .input(z.object({ lessonId: z.string().max(64), title: lessonInput.title.optional(), content: z.unknown().optional() }))
      .mutation(async ({ ctx, input }) => {
        requireSchool(ctx.user);
        const row = await requireOwnedLesson(input.lessonId, ctx.user.id);
        const patch: { title?: string; content?: string } = {};
        if (input.title) patch.title = input.title;
        if (input.content !== undefined) {
          let content: LessonContent;
          try {
            content = normalizeLesson(input.content);
          } catch {
            throw new TRPCError({ code: "BAD_REQUEST", message: "A lesson needs at least one teaching step." });
          }
          assertLessonSuitable(content);
          patch.content = JSON.stringify(content);
        }
        await db.updateLesson(row.id, patch);
        return { success: true };
      }),

    delete: parentProcedure.input(z.object({ lessonId: z.string().max(64) })).mutation(async ({ ctx, input }) => {
      requireSchool(ctx.user);
      const row = await requireOwnedLesson(input.lessonId, ctx.user.id);
      await db.deleteLesson(ctx.user.id, row.id);
      await db.logAudit(ctx.user.id, "lesson_deleted", row.title.slice(0, 100));
      return { success: true };
    }),

    // Share a lesson with a class: students see its summary and examples and can take its quiz.
    share: consentedParentProcedure
      .input(z.object({ lessonId: z.string().max(64), classId: z.string().max(64), dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }))
      .mutation(async ({ ctx, input }) => {
        requireSchool(ctx.user);
        const [lesson, cls] = await Promise.all([requireOwnedLesson(input.lessonId, ctx.user.id), requireOwnedClass(input.classId, ctx.user.id)]);
        const content = parseContent(lesson.content);
        if (content.quiz.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Add at least one quiz question before sharing this lesson with students." });
        assertLessonSuitable(content);
        const open = await db.listLessonShares(ctx.user.id, cls.id);
        if (open.some(x => x.lessonId === lesson.id)) throw new TRPCError({ code: "CONFLICT", message: "This lesson is already shared with that class." });
        if (open.length >= 10) throw new TRPCError({ code: "BAD_REQUEST", message: "A class can have up to 10 shared lessons. Archive one first." });
        const id = randomUUID();
        await db.createLessonShare({ id, userId: ctx.user.id, classId: cls.id, lessonId: lesson.id, dueDate: input.dueDate });
        await db.logAudit(ctx.user.id, "lesson_shared", `${lesson.title.slice(0, 60)} → ${cls.name}`);
        return { id };
      }),

    shares: parentProcedure.input(z.object({ classId: z.string().max(64).optional() })).query(async ({ ctx, input }) => {
      requireSchool(ctx.user);
      if (input.classId) await requireOwnedClass(input.classId, ctx.user.id);
      const [shares, classes, lessons] = await Promise.all([db.listLessonShares(ctx.user.id, input.classId), db.listClasses(ctx.user.id), db.listLessons(ctx.user.id)]);
      return shares.map(sh => ({
        id: sh.id, lessonId: sh.lessonId, classId: sh.classId, dueDate: sh.dueDate, createdAt: sh.createdAt,
        lessonTitle: lessons.find(l => l.id === sh.lessonId)?.title ?? "",
        className: classes.find(c => c.id === sh.classId)?.name ?? "",
      }));
    }),

    archiveShare: parentProcedure.input(z.object({ shareId: z.string().max(64) })).mutation(async ({ ctx, input }) => {
      requireSchool(ctx.user);
      const sh = await db.getLessonShare(input.shareId);
      if (!sh || sh.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND", message: "Shared lesson not found" });
      await db.archiveLessonShare(sh.id);
      return { success: true };
    }),

    // Per-question results show which idea the class has not understood yet; per-student scores show who is missing.
    results: parentProcedure.input(z.object({ shareId: z.string().max(64) })).query(async ({ ctx, input }) => {
      requireSchool(ctx.user);
      const sh = await db.getLessonShare(input.shareId);
      if (!sh || sh.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND", message: "Shared lesson not found" });
      const [lesson, students, results] = await Promise.all([requireOwnedLesson(sh.lessonId, ctx.user.id), db.listClassProfiles(ctx.user.id, sh.classId), db.listLessonResults(sh.id)]);
      const content = parseContent(lesson.content);
      const graded = results.map(r => {
        let answers: number[] = [];
        try { answers = JSON.parse(r.answers); } catch { /* keep empty */ }
        return { profileId: r.profileId, ...gradeQuiz(content.quiz, answers) };
      });
      return {
        lessonTitle: lesson.title,
        studentCount: students.length,
        doneCount: graded.length,
        questions: content.quiz.map((q, i) => ({ q: q.q, percentCorrect: graded.length ? Math.round((graded.filter(g => g.perQuestion[i]).length / graded.length) * 100) : null })),
        students: students.map(s => {
          const g = graded.find(x => x.profileId === s.id);
          return { profileId: s.id, childName: s.childName, correct: g?.correct ?? null, total: g?.total ?? content.quiz.length };
        }),
      };
    }),
  }),

  // A stateless chat with the teacher companion. Nothing here involves children's data and nothing is stored.
  assistant: router({
    ask: consentedParentProcedure
      .input(
        z.object({
          messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(3000) })).min(1).max(12),
          language: langSchema,
          lessonId: z.string().max(64).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        requireSchool(ctx.user);
        checkRateLimit(`assistant:${ctx.user.id}`, 30, 10 * 60 * 1000);
        if (input.messages[input.messages.length - 1].role !== "user") throw new TRPCError({ code: "BAD_REQUEST", message: "Ask a question first." });
        let context: string | undefined;
        if (input.lessonId) {
          const row = await requireOwnedLesson(input.lessonId, ctx.user.id);
          context = JSON.stringify({ title: row.title, subject: row.subject, grade: row.grade, content: parseContent(row.content) }).slice(0, 6000);
        }
        const response = await llm({ task: "assistant", messages: [{ role: "system", content: assistantSystemPrompt(input.language, context) }, ...input.messages] });
        const reply = textOf(response).trim();
        if (!reply) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: AI_UNAVAILABLE });
        return { reply };
      }),
  }),

  // The student's side of a shared lesson. Grading happens here, so a student cannot score themselves.
  studentLessons: router({
    get: consentedProcedure.input(z.object({ profileId: z.string().max(64), shareId: z.string().max(64) })).query(async ({ ctx, input }) => {
      const profile = await requireOwnedProfile(input.profileId, ctx.user.id);
      const sh = await db.getLessonShare(input.shareId);
      if (!sh || sh.userId !== ctx.user.id || sh.archivedAt || sh.classId !== profile.classId) throw new TRPCError({ code: "NOT_FOUND", message: "Lesson not found" });
      const lesson = await db.getLesson(sh.lessonId);
      if (!lesson) throw new TRPCError({ code: "NOT_FOUND", message: "Lesson not found" });
      const result = await db.getLessonResult(sh.id, profile.id);
      return { title: lesson.title, subject: lesson.subject, language: lesson.language as Lang, ...studentView(parseContent(lesson.content)), result: result ? { correct: result.correct, total: result.total } : null };
    }),

    submit: consentedProcedure
      .input(
        z.object({
          profileId: z.string().max(64),
          shareId: z.string().max(64),
          answers: z.array(z.number().int().min(-1).max(3)).max(20),
          durationMs: z.number().int().min(0).max(60 * 60 * 1000),
          localDay: z.string().max(10).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const profile = await requireOwnedProfile(input.profileId, ctx.user.id);
        checkRateLimit(`lesson-submit:${ctx.user.id}`, 30, 60 * 1000);
        const sh = await db.getLessonShare(input.shareId);
        if (!sh || sh.userId !== ctx.user.id || sh.archivedAt || sh.classId !== profile.classId) throw new TRPCError({ code: "NOT_FOUND", message: "Lesson not found" });
        const lesson = await db.getLesson(sh.lessonId);
        if (!lesson) throw new TRPCError({ code: "NOT_FOUND", message: "Lesson not found" });
        const content = parseContent(lesson.content);
        if (input.answers.length !== content.quiz.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Answer every question." });
        if (input.durationMs < content.quiz.length * MIN_MS_PER_QUESTION) throw new TRPCError({ code: "BAD_REQUEST", message: "That round finished too fast to be real." });

        const graded = gradeQuiz(content.quiz, input.answers);
        const review = content.quiz.map((q, i) => ({ correctAnswer: q.answer, explanation: q.explanation, right: graded.perQuestion[i] }));
        const stored = await db.insertLessonResult({ id: randomUUID(), userId: ctx.user.id, shareId: sh.id, profileId: profile.id, answers: JSON.stringify(input.answers), correct: graded.correct, total: graded.total });
        if (!stored) {
          // Only the first attempt counts, for the score and for XP.
          const first = await db.getLessonResult(sh.id, profile.id);
          return { already: true as const, correct: first?.correct ?? graded.correct, total: first?.total ?? graded.total, review, xpEarned: 0, xp: null, leveledUp: false, newBadges: [] as Array<{ id: string; name: string; icon: string }> };
        }
        const play = await db.recordPlay({ userId: ctx.user.id, profileId: profile.id, game: "quiz", level: 1, correct: graded.correct, total: graded.total, durationMs: input.durationMs, day: resolvePlayDay(input.localDay, new Date()) });
        return {
          already: false as const, correct: graded.correct, total: graded.total, review,
          xpEarned: play.xpEarned, xp: play.xp, leveledUp: play.leveledUp,
          newBadges: play.newBadges.map(id => ({ id, name: badgeById(id)?.name ?? id, icon: badgeById(id)?.icon ?? "🏅" })),
        };
      }),
  }),

  account: router({
    auditLog: parentProcedure.query(({ ctx }) => db.listAuditEvents(ctx.user.id)),

    // Permanently deletes the parent account and everything stored for it. Requires the password again.
    delete: parentProcedure
      .input(z.object({ password: z.string().min(1).max(128), confirm: z.literal("DELETE") }))
      .mutation(async ({ ctx, input }) => {
        checkRateLimit(`delete-account:${ctx.user.id}`, 5, 15 * 60 * 1000);
        const user = await db.getUser(ctx.user.id);
        if (!user?.passwordHash || !(await verifyPassword(input.password, user.passwordHash))) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Password is incorrect" });
        }
        await db.deleteAllUserData(ctx.user.id);
        const options = getSessionCookieOptions(ctx.req);
        ctx.res.clearCookie(COOKIE_NAME, { ...options, maxAge: -1 });
        ctx.res.clearCookie(UNLOCK_COOKIE_NAME, { ...options, maxAge: -1 });
        return { success: true };
      }),
  }),

  parent: router({
    status: protectedProcedure.query(async ({ ctx }) => {
      const settings = await db.getParentalSettings(ctx.user.id);
      return { hasPin: !!settings, unlocked: await isParentUnlocked(ctx.req, ctx.user.id) };
    }),

    setPin: protectedProcedure
      .input(z.object({ pin: pinSchema, currentPin: pinSchema.optional() }))
      .mutation(async ({ ctx, input }) => {
        checkRateLimit(`pin:${ctx.user.id}`, 5, 5 * 60 * 1000);
        const existing = await db.getParentalSettings(ctx.user.id);
        const pinHash = await hashPassword(input.pin);
        if (!existing) {
          await db.createParentalSettings({ id: randomUUID(), userId: ctx.user.id, password: pinHash });
        } else {
          if (!input.currentPin || !(await verifyPassword(input.currentPin, existing.password))) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Current PIN is incorrect" });
          }
          await db.updateParentalSettings(ctx.user.id, { password: pinHash });
          await db.logAudit(ctx.user.id, "pin_changed");
        }
        ctx.res.cookie(UNLOCK_COOKIE_NAME, await signUnlock(ctx.user.id), {
          ...getSessionCookieOptions(ctx.req),
          maxAge: UNLOCK_TTL_MS,
        });
        return { success: true };
      }),

    unlock: protectedProcedure
      .input(z.object({ pin: pinSchema }))
      .mutation(async ({ ctx, input }) => {
        checkRateLimit(`pin:${ctx.user.id}`, 5, 5 * 60 * 1000);
        const settings = await db.getParentalSettings(ctx.user.id);
        if (!settings) return { valid: false, needsSetup: true };
        const valid = await verifyPassword(input.pin, settings.password);
        if (valid) {
          ctx.res.cookie(UNLOCK_COOKIE_NAME, await signUnlock(ctx.user.id), {
            ...getSessionCookieOptions(ctx.req),
            maxAge: UNLOCK_TTL_MS,
          });
        }
        return { valid, needsSetup: false };
      }),

    lock: protectedProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(UNLOCK_COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
      return { success: true };
    }),

    // Never returns the PIN hash.
    getSettings: parentProcedure.query(async ({ ctx }) => {
      const settings = await db.getParentalSettings(ctx.user.id);
      return settings ? { dailyLimit: settings.dailyLimit, allowedHours: settings.allowedHours } : null;
    }),

    // Stored for the parent's reference; NOT yet enforced when a child chats.
    updateSettings: parentProcedure
      .input(
        z.object({
          dailyLimit: z.string().regex(/^\d{1,3}$/).optional(),
          allowedHours: z.string().max(200).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await db.updateParentalSettings(ctx.user.id, input);
        return { success: true };
      }),

    getActivityReport: parentProcedure.query(async ({ ctx }) => {
      const sessions = await db.getUserChatSessions(ctx.user.id);
      const messages = await db.getAllUserMessages(ctx.user.id);
      return {
        sessions,
        messages,
        flaggedMessages: messages.filter(m => m.flagged && m.flagged !== "safe"),
        totalSessions: sessions.length,
        totalMessages: messages.length,
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
