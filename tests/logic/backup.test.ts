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
