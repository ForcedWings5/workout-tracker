import { createDb, type WorkoutDB } from "../../src/storage/db";
import { seedExerciseId, seedIfEmpty } from "../../src/storage/seed";
import {
  addExerciseToSession,
  deleteSessionSet,
  finishWorkout,
  removeSessionEntry,
  startWorkout,
  updateSet,
} from "../../src/storage/repo";

const UPPER_A = "seed-workout-upper-a";
const BENCH = seedExerciseId("Barbell Bench Press");
let db: WorkoutDB;
let id: string;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-18T15:00:00Z"));
  db = createDb(crypto.randomUUID());
  await seedIfEmpty(db);
  id = await startWorkout(db, UPPER_A);
});
afterEach(() => {
  vi.useRealTimers();
  db.close();
});

const session = async () => (await db.sessions.get(id))!;

test("deleting a set removes only that set from today, done or not", async () => {
  await updateSet(db, id, 0, 0, { weight: 135, amount: 8, done: true });
  const before = await session();
  vi.setSystemTime(new Date("2026-11-18T15:05:00Z"));
  await deleteSessionSet(db, id, 0, 0, BENCH);
  const after = await session();
  expect(after.entries[0].sets).toHaveLength(3);
  expect(after.entries[0].sets[0]).not.toMatchObject({ weight: 135, amount: 8, done: true });
  expect(after.updatedAt).not.toBe(before.updatedAt);
  expect(after.dirty).toBe(1);
  expect((await db.workouts.get(UPPER_A))!.exercises[0].sets).toBe(4);
});

test("removing an exercise takes its sets with it, and the workout keeps it", async () => {
  await removeSessionEntry(db, id, 0, BENCH);
  expect((await session()).entries[0]?.exerciseId).not.toBe(BENCH);
  expect((await db.workouts.get(UPPER_A))!.exercises[0].exerciseId).toBe(BENCH);
});

test("a mismatched exerciseId changes nothing", async () => {
  const before = await session();
  await expect(removeSessionEntry(db, id, 0, "not-bench")).rejects.toThrow("Exercise not found in session");
  await expect(deleteSessionSet(db, id, 0, 0, "not-bench")).rejects.toThrow("Exercise not found in session");
  expect(await session()).toEqual(before);
});

test("with the same exercise twice, removing the second keeps the first", async () => {
  const count = (await session()).entries.length;
  await addExerciseToSession(db, id, BENCH);
  await removeSessionEntry(db, id, count, BENCH);
  const after = await session();
  expect(after.entries).toHaveLength(count);
  expect(after.entries[0].exerciseId).toBe(BENCH);
  expect(after.entries[0].sets).toHaveLength(4);
});

test("a missing set is refused", async () => {
  await expect(deleteSessionSet(db, id, 0, 99, BENCH)).rejects.toThrow("Set not found");
});

test("a finished session can't be changed", async () => {
  await updateSet(db, id, 0, 0, { weight: 135, amount: 8, done: true });
  await finishWorkout(db, id);
  await expect(removeSessionEntry(db, id, 0, BENCH)).rejects.toThrow("This workout is already finished");
});
