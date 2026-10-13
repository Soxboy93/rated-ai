import { T, t } from "@/i18n";

const GRADE_LABELS = [
  T("Grade 1"), T("Grade 2"), T("Grade 3"), T("Grade 4"), T("Grade 5"), T("Grade 6"),
  T("Grade 7"), T("Grade 8"), T("Grade 9"), T("Grade 10"), T("Grade 11"), T("Grade 12"),
];
export const gradeLabel = (grade: number) => t(GRADE_LABELS[grade - 1] ?? "Grade {n}", { n: grade });

/** Grades offered when creating a class. The first Arabic content band covers Grades 1-6; later grades use the same
 *  generators with English-first wording until more Arabic content is written and reviewed. */
export const CLASS_GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
