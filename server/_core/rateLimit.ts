import { TRPCError } from "@trpc/server";

/**
 * Minimal in-memory sliding-window limiter.
 * NOTE: state is per process. Behind more than one instance, replace with a
 * shared store (e.g. Redis) before relying on it.
 */
const hits = new Map<string, number[]>();

export function checkRateLimit(key: string, limit: number, windowMs: number, now = Date.now()) {
  const recent = (hits.get(key) ?? []).filter(t => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Too many requests. Please wait a moment and try again.",
    });
  }
  recent.push(now);
  hits.set(key, recent);
}

export function resetRateLimits() {
  hits.clear();
}

// Drop stale keys so the map cannot grow without bound.
setInterval(() => {
  const now = Date.now();
  hits.forEach((times, key) => {
    if (times.every(t => now - t > 60 * 60 * 1000)) hits.delete(key);
  });
}, 10 * 60 * 1000).unref();
