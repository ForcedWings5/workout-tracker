import { describeSet, shortSet, formatElapsed, formatTarget, holdPercent, setLabel, targetHint } from "../../src/logic/format";

test("formatTarget", () => {
  expect(formatTarget({ sets: 4, targetMin: 6, targetMax: 10 }, "reps")).toBe("4 × 6–10");
  expect(formatTarget({ sets: 2, targetMin: 45 }, "seconds")).toBe("2 × 45 sec");
  expect(formatTarget({ sets: 2, targetMin: 8, targetMax: 12, label: "per leg" }, "reps")).toBe("2 × 8–12 per leg");
});

test("setLabel names the values and the state", () => {
  expect(setLabel(2, { weight: 85, amount: 8, done: false }, "reps")).toBe("Set 3: 85 lb, 8 reps, not done");
  expect(setLabel(0, { weight: 65, amount: 10, done: true }, "reps")).toBe("Set 1: 65 lb, 10 reps, done");
  expect(setLabel(0, { amount: 45, done: false, skipped: true }, "seconds")).toBe("Set 1: bodyweight, 45 sec, skipped");
  expect(setLabel(1, { done: false }, "reps")).toBe("Set 2: bodyweight, no reps, not done");
});

test("formatElapsed", () => {
  expect(formatElapsed(0)).toBe("0:00");
  expect(formatElapsed(32 * 60 + 14)).toBe("32:14");
  expect(formatElapsed(3600 + 2 * 60 + 3)).toBe("1:02:03");
});

test("holdPercent is proportional to the seconds held, capped at the target", () => {
  expect(holdPercent(30, { targetMin: 45 })).toBeCloseTo(66.67, 1);
  expect(holdPercent(45, { targetMin: 45 })).toBe(100);
  expect(holdPercent(90, { targetMin: 45 })).toBe(100);
  expect(holdPercent(undefined, { targetMin: 45 })).toBe(0);
  expect(holdPercent(30, { targetMin: 30, targetMax: 60 })).toBe(50);
});

test("an exercise added mid-session has no target to show", () => {
  expect(formatTarget({ sets: 1, targetMin: 0 }, "reps")).toBe("");
  expect(targetHint({ targetMin: 0 })).toBeUndefined();
});

test("targetHint is the range a blank set shows", () => {
  expect(targetHint({ targetMin: 6, targetMax: 10 })).toBe("6–10");
  expect(targetHint({ targetMin: 45 })).toBe("45");
});

test("describeSet reads like the row", () => {
  expect(describeSet({ weight: 135, amount: 8, done: true }, "reps")).toBe("135 lb × 8 reps");
  expect(describeSet({ amount: 8, done: false }, "reps")).toBe("Bodyweight × 8 reps");
  expect(describeSet({ weight: 20, amount: 45, done: false }, "seconds")).toBe("20 lb × 45 sec");
  expect(describeSet({ weight: 135, done: false }, "reps")).toBe("135 lb");
  expect(describeSet({ done: false }, "reps")).toBe("Bodyweight");
});

test("shortSet is the compact form for history rows", () => {
  expect(shortSet({ weight: 65, amount: 10, done: true }, "reps")).toBe("65×10");
  expect(shortSet({ amount: 12, done: true }, "reps")).toBe("12");
  expect(shortSet({ amount: 45, done: true }, "seconds")).toBe("45s");
  expect(shortSet({ weight: 25, amount: 30, done: true }, "seconds")).toBe("25×30s");
  expect(shortSet({ weight: 135, done: true }, "reps")).toBe("135×–");
});
