// Rules for editing workouts, the rotation and exercises.
import { parseNumberInput } from "./input";
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

type Targets = { sets: number; targetMin: number; targetMax?: number };

/**
 * Applies one typed target number to a planned exercise. Returns the updated copy,
 * or a message saying what's wrong (nothing is saved then). Values are rounded to
 * whole numbers. A top of the range that isn't above the bottom is dropped, which
 * makes a fixed target like "45 sec".
 */
export function setPlannedNumber<T extends Targets>(planned: T, field: "sets" | "targetMin" | "targetMax", raw: string): T | string {
  const value = parseNumberInput(raw);
  const copy = { ...planned };
  if (field === "sets") {
    if (value === undefined || Math.round(value) < 1) return "At least 1 set";
    copy.sets = Math.round(value);
    return copy;
  }
  if (field === "targetMax" && raw.trim() === "") {
    delete copy.targetMax;
    return copy;
  }
  if (value === undefined) return "Enter a number";
  copy[field] = Math.round(value);
  if (copy.targetMax !== undefined && copy.targetMax <= copy.targetMin) delete copy.targetMax;
  return copy;
}
