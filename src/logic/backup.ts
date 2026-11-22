import type { Exercise, Rotation, Session, Workout } from "./types";

/** The backup file. Bump `version` whenever this shape changes, and keep reading older ones. */
export type Backup = {
  version: 1;
  exportedAt: string;
  exercises: Exercise[];
  workouts: Workout[];
  rotation: Rotation[];
  sessions: Session[];
};

export const BACKUP_VERSION = 1;

const NOT_A_BACKUP = "This file isn't a Workout Tracker backup.";
const NEWER = "This backup is from a newer version of the app.";
const DAMAGED = "This backup file is damaged, so nothing was imported.";

type Row = Record<string, unknown>;
const isRow = (v: unknown): v is Row => typeof v === "object" && v !== null && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === "string";
const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const optional = (v: unknown, check: (x: unknown) => boolean) => v === undefined || check(v);

/** Targets, as a workout plans them and a session snapshots them. */
const isTargets = (p: unknown): p is Row =>
  isRow(p) && isNumber(p.sets) && isNumber(p.targetMin) && optional(p.targetMax, isNumber) && optional(p.label, isString);

const isPlannedExercise = (p: unknown) => isTargets(p) && isString(p.exerciseId);

const isLoggedSet = (s: unknown) =>
  isRow(s) && typeof s.done === "boolean" && optional(s.weight, isNumber) && optional(s.amount, isNumber) && optional(s.skipped, (x) => typeof x === "boolean");

const isEntry = (e: unknown) =>
  isRow(e) && isString(e.exerciseId) && isTargets(e.planned) && Array.isArray(e.sets) && e.sets.every(isLoggedSet) && optional(e.note, isString);

/**
 * Enough shape for each row that every screen can open it without crashing. Import clears the
 * phone first, so anything a screen reads has to be checked here.
 */
const ROW_CHECKS: Record<"exercises" | "workouts" | "rotation" | "sessions", (r: Row) => boolean> = {
  exercises: (r) => isString(r.name) && (r.measure === "reps" || r.measure === "seconds"),
  workouts: (r) => isString(r.name) && Array.isArray(r.exercises) && r.exercises.every(isPlannedExercise),
  rotation: (r) => Array.isArray(r.workoutIds) && r.workoutIds.every(isString),
  sessions: (r) =>
    isString(r.workoutName) &&
    isString(r.date) &&
    (r.status === "in_progress" || r.status === "finished") &&
    Array.isArray(r.entries) &&
    r.entries.every(isEntry),
};

/** Reads a backup file's text. Refuses anything the app couldn't safely load, so an import never half-happens. */
export function parseBackup(text: string): { ok: true; backup: Backup } | { ok: false; error: string } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: NOT_A_BACKUP };
  }
  if (!isRow(data) || typeof data.version !== "number") return { ok: false, error: NOT_A_BACKUP };
  if (data.version > BACKUP_VERSION) return { ok: false, error: NEWER };
  if (data.version !== BACKUP_VERSION) return { ok: false, error: NOT_A_BACKUP };

  if (!isString(data.exportedAt) || Number.isNaN(Date.parse(data.exportedAt))) return { ok: false, error: DAMAGED };

  for (const key of Object.keys(ROW_CHECKS) as (keyof typeof ROW_CHECKS)[]) {
    const rows = data[key];
    if (!Array.isArray(rows)) return { ok: false, error: NOT_A_BACKUP };
    if (!rows.every((r) => isRow(r) && isString(r.id) && r.id !== "" && ROW_CHECKS[key](r))) return { ok: false, error: DAMAGED };
  }
  return { ok: true, backup: data as unknown as Backup };
}
