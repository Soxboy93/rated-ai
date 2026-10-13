/** Language and school-structure helpers for the Jordan school deployment. */
export type Lang = "ar" | "en";
export const LANGS: readonly Lang[] = ["ar", "en"];

export type AgeGroupId = "kids" | "tweens" | "teens";

/** Jordan's basic education runs Grades 1-10, secondary Grades 11-12 (Tawjihi). */
export const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

/**
 * Which of the app's three age bands a school grade uses. Grade 1 children are about 6, so Grades 1-3 use the
 * youngest band (4-8), Grades 4-7 the middle band (9-12) and Grades 8-12 the oldest (13-17).
 */
export function ageGroupForGrade(grade: number): AgeGroupId {
  if (grade <= 3) return "kids";
  if (grade <= 7) return "tweens";
  return "teens";
}

export const MAX_CLASSES_PER_TEACHER = 20;
export const MAX_STUDENTS_PER_CLASS = 60;
export const MAX_FAMILY_CHILDREN = 6;
export const MAX_STUDENTS_PER_SCHOOL_ACCOUNT = 400;

export type AccountType = "family" | "school";
