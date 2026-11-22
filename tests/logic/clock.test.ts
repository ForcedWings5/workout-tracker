// Runs with TZ=America/New_York (set in vite.config.ts).
import { EPOCH, isLocalDate, nowIso, shortDate, todayLocal } from "../../src/logic/clock";

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

test("shortDate shows month/day without leading zeros", () => {
  expect(shortDate("2026-11-12")).toBe("11/12");
  expect(shortDate("2026-01-05")).toBe("1/5");
});

test("isLocalDate accepts only real YYYY-MM-DD dates", () => {
  expect(isLocalDate("2026-11-13")).toBe(true);
  expect(isLocalDate("2028-02-29")).toBe(true);
  expect(isLocalDate("2026-02-29")).toBe(false);
  expect(isLocalDate("2026-13-40")).toBe(false);
  expect(isLocalDate("")).toBe(false);
  expect(isLocalDate("11/13/2026")).toBe(false);
});
