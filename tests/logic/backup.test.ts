import { parseBackup } from "../../src/logic/backup";

const valid = {
  version: 1,
  exportedAt: "2026-11-22T15:00:00.000Z",
  exercises: [{ id: "e1", name: "Bench", measure: "reps", archived: false, updatedAt: "x", deleted: false, dirty: 0 }],
  workouts: [{ id: "w1", name: "Upper A", exercises: [], updatedAt: "x", deleted: false, dirty: 0 }],
  rotation: [{ id: "rotation", workoutIds: ["w1"], updatedAt: "x", deleted: false, dirty: 0 }],
  sessions: [{ id: "s1", workoutName: "Upper A", date: "2026-11-20", status: "finished", entries: [], updatedAt: "x", deleted: true, dirty: 0 }],
};

test("a valid backup parses", () => {
  const result = parseBackup(JSON.stringify(valid));
  expect(result).toEqual({ ok: true, backup: valid });
});

test("text that isn't JSON is refused", () => {
  expect(parseBackup("not json {")).toEqual({ ok: false, error: "This file isn't a Workout Tracker backup." });
});

test("JSON that isn't a backup is refused", () => {
  expect(parseBackup(JSON.stringify({ hello: "world" }))).toEqual({ ok: false, error: "This file isn't a Workout Tracker backup." });
  expect(parseBackup("[]")).toEqual({ ok: false, error: "This file isn't a Workout Tracker backup." });
  expect(parseBackup("null")).toEqual({ ok: false, error: "This file isn't a Workout Tracker backup." });
});

test("a backup from a newer app version is refused", () => {
  expect(parseBackup(JSON.stringify({ ...valid, version: 2 }))).toEqual({ ok: false, error: "This backup is from a newer version of the app." });
});

test("a backup missing its sessions is refused", () => {
  const { sessions: _, ...rest } = valid;
  expect(parseBackup(JSON.stringify(rest))).toEqual({ ok: false, error: "This file isn't a Workout Tracker backup." });
});

test("a backup with a damaged row is refused, so nothing half-imports", () => {
  const broken = { ...valid, sessions: [{ id: "s1", date: "2026-11-20" }] };
  expect(parseBackup(JSON.stringify(broken))).toEqual({ ok: false, error: "This backup file is damaged, so nothing was imported." });
  const noId = { ...valid, exercises: [{ name: "Bench", measure: "reps" }] };
  expect(parseBackup(JSON.stringify(noId))).toEqual({ ok: false, error: "This backup file is damaged, so nothing was imported." });
});

const DAMAGED = { ok: false, error: "This backup file is damaged, so nothing was imported." };
const session1 = valid.sessions[0];
const withEntry = (entry: unknown) => JSON.stringify({ ...valid, sessions: [{ ...session1, entries: [entry] }] });

test("Final: a session entry without its planned targets is refused", () => {
  expect(parseBackup(withEntry({ exerciseId: "e1", sets: [] }))).toEqual(DAMAGED);
  expect(parseBackup(withEntry({ exerciseId: "e1", planned: { sets: "3", targetMin: 8 }, sets: [] }))).toEqual(DAMAGED);
});

test("Final: a set that isn't a set is refused", () => {
  const planned = { sets: 3, targetMin: 8, targetMax: 12 };
  expect(parseBackup(withEntry({ exerciseId: "e1", planned, sets: [null] }))).toEqual(DAMAGED);
  expect(parseBackup(withEntry({ exerciseId: "e1", planned, sets: [{ weight: 65, amount: 10 }] }))).toEqual(DAMAGED);
  expect(parseBackup(withEntry({ exerciseId: "e1", planned, sets: [{ weight: "65", amount: 10, done: true }] }))).toEqual(DAMAGED);
  expect(parseBackup(withEntry({ exerciseId: "e1", planned, sets: [{ weight: 65, amount: 10, done: true }] })).ok).toBe(true);
});

test("Final: a workout's planned exercise must name its exercise and targets", () => {
  const workout = (exercises: unknown[]) => JSON.stringify({ ...valid, workouts: [{ ...valid.workouts[0], exercises }] });
  expect(parseBackup(workout([{ sets: 3, targetMin: 8 }]))).toEqual(DAMAGED);
  expect(parseBackup(workout([null]))).toEqual(DAMAGED);
  expect(parseBackup(workout([{ exerciseId: "e1", sets: 3, targetMin: 8, targetMax: 12 }])).ok).toBe(true);
});

test("Final: a backup without a real export date is refused", () => {
  expect(parseBackup(JSON.stringify({ ...valid, exportedAt: undefined }))).toEqual(DAMAGED);
  expect(parseBackup(JSON.stringify({ ...valid, exportedAt: "yesterday-ish" }))).toEqual(DAMAGED);
});
