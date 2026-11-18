// Runs with TZ=America/New_York (set in vite.config.ts).
import { EPOCH, nowIso, todayLocal } from "../../src/logic/clock";

test("tests run behind UTC, so the midnight case is real", () => {
  expect(new Date("2026-11-19T02:30:00Z").getTimezoneOffset()).toBe(300);
});

test("todayLocal uses local date, not UTC", () => {
  // 9:30 pm on Nov 18 in New York is already Nov 19 in UTC.
  expect(todayLocal(new Date("2026-11-19T02:30:00Z"))).toBe("2026-11-18");
});

test("todayLocal pads month and day", () => {
  expect(todayLocal(new Date(2026, 0, 5, 12))).toBe("2026-01-05");
});

test("EPOCH is the Unix epoch in ISO form", () => {
  expect(EPOCH).toBe("1970-01-01T00:00:00.000Z");
});

test("nowIso returns the current time as an ISO string", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-18T15:00:00Z"));
  expect(nowIso()).toBe("2026-11-18T15:00:00.000Z");
  vi.useRealTimers();
});
