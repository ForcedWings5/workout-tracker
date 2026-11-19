import { parseNumberInput, splitWorkoutName } from "../../src/logic/input";
import { newId } from "../../src/logic/ids";

test.each([
  ["42.5", 42.5],
  ["42,5", 42.5],
  [" 10 ", 10],
  ["", undefined],
  ["   ", undefined],
  ["abc", undefined],
  ["12abc", undefined],
  ["-5", undefined],
  ["0", 0],
  ["Infinity", undefined],
])("parseNumberInput(%j)", (raw, out) => {
  expect(parseNumberInput(raw)).toBe(out);
});

test("splitWorkoutName", () => {
  expect(splitWorkoutName("Upper A: Horizontal Push & Pull")).toEqual({
    title: "Upper A",
    subtitle: "Horizontal Push & Pull",
  });
  expect(splitWorkoutName("Workout")).toEqual({ title: "Workout" });
});

test("newId returns distinct ids", () => {
  expect(newId()).not.toBe(newId());
});
