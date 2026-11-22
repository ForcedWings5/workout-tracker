import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { WorkoutDB } from "../../src/storage/db";
import { finishWorkout, loadTodayState, setScheduleDay, startWorkout, updateSet } from "../../src/storage/repo";
import { renderApp, seededDb } from "./helpers";

const UPPER_A = "seed-workout-upper-a";
const LOWER_A = "seed-workout-lower-a";
let db: WorkoutDB;

beforeEach(async () => {
  db = await seededDb();
});
afterEach(() => {
  vi.useRealTimers();
  db.close();
});

/** Sets the clock to a local day and time. Only Date is faked, so the UI's timers still run. */
function at(y: number, m: number, d: number, h = 15, min = 0) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(y, m - 1, d, h, min));
}

async function finish(workoutId: string, d: number) {
  at(2026, 11, d);
  const id = await startWorkout(db, workoutId);
  await updateSet(db, id, 0, 0, { weight: 65, amount: 10, done: true });
  await finishWorkout(db, id);
}

test("on Monday, Today is one card: Upper A, Start workout, and what's next", async () => {
  at(2026, 11, 16);
  renderApp(db);
  const today = await screen.findByRole("region", { name: "Today: Upper A" });
  expect(within(today).getByText("Today · Monday")).toBeInTheDocument();
  expect(within(today).getByRole("heading", { name: "Upper A" })).toBeInTheDocument();
  expect(within(today).getByText("Horizontal Push & Pull")).toBeInTheDocument();
  expect(within(today).getByRole("button", { name: "Start workout" })).toBeInTheDocument();
  expect(within(today).getByText("Next: Lower A, tomorrow")).toBeInTheDocument();
  expect(screen.queryByText("Other workouts")).not.toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: "Start a different workout" })).toHaveLength(1);
});

test("Start workout starts today's workout", async () => {
  at(2026, 11, 16);
  const user = userEvent.setup();
  renderApp(db);
  await user.click(await screen.findByRole("button", { name: "Start workout" }));
  expect(await screen.findByText("Barbell Bench Press")).toBeInTheDocument();
  expect((await loadTodayState(db)).inProgress?.workoutId).toBe(UPPER_A);
});

test("Review Focus 5: a week with missed workouts shows no reminder; a rest day names what's next", async () => {
  at(2026, 11, 22); // Sunday, nothing logged all week
  renderApp(db);
  const rest = await screen.findByRole("region", { name: "Rest day" });
  expect(within(rest).getByText("Next: Upper A, tomorrow")).toBeInTheDocument();
  expect(screen.queryByText(/^Missed /)).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /instead$/ })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Start a different workout" })).toBeInTheDocument();
});

test("Review Focus 4: Start a different workout lists the week's workouts in order, then Empty workout", async () => {
  at(2026, 11, 16);
  const user = userEvent.setup();
  renderApp(db);
  await user.click(await screen.findByRole("button", { name: "Start a different workout" }));
  const sheet = screen.getByRole("dialog", { name: "Start a workout" });
  const names = within(sheet)
    .getAllByRole("button")
    .map((b) => b.querySelector(".picker__name")?.textContent)
    .filter(Boolean);
  expect(names).toEqual(["Upper A", "Lower A", "Upper B", "Lower B", "Empty workout"]);
});

test("picking a workout from the list starts it", async () => {
  at(2026, 11, 16);
  const user = userEvent.setup();
  renderApp(db);
  await user.click(await screen.findByRole("button", { name: "Start a different workout" }));
  await user.click(within(screen.getByRole("dialog", { name: "Start a workout" })).getByRole("button", { name: /^Lower A/ }));
  expect(await screen.findByText("Barbell Squats")).toBeInTheDocument();
  expect((await loadTodayState(db)).inProgress?.workoutId).toBe(LOWER_A);
});

test("Empty workout from the list starts a one-off", async () => {
  at(2026, 11, 16);
  const user = userEvent.setup();
  renderApp(db);
  await user.click(await screen.findByRole("button", { name: "Start a different workout" }));
  await user.click(within(screen.getByRole("dialog", { name: "Start a workout" })).getByRole("button", { name: "Empty workout" }));
  expect(await screen.findByRole("heading", { level: 1, name: "Workout" })).toBeInTheDocument();
  expect((await loadTodayState(db)).inProgress?.workoutId).toBeUndefined();
});

test("Review Focus 3: options can't be tapped twice while a workout is starting", async () => {
  at(2026, 11, 16);
  const user = userEvent.setup();
  renderApp(db);
  await user.click(await screen.findByRole("button", { name: "Start a different workout" }));
  const sheet = screen.getByRole("dialog", { name: "Start a workout" });
  const lowerA = within(sheet).getByRole("button", { name: /^Lower A/ });
  await user.dblClick(lowerA);
  await screen.findByText("Barbell Squats");
  expect((await db.sessions.toArray()).filter((s) => s.status === "in_progress")).toHaveLength(1);
});

test("on a rest day after this week's workouts, Today says so and names what's next", async () => {
  await finish(UPPER_A, 16);
  await finish(LOWER_A, 17);
  at(2026, 11, 18);
  renderApp(db);
  const rest = await screen.findByRole("region", { name: "Rest day" });
  expect(within(rest).getByText("Next: Upper B, tomorrow")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Start workout" })).not.toBeInTheDocument();
});

test("once today's workout is done, Today says so and it can still be redone from the list", async () => {
  await finish(UPPER_A, 16);
  const user = userEvent.setup();
  renderApp(db);
  const today = await screen.findByRole("region", { name: "Today: Upper A" });
  expect(within(today).getByText("Done today")).toBeInTheDocument();
  expect(within(today).getByText("Next: Lower A, tomorrow")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Start workout" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Start a different workout" }));
  expect(within(screen.getByRole("dialog", { name: "Start a workout" })).getByRole("button", { name: /^Upper A/ })).toBeInTheDocument();
});

test("a workout done earlier this week shows as done this week", async () => {
  await finish(LOWER_A, 16);
  at(2026, 11, 17);
  renderApp(db);
  const today = await screen.findByRole("region", { name: "Today: Lower A" });
  expect(within(today).getByText("Done this week (Monday)")).toBeInTheDocument();
});

test("Review Focus 3: a workout in progress from yesterday shows only Resume and Discard", async () => {
  at(2026, 11, 16);
  await startWorkout(db, UPPER_A);
  at(2026, 11, 17);
  renderApp(db);
  expect(await screen.findByRole("button", { name: "Resume" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Discard" })).toBeInTheDocument();
  expect(screen.queryByText(/^Today · /)).not.toBeInTheDocument();
  expect(screen.queryByText(/^Missed /)).not.toBeInTheDocument();
  expect(screen.queryByText("Other workouts")).not.toBeInTheDocument();
  // Review Focus 1: starting another workout isn't allowed while one is in progress.
  expect(screen.queryByRole("button", { name: "Start a different workout" })).not.toBeInTheDocument();
});

test("Discard asks first, then removes the in-progress workout", async () => {
  at(2026, 11, 16);
  await startWorkout(db, UPPER_A);
  const user = userEvent.setup();
  renderApp(db);
  await user.click(await screen.findByRole("button", { name: "Discard" }));
  await user.click(within(screen.getByRole("dialog", { name: "Discard this workout?" })).getByRole("button", { name: "Discard workout" }));
  await waitFor(async () => expect((await loadTodayState(db)).inProgress).toBeUndefined());
  expect(await screen.findByRole("button", { name: "Start workout" })).toBeInTheDocument();
});

test("Review Focus 1: left open past midnight, Today moves to the new day when the app comes back", async () => {
  at(2026, 11, 16, 23, 59);
  renderApp(db);
  expect(await screen.findByText("Today · Monday")).toBeInTheDocument();
  at(2026, 11, 17, 0, 5);
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(await screen.findByText("Today · Tuesday")).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Today: Lower A" })).toBeInTheDocument();
});

test("with nothing scheduled, Today says where to set the week", async () => {
  for (let d = 0; d < 7; d++) await setScheduleDay(db, d, null);
  at(2026, 11, 16);
  renderApp(db);
  expect(await screen.findByText("No workouts scheduled. Set your week on the Workouts tab.")).toBeInTheDocument();
  // Review Focus 2: a workout can still be started.
  expect(screen.getByRole("button", { name: "Start a different workout" })).toBeInTheDocument();
});
