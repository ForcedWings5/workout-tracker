import Dexie from "dexie";
import { EPOCH } from "../../src/logic/clock";
import { createDb } from "../../src/storage/db";
import { SEED_SCHEDULE, SEED_WORKOUT_IDS } from "../../src/storage/seed";

/** The database as version 1 of the app left it: a rotation, no schedule. */
class V1 extends Dexie {
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

const workout = (id: string) => ({ id, name: id, exercises: [], updatedAt: EPOCH, deleted: false, dirty: 0 });

async function v1(rows: { rotation?: object; sessions?: object[] }) {
  const name = crypto.randomUUID();
  const old = new V1(name);
  await old.table("workouts").bulkPut(SEED_WORKOUT_IDS.map(workout));
  if (rows.rotation) await old.table("rotation").put(rows.rotation);
  if (rows.sessions) await old.table("sessions").bulkPut(rows.sessions);
  old.close();
  return createDb(name);
}

test("Review Focus 4: an untouched seed rotation becomes the clean seed schedule, history untouched", async () => {
  const session = { id: "s1", workoutId: SEED_WORKOUT_IDS[0], workoutName: "Upper A", date: "2026-11-16", status: "finished", entries: [], updatedAt: "2026-11-16T15:00:00.000Z", deleted: false, dirty: 1 };
  const db = await v1({ rotation: { id: "rotation", workoutIds: [...SEED_WORKOUT_IDS], updatedAt: EPOCH, deleted: false, dirty: 0 }, sessions: [session] });
  expect(await db.schedule.get("schedule")).toEqual({ id: "schedule", days: SEED_SCHEDULE, updatedAt: EPOCH, deleted: false, dirty: 0 });
  expect(await db.sessions.get("s1")).toEqual(session);
  db.close();
});

test("Review Focus 4: an edited rotation becomes a schedule that will sync", async () => {
  const db = await v1({ rotation: { id: "rotation", workoutIds: [SEED_WORKOUT_IDS[1], SEED_WORKOUT_IDS[0]], updatedAt: "2026-11-20T10:00:00.000Z", deleted: false, dirty: 1 } });
  const row = await db.schedule.get("schedule");
  expect(row?.days.slice(0, 2)).toEqual([SEED_WORKOUT_IDS[1], SEED_WORKOUT_IDS[0]]);
  expect(row?.dirty).toBe(1);
  expect(row?.updatedAt).not.toBe(EPOCH);
  db.close();
});

test("with no rotation, every day is rest", async () => {
  const db = await v1({});
  expect((await db.schedule.get("schedule"))?.days).toEqual([null, null, null, null, null, null, null]);
  db.close();
});
