/** Pure maths for the school overview and printable impact report. Every number comes from real stored activity, nothing is estimated. */

export type DayCount = { day: string; plays: number };
export type WeekBucket = { weekStart: string; plays: number };

const dayMs = 86_400_000;
const parseDay = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
const isoOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Plays per week for the last `weeks` weeks, each week being the 7 days ending on `today` (oldest first). */
export function bucketWeeks(days: DayCount[], today: string, weeks = 8): WeekBucket[] {
  const end = parseDay(today);
  const buckets: WeekBucket[] = Array.from({ length: weeks }, (_, i) => ({ weekStart: isoOf(end - (weeks - i) * 7 * dayMs + dayMs), plays: 0 }));
  for (const d of days) {
    const age = Math.floor((end - parseDay(d.day)) / dayMs);
    if (age < 0 || age >= weeks * 7) continue;
    buckets[weeks - 1 - Math.floor(age / 7)].plays += d.plays;
  }
  return buckets;
}

export type ClassReportRow = {
  id: string; name: string; grade: number; students: number; activeThisWeek: number; plays: number;
  /** 0..100 across all games, or null when nobody has played. */
  accuracyPercent: number | null; lessonsShared: number; quizAveragePercent: number | null; needAttention: number;
};

export type SchoolOverview = {
  generatedAt: string;
  totals: {
    students: number; classes: number; activeThisWeek: number; activePercent: number | null; plays: number;
    lessonsShared: number; quizAveragePercent: number | null; quizTakenPercent: number | null; needAttention: number;
  };
  classes: ClassReportRow[];
  weekly: WeekBucket[];
  safety: { flaggedLast30Days: number; open: number; reviewed: number };
};

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : null);

/** Quiz results as stored: one row per student per shared lesson, with the score. */
export type QuizRow = { classId: string; correct: number; total: number };
export type ShareRow = { classId: string };

export function buildSchoolOverview(input: {
  now: Date;
  classes: Array<{ id: string; name: string; grade: number; students: number; activeThisWeek: number; plays: number; correct: number; asked: number; needAttention: number }>;
  shares: ShareRow[];
  quizRows: QuizRow[];
  days: DayCount[];
  today: string;
  safety: { flaggedLast30Days: number; open: number; reviewed: number };
}): SchoolOverview {
  const rows: ClassReportRow[] = input.classes.map(c => {
    const q = input.quizRows.filter(r => r.classId === c.id);
    return {
      id: c.id, name: c.name, grade: c.grade, students: c.students, activeThisWeek: c.activeThisWeek, plays: c.plays,
      accuracyPercent: pct(c.correct, c.asked), lessonsShared: input.shares.filter(s => s.classId === c.id).length,
      quizAveragePercent: pct(q.reduce((n, r) => n + r.correct, 0), q.reduce((n, r) => n + r.total, 0)), needAttention: c.needAttention,
    };
  });
  const students = rows.reduce((n, c) => n + c.students, 0);
  const active = rows.reduce((n, c) => n + c.activeThisWeek, 0);
  // Students expected to take each shared lesson = the size of the class it was shared with.
  const expected = input.shares.reduce((n, s) => n + (input.classes.find(c => c.id === s.classId)?.students ?? 0), 0);
  return {
    generatedAt: input.now.toISOString(),
    totals: {
      students, classes: rows.length, activeThisWeek: active, activePercent: pct(active, students), plays: rows.reduce((n, c) => n + c.plays, 0),
      lessonsShared: input.shares.length,
      quizAveragePercent: pct(input.quizRows.reduce((n, r) => n + r.correct, 0), input.quizRows.reduce((n, r) => n + r.total, 0)),
      quizTakenPercent: pct(input.quizRows.length, expected), needAttention: rows.reduce((n, c) => n + c.needAttention, 0),
    },
    classes: rows,
    weekly: bucketWeeks(input.days, input.today),
    safety: input.safety,
  };
}
