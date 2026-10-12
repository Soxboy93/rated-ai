import { describe, expect, it } from "vitest";
import { makeRng } from "@shared/rng";
import { makeMathRound, makeSpellingRound, makeQuizRound, makeMemoryDeck, makePatternRound, memoryScore, misspell, quizBank, type AgeId, type Level } from "@shared/games";
import { BADGES, earnedBadgeIds, levelFromXp, levelProgress, nextStreak, resolvePlayDay, xpForPlay, MAX_QUESTIONS_PER_PLAY, type ProgressStats } from "@shared/gamification";

const AGES: AgeId[] = ["kids", "tweens", "teens"];
const LEVELS: Level[] = [1, 2, 3];

function assertWellFormed(qs: { options: string[]; answer: number; prompt: string }[]) {
  for (const q of qs) {
    expect(q.options).toHaveLength(4);
    expect(new Set(q.options).size).toBe(4); // no duplicate options
    expect(q.answer).toBeGreaterThanOrEqual(0);
    expect(q.answer).toBeLessThan(4);
    expect(q.prompt.length).toBeGreaterThan(0);
  }
}

describe("question generators", () => {
  it("always produce 4 distinct options with a valid answer index (many seeds)", () => {
    for (let seed = 1; seed <= 150; seed++) {
      for (const age of AGES) for (const level of LEVELS) {
        const rng = makeRng(seed * 7 + level);
        assertWellFormed(makeMathRound(age, level, rng, 10));
        assertWellFormed(makeSpellingRound(age, level, rng, 5));
        assertWellFormed(makePatternRound(age, level, rng, 6));
      }
      assertWellFormed(makeQuizRound("kids", makeRng(seed), 8));
    }
  });

  it("is reproducible for the same seed", () => {
    expect(makeMathRound("tweens", 2, makeRng(42))).toEqual(makeMathRound("tweens", 2, makeRng(42)));
  });

  it("math answers are arithmetically correct (kids and tweens)", () => {
    for (let seed = 1; seed <= 200; seed++) {
      for (const q of makeMathRound("kids", 3, makeRng(seed), 6)) {
        const m = q.prompt.match(/^(\d+) ([+−]) (\d+) = \?$/)!;
        const [a, b] = [Number(m[1]), Number(m[3])];
        expect(Number(q.options[q.answer])).toBe(m[2] === "+" ? a + b : a - b);
        expect(Number(q.options[q.answer])).toBeGreaterThanOrEqual(0);
      }
      for (const q of makeMathRound("tweens", 2, makeRng(seed), 6)) {
        const times = q.prompt.match(/^(\d+) × (\d+) = \?$/);
        const div = q.prompt.match(/^(\d+) ÷ (\d+) = \?$/);
        const right = Number(q.options[q.answer]);
        if (times) expect(right).toBe(Number(times[1]) * Number(times[2]));
        else { expect(div).toBeTruthy(); expect(right * Number(div![2])).toBe(Number(div![1])); }
      }
    }
  });

  it("algebra and percentage answers are correct for teens", () => {
    for (let seed = 1; seed <= 200; seed++) {
      for (const q of makeMathRound("teens", 3, makeRng(seed), 4)) {
        const m = q.prompt.match(/(\d+)x \+ (\d+) = (\d+)/)!;
        const x = Number(q.options[q.answer]);
        expect(Number(m[1]) * x + Number(m[2])).toBe(Number(m[3]));
      }
      for (const q of makeMathRound("teens", 1, makeRng(seed), 4)) {
        const m = q.prompt.match(/What is (\d+)% of (\d+)\?/)!;
        expect(Number(q.options[q.answer])).toBe((Number(m[1]) * Number(m[2])) / 100);
        expect(Number.isInteger(Number(q.options[q.answer]))).toBe(true);
      }
    }
  });

  it("number patterns continue correctly", () => {
    for (let seed = 1; seed <= 200; seed++) {
      for (const q of makePatternRound("tweens", 1, makeRng(seed), 3)) {
        const nums = q.prompt.replace(", ?", "").split(", ").map(Number);
        const step = nums[1] - nums[0];
        expect(Number(q.options[q.answer])).toBe(nums[nums.length - 1] + step);
      }
      for (const q of makePatternRound("teens", 3, makeRng(seed), 3)) {
        const nums = q.prompt.replace(", ?", "").split(", ").map(Number);
        expect(Number(q.options[q.answer])).toBe(nums[nums.length - 1] + nums[nums.length - 2]);
      }
    }
  });

  it("spelling: the correct option is the real word and wrong ones are not", () => {
    for (let seed = 1; seed <= 100; seed++) {
      for (const q of makeSpellingRound("teens", 3, makeRng(seed), 5)) {
        expect(q.options[q.answer]).toBe(q.say);
        q.options.forEach((o, i) => { if (i !== q.answer) expect(o).not.toBe(q.say); });
      }
    }
    expect(misspell("cat", makeRng(1))).not.toBe("cat");
  });

  it("quiz bank: each right answer is not among its wrong answers and every question is unique", () => {
    for (const age of AGES) {
      const bank = quizBank(age);
      expect(new Set(bank.map(b => b.q)).size).toBe(bank.length);
      for (const b of bank) { expect(b.wrong).not.toContain(b.a); expect(new Set([b.a, ...b.wrong]).size).toBe(4); }
      expect(makeQuizRound(age, makeRng(3), 8)).toHaveLength(8);
    }
  });

  it("memory decks contain exact pairs and score by efficiency", () => {
    for (const age of AGES) for (const level of LEVELS) {
      const deck = makeMemoryDeck(age, level, makeRng(5));
      const counts = new Map<number, number>();
      deck.forEach(c => counts.set(c.pairId, (counts.get(c.pairId) ?? 0) + 1));
      expect(Array.from(counts.values()).every(n => n === 2)).toBe(true);
      expect(new Set(deck.map(c => c.id)).size).toBe(deck.length);
    }
    expect(memoryScore(6, 9)).toEqual({ correct: 6, total: 6 });
    const slow = memoryScore(6, 30);
    expect(slow.correct).toBeGreaterThanOrEqual(1);
    expect(slow.correct).toBeLessThan(6);
  });
});

describe("gamification", () => {
  it("awards XP for correct answers plus a perfect bonus, capped per play", () => {
    expect(xpForPlay(0, 10)).toBe(5);
    expect(xpForPlay(7, 10)).toBe(75);
    expect(xpForPlay(10, 10)).toBe(125);
    expect(xpForPlay(99, 10)).toBe(125); // cannot exceed total
    expect(xpForPlay(MAX_QUESTIONS_PER_PLAY, MAX_QUESTIONS_PER_PLAY)).toBeLessThanOrEqual(MAX_QUESTIONS_PER_PLAY * 10 + 25);
  });

  it("levels rise on a square-root curve", () => {
    expect([0, 39, 40, 159, 160, 640].map(levelFromXp)).toEqual([1, 1, 2, 2, 3, 5]);
    const p = levelProgress(100);
    expect(p.level).toBe(2);
    expect(p.fraction).toBeGreaterThan(0);
    expect(p.fraction).toBeLessThan(1);
  });

  it("streaks continue on consecutive days, hold on the same day and reset after a gap", () => {
    expect(nextStreak(null, 0, "2026-10-12")).toBe(1);
    expect(nextStreak("2026-10-12", 3, "2026-10-12")).toBe(3);
    expect(nextStreak("2026-10-11", 3, "2026-10-12")).toBe(4);
    expect(nextStreak("2026-10-09", 5, "2026-10-12")).toBe(1);
    expect(nextStreak("2026-12-31", 2, "2027-01-01")).toBe(3); // across a year boundary
  });

  it("only trusts a client day within one day of the server's UTC day", () => {
    const now = new Date("2026-10-12T23:30:00Z");
    expect(resolvePlayDay("2026-10-13", now)).toBe("2026-10-13"); // a timezone ahead of UTC
    expect(resolvePlayDay("2026-10-11", now)).toBe("2026-10-11");
    expect(resolvePlayDay("2030-01-01", now)).toBe("2026-10-12");
    expect(resolvePlayDay("nonsense", now)).toBe("2026-10-12");
    expect(resolvePlayDay(undefined, now)).toBe("2026-10-12");
  });

  it("badge rules fire exactly when their condition is met", () => {
    const base: ProgressStats = { xp: 0, streakDays: 0, longestStreak: 0, totalPlays: 0, perfectPlays: 0, playsByGame: {}, moodCheckins: 0 };
    expect(earnedBadgeIds(base)).toEqual([]);
    expect(earnedBadgeIds({ ...base, totalPlays: 1, perfectPlays: 1 })).toEqual(["first_play", "perfect_round"]);
    expect(earnedBadgeIds({ ...base, longestStreak: 7 })).toEqual(expect.arrayContaining(["streak_3", "streak_7"]));
    expect(earnedBadgeIds({ ...base, totalPlays: 5, playsByGame: { math: 1, spelling: 1, quiz: 1, memory: 1, patterns: 1 } })).toContain("explorer");
    expect(earnedBadgeIds({ ...base, playsByGame: { math: 4 } })).not.toContain("math_5");
    expect(earnedBadgeIds({ ...base, xp: 640 })).toContain("level_5");
    expect(new Set(BADGES.map(b => b.id)).size).toBe(BADGES.length);
  });
});
