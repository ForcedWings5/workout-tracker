import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { WorkoutDB } from "../../src/storage/db";
import { loadTodayState, startWorkout, updateSet, finishWorkout } from "../../src/storage/repo";
import { renderApp, seededDb } from "./helpers";

let db: WorkoutDB;

beforeEach(async () => {
  db = await seededDb();
});
afterEach(() => db.close());

test("shows the next-up workout with its subtitle and Start workout", async () => {
  renderApp(db);
  const next = await screen.findByRole("region", { name: "Next up: Upper A" });
  expect(within(next).getByRole("heading", { name: "Upper A" })).toBeInTheDocument();
  expect(within(next).getByText("Horizontal Push & Pull")).toBeInTheDocument();
  expect(within(next).getByText("6 exercises")).toBeInTheDocument();
  expect(within(next).getByRole("button", { name: "Start workout" })).toBeInTheDocument();
});

test("lists the other three workouts", async () => {
  renderApp(db);
  expect(await screen.findByRole("button", { name: /Lower A/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Upper B/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Lower B/ })).toBeInTheDocument();
});

test("Start workout opens Log Workout", async () => {
  renderApp(db);
  await userEvent.click(await screen.findByRole("button", { name: "Start workout" }));
  expect(await screen.findByText("Barbell Bench Press")).toBeInTheDocument();
  expect((await loadTodayState(db)).inProgress?.workoutId).toBe("seed-workout-upper-a");
});

test("tapping another workout starts that one", async () => {
  renderApp(db);
  await userEvent.click(await screen.findByRole("button", { name: /Lower A/ }));
  expect(await screen.findByText("Barbell Squats")).toBeInTheDocument();
});

test("with a workout in progress, Resume replaces Start workout", async () => {
  await startWorkout(db, "seed-workout-upper-a");
  renderApp(db);
  expect(await screen.findByRole("button", { name: "Resume" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Start workout" })).not.toBeInTheDocument();
  expect(screen.getByText("0 of 15 sets")).toBeInTheDocument();
});

test("Discard asks first, then removes the in-progress workout", async () => {
  await startWorkout(db, "seed-workout-upper-a");
  renderApp(db);
  await userEvent.click(await screen.findByRole("button", { name: "Discard" }));
  const sheet = screen.getByRole("dialog", { name: "Discard this workout?" });
  await userEvent.click(within(sheet).getByRole("button", { name: "Discard workout" }));
  expect(await screen.findByRole("button", { name: "Start workout" })).toBeInTheDocument();
  expect((await loadTodayState(db)).inProgress).toBeUndefined();
});

test("after finishing, next up moves on and shows the last date", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-12T15:00:00Z"));
  const id = await startWorkout(db, "seed-workout-lower-a");
  await updateSet(db, id, 0, 0, { weight: 135, amount: 8, done: true });
  await finishWorkout(db, id);
  vi.useRealTimers();
  renderApp(db);
  await waitFor(() => expect(screen.getByRole("region", { name: "Next up: Upper B" })).toBeInTheDocument());
  expect(screen.getByRole("button", { name: /Lower A/ })).toHaveTextContent("last 11/12");
});
