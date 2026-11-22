import type { SyncMeta } from "../../src/logic/types";
import { createDb, type WorkoutDB } from "../../src/storage/db";
import { seedIfEmpty } from "../../src/storage/seed";
import { deleteSession, exportBackup, finishWorkout, importBackup, startWorkout, updateSet } from "../../src/storage/repo";

let db: WorkoutDB;
let other: WorkoutDB;
beforeEach(async () => {
  db = createDb(crypto.randomUUID());
  other = createDb(crypto.randomUUID());
  await seedIfEmpty(db);
});
afterEach(() => {
  vi.useRealTimers();
  db.close();
  other.close();
});

async function history() {
  const kept = await startWorkout(db, "seed-workout-upper-a");
  await updateSet(db, kept, 0, 0, { weight: 65, amount: 10, done: true });
  await finishWorkout(db, kept);
  const gone = await startWorkout(db, "seed-workout-lower-a");
  await updateSet(db, gone, 0, 0, { weight: 135, amount: 5, done: true });
  await finishWorkout(db, gone);
  await deleteSession(db, gone);
  return { kept, gone };
}

const strip = (rows: SyncMeta[]) =>
  rows.map(({ updatedAt: _u, dirty: _d, ...rest }) => rest).sort((a, b) => a.id.localeCompare(b.id));

test("a round trip keeps every row, tombstones included", async () => {
  const { gone } = await history();
  const backup = await exportBackup(db);
  expect(backup.version).toBe(1);
  expect(backup.sessions.find((s) => s.id === gone)?.deleted).toBe(true);
  await seedIfEmpty(other);
  await importBackup(other, JSON.parse(JSON.stringify(backup)));
  for (const table of ["exercises", "workouts", "rotation", "sessions"] as const) {
    expect(strip(await other[table].toArray())).toEqual(strip(await db[table].toArray()));
  }
});

test("import replaces what was there", async () => {
  await history();
  const backup = await exportBackup(db);
  await seedIfEmpty(other);
  const stray = await startWorkout(other, "seed-workout-upper-b");
  await importBackup(other, backup);
  expect(await other.sessions.get(stray)).toBeUndefined();
});

test("import marks every row dirty with a fresh updatedAt", async () => {
  await history();
  const backup = await exportBackup(db);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2030-01-01T00:00:00Z"));
  await importBackup(other, backup);
  for (const table of ["exercises", "workouts", "rotation", "sessions"] as const) {
    const rows = await other[table].toArray();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.dirty === 1 && r.updatedAt === "2030-01-01T00:00:00.000Z")).toBe(true);
  }
});
