import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, resetRateLimits } from "./_core/rateLimit";

describe("checkRateLimit", () => {
  beforeEach(resetRateLimits);

  it("allows up to the limit then rejects", () => {
    for (let i = 0; i < 3; i++) checkRateLimit("k", 3, 1000, 0);
    expect(() => checkRateLimit("k", 3, 1000, 10)).toThrow(/Too many requests/);
  });

  it("recovers after the window and isolates keys", () => {
    for (let i = 0; i < 3; i++) checkRateLimit("k", 3, 1000, 0);
    expect(() => checkRateLimit("other", 3, 1000, 10)).not.toThrow();
    expect(() => checkRateLimit("k", 3, 1000, 1500)).not.toThrow();
  });
});
