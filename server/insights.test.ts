import { describe, expect, it } from "vitest";
import { analyzeResults, insightFacts } from "@shared/insights";
import { normalizeInsights } from "./lessonPrompts";

const quiz = [
  { q: "1/4 + 2/4 = ?", options: ["3/8", "3/4", "2/4", "1/2"], answer: 1, explanation: "" },
  { q: "2/5 + 2/5 = ?", options: ["4/10", "4/5", "2/5", "1/5"], answer: 1, explanation: "" },
];
const students = ["a", "b", "c", "d", "e"].map(id => ({ id, childName: `Name-${id}` }));

describe("class insights", () => {
  const results = [
    { profileId: "a", answers: [1, 1] }, { profileId: "b", answers: [0, 0] }, { profileId: "c", answers: [0, 1] }, { profileId: "d", answers: [0, 0] },
  ];
  const a = analyzeResults(quiz, results, students);

  it("finds the hard question and the wrong answer most students picked", () => {
    expect(a.questions[0]).toMatchObject({ percentCorrect: 25, picks: [3, 1, 0, 0], topWrong: { option: 0, count: 3 } });
    expect(a.hard.map(q => q.index)).toEqual([0, 1]);
    expect(a.averagePercent).toBe(38);
  });

  it("groups students without using any AI", () => {
    expect(a.needsSupport.map(s => s.id)).toEqual(["b", "d"]);
    expect(a.readyForMore.map(s => s.id)).toEqual(["a"]);
    expect(a.notYetTaken.map(s => s.id)).toEqual(["e"]);
  });

  it("gives the AI questions and counts but no student names or ids", () => {
    const text = JSON.stringify(insightFacts({ title: "Fractions", subject: "math", grade: 4 }, a));
    expect(text).not.toMatch(/Name-|"profileId"/);
    expect(text).toContain("mostPickedWrongOption");
  });

  it("copes with unanswered or out-of-range answers and an empty class", () => {
    const odd = analyzeResults(quiz, [{ profileId: "a", answers: [-1, 9] }], students);
    expect(odd.questions[0].picks).toEqual([0, 0, 0, 0]);
    expect(analyzeResults(quiz, [], students).averagePercent).toBeNull();
  });

  it("coerces a messy model answer and refuses an empty one", () => {
    const ok = normalizeInsights({ summary: " Most mixed up the bottoms. ", misconceptions: ["adds denominators", 5, ""], reteach: [{ title: "Pizza", minutes: 400, instructions: "Cut it." }, { nothing: true }], quickCheck: "q", extension: "" });
    expect(ok.misconceptions).toEqual(["adds denominators"]);
    expect(ok.reteach).toEqual([{ title: "Pizza", minutes: 30, instructions: "Cut it." }]);
    expect(() => normalizeInsights({})).toThrow();
  });
});
