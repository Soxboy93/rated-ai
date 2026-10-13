import { describe, expect, it } from "vitest";
import { buildBoost, buildSlides, gradeQuiz, normalizeLesson, plannedMinutes, studentFacingText, studentView, type LessonContent } from "@shared/lesson";

const good = {
  objectives: ["Add fractions with the same denominator"],
  warmup: { title: "Pizza", script: "Cut a pizza into 4.", minutes: 4 },
  steps: [
    { title: "Same denominators", explanation: "Add the tops, keep the bottom.", board: ["1/4 + 2/4 = 3/4"], minutes: 8 },
    { title: "Practice", explanation: "Try three.", board: [], minutes: 6 },
  ],
  examples: [{ prompt: "1/5 + 2/5", solution: "3/5" }],
  activities: [{ title: "Fraction cards", mode: "pair", instructions: "Match cards.", minutes: 10 }],
  quiz: [
    { q: "1/3 + 1/3 = ?", options: ["1/3", "2/3", "2/6", "3/3"], answer: 1, explanation: "Add the tops." },
    { q: "2/7 + 3/7 = ?", options: ["5/14", "5/7", "6/7", "1/7"], answer: 1, explanation: "Same bottom." },
  ],
  differentiation: { support: "Use drawings", extension: "Mixed numbers" },
  misconceptions: ["Adding the denominators"],
  homework: "Page 40",
  studentSummary: ["Same bottom: add the tops."],
};

describe("normalizeLesson", () => {
  it("keeps a good lesson intact", () => {
    const c = normalizeLesson(good);
    expect(c.steps).toHaveLength(2);
    expect(c.quiz).toHaveLength(2);
    expect(c.activities[0].mode).toBe("pair");
    expect(plannedMinutes(c)).toBe(4 + 8 + 6 + 10);
  });

  it("drops unusable quiz questions instead of showing broken ones to children", () => {
    const c = normalizeLesson({
      ...good,
      quiz: [
        { q: "dup options", options: ["a", "a", "b", "c"], answer: 0, explanation: "" },
        { q: "three options", options: ["a", "b", "c"], answer: 0, explanation: "" },
        { q: "bad index", options: ["a", "b", "c", "d"], answer: 4, explanation: "" },
        { q: "", options: ["a", "b", "c", "d"], answer: 0, explanation: "" },
        { q: "ok", options: ["a", "b", "c", "d"], answer: 3, explanation: "" },
      ],
    });
    expect(c.quiz.map(q => q.q)).toEqual(["ok"]);
  });

  it("clips lengths, ignores junk types and rejects a lesson with no steps", () => {
    const c = normalizeLesson({ ...good, steps: Array.from({ length: 20 }, (_, i) => ({ title: `S${i}`, explanation: "x".repeat(9000), minutes: 999 })), objectives: [1, null, "ok"] });
    expect(c.steps).toHaveLength(8);
    expect(c.steps[0].explanation.length).toBeLessThanOrEqual(2500);
    expect(c.steps[0].minutes).toBe(5);
    expect(c.objectives).toEqual(["ok"]);
    expect(() => normalizeLesson({})).toThrow();
    expect(() => normalizeLesson("nope")).toThrow();
  });
});

describe("student view and grading", () => {
  const c: LessonContent = normalizeLesson(good);
  it("never exposes the answers or the teacher notes to students", () => {
    const view = studentView(c);
    expect(JSON.stringify(view)).not.toContain("explanation");
    expect(view.quiz.every(q => !("answer" in q))).toBe(true);
    expect(JSON.stringify(view)).not.toContain("Adding the denominators");
    expect(studentFacingText(c)).toContain("1/3 + 1/3");
  });
  it("grades by index and treats missing or invalid answers as wrong", () => {
    expect(gradeQuiz(c.quiz, [1, 1])).toEqual({ correct: 2, total: 2, perQuestion: [true, true] });
    expect(gradeQuiz(c.quiz, [0, -1])).toEqual({ correct: 0, total: 2, perQuestion: [false, false] });
    expect(gradeQuiz(c.quiz, [1]).correct).toBe(1);
  });
});

describe("vocabulary", () => {
  const base = { steps: [{ title: "s", explanation: "e", board: [], minutes: 5 }] };
  it("keeps clean word/meaning pairs, drops blanks and duplicates, and caps the list", () => {
    const c = normalizeLesson({ ...base, vocabulary: [{ term: " half ", meaning: "one of two" }, { term: "half", meaning: "again" }, { term: "", meaning: "x" }, { term: "part", meaning: "" }, ...Array.from({ length: 20 }, (_, i) => ({ term: `w${i}`, meaning: "m" }))] });
    expect(c.vocabulary[0]).toEqual({ term: "half", meaning: "one of two" });
    expect(c.vocabulary.some(v => v.meaning === "again" || !v.term)).toBe(false);
    expect(c.vocabulary).toHaveLength(12);
  });
  it("is empty for lessons made before word cards existed, and reaches students and the safety screen", () => {
    expect(normalizeLesson(base).vocabulary).toEqual([]);
    const c = normalizeLesson({ ...base, vocabulary: [{ term: "half", meaning: "one of two" }] });
    expect(studentView(c).vocabulary).toEqual(c.vocabulary);
    expect(studentFacingText(c)).toContain("one of two");
  });
});

describe("buildSlides", () => {
  it("orders title, objectives, warm-up, steps, examples, activities, quiz, summary, homework", () => {
    const slides = buildSlides(normalizeLesson(good), { title: "Fractions", subtitle: "Grade 4" });
    expect(slides.map(s => s.kind)).toEqual(["title", "objectives", "warmup", "step", "step", "example", "activity", "quiz", "quiz", "summary", "homework"]);
    const q = slides.find(s => s.kind === "quiz")!;
    expect(q.kind === "quiz" && q.answer).toBe(1);
  });
  it("skips empty sections", () => {
    const slides = buildSlides(normalizeLesson({ steps: [{ title: "Only", explanation: "x" }] }), { title: "T", subtitle: "" });
    expect(slides.map(s => s.kind)).toEqual(["title", "step"]);
  });
});

describe("daily boost", () => {
  const mk = (title: string, nPractice: number, words = 0) => ({
    title,
    content: normalizeLesson({
      steps: [{ title: "s", explanation: "e", board: [], minutes: 5 }],
      practice: Array.from({ length: nPractice }, (_, i) => ({ q: `${title} Q${i}`, options: ["a", "b", "c", "d"], answer: 1, explanation: "x" })),
      vocabulary: Array.from({ length: words }, (_, i) => ({ term: `${title}-w${i}`, meaning: `${title} means ${i}` })),
    }),
  });
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  it("mixes lessons, takes at most two from one lesson first, and never repeats a question", () => {
    const out = buildBoost([mk("A", 6), mk("B", 6), mk("C", 6)], 6, rnd);
    expect(out).toHaveLength(6);
    for (const t of ["A", "B", "C"]) expect(out.filter(q => q.lessonTitle === t)).toHaveLength(2);
    expect(new Set(out.map(q => q.q)).size).toBe(6);
  });
  it("fills up from one lesson when that is all there is, and returns nothing for no lessons", () => {
    expect(buildBoost([mk("A", 8)], 6, rnd)).toHaveLength(6);
    expect(buildBoost([], 6, rnd)).toEqual([]);
    expect(buildBoost([mk("A", 0)], 6, rnd)).toEqual([]);
  });
  it("makes word-meaning questions with four distinct options and the right answer index", () => {
    const out = buildBoost([mk("W", 0, 6)], 6, rnd);
    expect(out).toHaveLength(6);
    for (const q of out) {
      expect(new Set(q.options).size).toBe(4);
      expect(q.options[q.answer]).toBe(q.explanation.split(": ")[1]);
    }
  });
  it("needs at least four words before it makes word questions (it needs wrong options)", () => {
    expect(buildBoost([mk("W", 0, 3)], 6, rnd)).toEqual([]);
  });
});
