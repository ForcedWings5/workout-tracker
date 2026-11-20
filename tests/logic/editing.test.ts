import { cleanName, findExerciseByName, moveItem, normalizeName, setPlannedNumber } from "../../src/logic/editing";
import type { Exercise } from "../../src/logic/types";

const ex = (id: string, name: string): Exercise => ({
  id,
  name,
  measure: "reps",
  archived: false,
  updatedAt: "1970-01-01T00:00:00.000Z",
  deleted: false,
  dirty: 0,
});

test("normalizeName trims, collapses spaces and lowercases", () => {
  expect(normalizeName("  Bench   Press ")).toBe("bench press");
  expect(normalizeName("EZ-Bar Curl")).toBe("ez-bar curl");
});

test("cleanName trims and collapses spaces but keeps case", () => {
  expect(cleanName("  Face   Pull ")).toBe("Face Pull");
});

test("findExerciseByName ignores case and extra spaces", () => {
  const list = [ex("a", "Barbell Bench Press"), ex("b", "Lat Pulldown")];
  expect(findExerciseByName(list, "lat  pulldown ")?.id).toBe("b");
  expect(findExerciseByName(list, "Pulldown")).toBeUndefined();
});

test("moveItem moves up and down", () => {
  expect(moveItem(["a", "b", "c"], 1, 0)).toEqual(["b", "a", "c"]);
  expect(moveItem(["a", "b", "c"], 1, 2)).toEqual(["a", "c", "b"]);
});

test("moveItem at the edges returns the list unchanged", () => {
  const list = ["a", "b", "c"];
  expect(moveItem(list, 0, -1)).toEqual(["a", "b", "c"]);
  expect(moveItem(list, 2, 3)).toEqual(["a", "b", "c"]);
});

test("moveItem never changes the list it was given", () => {
  const list = ["a", "b", "c"];
  moveItem(list, 0, 1);
  expect(list).toEqual(["a", "b", "c"]);
});

describe("setPlannedNumber", () => {
  const bench = { exerciseId: "x", sets: 4, targetMin: 6, targetMax: 10 };

  test("sets takes a whole number of at least 1", () => {
    expect(setPlannedNumber(bench, "sets", "5")).toEqual({ ...bench, sets: 5 });
    expect(setPlannedNumber(bench, "sets", "0")).toBe("At least 1 set");
    expect(setPlannedNumber(bench, "sets", "")).toBe("At least 1 set");
    expect(setPlannedNumber(bench, "sets", "3.6")).toEqual({ ...bench, sets: 4 });
  });

  test("targetMin needs a number", () => {
    expect(setPlannedNumber(bench, "targetMin", "8")).toEqual({ ...bench, targetMin: 8 });
    expect(setPlannedNumber(bench, "targetMin", "")).toBe("Enter a number");
    expect(setPlannedNumber(bench, "targetMin", "abc")).toBe("Enter a number");
  });

  test("a blank targetMax makes a fixed target", () => {
    expect(setPlannedNumber(bench, "targetMax", "")).toEqual({ exerciseId: "x", sets: 4, targetMin: 6 });
    expect(setPlannedNumber(bench, "targetMax", "12")).toEqual({ ...bench, targetMax: 12 });
    expect(setPlannedNumber(bench, "targetMax", "x")).toBe("Enter a number");
  });

  test("a min and max that cross save nothing, so a typo never changes the other field", () => {
    expect(setPlannedNumber(bench, "targetMax", "6")).toBe("Max must be above min");
    expect(setPlannedNumber(bench, "targetMin", "60")).toBe("Min must be below max");
    expect(setPlannedNumber({ exerciseId: "x", sets: 2, targetMin: 45 }, "targetMin", "60")).toEqual({ exerciseId: "x", sets: 2, targetMin: 60 });
  });
});
