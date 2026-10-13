import { describe, expect, it } from "vitest";
import { ageGroupForGrade } from "@shared/jordan";
import { buildClassOverview, type StudentAggregate } from "@shared/classroom";
import { normalizeArabic, toArabicIndicDigits, toWesternDigits } from "@shared/arabic";

const now = new Date("2026-10-13T10:00:00Z");
const base = (over: Partial<StudentAggregate>): StudentAggregate => ({
  profileId: "s", childName: "S", ageGroup: "tweens", xp: 0, streakDays: 0, lastPlayDate: null, plays: {}, lastPlayedAt: null,
  flaggedMessages: 0, flaggedMoods: 0, lastMood: null, assignmentsDone: 0, ...over,
});

describe("grades and age groups", () => {
  it("maps Jordanian grades to the three age bands", () => {
    expect([1, 2, 3, 4, 7, 8, 12].map(ageGroupForGrade)).toEqual(["kids", "kids", "kids", "tweens", "tweens", "teens", "teens"]);
  });
});

describe("class overview", () => {
  it("computes accuracy, activity and per-game averages", () => {
    const out = buildClassOverview(
      [
        base({ profileId: "a", childName: "A", xp: 255, streakDays: 2, lastPlayDate: "2026-10-12", lastPlayedAt: new Date("2026-10-12T09:00:00Z"), plays: { math: { plays: 2, correct: 15, total: 20 }, quiz: { plays: 1, correct: 6, total: 8 } } }),
        base({ profileId: "b", childName: "B", plays: { math: { plays: 1, correct: 5, total: 10 } }, lastPlayedAt: new Date("2026-10-13T08:00:00Z"), lastPlayDate: "2026-10-13", streakDays: 1 }),
      ],
      1, "2026-10-13", now
    );
    expect(out.summary.studentCount).toBe(2);
    expect(out.summary.activeThisWeek).toBe(2);
    expect(out.summary.accuracyByGame.math).toBeCloseTo(20 / 30);
    expect(out.summary.accuracyByGame.quiz).toBeCloseTo(0.75);
    expect(out.summary.accuracyByGame.spelling).toBeUndefined();
    expect(out.students[0]).toMatchObject({ level: 3, streakDays: 2, totalPlays: 3 });
    expect(out.students[0].accuracy).toBeCloseTo(21 / 28);
    expect(out.summary.attentionCount).toBe(0);
  });

  it("flags inactive, low-accuracy and flagged students, but not low accuracy from a handful of answers", () => {
    const out = buildClassOverview(
      [
        base({ profileId: "never" }), // never played
        base({ profileId: "few", plays: { math: { plays: 1, correct: 1, total: 10 } }, lastPlayedAt: new Date("2026-10-12T00:00:00Z") }), // 10% but only 10 answers
        base({ profileId: "weak", plays: { math: { plays: 3, correct: 10, total: 30 } }, lastPlayedAt: new Date("2026-10-12T00:00:00Z") }),
        base({ profileId: "flag", flaggedMoods: 1, plays: { math: { plays: 3, correct: 25, total: 30 } }, lastPlayedAt: new Date("2026-10-12T00:00:00Z") }),
      ],
      0, "2026-10-13", now
    );
    const by = Object.fromEntries(out.students.map(s => [s.profileId, s.attention]));
    expect(by.never).toEqual(["inactive"]);
    expect(by.few).toEqual([]);
    expect(by.weak).toEqual(["low_accuracy"]);
    expect(by.flag).toEqual(["flagged"]);
    expect(out.summary.attentionCount).toBe(3);
  });

  it("shows a lapsed streak as zero", () => {
    const out = buildClassOverview([base({ streakDays: 5, lastPlayDate: "2026-10-01", lastPlayedAt: new Date("2026-10-01T00:00:00Z"), plays: { math: { plays: 1, correct: 1, total: 1 } } })], 0, "2026-10-13", now);
    expect(out.students[0].streakDays).toBe(0);
  });
});

describe("Arabic helpers", () => {
  it("normalises letter forms, diacritics and digits for matching", () => {
    expect(normalizeArabic("أُرِيدُ")).toBe("اريد");
    expect(normalizeArabic("مدرسة")).toBe("مدرسه");
    expect(normalizeArabic("٠٧٩١٢٣٤٥٦٧")).toBe("0791234567");
    expect(normalizeArabic("HELLO")).toBe("hello");
  });
  it("converts digits both ways", () => {
    expect(toArabicIndicDigits("12 + 35 = 47")).toBe("١٢ + ٣٥ = ٤٧");
    expect(toWesternDigits("١٢ + ٣٥")).toBe("12 + 35");
  });
});
