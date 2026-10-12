import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { authenticateRequest, type SessionUser } from "./auth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: SessionUser | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: SessionUser | null = null;
  try {
    user = await authenticateRequest(opts.req);
  } catch (error) {
    console.warn("[Auth] Could not authenticate request:", String(error));
  }
  return { req: opts.req, res: opts.res, user };
}
