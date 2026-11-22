// Domain types. Shapes follow the spec's Data model section.

export type Measure = "reps" | "seconds";
export type Kind = "exercise" | "workout" | "rotation" | "schedule" | "session";

/** Every synced record carries these fields. */
export type SyncMeta = {
  id: string;
  /** ISO timestamp, set on every local write. */
  updatedAt: string;
  /** Deletes are tombstones, so they sync. */
  deleted: boolean;
  /** 1 = changed locally, not yet pushed (0/1 so Dexie can index it). */
  dirty: 0 | 1;
};

export type Exercise = SyncMeta & {
  name: string;
  measure: Measure;
  /** Hidden from pickers, history kept. */
  archived: boolean;
};

export type PlannedExercise = {
  exerciseId: string;
  sets: number;
  /** Reps or seconds. */
  targetMin: number;
  /** Absent for fixed targets like "45 sec". */
  targetMax?: number;
  /** For example "per leg". */
  label?: string;
};

export type Workout = SyncMeta & {
  name: string;
  /** In order. */
  exercises: PlannedExercise[];
};

/** Single record, id "rotation". Retired: replaced by Schedule; read only when upgrading and importing old backups. */
export type Rotation = SyncMeta & { workoutIds: string[] };

/** Single record, id "schedule". Seven days, Monday first: a workout id, or null for Rest. */
export type Schedule = SyncMeta & { days: (string | null)[] };

export type LoggedSet = {
  /** Pounds, decimals allowed, blank = bodyweight. */
  weight?: number;
  /** Reps or seconds, per the exercise's measure. */
  amount?: number;
  /** Only done sets count. */
  done: boolean;
  /** Marked "Skip set"; dropped when the session is finished. */
  skipped?: boolean;
};

export type SessionEntry = {
  exerciseId: string;
  /** Snapshot of the targets at the time. */
  planned: Omit<PlannedExercise, "exerciseId">;
  sets: LoggedSet[];
  note?: string;
};

export type Session = SyncMeta & {
  /** Absent for a one-off workout. */
  workoutId?: string;
  /** Snapshot. */
  workoutName: string;
  /** Local YYYY-MM-DD, editable. */
  date: string;
  status: "in_progress" | "finished";
  entries: SessionEntry[];
};

/** Local only, never synced. */
export type SyncState = {
  /** Server time of the newest row pulled. */
  lastPulledAt?: string;
  /** When the last successful sync finished. */
  lastSyncedAt?: string;
  /** When a backup file was last exported. */
  lastExportAt?: string;
};
