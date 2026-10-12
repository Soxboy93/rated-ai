import { COOKIE_NAME } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import * as bcrypt from "bcryptjs";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

export const UNLOCK_COOKIE_NAME = "parent_unlock";
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
export const UNLOCK_TTL_MS = 1000 * 60 * 15; // 15 minutes

/** A user as exposed to request handlers: never includes the password hash. */
export type SessionUser = Omit<User, "passwordHash">;

function secretKey() {
  if (ENV.cookieSecret.length < 32) {
    throw new Error("JWT_SECRET must be set to a random string of at least 32 characters");
  }
  return new TextEncoder().encode(ENV.cookieSecret);
}

export const hashPassword = (password: string) => bcrypt.hash(password, 12);
export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);

async function sign(payload: Record<string, unknown>, ttlMs: number) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(Math.floor((Date.now() + ttlMs) / 1000))
    .sign(secretKey());
}

async function verify(token: string | undefined, kind: "session" | "unlock") {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (payload.kind !== kind || typeof payload.sub !== "string") return null;
    return payload.sub;
  } catch {
    return null;
  }
}

export const signSession = (userId: string) => sign({ kind: "session", sub: userId }, SESSION_TTL_MS);
export const signUnlock = (userId: string) => sign({ kind: "unlock", sub: userId }, UNLOCK_TTL_MS);

function cookieValue(req: Request, name: string) {
  const header = req.headers.cookie;
  return header ? parseCookieHeader(header)[name] : undefined;
}

export function toSessionUser(user: User): SessionUser {
  const { passwordHash: _omit, ...rest } = user;
  return rest;
}

export async function authenticateRequest(req: Request): Promise<SessionUser | null> {
  const userId = await verify(cookieValue(req, COOKIE_NAME), "session");
  if (!userId) return null;
  const user = await db.getUser(userId);
  return user ? toSessionUser(user) : null;
}

/** True when the request carries a valid, unexpired parent-PIN unlock for this user. */
export async function isParentUnlocked(req: Request, userId: string) {
  return (await verify(cookieValue(req, UNLOCK_COOKIE_NAME), "unlock")) === userId;
}
