import { parseBackup } from "../../src/logic/backup";

const valid = {
  version: 2,
  exportedAt: "2026-11-22T15:00:00.000Z",
  exercises: [{ id: "e1", name: "Bench", measure: "reps", archived: false, updatedAt: "x", deleted: false, dirty: 0 }],
  workouts: [{ id: "w1", name: "Upper A", exercises: [], updatedAt: "x", deleted: false, dirty: 0 }],
  schedule: [{ id: "schedule", days: ["w1", null, null, null, null, null, null], updatedAt: "x", deleted: false, dirty: 0 }],
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
  expect(parseBackup(JSON.stringify({ ...valid, version: 3 }))).toEqual({ ok: false, error: "This backup is from a newer version of the app." });
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

test("a version 1 backup's rotation becomes the weekly schedule", () => {
  const { schedule: _, ...rest } = valid;
  const workouts = ["w1", "w2", "w3", "w4"].map((id) => ({ ...valid.workouts[0], id }));
  const v1 = { ...rest, version: 1, workouts, rotation: [{ id: "rotation", workoutIds: ["w1", "w2", "w3", "w4"], updatedAt: "2026-11-01T00:00:00.000Z", deleted: false, dirty: 1 }] };
  const result = parseBackup(JSON.stringify(v1));
  if (!result.ok) throw new Error(result.error);
  expect(result.backup.version).toBe(2);
  expect(result.backup.schedule).toEqual([
    { id: "schedule", days: ["w1", "w2", null, "w3", "w4", null, null], updatedAt: "2026-11-01T00:00:00.000Z", deleted: false, dirty: 1 },
  ]);
  expect("rotation" in result.backup).toBe(false);
});

test("a schedule that isn't seven days of workouts or rest is refused", () => {
  const row = valid.schedule[0];
  expect(parseBackup(JSON.stringify({ ...valid, schedule: [{ ...row, days: [null, null, null, null, null, null] }] }))).toEqual(DAMAGED);
  expect(parseBackup(JSON.stringify({ ...valid, schedule: [{ ...row, days: [1, null, null, null, null, null, null] }] }))).toEqual(DAMAGED);
});
