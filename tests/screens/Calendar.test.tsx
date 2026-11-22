import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { WorkoutDB } from "../../src/storage/db";
import { addExerciseToSession, finishWorkout, startEmptyWorkout, startWorkout, updateSet } from "../../src/storage/repo";
import { seedExerciseId } from "../../src/storage/seed";
import { renderApp, seededDb } from "./helpers";

let db: WorkoutDB;
beforeEach(async () => {
  db = await seededDb();
});
afterEach(() => {
  vi.useRealTimers();
  db.close();
});

function at(d: number, m = 11) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, m - 1, d, 15));
}

async function finishUpperA(d: number) {
  at(d);
  const id = await startWorkout(db, "seed-workout-upper-a");
  await updateSet(db, id, 0, 0, { weight: 65, amount: 10, done: true });
  await finishWorkout(db, id);
}

async function openProgress() {
  at(20);
  const user = userEvent.setup();
  renderApp(db);
  await user.click(await screen.findByRole("button", { name: "Progress" }));
  await screen.findByRole("heading", { level: 1, name: "Progress" });
  return user;
}

test("days with a workout are marked and named; others say no workout", async () => {
  await finishUpperA(16);
  await openProgress();
  const calendar = screen.getByRole("region", { name: "November 2026" });
  const monday = within(calendar).getByRole("button", { name: "Monday, November 16, Upper A" });
  expect(monday.querySelector(".calendar__mark")).not.toBeNull();
  const wednesday = within(calendar).getByRole("button", { name: "Wednesday, November 18, no workout" });
  expect(wednesday.querySelector(".calendar__mark")).toBeNull();
});

test("selecting a day lists its workouts; opening one edits it and Done comes back to the same day", async () => {
  await finishUpperA(16);
  const user = await openProgress();
  await user.click(screen.getByRole("button", { name: "Monday, November 16, Upper A" }));
  await user.click(screen.getByRole("button", { name: "Upper A · 1 set" }));
  expect(await screen.findByLabelText("Date")).toHaveValue("2026-11-16");
  await user.click(screen.getByRole("button", { name: "Done" }));
  expect(await screen.findByRole("region", { name: "November 2026" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Upper A · 1 set" })).toBeInTheDocument();
});

test("a day without a workout says so", async () => {
  const user = await openProgress();
  await user.click(screen.getByRole("button", { name: "Wednesday, November 18, no workout" }));
  expect(screen.getByText("No workout on Wednesday, Nov 18.")).toBeInTheDocument();
});

test("the calendar can go back a month but not past this one", async () => {
  const user = await openProgress();
  expect(screen.getByRole("button", { name: "Next month" })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Previous month" }));
  expect(screen.getByRole("region", { name: "October 2026" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Next month" })).toBeEnabled();
});

test("one-off workouts are marked too", async () => {
  at(17);
  const id = await startEmptyWorkout(db);
  await addExerciseToSession(db, id, seedExerciseId("EZ-Bar Curl"));
  await updateSet(db, id, 0, 0, { weight: 40, amount: 12, done: true });
  await finishWorkout(db, id);
  await openProgress();
  expect(screen.getByRole("button", { name: "Tuesday, November 17, Workout" }).querySelector(".calendar__mark")).not.toBeNull();
});

test("with no history the calendar still shows, above the empty state", async () => {
  await openProgress();
  expect(screen.getByRole("region", { name: "November 2026" })).toBeInTheDocument();
  expect(screen.getByText(/No sessions yet\. Finish a workout/)).toBeInTheDocument();
});

test("today is outlined", async () => {
  await openProgress();
  expect(screen.getByRole("button", { name: /^Friday, November 20/ })).toHaveClass("calendar__day--today");
});

test("opening an exercise from Progress and coming back keeps the calendar's month and day", async () => {
  await finishUpperA(16);
  const user = await openProgress();
  await user.click(screen.getByRole("button", { name: "Previous month" }));
  await user.click(screen.getByRole("button", { name: "Next month" }));
  await user.click(screen.getByRole("button", { name: "Monday, November 16, Upper A" }));
  await user.click(screen.getByRole("button", { name: /^Barbell Bench Press/ }));
  await screen.findByRole("heading", { level: 1, name: "Barbell Bench Press" });
  await user.click(screen.getAllByRole("button", { name: "Progress" })[0]);
  expect(await screen.findByRole("button", { name: "Upper A · 1 set" })).toBeInTheDocument();
});

test("two workouts on the same day keep their order when one is edited", async () => {
  at(16);
  const lower = await startWorkout(db, "seed-workout-lower-a");
  await updateSet(db, lower, 0, 0, { weight: 135, amount: 5, done: true });
  await finishWorkout(db, lower);
  await finishUpperA(16);
  const user = await openProgress();
  await user.click(screen.getByRole("button", { name: /^Monday, November 16/ }));
  const order = () => screen.getAllByRole("button", { name: /· \d+ sets?$/ }).map((b) => b.textContent);
  const before = order();
  await updateSet(db, lower, 0, 0, { weight: 140 }, "finished");
  await new Promise((r) => setTimeout(r, 50));
  expect(order()).toEqual(before);
  expect(before).toEqual(["Lower A · 1 set", "Upper A · 1 set"]);
});

test("Progress moves its today outline to the new day when the app comes back after midnight", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 20, 23, 59));
  const user = userEvent.setup();
  renderApp(db);
  await user.click(await screen.findByRole("button", { name: "Progress" }));
  expect(await screen.findByRole("button", { name: /^Friday, November 20/ })).toHaveClass("calendar__day--today");
  vi.setSystemTime(new Date(2026, 10, 21, 0, 5));
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await waitFor(() => expect(screen.getByRole("button", { name: /^Saturday, November 21/ })).toHaveClass("calendar__day--today"));
});
