import { EPOCH } from "../logic/clock";
import type { Exercise, Measure, PlannedExercise, Rotation, Workout } from "../logic/types";
import type { WorkoutDB } from "./db";

function kebab(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function seedExerciseId(name: string): string {
  return `seed-exercise-${kebab(name)}`;
}

export const SEED_WORKOUT_IDS = [
  "seed-workout-upper-a",
  "seed-workout-lower-a",
  "seed-workout-upper-b",
  "seed-workout-lower-b",
];

type SeedLine = { name: string; sets: number; min: number; max?: number; label?: string; measure?: Measure };

// The spec's Seed data section, in rotation order.
const SEED: { id: string; name: string; lines: SeedLine[] }[] = [
  {
    id: "seed-workout-upper-a",
    name: "Upper A: Horizontal Push & Pull",
    lines: [
      { name: "Barbell Bench Press", sets: 4, min: 6, max: 10 },
      { name: "Cable Row (Narrow Grip)", sets: 3, min: 8, max: 12 },
      { name: "Seated Dumbbell Shoulder Press", sets: 2, min: 8, max: 12 },
      { name: "Lat Pulldown", sets: 2, min: 10, max: 15 },
      { name: "Triceps Pushdown (Rope)", sets: 2, min: 10, max: 15 },
      { name: "EZ-Bar Curl", sets: 2, min: 10, max: 15 },
    ],
  },
  {
    id: "seed-workout-lower-a",
    name: "Lower A: Squat & Hamstrings",
    lines: [
      { name: "Barbell Squats", sets: 3, min: 6, max: 10 },
      { name: "Seated Leg Curl", sets: 3, min: 10, max: 15 },
      { name: "Leg Press", sets: 2, min: 10, max: 15 },
      { name: "Standing Calf Raise", sets: 3, min: 10, max: 15 },
      { name: "Plank", sets: 2, min: 45, measure: "seconds" },
    ],
  },
  {
    id: "seed-workout-upper-b",
    name: "Upper B: Vertical Pull & Incline Push",
    lines: [
      { name: "Lat Pulldown", sets: 3, min: 8, max: 12 },
      { name: "Incline Bench Dumbbell Press", sets: 4, min: 8, max: 12 },
      { name: "Cable Row (Wide Grip)", sets: 2, min: 10, max: 15 },
      { name: "Dumbbell Lateral Raise", sets: 3, min: 12, max: 20 },
      { name: "Overhead Cable Triceps Extension (Bar)", sets: 2, min: 10, max: 15 },
      { name: "Dumbbell Bicep Curl", sets: 2, min: 10, max: 15 },
    ],
  },
  {
    id: "seed-workout-lower-b",
    name: "Lower B: Hip Hinge & Single-Leg",
    lines: [
      { name: "Romanian Deadlift", sets: 3, min: 8, max: 12 },
      { name: "Bulgarian Split Squats (Dumbbell)", sets: 2, min: 8, max: 12, label: "per leg" },
      { name: "Leg Extension", sets: 2, min: 10, max: 15 },
      { name: "Seated Calf Raise", sets: 3, min: 12, max: 20 },
      { name: "Toe Touches", sets: 2, min: 12, max: 15 },
    ],
  },
];

const clean = { updatedAt: EPOCH, dirty: 0 as const, deleted: false };

/**
 * Writes the starter workouts on a fresh install. Seed rows are written
 * directly (not through save) with fixed ids, an epoch updatedAt and
 * dirty 0, so any real copy in the cloud always replaces them.
 */
export async function seedIfEmpty(db: WorkoutDB): Promise<void> {
  await db.transaction("rw", db.exercises, db.workouts, db.rotation, async () => {
    if ((await db.workouts.count()) > 0) return;

    const exercises = new Map<string, Exercise>();
    const workouts: Workout[] = SEED.map((w) => ({
      ...clean,
      id: w.id,
      name: w.name,
      exercises: w.lines.map((line): PlannedExercise => {
        const exerciseId = seedExerciseId(line.name);
        exercises.set(exerciseId, {
          ...clean,
          id: exerciseId,
          name: line.name,
          measure: line.measure ?? "reps",
          archived: false,
        });
        const planned: PlannedExercise = { exerciseId, sets: line.sets, targetMin: line.min };
        if (line.max !== undefined) planned.targetMax = line.max;
        if (line.label !== undefined) planned.label = line.label;
        return planned;
      }),
    }));
    const rotation: Rotation = { ...clean, id: "rotation", workoutIds: [...SEED_WORKOUT_IDS] };

    await db.exercises.bulkPut([...exercises.values()]);
    await db.workouts.bulkPut(workouts);
    await db.rotation.put(rotation);
  });
}
