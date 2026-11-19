// Rules for editing workouts, the rotation and exercises.
import type { Exercise } from "./types";

/** The form two names are compared in: trimmed, single-spaced, lowercase. */
export function normalizeName(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

/** The exercise with this name, ignoring case and extra spaces. */
export function findExerciseByName(exercises: Exercise[], name: string): Exercise | undefined {
  const wanted = normalizeName(name);
  return exercises.find((e) => normalizeName(e.name) === wanted);
}

/** A copy of the list with one item moved. A move past either end returns an unchanged copy. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  const copy = [...list];
  if (from < 0 || from >= list.length || to < 0 || to >= list.length) return copy;
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

/** A display name: trimmed and single-spaced, case kept. */
export function cleanName(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}
