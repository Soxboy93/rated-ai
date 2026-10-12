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
import { CONSENT_POINTS, CONSENT_STATEMENT, CONSENT_TITLE, CONSENT_VERSION } from "@shared/consent";
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
import { AGE_GROUP_IDS, CHARACTER_IDS, buildSystemPrompt } from "./prompts";
import { SAFE_FALLBACK_REPLY, screenText, screenWithProvider } from "./safety";

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

const MAX_PROFILES = 6;
const consentTextHash = () =>
  createHash("sha256")
    .update(JSON.stringify({ v: CONSENT_VERSION, t: CONSENT_TITLE, p: CONSENT_POINTS, s: CONSENT_STATEMENT }))
    .digest("hex");

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
  const [row, badges, breakdown, recent, moods] = await Promise.all([
    db.getChildProgress(profileId),
    db.listBadges(profileId),
    db.getGameBreakdown(profileId),
    db.getRecentPlays(profileId, 8),
    db.listMoodCheckins(profileId, 1),
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
  };
}

/** Reject disallowed child input to the creative tools before it reaches the model. */
async function assertPromptAllowed(text: string) {
  const verdict = await screenWithProvider(text);
  if (verdict.level !== "safe") {
    throw new TRPCError({ code: "BAD_REQUEST", message: verdict.reply ?? SAFE_FALLBACK_REPLY });
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
    console.error("[LLM] request failed:", error);
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: AI_UNAVAILABLE });
  }
}

const textOf = (response: Awaited<ReturnType<typeof invokeLLM>>) => {
  const content = response.choices[0]?.message.content;
  return typeof content === "string" ? content : "";
};

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

        const verdict = await screenWithProvider(input.message);
        await db.createChatMessage({
          id: randomUUID(),
          sessionId: session.id,
          role: "user",
          content: input.message,
          flagged: verdict.level,
        });

        // Flagged input never reaches the model; the child gets a safe canned reply.
        if (verdict.level !== "safe") {
          const reply = verdict.reply ?? SAFE_FALLBACK_REPLY;
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
          messages: [
            { role: "system", content: buildSystemPrompt(session) },
            ...history.map(m => ({ role: m.role, content: m.content })),
          ],
        });

        let assistantMessage = textOf(response) || "I'm sorry, I couldn't understand that.";
        let outputFlag: "safe" | "blocked" = "safe";
        if (screenText(assistantMessage).level === "blocked") {
          assistantMessage = SAFE_FALLBACK_REPLY;
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
      .input(z.object({ prompt: z.string().trim().min(1).max(500) }))
      .mutation(async ({ ctx, input }) => {
        checkRateLimit(`creative:${ctx.user.id}`, 10, 60 * 1000);
        await assertPromptAllowed(input.prompt);
        const response = await llm({
          messages: [
            {
              role: "system",
              content:
                "You are a creative children's story writer. Write engaging, age-appropriate stories that are fun, educational, and inspire imagination. Never include violence, scary or adult content. Keep stories between 200-400 words.",
            },
            { role: "user", content: `Write a creative children's story about: ${input.prompt}` },
          ],
        });
        let content = textOf(response) || "Once upon a time...";
        if (screenText(content).level === "blocked") content = SAFE_FALLBACK_REPLY;
        return { content };
      }),

    generateIllustration: consentedProcedure
      .input(z.object({ prompt: z.string().trim().min(1).max(500) }))
      .mutation(async ({ ctx, input }) => {
        checkRateLimit(`image:${ctx.user.id}`, 5, 60 * 1000);
        await assertPromptAllowed(input.prompt);
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
        })
      )
      .mutation(async ({ ctx, input }) => {
        checkRateLimit(`homework:${ctx.user.id}`, 10, 60 * 1000);
        const response = await llm({
          messages: [
            {
              role: "system",
              content:
                "You are a helpful homework tutor for students. Analyze the homework problem in the image and provide a clear, step-by-step solution. Break down complex problems into simple steps. Be encouraging and educational. If the image is not a homework problem, say so in the question field and leave steps empty. Format your response as JSON with these fields: question (the problem statement), steps (array of solution steps), answer (final answer), explanation (why this solution works), subject (detected subject area), difficulty (easy/medium/hard).",
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

    generateReport: protectedProcedure.mutation(async ({ ctx }) => {
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
        messages: [
          {
            role: "system",
            content:
              "You summarise a child's learning conversations for a parent. Grades are rough estimates from topics discussed, not assessments. Use A+ to C- or N/A where there is no evidence for a subject.",
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

    generate: protectedProcedure.mutation(async ({ ctx }) => {
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
        messages: [
          {
            role: "system",
            content:
              "You are an educational progress analyst writing a short, positive, factual summary for a parent from their child's messages. Only mention things evidenced in the messages.",
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

  challenges: router({
    getMyChallenges: protectedProcedure.query(({ ctx }) => db.getPeerChallenges(ctx.user.id)),

    create: protectedProcedure
      .input(
        z.object({
          challengeType: z.string().trim().max(50),
          subject: z.string().trim().max(50),
          difficulty: z.string().trim().max(20),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const challenge = {
          id: randomUUID(),
          creatorId: ctx.user.id,
          challengerId: null,
          challengeType: input.challengeType,
          subject: input.subject,
          difficulty: input.difficulty,
          creatorScore: 0,
          challengerScore: 0,
          status: "pending",
          winnerId: null,
        };
        await db.createPeerChallenge(challenge);
        return challenge;
      }),
  }),

  teacher: router({
    getClassrooms: protectedProcedure.query(({ ctx }) => db.getClassroomsByTeacher(ctx.user.id)),

    createClassroom: protectedProcedure
      .input(
        z.object({
          name: z.string().trim().min(1).max(200),
          gradeLevel: z.string().trim().max(50).optional(),
          subject: z.string().trim().max(100).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const classroom = {
          id: randomUUID(),
          teacherId: ctx.user.id,
          name: input.name,
          gradeLevel: input.gradeLevel || null,
          subject: input.subject || null,
          studentCount: 0,
        };
        await db.createClassroom(classroom);
        return classroom;
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

  // Not implemented yet: no practice questions or scoring exist. Kept so the page loads.
  collegePrep: router({
    getProgress: protectedProcedure.query(() => []),
    startPractice: protectedProcedure
      .input(z.object({ testType: z.string().max(20) }))
      .mutation(({ input }) => ({ success: true, testType: input.testType })),
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
        })
      )
      .mutation(async ({ ctx, input }) => {
        await requireOwnedProfile(input.profileId, ctx.user.id);
        checkRateLimit(`mood:${ctx.user.id}`, 10, 60 * 1000);
        if ((await db.countRecentMoodCheckins(input.profileId, new Date(Date.now() - 24 * 60 * 60 * 1000))) >= 10) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "You've checked in a lot today. Come back tomorrow!" });
        }
        const verdict = input.note ? screenText(input.note) : { level: "safe" as const };
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
      const active = await db.getActiveConsent(ctx.user.id);
      return {
        version: CONSENT_VERSION,
        granted: !!active && active.version === CONSENT_VERSION,
        grantedVersion: active?.version ?? null,
        grantedAt: active?.grantedAt ?? null,
        contactEmail: ENV.privacyContactEmail || null,
      };
    }),

    grant: protectedProcedure
      .input(z.object({ version: z.literal(CONSENT_VERSION), confirmParent: z.literal(true) }))
      .mutation(async ({ ctx }) => {
        const active = await db.getActiveConsent(ctx.user.id);
        if (!active || active.version !== CONSENT_VERSION) {
          if (active) await db.revokeConsent(ctx.user.id); // supersede consent given for older wording
          await db.createConsent({
            id: randomUUID(),
            userId: ctx.user.id,
            version: CONSENT_VERSION,
            textSha256: consentTextHash(),
          });
          await db.logAudit(ctx.user.id, "consent_granted", CONSENT_VERSION);
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
      }));
    }),

    create: consentedParentProcedure
      .input(
        z.object({
          childName: childNameSchema,
          ageGroup: z.enum(AGE_GROUP_IDS),
          selectedCharacter: z.enum(CHARACTER_IDS).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        assertNameAllowed(input.childName);
        if ((await db.listProfiles(ctx.user.id)).length >= MAX_PROFILES) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `You can add up to ${MAX_PROFILES} children.` });
        }
        const id = randomUUID();
        await db.createProfile({
          id,
          userId: ctx.user.id,
          childName: input.childName,
          ageGroup: input.ageGroup,
          selectedCharacter: input.selectedCharacter,
        });
        await db.logAudit(ctx.user.id, "profile_created", input.childName);
        return { id };
      }),

    update: consentedParentProcedure
      .input(
        z.object({
          profileId: z.string().max(64),
          childName: childNameSchema.optional(),
          ageGroup: z.enum(AGE_GROUP_IDS).optional(),
          selectedCharacter: z.enum(CHARACTER_IDS).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const profile = await requireOwnedProfile(input.profileId, ctx.user.id);
        if (input.childName) assertNameAllowed(input.childName);
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
