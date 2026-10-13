import { describe, expect, it } from "vitest";
import { bucketWeeks, buildSchoolOverview } from "@shared/schoolReport";

describe("weekly buckets", () => {
  it("puts each day in the right 7-day window ending today, oldest first, and ignores anything outside 8 weeks", () => {
    const w = bucketWeeks([{ day: "2026-10-13", plays: 5 }, { day: "2026-10-07", plays: 2 }, { day: "2026-10-06", plays: 3 }, { day: "2026-08-19", plays: 9 }, { day: "2026-08-18", plays: 100 }, { day: "2026-10-14", plays: 50 }], "2026-10-13");
    expect(w).toHaveLength(8);
    expect(w[7].plays).toBe(7); // 13th back to the 7th
    expect(w[6].plays).toBe(3); // 6th falls into the week before
    expect(w[0].plays).toBe(9); // the oldest day still inside the window
    expect(w.reduce((n, x) => n + x.plays, 0)).toBe(19); // 18 Aug (too old) and tomorrow are left out
  });
});

describe("school overview", () => {
  const base = {
    now: new Date("2026-10-13T10:00:00Z"), today: "2026-10-13", days: [],
    classes: [
      { id: "a", name: "4A", grade: 4, students: 10, activeThisWeek: 8, plays: 40, correct: 300, asked: 400, needAttention: 2 },
      { id: "b", name: "5B", grade: 5, students: 0, activeThisWeek: 0, plays: 0, correct: 0, asked: 0, needAttention: 0 },
    ],
    shares: [{ classId: "a" }, { classId: "a" }],
    quizRows: [{ classId: "a", correct: 2, total: 3 }, { classId: "a", correct: 3, total: 3 }],
    safety: { flaggedLast30Days: 3, open: 1, reviewed: 2 },
  };

  it("adds up the classes without inventing numbers", () => {
    const o = buildSchoolOverview(base);
    expect(o.totals).toMatchObject({ students: 10, classes: 2, activeThisWeek: 8, activePercent: 80, plays: 40, lessonsShared: 2, quizAveragePercent: 83, needAttention: 2 });
    expect(o.totals.quizTakenPercent).toBe(10); // 2 results of 20 expected (2 lessons x 10 students)
    expect(o.classes[0]).toMatchObject({ accuracyPercent: 75, lessonsShared: 2, quizAveragePercent: 83 });
  });

  it("shows dashes (null) rather than zeros where nothing has happened", () => {
    const o = buildSchoolOverview(base);
    expect(o.classes[1]).toMatchObject({ accuracyPercent: null, quizAveragePercent: null, lessonsShared: 0 });
    const empty = buildSchoolOverview({ ...base, classes: [], shares: [], quizRows: [] });
    expect(empty.totals).toMatchObject({ students: 0, activePercent: null, quizAveragePercent: null, quizTakenPercent: null });
  });
});
