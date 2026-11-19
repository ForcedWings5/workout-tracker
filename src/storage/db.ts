import Dexie, { type Table } from "dexie";
import type { Exercise, Rotation, Session, SyncState, Workout } from "../logic/types";

export type SyncStateRow = SyncState & { id: "state" };

export class WorkoutDB extends Dexie {
  exercises!: Table<Exercise, string>;
  workouts!: Table<Workout, string>;
  rotation!: Table<Rotation, string>;
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
  }
}

export function createDb(name: string): WorkoutDB {
  return new WorkoutDB(name);
}

/** The app's database. Tests create their own with createDb. */
export const db = createDb("workout-tracker");
