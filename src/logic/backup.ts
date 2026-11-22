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

/** Just enough shape for each row that the app can open it without crashing. */
const ROW_CHECKS: Record<"exercises" | "workouts" | "rotation" | "sessions", (r: Row) => boolean> = {
  exercises: (r) => isString(r.name) && (r.measure === "reps" || r.measure === "seconds"),
  workouts: (r) => isString(r.name) && Array.isArray(r.exercises),
  rotation: (r) => Array.isArray(r.workoutIds) && r.workoutIds.every(isString),
  sessions: (r) =>
    isString(r.workoutName) &&
    isString(r.date) &&
    (r.status === "in_progress" || r.status === "finished") &&
    Array.isArray(r.entries) &&
    r.entries.every((e) => isRow(e) && isString(e.exerciseId) && Array.isArray(e.sets)),
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

  for (const key of Object.keys(ROW_CHECKS) as (keyof typeof ROW_CHECKS)[]) {
    const rows = data[key];
    if (!Array.isArray(rows)) return { ok: false, error: NOT_A_BACKUP };
    if (!rows.every((r) => isRow(r) && isString(r.id) && r.id !== "" && ROW_CHECKS[key](r))) return { ok: false, error: DAMAGED };
  }
  return { ok: true, backup: data as unknown as Backup };
}
