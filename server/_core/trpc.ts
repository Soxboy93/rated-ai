import { CONSENT_REQUIRED_ERR_MSG, NOT_ADMIN_ERR_MSG, PARENT_LOCKED_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { isParentUnlocked } from "./auth";
import * as db from "../db";
import { CONSENT_VERSION } from "@shared/consent";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

/** Requires a signed-in account that has recently unlocked parent mode with the PIN. */
export const parentProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!(await isParentUnlocked(ctx.req, ctx.user.id))) {
    throw new TRPCError({ code: "FORBIDDEN", message: PARENT_LOCKED_ERR_MSG });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

async function assertConsent(userId: string) {
  // Consent given for older wording does not count: the parent must agree to the current text.
  const consent = await db.getActiveConsent(userId);
  if (!consent || consent.version !== CONSENT_VERSION) {
    throw new TRPCError({ code: "FORBIDDEN", message: CONSENT_REQUIRED_ERR_MSG });
  }
}

/** Signed in AND the parent has granted (and not withdrawn) consent. Use for anything that handles a child's data. */
export const consentedProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  await assertConsent(ctx.user.id);
  return next({ ctx: { ...ctx, user: ctx.user } });
});

/** Parent PIN unlocked AND consent active: for managing child profiles. */
export const consentedParentProcedure = parentProcedure.use(async ({ ctx, next }) => {
  await assertConsent(ctx.user.id);
  return next({ ctx: { ...ctx, user: ctx.user } });
});
