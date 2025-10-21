import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { randomUUID } from "crypto";
import * as db from "./db";
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
