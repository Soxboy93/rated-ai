/**
 * Lesson plans for the teacher companion. A lesson is AI-drafted from the teacher's request (and optionally text the
 * teacher pasted from the textbook), then reviewed and edited by the teacher. These helpers coerce whatever the AI
 * returns into a safe shape and turn a lesson into presentation slides. The AI output is a DRAFT: nothing here makes
 * it correct, curriculum-aligned or suitable; the teacher is responsible for reviewing it before teaching or sharing.
 */
export const LESSON_SUBJECTS = ["arabic", "math", "science", "english", "islamic", "social", "computer", "other"] as const;
export type LessonSubject = (typeof LESSON_SUBJECTS)[number];

/** Subjects where the AI must not invent content: a teacher has to paste the textbook passage to teach from. */
export const SOURCE_REQUIRED_SUBJECTS: readonly LessonSubject[] = ["islamic"];
export const MIN_SOURCE_CHARS = 100;
export const MAX_SOURCE_CHARS = 6000;

export type ActivityMode = "individual" | "pair" | "group";
export type QuizQuestion = { q: string; options: string[]; answer: number; explanation: string };
export type LessonContent = {
  objectives: string[];
  warmup: { title: string; script: string; minutes: number };
  steps: Array<{ title: string; explanation: string; board: string[]; minutes: number }>;
  examples: Array<{ prompt: string; solution: string }>;
  activities: Array<{ title: string; mode: ActivityMode; instructions: string; minutes: number }>;
  quiz: QuizQuestion[];
  differentiation: { support: string; extension: string };
  misconceptions: string[];
  homework: string;
  studentSummary: string[];
};

const LIMITS = { objectives: 6, steps: 8, board: 6, examples: 5, activities: 5, quiz: 10, misconceptions: 5, summary: 8 };

const str = (v: unknown, max = 1500): string => (typeof v === "string" ? v.replace(/\s+\n/g, "\n").trim().slice(0, max) : "");
const strList = (v: unknown, max: number, len = 400): string[] =>
  (Array.isArray(v) ? v : []).map(x => str(x, len)).filter(Boolean).slice(0, max);
const minutes = (v: unknown, fallback: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 1 && n <= 90 ? n : fallback;
};

/** Coerces untrusted AI (or client) output into a LessonContent. Throws when there is nothing teachable in it. */
export function normalizeLesson(raw: unknown): LessonContent {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>;
  const steps = (Array.isArray(r.steps) ? r.steps : [])
    .map((s: any) => ({ title: str(s?.title, 160), explanation: str(s?.explanation, 2500), board: strList(s?.board, LIMITS.board, 200), minutes: minutes(s?.minutes, 5) }))
    .filter((s: { title: string; explanation: string }) => s.title || s.explanation)
    .slice(0, LIMITS.steps);
  if (steps.length === 0) throw new Error("The lesson has no teaching steps.");

  const quiz: QuizQuestion[] = [];
  for (const item of Array.isArray(r.quiz) ? r.quiz : []) {
    const options = strList(item?.options, 4, 200);
    const answer = Number(item?.answer);
    // A question is only usable with a prompt, exactly four distinct options, and a valid correct index.
    if (!str(item?.q, 400) || options.length !== 4 || new Set(options).size !== 4 || !Number.isInteger(answer) || answer < 0 || answer > 3) continue;
    quiz.push({ q: str(item.q, 400), options, answer, explanation: str(item?.explanation, 600) });
    if (quiz.length >= LIMITS.quiz) break;
  }

  const mode = (m: unknown): ActivityMode => (m === "pair" || m === "group" ? m : "individual");
  return {
    objectives: strList(r.objectives, LIMITS.objectives),
    warmup: { title: str(r.warmup?.title, 160), script: str(r.warmup?.script, 1500), minutes: minutes(r.warmup?.minutes, 5) },
    steps,
    examples: (Array.isArray(r.examples) ? r.examples : [])
      .map((e: any) => ({ prompt: str(e?.prompt, 800), solution: str(e?.solution, 1500) }))
      .filter((e: { prompt: string }) => e.prompt)
      .slice(0, LIMITS.examples),
    activities: (Array.isArray(r.activities) ? r.activities : [])
      .map((a: any) => ({ title: str(a?.title, 160), mode: mode(a?.mode), instructions: str(a?.instructions, 1500), minutes: minutes(a?.minutes, 10) }))
      .filter((a: { title: string; instructions: string }) => a.title || a.instructions)
      .slice(0, LIMITS.activities),
    quiz,
    differentiation: { support: str(r.differentiation?.support, 1000), extension: str(r.differentiation?.extension, 1000) },
    misconceptions: strList(r.misconceptions, LIMITS.misconceptions),
    homework: str(r.homework, 1000),
    studentSummary: strList(r.studentSummary, LIMITS.summary),
  };
}

/** Everything a student could read in a lesson: used to screen AI output before it can be shown to children. */
export function studentFacingText(c: LessonContent): string {
  return [
    ...c.studentSummary,
    ...c.examples.flatMap(e => [e.prompt, e.solution]),
    ...c.quiz.flatMap(q => [q.q, ...q.options, q.explanation]),
  ].join("\n");
}

/** What a student is allowed to see: the quiz WITHOUT answers, a short summary, and worked examples. */
export function studentView(c: LessonContent) {
  return {
    summary: c.studentSummary,
    examples: c.examples,
    quiz: c.quiz.map(q => ({ q: q.q, options: q.options })),
  };
}

/** Marks a student's answers against the lesson quiz. Unanswered (-1) or out-of-range counts as wrong. */
export function gradeQuiz(quiz: QuizQuestion[], answers: number[]) {
  const perQuestion = quiz.map((q, i) => answers[i] === q.answer);
  return { correct: perQuestion.filter(Boolean).length, total: quiz.length, perQuestion };
}

/* ----------------------------------------------------------------------------------------- slides */

export type Slide =
  | { kind: "title"; title: string; subtitle: string }
  | { kind: "objectives"; bullets: string[] }
  | { kind: "warmup"; title: string; body: string; minutes: number }
  | { kind: "step"; n: number; of: number; title: string; body: string; bullets: string[]; minutes: number }
  | { kind: "example"; n: number; of: number; prompt: string; solution: string }
  | { kind: "activity"; title: string; mode: ActivityMode; body: string; minutes: number }
  | { kind: "quiz"; n: number; of: number; q: string; options: string[]; answer: number; explanation: string }
  | { kind: "summary"; bullets: string[] }
  | { kind: "homework"; body: string };

/** The presentation order for teaching the lesson in class. Empty sections are skipped. */
export function buildSlides(c: LessonContent, meta: { title: string; subtitle: string }): Slide[] {
  const slides: Slide[] = [{ kind: "title", title: meta.title, subtitle: meta.subtitle }];
  if (c.objectives.length) slides.push({ kind: "objectives", bullets: c.objectives });
  if (c.warmup.script) slides.push({ kind: "warmup", title: c.warmup.title, body: c.warmup.script, minutes: c.warmup.minutes });
  c.steps.forEach((s, i) => slides.push({ kind: "step", n: i + 1, of: c.steps.length, title: s.title, body: s.explanation, bullets: s.board, minutes: s.minutes }));
  c.examples.forEach((e, i) => slides.push({ kind: "example", n: i + 1, of: c.examples.length, prompt: e.prompt, solution: e.solution }));
  c.activities.forEach(a => slides.push({ kind: "activity", title: a.title, mode: a.mode, body: a.instructions, minutes: a.minutes }));
  c.quiz.forEach((q, i) => slides.push({ kind: "quiz", n: i + 1, of: c.quiz.length, q: q.q, options: q.options, answer: q.answer, explanation: q.explanation }));
  if (c.studentSummary.length) slides.push({ kind: "summary", bullets: c.studentSummary });
  if (c.homework) slides.push({ kind: "homework", body: c.homework });
  return slides;
}

/** Total planned minutes in a lesson, for a quick "does this fit the period" check. */
export const plannedMinutes = (c: LessonContent) =>
  c.warmup.minutes * (c.warmup.script ? 1 : 0) + c.steps.reduce((n, s) => n + s.minutes, 0) + c.activities.reduce((n, a) => n + a.minutes, 0);

export const lessonSchemaHint = {
  objectives: ["string"],
  warmup: { title: "string", script: "string", minutes: 5 },
  steps: [{ title: "string", explanation: "string (what the teacher says and does)", board: ["short points to write on the board"], minutes: 5 }],
  examples: [{ prompt: "string", solution: "string" }],
  activities: [{ title: "string", mode: "individual | pair | group", instructions: "string", minutes: 10 }],
  quiz: [{ q: "string", options: ["four distinct options"], answer: "index 0-3 of the correct option", explanation: "string" }],
  differentiation: { support: "string", extension: "string" },
  misconceptions: ["string"],
  homework: "string",
  studentSummary: ["short sentences a child can read"],
};
