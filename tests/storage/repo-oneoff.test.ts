import { createDb, type WorkoutDB } from "../../src/storage/db";
import { seedExerciseId, seedIfEmpty } from "../../src/storage/seed";
import {
  addExerciseToSession,
  deleteExercise,
  finishWorkout,
  loadExercises,
  loadTodayState,
  renameSession,
  startEmptyWorkout,
  startWorkout,
  updateSet,
} from "../../src/storage/repo";

let db: WorkoutDB;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-18T15:00:00Z"));
  db = createDb(crypto.randomUUID());
  await seedIfEmpty(db);
});
afterEach(() => {
  vi.useRealTimers();
  db.close();
});

const UPPER_A = "seed-workout-upper-a";
const LOWER_A = "seed-workout-lower-a";
const BENCH = seedExerciseId("Barbell Bench Press");

async function session(id: string) {
  const s = await db.sessions.get(id);
  if (!s) throw new Error("missing session");
  return s;
}

test("startEmptyWorkout creates an in-progress 'Workout' with no workout and no exercises", async () => {
  const id = await startEmptyWorkout(db);
  const s = await session(id);
  expect(s).toMatchObject({ workoutName: "Workout", status: "in_progress", date: "2026-11-18", entries: [], dirty: 1 });
  expect(s.workoutId).toBeUndefined();
  await expect(startEmptyWorkout(db)).rejects.toThrow("A workout is already in progress");
});

test("a one-off workout never counts toward the week", async () => {
  const upper = await startWorkout(db, UPPER_A);
  await updateSet(db, upper, 0, 0, { weight: 65, amount: 10, done: true });
  await finishWorkout(db, upper);
  vi.setSystemTime(new Date("2026-11-19T15:00:00Z"));
  const oneOff = await startEmptyWorkout(db);
  await addExerciseToSession(db, oneOff, BENCH);
  await updateSet(db, oneOff, 0, 0, { done: true });
  expect(await finishWorkout(db, oneOff)).toBe("finished");
  // Thursday: Upper A (done Wednesday) covers Monday; the one-off covers nothing.
  const { plan } = await loadTodayState(db);
  expect(plan.today).toEqual({ workoutId: "seed-workout-upper-b", status: "todo" });
  expect(plan.missed).toEqual([{ workoutId: LOWER_A, date: "2026-11-17" }]);
});

test("an added exercise gets one set pre-filled from history", async () => {
  const upper = await startWorkout(db, UPPER_A);
  await updateSet(db, upper, 0, 0, { weight: 65, amount: 10, done: true });
  await finishWorkout(db, upper);
  const oneOff = await startEmptyWorkout(db);
  await addExerciseToSession(db, oneOff, BENCH);
  expect((await session(oneOff)).entries).toEqual([{ exerciseId: BENCH, planned: { sets: 1, targetMin: 0 }, sets: [{ weight: 65, amount: 10, done: false }] }]);
});

test("adding an exercise to a rotation session leaves the workout alone", async () => {
  const id = await startWorkout(db, LOWER_A);
  await addExerciseToSession(db, id, BENCH);
  expect((await session(id)).entries.at(-1)?.exerciseId).toBe(BENCH);
  expect((await db.workouts.get(LOWER_A))?.exercises.map((p) => p.exerciseId)).not.toContain(BENCH);
});

test("renameSession renames a one-off and refuses a blank name", async () => {
  const id = await startEmptyWorkout(db);
  await renameSession(db, id, "  Arms   day ");
  expect((await session(id)).workoutName).toBe("Arms day");
  await expect(renameSession(db, id, " ")).rejects.toThrow("Give the workout a name");
});

test("loadExercises lists live, unarchived exercises by name", async () => {
  const upper = await startWorkout(db, UPPER_A);
  await updateSet(db, upper, 0, 0, { done: true });
  await finishWorkout(db, upper);
  await deleteExercise(db, BENCH); // archived: has history
  await deleteExercise(db, seedExerciseId("Lat Pulldown")); // in a finished session? no: only bench was kept → deleted
  const names = (await loadExercises(db)).map((e) => e.name);
  expect(names).not.toContain("Barbell Bench Press");
  expect(names).not.toContain("Lat Pulldown");
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  expect(names.length).toBeGreaterThan(10);
});
