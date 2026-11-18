import { lastNoteFor, prefillSets, startSession } from "../../src/logic/session";
import type { Workout } from "../../src/logic/types";
import { done, entry, session } from "./fixtures";

const LAT = "lat";

describe("prefillSets", () => {
  test("prefers the same workout over a more recent other workout", () => {
    const history = [
      session({ workoutId: "upperA", date: "2026-11-10", entries: [entry(LAT, [done(70, 12), done(70, 12)])] }),
      session({ workoutId: "upperB", date: "2026-11-12", entries: [entry(LAT, [done(80, 10), done(80, 10)])] }),
    ];
    expect(prefillSets(LAT, "upperA", 2, history)).toEqual([
      { weight: 70, amount: 12, done: false },
      { weight: 70, amount: 12, done: false },
    ]);
  });

  test("falls back to the most recent other workout when the same one has none", () => {
    const history = [
      session({ workoutId: "upperB", date: "2026-11-08", entries: [entry(LAT, [done(75, 10)])] }),
      session({ workoutId: "upperB", date: "2026-11-12", entries: [entry(LAT, [done(80, 10)])] }),
      session({ workoutId: "upperA", date: "2026-11-14", entries: [entry("bench", [done(95, 6)])] }),
    ];
    expect(prefillSets(LAT, "upperA", 1, history)).toEqual([{ weight: 80, amount: 10, done: false }]);
  });

  test("copies by done-set index, skipping undone sets", () => {
    const history = [
      session({
        entries: [entry(LAT, [done(60, 12), { weight: 99, amount: 1, done: false }, done(65, 10)])],
      }),
    ];
    expect(prefillSets(LAT, "A", 2, history)).toEqual([
      { weight: 60, amount: 12, done: false },
      { weight: 65, amount: 10, done: false },
    ]);
  });

  test("sets beyond the source's count copy its last done set", () => {
    const history = [session({ entries: [entry(LAT, [done(65, 10), done(75, 8), done(85, 8)])] })];
    expect(prefillSets(LAT, "A", 4, history)[3]).toEqual({ weight: 85, amount: 8, done: false });
  });

  test("bodyweight sets copy a blank weight", () => {
    const history = [session({ entries: [entry("toe", [done(undefined, 15)])] })];
    expect(prefillSets("toe", "A", 1, history)).toEqual([{ weight: undefined, amount: 15, done: false }]);
  });

  test("no history → blank sets", () => {
    expect(prefillSets(LAT, "A", 3, [])).toEqual([{ done: false }, { done: false }, { done: false }]);
  });

  test("deleted and in-progress sessions are never a source", () => {
    const history = [
      session({ date: "2026-11-01", entries: [entry(LAT, [done(50, 10)])] }),
      session({ date: "2026-11-12", deleted: true, entries: [entry(LAT, [done(90, 10)])] }),
      session({ date: "2026-11-13", status: "in_progress", entries: [entry(LAT, [done(95, 10)])] }),
    ];
    expect(prefillSets(LAT, "A", 1, history)).toEqual([{ weight: 50, amount: 10, done: false }]);
  });

  test("an entry with no done sets is not a source", () => {
    const history = [
      session({ date: "2026-11-01", entries: [entry(LAT, [done(50, 10)])] }),
      session({ date: "2026-11-12", entries: [entry(LAT, [{ weight: 90, amount: 10, done: false }])] }),
    ];
    expect(prefillSets(LAT, "A", 1, history)).toEqual([{ weight: 50, amount: 10, done: false }]);
  });
});

describe("startSession", () => {
  const workout: Workout = {
    id: "upperA",
    name: "Upper A: Horizontal Push & Pull",
    exercises: [
      { exerciseId: "bench", sets: 4, targetMin: 6, targetMax: 10 },
      { exerciseId: "split", sets: 2, targetMin: 8, targetMax: 12, label: "per leg" },
    ],
    updatedAt: "x",
    dirty: 0,
    deleted: false,
  };

  test("snapshots planned targets and the workout name", () => {
    const s = startSession(workout, [], "2026-11-18");
    expect(s).toMatchObject({ workoutId: "upperA", workoutName: "Upper A: Horizontal Push & Pull", date: "2026-11-18", status: "in_progress" });
    expect(typeof s.id).toBe("string");
    expect(s.entries.map((e) => e.planned)).toEqual([
      { sets: 4, targetMin: 6, targetMax: 10 },
      { sets: 2, targetMin: 8, targetMax: 12, label: "per leg" },
    ]);
    expect(s.entries[0].sets).toHaveLength(4);
    expect(s.entries[0].exerciseId).toBe("bench");
  });

  test("the snapshot doesn't share objects with the workout", () => {
    const s = startSession(workout, [], "2026-11-18");
    s.entries[0].planned.sets = 9;
    expect(workout.exercises[0].sets).toBe(4);
  });

  test("entries are pre-filled from history", () => {
    const history = [session({ workoutId: "upperA", entries: [entry("bench", [done(65, 10)])] })];
    expect(startSession(workout, history, "2026-11-18").entries[0].sets[0]).toEqual({ weight: 65, amount: 10, done: false });
  });
});

describe("lastNoteFor", () => {
  test("returns the newest non-empty note from any finished session, with its date", () => {
    const history = [
      session({ date: "2026-11-05", workoutId: "B", entries: [entry(LAT, [done(70, 10)], { note: "old note" })] }),
      session({ date: "2026-11-12", workoutId: "A", entries: [entry(LAT, [done(70, 10)], { note: "form shaky last set" })] }),
      session({ date: "2026-11-14", entries: [entry(LAT, [done(70, 10)], { note: "   " })] }),
      session({ date: "2026-11-15", status: "in_progress", entries: [entry(LAT, [done(70, 10)], { note: "not yet" })] }),
      session({ date: "2026-11-16", deleted: true, entries: [entry(LAT, [done(70, 10)], { note: "deleted" })] }),
    ];
    expect(lastNoteFor(LAT, history)).toEqual({ date: "2026-11-12", note: "form shaky last set" });
  });

  test("undefined when there is no note", () => {
    expect(lastNoteFor(LAT, [session({ entries: [entry(LAT, [done(70, 10)])] })])).toBeUndefined();
  });
});
