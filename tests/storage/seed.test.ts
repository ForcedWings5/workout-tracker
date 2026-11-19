import { createDb, type WorkoutDB } from "../../src/storage/db";
import { SEED_WORKOUT_IDS, seedExerciseId, seedIfEmpty } from "../../src/storage/seed";
import { EPOCH } from "../../src/logic/clock";

let db: WorkoutDB;

beforeEach(() => {
  db = createDb(crypto.randomUUID());
});
afterEach(() => db.close());

test("seedExerciseId is a kebab-case fixed id", () => {
  expect(seedExerciseId("Cable Row (Narrow Grip)")).toBe("seed-exercise-cable-row-narrow-grip");
  expect(seedExerciseId("Barbell Bench Press")).toBe("seed-exercise-barbell-bench-press");
});

test("seeds four workouts in rotation order", async () => {
  await seedIfEmpty(db);
  expect(await db.workouts.count()).toBe(4);
  expect((await db.rotation.get("rotation"))?.workoutIds).toEqual(SEED_WORKOUT_IDS);
  expect(SEED_WORKOUT_IDS).toEqual([
    "seed-workout-upper-a",
    "seed-workout-lower-a",
    "seed-workout-upper-b",
    "seed-workout-lower-b",
  ]);
});

test("workout names and the first plan match the spec", async () => {
  await seedIfEmpty(db);
  const upperA = await db.workouts.get("seed-workout-upper-a");
  expect(upperA?.name).toBe("Upper A: Horizontal Push & Pull");
  expect(upperA?.exercises[0]).toEqual({
    exerciseId: "seed-exercise-barbell-bench-press",
    sets: 4,
    targetMin: 6,
    targetMax: 10,
  });
  expect(upperA?.exercises.map((e) => e.exerciseId)).toEqual([
    "seed-exercise-barbell-bench-press",
    "seed-exercise-cable-row-narrow-grip",
    "seed-exercise-seated-dumbbell-shoulder-press",
    "seed-exercise-lat-pulldown",
    "seed-exercise-triceps-pushdown-rope",
    "seed-exercise-ez-bar-curl",
  ]);
  expect((await db.workouts.get("seed-workout-lower-b"))?.name).toBe("Lower B: Hip Hinge & Single-Leg");
});

test("Lat Pulldown is shared; the two cable rows are separate", async () => {
  await seedIfEmpty(db);
  const upperA = await db.workouts.get("seed-workout-upper-a");
  const upperB = await db.workouts.get("seed-workout-upper-b");
  const lat = seedExerciseId("Lat Pulldown");
  expect(upperA?.exercises.find((e) => e.exerciseId === lat)).toMatchObject({ sets: 2, targetMin: 10, targetMax: 15 });
  expect(upperB?.exercises.find((e) => e.exerciseId === lat)).toMatchObject({ sets: 3, targetMin: 8, targetMax: 12 });
  expect(seedExerciseId("Cable Row (Narrow Grip)")).not.toBe(seedExerciseId("Cable Row (Wide Grip)"));
  expect(await db.exercises.get(seedExerciseId("Cable Row (Wide Grip)"))).toBeDefined();
});

test("Plank is 2 sets of 45 seconds; Bulgarian Split Squats are per leg; Toe Touches 2 × 12–15", async () => {
  await seedIfEmpty(db);
  const plankId = seedExerciseId("Plank");
  expect((await db.exercises.get(plankId))?.measure).toBe("seconds");
  const lowerA = await db.workouts.get("seed-workout-lower-a");
  const plank = lowerA?.exercises.find((e) => e.exerciseId === plankId);
  expect(plank).toEqual({ exerciseId: plankId, sets: 2, targetMin: 45 });
  const lowerB = await db.workouts.get("seed-workout-lower-b");
  expect(lowerB?.exercises.find((e) => e.exerciseId === seedExerciseId("Bulgarian Split Squats (Dumbbell)"))).toMatchObject({
    sets: 2,
    targetMin: 8,
    targetMax: 12,
    label: "per leg",
  });
  expect(lowerB?.exercises.find((e) => e.exerciseId === seedExerciseId("Toe Touches"))).toMatchObject({
    sets: 2,
    targetMin: 12,
    targetMax: 15,
  });
});

test("every seed row is clean and epoch-dated", async () => {
  await seedIfEmpty(db);
  const rows = [
    ...(await db.exercises.toArray()),
    ...(await db.workouts.toArray()),
    ...(await db.rotation.toArray()),
  ];
  expect(rows.length).toBeGreaterThan(0);
  for (const row of rows) {
    expect(row.updatedAt).toBe(EPOCH);
    expect(row.dirty).toBe(0);
    expect(row.deleted).toBe(false);
  }
  for (const ex of await db.exercises.toArray()) {
    expect(ex.archived).toBe(false);
    expect(ex.id.startsWith("seed-exercise-")).toBe(true);
  }
});

test("there are 21 exercises, and seeding twice changes nothing", async () => {
  await seedIfEmpty(db);
  expect(await db.exercises.count()).toBe(21);
  await seedIfEmpty(db);
  expect(await db.exercises.count()).toBe(21);
  expect(await db.workouts.count()).toBe(4);
});

test("does not seed when any workout already exists", async () => {
  await db.workouts.put({ id: "mine", name: "Mine", exercises: [], updatedAt: EPOCH, dirty: 1, deleted: false });
  await seedIfEmpty(db);
  expect(await db.workouts.count()).toBe(1);
  expect(await db.exercises.count()).toBe(0);
});
