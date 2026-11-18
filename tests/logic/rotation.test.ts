import { nextUp } from "../../src/logic/rotation";
import { session } from "./fixtures";

const ROT = ["A", "B", "C", "D"];

test("no history → the first workout", () => {
  expect(nextUp(ROT, [])).toBe("A");
});

test("after A → B", () => {
  expect(nextUp(ROT, [session({ workoutId: "A" })])).toBe("B");
});

test("after the last → wraps to the first", () => {
  expect(nextUp(ROT, [session({ workoutId: "C", date: "2026-11-01" }), session({ workoutId: "D", date: "2026-11-03" })])).toBe("A");
});

test("uses the latest finished session by date, not array order", () => {
  expect(nextUp(ROT, [session({ workoutId: "C", date: "2026-11-12" }), session({ workoutId: "A", date: "2026-11-10" })])).toBe("D");
});

test("one-off sessions (no workoutId) are ignored", () => {
  expect(nextUp(ROT, [session({ workoutId: "A", date: "2026-11-10" }), session({ workoutId: undefined, date: "2026-11-12" })])).toBe("B");
});

test("in-progress and deleted sessions are ignored", () => {
  const sessions = [
    session({ workoutId: "A", date: "2026-11-10" }),
    session({ workoutId: "B", date: "2026-11-12", status: "in_progress" }),
    session({ workoutId: "C", date: "2026-11-13", deleted: true }),
  ];
  expect(nextUp(ROT, sessions)).toBe("B");
});

test("the latest finished workout is no longer in the rotation → the first", () => {
  expect(nextUp(ROT, [session({ workoutId: "A", date: "2026-11-10" }), session({ workoutId: "gone", date: "2026-11-12" })])).toBe("A");
});

test("empty rotation → undefined", () => {
  expect(nextUp([], [session({ workoutId: "A" })])).toBeUndefined();
});

test("two sessions on the same date → the later updatedAt wins", () => {
  const sessions = [
    session({ workoutId: "B", date: "2026-11-10", updatedAt: "2026-11-10T18:00:00.000Z" }),
    session({ workoutId: "A", date: "2026-11-10", updatedAt: "2026-11-10T09:00:00.000Z" }),
  ];
  expect(nextUp(ROT, sessions)).toBe("C");
});
