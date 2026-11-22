import Dexie, { type Table } from "dexie";
import { EPOCH, nowIso } from "../logic/clock";
import { scheduleFromRotation } from "../logic/schedule";
import type { Exercise, Rotation, Schedule, Session, SyncState, Workout } from "../logic/types";

export type SyncStateRow = SyncState & { id: "state" };

export class WorkoutDB extends Dexie {
  exercises!: Table<Exercise, string>;
  workouts!: Table<Workout, string>;
  /** Retired in version 2; kept only so the upgrade can read it. */
  rotation!: Table<Rotation, string>;
  schedule!: Table<Schedule, string>;
  sessions!: Table<Session, string>;
  syncState!: Table<SyncStateRow, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      exercises: "id, dirty, name",
      workouts: "id, dirty",
      rotation: "id, dirty",
      sessions: "id, dirty, status, date, workoutId",
      syncState: "id",
    });
    // Version 2: the weekly schedule replaces the rotation.
    this.version(2)
      .stores({ schedule: "id, dirty" })
      .upgrade(async (tx) => {
        const rotation = (await tx.table("rotation").get("rotation")) as Rotation | undefined;
        const workouts = (await tx.table("workouts").toArray()) as Workout[];
        const live = workouts.filter((w) => !w.deleted).map((w) => w.id);
        // A damaged rotation must never stop the app from opening: treat it as no rotation.
        const usable = rotation && !rotation.deleted && Array.isArray(rotation.workoutIds) && rotation.workoutIds.every((id) => typeof id === "string");
        const days = usable ? scheduleFromRotation(rotation.workoutIds, live) : [null, null, null, null, null, null, null];
        // An untouched seed rotation (or none) gives a seed-like row, so it never overwrites a real
        // schedule in the cloud. Anything the owner edited becomes a real change that will sync.
        // Written directly: save() can't run inside an upgrade, and these are the stamps it would set.
        const clean = !rotation || (rotation.dirty === 0 && rotation.updatedAt === EPOCH);
        const row: Schedule = { id: "schedule", days, deleted: false, ...(clean ? { updatedAt: EPOCH, dirty: 0 } : { updatedAt: nowIso(), dirty: 1 }) };
        await tx.table("schedule").put(row);
      });
  }
}

export function createDb(name: string): WorkoutDB {
  return new WorkoutDB(name);
}

/** The app's database. Tests create their own with createDb. */
export const db = createDb("workout-tracker");
