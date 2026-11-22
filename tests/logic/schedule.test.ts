import { addDays, monthGrid, scheduleFromRotation, todayPlan, weekdayOf, weekStartOf, WEEKDAYS } from "../../src/logic/schedule";
import type { Session } from "../../src/logic/types";
import { done, entry, session } from "./fixtures";

// The owner's week. Monday is 2026-11-16.
const WEEK = ["UA", "LA", null, "UB", "LB", null, null];
const LIVE = ["UA", "LA", "UB", "LB"];
const did = (workoutId: string | undefined, date: string, over: Partial<Session> = {}) =>
  session({ workoutId, date, entries: [entry("x", [done(50, 10)])], ...over });

test("weekdays run Monday to Sunday", () => {
  expect(WEEKDAYS[0]).toBe("Monday");
  expect(WEEKDAYS[6]).toBe("Sunday");
  expect(weekdayOf("2026-11-16")).toBe(0);
  expect(weekdayOf("2026-11-22")).toBe(6);
  expect(weekdayOf("2028-02-29")).toBe(1);
});

test("addDays crosses months, years and the clock change", () => {
  expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
  expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  expect(addDays("2026-03-08", 1)).toBe("2026-03-09");
  expect(addDays("2026-11-16", -1)).toBe("2026-11-15");
});

test("the week starts on the Monday on or before a date", () => {
  expect(weekStartOf("2026-11-22")).toBe("2026-11-16");
  expect(weekStartOf("2026-11-16")).toBe("2026-11-16");
  expect(weekStartOf("2027-01-01")).toBe("2026-12-28");
});

test("a training day with nothing done", () => {
  expect(todayPlan(WEEK, LIVE, [], "2026-11-16")).toEqual({
    weekday: 0,
    today: { workoutId: "UA", status: "todo" },
    next: { workoutId: "LA", date: "2026-11-17" },
    missed: [],
  });
});

test("a rest day names the next workout", () => {
  const plan = todayPlan(WEEK, LIVE, [did("UA", "2026-11-16"), did("LA", "2026-11-17")], "2026-11-18");
  expect(plan.today).toBeUndefined();
  expect(plan.next).toEqual({ workoutId: "UB", date: "2026-11-19" });
  expect(plan.missed).toEqual([]);
});

test("Sunday's next workout wraps to Monday", () => {
  expect(todayPlan(WEEK, LIVE, [], "2026-11-22").next).toEqual({ workoutId: "UA", date: "2026-11-23" });
});

test("a workout finished today is done today", () => {
  expect(todayPlan(WEEK, LIVE, [did("UA", "2026-11-16")], "2026-11-16").today).toEqual({ workoutId: "UA", status: "doneToday" });
});

test("catching up later in the week clears the reminder", () => {
  const plan = todayPlan(WEEK, LIVE, [did("UA", "2026-11-17")], "2026-11-17");
  expect(plan.today).toEqual({ workoutId: "LA", status: "todo" });
  expect(plan.missed).toEqual([]);
});

test("missed workouts are listed earliest first", () => {
  expect(todayPlan(WEEK, LIVE, [], "2026-11-20").missed).toEqual([
    { workoutId: "UA", date: "2026-11-16" },
    { workoutId: "LA", date: "2026-11-17" },
    { workoutId: "UB", date: "2026-11-19" },
  ]);
});

test("a workout done earlier this week is done this week", () => {
  const plan = todayPlan(WEEK, LIVE, [did("LA", "2026-11-16")], "2026-11-17");
  expect(plan.today).toEqual({ workoutId: "LA", status: "doneThisWeek", doneOn: "2026-11-16" });
  expect(plan.missed).toEqual([{ workoutId: "UA", date: "2026-11-16" }]);
});

test("Monday starts fresh: nothing from last week is missed", () => {
  expect(todayPlan(WEEK, LIVE, [], "2026-11-23").missed).toEqual([]);
});

test("deleted, unfinished, one-off and future sessions don't count", () => {
  const sessions = [
    did("UA", "2026-11-16", { deleted: true }),
    did("UA", "2026-11-16", { status: "in_progress" }),
    did(undefined, "2026-11-16"),
    did("UA", "2026-11-19"),
  ];
  const plan = todayPlan(WEEK, LIVE, sessions, "2026-11-17");
  expect(plan.missed).toEqual([{ workoutId: "UA", date: "2026-11-16" }]);
});

test("a scheduled workout that was deleted counts as rest", () => {
  const plan = todayPlan(WEEK, ["LA", "UB", "LB"], [], "2026-11-16");
  expect(plan.today).toBeUndefined();
  expect(plan.next).toEqual({ workoutId: "LA", date: "2026-11-17" });
});

test("a workout scheduled twice needs a session for each day", () => {
  const twice = ["UA", "LA", null, "UA", "LB", null, null];
  const plan = todayPlan(twice, LIVE, [did("UA", "2026-11-16"), did("LA", "2026-11-17")], "2026-11-20");
  expect(plan.missed).toEqual([{ workoutId: "UA", date: "2026-11-19" }]);
});

test("with nothing scheduled there's no workout today and nothing next", () => {
  const plan = todayPlan([null, null, null, null, null, null, null], LIVE, [], "2026-11-16");
  expect(plan.today).toBeUndefined();
  expect(plan.next).toBeUndefined();
  expect(plan.missed).toEqual([]);
});

test("the rotation becomes Monday, Tuesday, Thursday, Friday, then Wednesday, Saturday, Sunday", () => {
  expect(scheduleFromRotation(["UA", "LA", "UB", "LB"], LIVE)).toEqual(["UA", "LA", null, "UB", "LB", null, null]);
  const eight = ["a", "b", "c", "d", "e", "f", "g", "h"];
  expect(scheduleFromRotation(eight, eight)).toEqual(["a", "b", "e", "c", "d", "f", "g"]);
  expect(scheduleFromRotation(["gone", "UA", "LA"], LIVE)).toEqual(["UA", "LA", null, null, null, null, null]);
});

test("a month grid is weeks of seven, Monday first", () => {
  const nov = monthGrid(2026, 11);
  expect(nov[0]).toEqual([null, null, null, null, null, null, "2026-11-01"]);
  expect(nov[nov.length - 1][0]).toBe("2026-11-30");
  expect(nov.every((week) => week.length === 7)).toBe(true);
  expect(monthGrid(2028, 2).flat()).toContain("2028-02-29");
});
