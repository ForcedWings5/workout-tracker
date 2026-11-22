import { exercisesByRecency, isRecordSet, progressSeries } from "../../src/logic/progress";
import type { Exercise, LoggedSet } from "../../src/logic/types";
import { done, entry, session } from "./fixtures";

function exercise(id: string, measure: Exercise["measure"] = "reps", over: Partial<Exercise> = {}): Exercise {
  return { id, name: id, measure, archived: false, updatedAt: "2026-11-01T00:00:00.000Z", deleted: false, dirty: 0, ...over };
}

const bench = exercise("bench");
const benchHistory = [
  session({ date: "2026-11-12", entries: [entry("bench", [done(65, 10), done(75, 8), done(85, 8), done(95, 6)])] }),
  session({ date: "2026-11-05", entries: [entry("bench", [done(65, 10), done(75, 8), done(85, 6)])] }),
  session({ date: "2026-11-08", entries: [entry("bench", [done(65, 10), done(85, 8)])] }),
];

test("weight series for bench: one point per session, the heaviest done set, oldest first", () => {
  const { metric, points } = progressSeries(bench, benchHistory);
  expect(metric).toBe("weight");
  expect(points.map((p) => [p.date, p.value])).toEqual([
    ["2026-11-05", 85],
    ["2026-11-08", 85],
    ["2026-11-12", 95],
  ]);
  expect(points[2]).toMatchObject({ weight: 95, amount: 6 });
});

test("only done sets count", () => {
  const notDone: LoggedSet = { weight: 200, amount: 5, done: false };
  const { points } = progressSeries(bench, [session({ entries: [entry("bench", [done(65, 10), notDone])] })]);
  expect(points.map((p) => p.value)).toEqual([65]);
});

test("Toe Touches, never weighted, charts reps", () => {
  const toes = exercise("toes");
  const { metric, points } = progressSeries(toes, [
    session({ date: "2026-11-05", entries: [entry("toes", [done(undefined, 12), done(undefined, 15)])] }),
    session({ date: "2026-11-08", entries: [entry("toes", [done(undefined, 14)])] }),
  ]);
  expect(metric).toBe("reps");
  expect(points.map((p) => p.value)).toEqual([15, 14]);
});

test("a Plank held with 25 lb charts weight; unweighted sessions get no point", () => {
  const plank = exercise("plank", "seconds");
  const { metric, points } = progressSeries(plank, [
    session({ date: "2026-11-05", entries: [entry("plank", [done(undefined, 45)])] }),
    session({ date: "2026-11-08", entries: [entry("plank", [done(25, 30)])] }),
  ]);
  expect(metric).toBe("weight");
  expect(points.map((p) => [p.date, p.value])).toEqual([["2026-11-08", 25]]);
});

test("an unweighted Plank charts seconds", () => {
  const plank = exercise("plank", "seconds");
  const { metric, points } = progressSeries(plank, [session({ entries: [entry("plank", [done(undefined, 45), done(undefined, 50)])] })]);
  expect(metric).toBe("seconds");
  expect(points.map((p) => p.value)).toEqual([50]);
});

test("the record flag is set only on strict increases, never on the first point", () => {
  const { points } = progressSeries(bench, benchHistory);
  expect(points.map((p) => p.isRecord)).toEqual([false, false, true]);
});

test("isRecordSet is false with no history", () => {
  expect(isRecordSet(bench, done(300, 1), [])).toBe(false);
});

test("isRecordSet is true only for a done set that beats every earlier one", () => {
  expect(isRecordSet(bench, done(100, 3), benchHistory)).toBe(true);
  expect(isRecordSet(bench, done(95, 10), benchHistory)).toBe(false);
  expect(isRecordSet(bench, { weight: 100, amount: 3, done: false }, benchHistory)).toBe(false);
  expect(isRecordSet(bench, done(undefined, 30), benchHistory)).toBe(false);
});

test("deleted and in-progress sessions are excluded", () => {
  const { points } = progressSeries(bench, [
    ...benchHistory,
    session({ date: "2026-11-15", deleted: true, entries: [entry("bench", [done(200, 1)])] }),
    session({ date: "2026-11-16", status: "in_progress", entries: [entry("bench", [done(210, 1)])] }),
  ]);
  expect(points.map((p) => p.value)).toEqual([85, 85, 95]);
});

test("exercises are ordered by when they were last done; never-done ones are left out", () => {
  const squat = exercise("squat");
  const curl = exercise("curl");
  const fly = exercise("fly");
  const list = exercisesByRecency(
    [bench, squat, curl, fly],
    [
      session({ date: "2026-11-05", entries: [entry("bench", [done(65, 10)]), entry("squat", [done(135, 5)])] }),
      session({ date: "2026-11-09", entries: [entry("squat", [done(140, 5)])] }),
      session({ date: "2026-11-10", entries: [entry("fly", [{ weight: 20, amount: 10, done: false }])] }),
      session({ date: "2026-11-11", status: "in_progress", entries: [entry("curl", [done(30, 10)])] }),
    ],
  );
  expect(list).toEqual([
    { exercise: squat, lastDate: "2026-11-09" },
    { exercise: bench, lastDate: "2026-11-05" },
  ]);
});
