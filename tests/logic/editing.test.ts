import { cleanName, findExerciseByName, moveItem, normalizeName } from "../../src/logic/editing";
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
