/**
 * Turns a class's quiz answers into what a teacher needs next: which questions were missed, which wrong option was
 * picked most (the likely misconception), and who needs support or a challenge. Pure maths; no names ever leave here
 * for the AI (the AI only sees the question texts and the counts).
 */
import type { QuizQuestion } from "./lesson";

export type ResultRow = { profileId: string; answers: number[] };
export type StudentRef = { id: string; childName: string };

export type QuestionInsight = {
  index: number;
  q: string;
  options: string[];
  correctOption: number;
  percentCorrect: number;
  /** How many students picked each option (unanswered ones are ignored). */
  picks: number[];
  /** The wrong option most students chose, or null when nobody got it wrong. */
  topWrong: { option: number; count: number } | null;
};

export type ClassInsight = {
  taken: number;
  classSize: number;
  averagePercent: number | null;
  questions: QuestionInsight[];
  /** Questions under 60% right, hardest first. */
  hard: QuestionInsight[];
  needsSupport: StudentRef[];
  readyForMore: StudentRef[];
  notYetTaken: StudentRef[];
};

export const MIN_RESULTS_FOR_INSIGHT = 3;
export const HARD_BELOW_PERCENT = 60;

export function analyzeResults(quiz: QuizQuestion[], results: ResultRow[], students: StudentRef[]): ClassInsight {
  const taken = results.length;
  const questions: QuestionInsight[] = quiz.map((q, index) => {
    const picks = [0, 0, 0, 0];
    let right = 0;
    for (const r of results) {
      const a = r.answers[index];
      if (Number.isInteger(a) && a >= 0 && a <= 3) picks[a]++;
      if (a === q.answer) right++;
    }
    const wrong = picks.map((count, option) => ({ option, count })).filter(p => p.option !== q.answer && p.count > 0).sort((a, b) => b.count - a.count);
    return { index, q: q.q, options: q.options, correctOption: q.answer, percentCorrect: taken ? Math.round((right / taken) * 100) : 0, picks, topWrong: wrong[0] ?? null };
  });

  const scoreOf = (r: ResultRow) => quiz.filter((q, i) => r.answers[i] === q.answer).length;
  const byId = new Map(results.map(r => [r.profileId, r]));
  const total = quiz.length || 1;
  const needsSupport: StudentRef[] = [];
  const readyForMore: StudentRef[] = [];
  const notYetTaken: StudentRef[] = [];
  for (const s of students) {
    const r = byId.get(s.id);
    if (!r) { notYetTaken.push(s); continue; }
    const score = scoreOf(r);
    if (score / total < 0.5) needsSupport.push(s);
    else if (score === quiz.length && quiz.length > 0) readyForMore.push(s);
  }
  const avg = taken && quiz.length ? Math.round((results.reduce((n, r) => n + scoreOf(r), 0) / (taken * quiz.length)) * 100) : null;
  return {
    taken, classSize: students.length, averagePercent: avg, questions,
    hard: questions.filter(q => q.percentCorrect < HARD_BELOW_PERCENT).sort((a, b) => a.percentCorrect - b.percentCorrect),
    needsSupport, readyForMore, notYetTaken,
  };
}

/** The facts the AI is given: questions and counts only. No student names or ids. */
export function insightFacts(lesson: { title: string; subject: string; grade: number }, a: ClassInsight) {
  return {
    lesson: lesson.title, subject: lesson.subject, grade: lesson.grade, studentsWhoTookIt: a.taken, classAverageRightPercent: a.averagePercent,
    questions: a.questions.map(q => ({
      question: q.q, options: q.options, correctOption: q.correctOption, percentRight: q.percentCorrect,
      timesEachOptionWasPicked: q.picks, mostPickedWrongOption: q.topWrong ? q.options[q.topWrong.option] : null,
    })),
  };
}
