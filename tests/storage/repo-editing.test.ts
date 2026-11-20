import { createDb, type WorkoutDB } from "../../src/storage/db";
import { seedExerciseId, seedIfEmpty } from "../../src/storage/seed";
import {
  createWorkout,
  deleteExercise,
  deleteWorkout,
  finishWorkout,
  getOrCreateExercise,
  loadEditWorkout,
  loadWorkoutList,
  patchWorkout,
  setExerciseMeasure,
  loadTodayState,
  renameExercise,
  saveWorkout,
  setRotation,
  startWorkout,
  updateSet,
} from "../../src/storage/repo";

let db: WorkoutDB;

beforeEach(async () => {
  db = createDb(crypto.randomUUID());
  await seedIfEmpty(db);
});
afterEach(() => db.close());

const UPPER_A = "seed-workout-upper-a";
const LOWER_A = "seed-workout-lower-a";
const BENCH = seedExerciseId("Barbell Bench Press");

async function workout(id: string) {
  const w = await db.workouts.get(id);
  if (!w) throw new Error("missing workout");
  return w;
}

async function rotationIds() {
  return (await db.rotation.get("rotation"))!.workoutIds;
}

test("Review Focus 5: a duplicate name reuses the existing exercise", async () => {
  const first = await getOrCreateExercise(db, "Bench Press", "reps");
  const count = await db.exercises.count();
  const second = await getOrCreateExercise(db, "bench  press ", "reps");
  expect(second.id).toBe(first.id);
  expect(await db.exercises.count()).toBe(count);
});

test("getOrCreateExercise creates a new dirty exercise with a trimmed name", async () => {
  const created = await getOrCreateExercise(db, "  Face Pull ", "reps");
  expect(await db.exercises.get(created.id)).toMatchObject({ name: "Face Pull", measure: "reps", archived: false, dirty: 1, deleted: false });
});

test("getOrCreateExercise brings back an archived exercise instead of splitting its history", async () => {
  await db.exercises.update(BENCH, { archived: true });
  const found = await getOrCreateExercise(db, "barbell bench press", "reps");
  expect(found.id).toBe(BENCH);
  expect((await db.exercises.get(BENCH))?.archived).toBe(false);
});

test("Review Focus 4: editing a workout mid-session leaves the session's targets alone", async () => {
  const id = await startWorkout(db, UPPER_A);
  const w = await workout(UPPER_A);
  await saveWorkout(db, { ...w, exercises: w.exercises.map((p, i) => (i === 0 ? { ...p, sets: 5, targetMin: 5, targetMax: 5 } : p)) });
  expect((await workout(UPPER_A)).exercises[0]).toMatchObject({ sets: 5, targetMin: 5, targetMax: 5 });
  const session = await db.sessions.get(id);
  expect(session?.entries[0].planned.sets).toBe(4);
  expect(session?.entries[0].sets).toHaveLength(4);
});

test("saveWorkout marks the workout dirty", async () => {
  await db.workouts.update(UPPER_A, { dirty: 0 });
  await saveWorkout(db, { ...(await workout(UPPER_A)), name: "Upper A: Push" });
  expect(await workout(UPPER_A)).toMatchObject({ name: "Upper A: Push", dirty: 1 });
});

test("createWorkout adds an empty workout to the end of the rotation", async () => {
  const id = await createWorkout(db, "Arms");
  expect(await workout(id)).toMatchObject({ name: "Arms", exercises: [], deleted: false, dirty: 1 });
  expect((await rotationIds()).at(-1)).toBe(id);
});

test("deleteWorkout tombstones it, takes it out of the rotation, and keeps past sessions' names", async () => {
  const sessionId = await startWorkout(db, UPPER_A);
  await updateSet(db, sessionId, 0, 0, { weight: 65, amount: 10, done: true });
  await finishWorkout(db, sessionId);
  await deleteWorkout(db, UPPER_A);
  expect(await workout(UPPER_A)).toMatchObject({ deleted: true, dirty: 1 });
  expect(await rotationIds()).not.toContain(UPPER_A);
  expect((await db.sessions.get(sessionId))?.workoutName).toBe("Upper A: Horizontal Push & Pull");
  expect((await loadTodayState(db)).workouts.map((w) => w.id)).not.toContain(UPPER_A);
});

test("setRotation stores the new order", async () => {
  await setRotation(db, [LOWER_A, UPPER_A, "seed-workout-upper-b", "seed-workout-lower-b"]);
  expect(await rotationIds()).toEqual([LOWER_A, UPPER_A, "seed-workout-upper-b", "seed-workout-lower-b"]);
  expect((await db.rotation.get("rotation"))?.dirty).toBe(1);
  expect((await loadTodayState(db)).nextUpId).toBe(LOWER_A);
});

test("renameExercise renames it everywhere, history included", async () => {
  await renameExercise(db, BENCH, "  Flat Bench ");
  expect((await db.exercises.get(BENCH))?.name).toBe("Flat Bench");
});

test("renameExercise refuses a blank name or one another exercise has", async () => {
  await expect(renameExercise(db, BENCH, "  ")).rejects.toThrow("Give the exercise a name");
  await expect(renameExercise(db, BENCH, "lat pulldown")).rejects.toThrow("Another exercise is already called that");
  await expect(renameExercise(db, BENCH, "barbell BENCH press")).resolves.toBeUndefined();
});

test("deleteExercise with history archives it and removes it from every plan", async () => {
  const sessionId = await startWorkout(db, UPPER_A);
  await updateSet(db, sessionId, 0, 0, { weight: 65, amount: 10, done: true });
  await finishWorkout(db, sessionId);
  expect(await deleteExercise(db, BENCH)).toBe("archived");
  expect(await db.exercises.get(BENCH)).toMatchObject({ archived: true, deleted: false, dirty: 1 });
  expect((await workout(UPPER_A)).exercises.map((p) => p.exerciseId)).not.toContain(BENCH);
  expect((await db.sessions.get(sessionId))?.entries[0].exerciseId).toBe(BENCH);
});

test("deleteExercise without history deletes it", async () => {
  expect(await deleteExercise(db, BENCH)).toBe("deleted");
  expect(await db.exercises.get(BENCH)).toMatchObject({ deleted: true, dirty: 1 });
  expect((await workout(UPPER_A)).exercises.map((p) => p.exerciseId)).not.toContain(BENCH);
});

test("deleteExercise counts an in-progress session as history", async () => {
  await startWorkout(db, UPPER_A);
  expect(await deleteExercise(db, BENCH)).toBe("archived");
});

test("patchWorkout edits the stored workout in one step", async () => {
  await patchWorkout(db, UPPER_A, (w) => {
    w.exercises[0].sets = 5;
  });
  await patchWorkout(db, UPPER_A, (w) => {
    w.name = "Upper A: Push";
  });
  expect(await workout(UPPER_A)).toMatchObject({ name: "Upper A: Push", dirty: 1 });
  expect((await workout(UPPER_A)).exercises[0].sets).toBe(5);
});

test("patchWorkout refuses a deleted workout", async () => {
  await deleteWorkout(db, UPPER_A);
  await expect(patchWorkout(db, UPPER_A, () => {})).rejects.toThrow("Workout not found");
});

test("setExerciseMeasure changes the exercise everywhere", async () => {
  await setExerciseMeasure(db, BENCH, "seconds");
  expect(await db.exercises.get(BENCH)).toMatchObject({ measure: "seconds", dirty: 1 });
});

test("loadWorkoutList gives workouts in rotation order with the rotation ids", async () => {
  await setRotation(db, [LOWER_A, UPPER_A, "seed-workout-upper-b", "seed-workout-lower-b"]);
  const list = await loadWorkoutList(db);
  expect(list.rotationIds[0]).toBe(LOWER_A);
  expect(list.workouts.map((w) => w.id).slice(0, 2)).toEqual([LOWER_A, UPPER_A]);
});

test("loadEditWorkout returns the workout and its exercises", async () => {
  const state = await loadEditWorkout(db, UPPER_A);
  expect(state.workout?.id).toBe(UPPER_A);
  expect(state.exercises[BENCH].name).toBe("Barbell Bench Press");
  await deleteWorkout(db, UPPER_A);
  expect((await loadEditWorkout(db, UPPER_A)).workout).toBeUndefined();
});
