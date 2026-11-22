import { createDb, type WorkoutDB } from "../../src/storage/db";
import { seedIfEmpty, seedExerciseId } from "../../src/storage/seed";
import {
  addSet,
  discardWorkout,
  finishWorkout,
  loadLogState,
  loadTodayState,
  setNote,
  skipOrRemoveSet,
  startWorkout,
  toggleSetDone,
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

async function sessionRow(id: string) {
  const s = await db.sessions.get(id);
  if (!s) throw new Error("missing session");
  return s;
}

test("with no history on a Wednesday, it's a rest day with Upper B next and nothing in progress", async () => {
  const state = await loadTodayState(db);
  expect(state.plan.today).toBeUndefined();
  expect(state.plan.next).toEqual({ workoutId: "seed-workout-upper-b", date: "2026-11-19" });
  expect(state.plan.missed.map((m) => m.workoutId)).toEqual([UPPER_A, LOWER_A]);
  expect(state.inProgress).toBeUndefined();
  expect(state.workouts.map((w) => w.id)).toEqual([UPPER_A, LOWER_A, "seed-workout-upper-b", "seed-workout-lower-b"]);
  expect(state.lastDateByWorkout).toEqual({});
});

test("startWorkout creates an in-progress session dated today", async () => {
  const id = await startWorkout(db, UPPER_A);
  const state = await loadTodayState(db);
  expect(state.inProgress?.id).toBe(id);
  expect(state.inProgress).toMatchObject({ workoutId: UPPER_A, date: "2026-11-18", status: "in_progress", dirty: 1 });
  expect(state.inProgress?.entries[0].exerciseId).toBe(seedExerciseId("Barbell Bench Press"));
});

test("a second startWorkout throws", async () => {
  await startWorkout(db, UPPER_A);
  await expect(startWorkout(db, LOWER_A)).rejects.toThrow("A workout is already in progress");
});

test("updateSet writes immediately and doesn't mark the set done", async () => {
  const id = await startWorkout(db, UPPER_A);
  await db.sessions.update(id, { dirty: 0 });
  await updateSet(db, id, 0, 0, { weight: 70 });
  const s = await sessionRow(id);
  expect(s.entries[0].sets[0]).toEqual({ weight: 70, done: false });
  expect(s.dirty).toBe(1);
});

test("updateSet can mark done and clear a weight", async () => {
  const id = await startWorkout(db, UPPER_A);
  await updateSet(db, id, 0, 0, { weight: 70, amount: 10 });
  await updateSet(db, id, 0, 0, { done: true, weight: undefined });
  expect((await sessionRow(id)).entries[0].sets[0]).toEqual({ amount: 10, done: true });
});

test("addSet adds a set to the entry", async () => {
  const id = await startWorkout(db, UPPER_A);
  await addSet(db, id, 0);
  expect((await sessionRow(id)).entries[0].sets).toHaveLength(5);
});

test("addSet pre-fills from last time's final set", async () => {
  const first = await startWorkout(db, UPPER_A);
  await updateSet(db, first, 0, 0, { weight: 65, amount: 10, done: true });
  await updateSet(db, first, 0, 1, { weight: 75, amount: 8, done: true });
  await finishWorkout(db, first);
  const second = await startWorkout(db, UPPER_A);
  await addSet(db, second, 0);
  expect((await sessionRow(second)).entries[0].sets[4]).toEqual({ weight: 75, amount: 8, done: false });
});

test("skipOrRemoveSet toggles skipped on a pre-filled set", async () => {
  const id = await startWorkout(db, UPPER_A);
  await updateSet(db, id, 0, 0, { weight: 65, amount: 10 });
  await skipOrRemoveSet(db, id, 0, 0);
  expect((await sessionRow(id)).entries[0].sets[0]).toMatchObject({ skipped: true, done: false });
  await skipOrRemoveSet(db, id, 0, 0);
  expect((await sessionRow(id)).entries[0].sets[0].skipped).toBe(false);
});

test("setNote stores the note and a blank note clears it", async () => {
  const id = await startWorkout(db, UPPER_A);
  await setNote(db, id, 0, "form shaky");
  expect((await sessionRow(id)).entries[0].note).toBe("form shaky");
  await setNote(db, id, 0, "  ");
  expect((await sessionRow(id)).entries[0].note).toBeUndefined();
});

test("finishWorkout with zero done sets returns empty and writes nothing", async () => {
  const id = await startWorkout(db, UPPER_A);
  const before = await sessionRow(id);
  expect(await finishWorkout(db, id)).toBe("empty");
  expect(await sessionRow(id)).toEqual(before);
});

test("finishing Upper A on Wednesday catches up Monday", async () => {
  const id = await startWorkout(db, UPPER_A);
  await updateSet(db, id, 0, 0, { weight: 65, amount: 10, done: true });
  expect(await finishWorkout(db, id)).toBe("finished");
  const state = await loadTodayState(db);
  expect(state.plan.missed).toEqual([{ workoutId: LOWER_A, date: "2026-11-17" }]);
  expect(state.inProgress).toBeUndefined();
  expect(state.lastDateByWorkout[UPPER_A]).toBe("2026-11-18");
  const saved = await sessionRow(id);
  expect(saved.status).toBe("finished");
  expect(saved.entries).toHaveLength(1);
});

test("Review Focus 3: a session left open for days keeps its date and still counts for its week", async () => {
  vi.setSystemTime(new Date("2026-11-10T15:00:00Z"));
  const id = await startWorkout(db, UPPER_A);
  await updateSet(db, id, 0, 0, { weight: 65, amount: 10, done: true });
  vi.setSystemTime(new Date("2026-11-14T15:00:00Z"));
  const state = await loadTodayState(db);
  expect(state.inProgress?.id).toBe(id);
  await finishWorkout(db, id);
  expect((await sessionRow(id)).date).toBe("2026-11-10");
  expect((await loadTodayState(db)).plan.missed.map((m) => m.workoutId)).toEqual([LOWER_A, "seed-workout-upper-b", "seed-workout-lower-b"]);
});

test("discardWorkout tombstones the session", async () => {
  const id = await startWorkout(db, UPPER_A);
  await discardWorkout(db, id);
  expect((await loadTodayState(db)).inProgress).toBeUndefined();
  expect(await sessionRow(id)).toMatchObject({ deleted: true, dirty: 1 });
  await expect(startWorkout(db, UPPER_A)).resolves.toBeTypeOf("string");
});

test("loadLogState returns the session, exercise names and last notes", async () => {
  const first = await startWorkout(db, UPPER_A);
  await updateSet(db, first, 0, 0, { weight: 65, amount: 10, done: true });
  await setNote(db, first, 0, "form shaky last set");
  vi.setSystemTime(new Date("2026-11-20T15:00:00Z"));
  await finishWorkout(db, first);
  const second = await startWorkout(db, UPPER_A);
  const state = await loadLogState(db, second);
  const bench = seedExerciseId("Barbell Bench Press");
  expect(state.session?.id).toBe(second);
  expect(state.exercises[bench].name).toBe("Barbell Bench Press");
  expect(state.lastNotes[bench]).toEqual({ date: "2026-11-18", note: "form shaky last set" });
});

test("loadLogState for a missing or deleted session has no session", async () => {
  const id = await startWorkout(db, UPPER_A);
  await discardWorkout(db, id);
  expect((await loadLogState(db, id)).session).toBeUndefined();
});

test("skipOrRemoveSet skips a blank planned set instead of removing it", async () => {
  const id = await startWorkout(db, UPPER_A);
  await skipOrRemoveSet(db, id, 0, 0);
  const sets = (await sessionRow(id)).entries[0].sets;
  expect(sets).toHaveLength(4);
  expect(sets[0]).toMatchObject({ skipped: true, done: false });
});

test("skipOrRemoveSet removes a blank set added beyond the plan", async () => {
  const id = await startWorkout(db, UPPER_A);
  await addSet(db, id, 0);
  await skipOrRemoveSet(db, id, 0, 4);
  expect((await sessionRow(id)).entries[0].sets).toHaveLength(4);
});

test("skipOrRemoveSet leaves a done set alone", async () => {
  const id = await startWorkout(db, UPPER_A);
  await updateSet(db, id, 0, 0, { weight: 65, amount: 10, done: true });
  await skipOrRemoveSet(db, id, 0, 0);
  expect((await sessionRow(id)).entries[0].sets[0]).toMatchObject({ done: true });
  expect((await sessionRow(id)).entries[0].sets[0].skipped).toBeFalsy();
});

test("toggleSetDone flips the stored value, so two quick taps cancel out", async () => {
  const id = await startWorkout(db, UPPER_A);
  await Promise.all([toggleSetDone(db, id, 0, 0), toggleSetDone(db, id, 0, 0)]);
  expect((await sessionRow(id)).entries[0].sets[0].done).toBe(false);
  expect(await toggleSetDone(db, id, 0, 0)).toBe(true);
});

test("toggleSetDone on a skipped set restores and confirms it", async () => {
  const id = await startWorkout(db, UPPER_A);
  await updateSet(db, id, 0, 0, { weight: 65, amount: 10 });
  await skipOrRemoveSet(db, id, 0, 0);
  await toggleSetDone(db, id, 0, 0);
  expect((await sessionRow(id)).entries[0].sets[0]).toMatchObject({ done: true, skipped: false });
});

test("a finished session refuses set and note edits, so history isn't rewritten", async () => {
  const id = await startWorkout(db, UPPER_A);
  await updateSet(db, id, 0, 0, { weight: 65, amount: 10, done: true });
  await finishWorkout(db, id);
  const before = await sessionRow(id);
  await expect(updateSet(db, id, 0, 0, { weight: 999 })).rejects.toThrow("This workout is already finished");
  await expect(toggleSetDone(db, id, 0, 0)).rejects.toThrow("This workout is already finished");
  await expect(addSet(db, id, 0)).rejects.toThrow("This workout is already finished");
  await expect(setNote(db, id, 0, "late")).rejects.toThrow("This workout is already finished");
  await expect(skipOrRemoveSet(db, id, 0, 0)).rejects.toThrow("This workout is already finished");
  expect(await sessionRow(id)).toEqual(before);
});
