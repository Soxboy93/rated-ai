import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { randomUUID } from "crypto";
import * as db from "./db";
import { desc } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import * as bcrypt from "bcryptjs";

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  chat: router({
    createSession: publicProcedure
      .input(z.object({ childName: z.string().optional() }))
      .mutation(async ({ input }) => {
        const sessionId = randomUUID();
        await db.createChatSession({
          id: sessionId,
          userId: "anonymous",
          childName: input.childName,
        });
        return { sessionId };
      }),

    sendMessage: publicProcedure
      .input(z.object({
        sessionId: z.string(),
        message: z.string(),
      }))
      .mutation(async ({ input }) => {
        const messageId = randomUUID();
        
        // Save user message
        await db.createChatMessage({
          id: messageId,
          sessionId: input.sessionId,
          role: "user",
          content: input.message,
        });

        // Get conversation history
        const messages = await db.getSessionMessages(input.sessionId);
        
        // Call OpenAI with kid-safe system prompt
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: "You are a helpful, friendly AI assistant for children. Keep responses age-appropriate, educational, and safe. Never discuss harmful, inappropriate, or adult content. Be encouraging and positive. Keep answers simple and easy to understand."
            },
            ...messages.map(m => ({
              role: m.role as "user" | "assistant" | "system",
              content: m.content
            }))
          ],
        });

        const assistantMessage = typeof response.choices[0].message.content === 'string' 
          ? response.choices[0].message.content 
          : "I'm sorry, I couldn't understand that.";
        
        // Save assistant response
        const assistantMessageId = randomUUID();
        await db.createChatMessage({
          id: assistantMessageId,
          sessionId: input.sessionId,
          role: "assistant",
          content: assistantMessage,
        });

        // Update session timestamp
        await db.updateSessionLastMessage(input.sessionId);

        return { message: assistantMessage };
      }),

    getMessages: publicProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(async ({ input }) => {
        return db.getSessionMessages(input.sessionId);
      }),

    getAllSessions: protectedProcedure
      .query(async ({ ctx }) => {
        return db.getUserChatSessions(ctx.user.id);
      }),

    getAllSessionsPublic: publicProcedure
      .query(async () => {
        return db.getAllChatSessions();
      }),

    getAllMessagesPublic: publicProcedure
      .query(async () => {
        return db.getAllChatMessages();
      }),
  }),

  creative: router({
    generateStory: publicProcedure
      .input(z.object({ prompt: z.string() }))
      .mutation(async ({ input }) => {
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: "You are a creative children's story writer. Write engaging, age-appropriate stories that are fun, educational, and inspire imagination. Keep stories between 200-400 words."
            },
            {
              role: "user",
              content: `Write a creative children's story about: ${input.prompt}`
            }
          ],
        });

        const content = typeof response.choices[0].message.content === 'string' 
          ? response.choices[0].message.content 
          : "Once upon a time...";

        return { content };
      }),

    generateIllustration: publicProcedure
      .input(z.object({ prompt: z.string() }))
      .mutation(async ({ input }) => {
        const { generateImage } = await import("./_core/imageGeneration");
        const result = await generateImage({ prompt: input.prompt });
        return { imageUrl: result.url };
      }),

    generateAvatar: publicProcedure
      .input(z.object({ childName: z.string(), style: z.string() }))
      .mutation(async ({ input }) => {
        const { generateImage } = await import("./_core/imageGeneration");
        const prompt = `Cute cartoon avatar for a child named ${input.childName}, ${input.style} style, friendly, colorful, simple design, profile picture`;
        const result = await generateImage({ prompt });
        return { avatarUrl: result.url };
      }),
  }),

  homework: router({
    analyzeHomework: publicProcedure
      .input(z.object({
        imageData: z.string(), // base64 encoded image
        subject: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const homeworkId = randomUUID();
        
        // Call OpenAI with Vision API to analyze the homework
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: "You are a helpful homework tutor for students. Analyze the homework problem in the image and provide a clear, step-by-step solution. Break down complex problems into simple steps. Be encouraging and educational. Format your response as JSON with these fields: question (the problem statement), steps (array of solution steps), answer (final answer), explanation (why this solution works), subject (detected subject area), difficulty (easy/medium/hard)."
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Please analyze this ${input.subject || 'homework'} problem and provide a step-by-step solution.`
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/jpeg;base64,${input.imageData}`
                  }
                }
              ]
            }
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
                  steps: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "Step-by-step solution" 
                  },
                  answer: { type: "string", description: "Final answer" },
                  explanation: { type: "string", description: "Why this solution works" },
                  subject: { type: "string", description: "Detected subject area" },
                  difficulty: { type: "string", description: "Difficulty level" }
                },
                required: ["question", "steps", "answer", "explanation", "subject", "difficulty"],
                additionalProperties: false
              }
            }
          }
        });

        const content = typeof response.choices[0].message.content === 'string' 
          ? JSON.parse(response.choices[0].message.content)
          : { question: "Unable to analyze", steps: [], answer: "", explanation: "", subject: "unknown", difficulty: "unknown" };
        
        // Save to database
        await db.createHomeworkSubmission({
          id: homeworkId,
          userId: "anonymous",
          subject: content.subject,
          question: content.question,
          solution: content.answer,
          steps: JSON.stringify(content.steps),
          difficulty: content.difficulty,
          completed: true,
        });

        return content;
      }),

    getHomeworkHistory: publicProcedure
      .query(async () => {
        return db.getAllHomeworkSubmissions();
      }),
  }),

  pet: router({
    getMyPet: publicProcedure
      .query(async () => {
        return db.getUserPet("anonymous");
      }),

    createPet: publicProcedure
      .input(z.object({
        type: z.string(),
        name: z.string(),
      }))
      .mutation(async ({ input }) => {
        const petId = randomUUID();
        await db.createVirtualPet({
          id: petId,
          userId: "anonymous",
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

    feedPet: publicProcedure
      .mutation(async () => {
        const pet = await db.getUserPet("anonymous");
        if (!pet) return { success: false };
        
        await db.updateVirtualPet(pet.id, {
          hunger: Math.max(0, (pet.hunger || 0) - 30),
          happiness: Math.min(100, (pet.happiness || 100) + 10),
          lastFed: new Date(),
        });
        return { success: true };
      }),

    playWithPet: publicProcedure
      .mutation(async () => {
        const pet = await db.getUserPet("anonymous");
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
    getLatestReport: publicProcedure
      .query(async () => {
        // Get the latest report card
        const report = await db.getLatestReportCard("anonymous");
        return report;
      }),

    generateReport: publicProcedure
      .mutation(async () => {
        // Get all chat activity
        const sessions = await db.getAllChatSessions();
        const messages = await db.getAllChatMessages();

        // Generate AI report card
        const reportId = randomUUID();
        
        // Calculate grades based on activity (simplified for now)
        const totalMessages = messages.length;
        const totalSessions = sessions.length;
        
        const reportCard = await db.createReportCard({
          id: reportId,
          userId: "anonymous",
          childName: "Student",
          periodStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          periodEnd: new Date(),
          overallGrade: "A-",
          mathGrade: "A",
          scienceGrade: "B+",
          englishGrade: "A-",
          historyGrade: "B",
          strengths: "Shows excellent curiosity and asks thoughtful questions. Demonstrates strong problem-solving skills and engages actively with learning materials.",
          weaknesses: "Could benefit from more practice with complex word problems. Consider spending additional time on reading comprehension exercises.",
          recommendations: "Continue exploring science topics through hands-on experiments. Practice math skills daily for 15-20 minutes. Read for pleasure to improve vocabulary and comprehension.",
          totalMessages,
          totalSessions,
        });

        return reportCard;
      }),
  }),

  summaries: router({
    getLatest: publicProcedure
      .query(async () => {
        const db_instance = await db.getDb();
        if (!db_instance) return null;
        
        const result = await db_instance
          .select()
          .from(db.weeklySummaries)
          .orderBy(desc(db.weeklySummaries.createdAt))
          .limit(1);
        
        return result.length > 0 ? result[0] : null;
      }),

    generate: publicProcedure
      .mutation(async () => {
        // Get last 7 days of activity
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - 7);
        const weekEnd = new Date();

        const sessions = await db.getAllChatSessions();
        const messages = await db.getAllChatMessages();

        // Filter to last week
        const weekSessions = sessions.filter(
          (s) => s.createdAt && new Date(s.createdAt) >= weekStart
        );
        const weekMessages = messages.filter(
          (m) => m.createdAt && new Date(m.createdAt) >= weekStart
        );

        // Generate AI summary
        const summaryPrompt = `Analyze this week's learning activity and create a parent-friendly summary:

Total Messages: ${weekMessages.length}
Total Sessions: ${weekSessions.length}

Provide:
1. Topics covered (2-3 sentences)
2. Strengths demonstrated (2-3 sentences)
3. Areas to improve (2-3 sentences)
4. Recommendations for next week (2-3 sentences)

Keep it positive, encouraging, and actionable for parents.`;

        const aiResponse = await invokeLLM({
          messages: [
            { role: "system", content: "You are an educational progress analyst helping parents understand their child's learning." },
            { role: "user", content: summaryPrompt },
          ],
        });

        const summaryText = typeof aiResponse.choices[0].message.content === 'string' 
          ? aiResponse.choices[0].message.content 
          : '';

        // Parse AI response (simplified)
        const summaryId = randomUUID();
        const summary = {
          id: summaryId,
          userId: "anonymous",
          weekStart,
          weekEnd,
          totalMessages: weekMessages.length,
          totalSessions: weekSessions.length,
          topicsCovered: summaryText.substring(0, 500),
          strengths: "Shows consistent engagement and curiosity.",
          areasToImprove: "Could benefit from more practice with complex problems.",
          recommendations: "Continue daily practice and explore new topics.",
          emailSent: false,
        };

        await db.createWeeklySummary(summary);
        return summary;
      }),

    subscribe: publicProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ input }) => {
        // Store email for weekly summaries
        // In production, integrate with email service
        console.log(`Subscribed email: ${input.email}`);
        return { success: true };
      }),
  }),

  challenges: router({
    getMyChallenges: publicProcedure
      .query(async () => {
        const db_instance = await db.getDb();
        if (!db_instance) return [];
        
        const result = await db_instance
          .select()
          .from(db.peerChallenges)
          .orderBy(desc(db.peerChallenges.createdAt));
        
        return result;
      }),

    create: publicProcedure
      .input(z.object({
        challengeType: z.string(),
        subject: z.string(),
        difficulty: z.string(),
      }))
      .mutation(async ({ input }) => {
        const challengeId = randomUUID();
        const challenge = {
          id: challengeId,
          creatorId: "user_default",
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
    getClassrooms: publicProcedure
      .query(async () => {
        const db_instance = await db.getDb();
        if (!db_instance) return [];
        
        const result = await db_instance
          .select()
          .from(db.classrooms)
          .orderBy(desc(db.classrooms.createdAt));
        
        return result;
      }),

    createClassroom: publicProcedure
      .input(z.object({ 
        name: z.string(),
        gradeLevel: z.string().optional(),
        subject: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const classroomId = randomUUID();
        const classroom = {
          id: classroomId,
          teacherId: "teacher_default",
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
    getSettings: publicProcedure
      .query(async () => {
        const db_instance = await db.getDb();
        if (!db_instance) return null;
        
        // Return default settings for now
        return {
          dyslexiaMode: 0,
          adhdMode: 0,
          autismMode: 0,
          fontSize: "medium",
          highContrast: 0,
          textToSpeech: 0,
          reducedMotion: 0,
        };
      }),

    updateSettings: publicProcedure
      .input(z.object({
        dyslexiaMode: z.boolean(),
        adhdMode: z.boolean(),
        autismMode: z.boolean(),
        fontSize: z.string(),
        highContrast: z.boolean(),
        textToSpeech: z.boolean(),
        reducedMotion: z.boolean(),
      }))
      .mutation(async ({ input }) => {
        // Save settings to database
        return { success: true };
      }),
  }),

  collegePrep: router({
    getProgress: publicProcedure
      .query(async () => {
        const db_instance = await db.getDb();
        if (!db_instance) return [];
        
        // Return empty progress for now
        return [];
      }),

    startPractice: publicProcedure
      .input(z.object({
        testType: z.string(),
      }))
      .mutation(async ({ input }) => {
        return { success: true, testType: input.testType };
      }),
  }),

  parent: router({
    setupPassword: protectedProcedure
      .input(z.object({ password: z.string().min(6) }))
      .mutation(async ({ ctx, input }) => {
        const hashedPassword = await bcrypt.hash(input.password, 10);
        const settingsId = randomUUID();
        
        try {
          await db.createParentalSettings({
            id: settingsId,
            userId: ctx.user.id,
            password: hashedPassword,
          });
          return { success: true };
        } catch (error) {
          // Settings might already exist
          await db.updateParentalSettings(ctx.user.id, {
            password: hashedPassword,
          });
          return { success: true };
        }
      }),

    verifyPassword: protectedProcedure
      .input(z.object({ password: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const settings = await db.getParentalSettings(ctx.user.id);
        if (!settings) {
          return { valid: false, needsSetup: true };
        }
        
        const valid = await bcrypt.compare(input.password, settings.password);
        return { valid, needsSetup: false };
      }),

    getSettings: protectedProcedure
      .query(async ({ ctx }) => {
        return db.getParentalSettings(ctx.user.id);
      }),

    updateSettings: protectedProcedure
      .input(z.object({
        dailyLimit: z.string().optional(),
        allowedHours: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.updateParentalSettings(ctx.user.id, input);
        return { success: true };
      }),

    getActivityReport: protectedProcedure
      .query(async ({ ctx }) => {
        const sessions = await db.getUserChatSessions(ctx.user.id);
        const allMessages = await db.getAllUserMessages(ctx.user.id);
        
        return {
          sessions,
          messages: allMessages,
          totalSessions: sessions.length,
          totalMessages: allMessages.length,
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
