import { formatElapsed, formatTarget, holdPercent, setLabel } from "../../src/logic/format";

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
