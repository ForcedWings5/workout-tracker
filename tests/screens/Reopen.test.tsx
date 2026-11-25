import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { WorkoutDB } from "../../src/storage/db";
import { startWorkout, updateSet } from "../../src/storage/repo";
import { renderApp, seededDb } from "./helpers";

// iOS often closes a home-screen app while the phone is locked between sets. Opening it again
// should land back in the workout, not on Today.

let db: WorkoutDB;
beforeEach(async () => {
  db = await seededDb();
});
afterEach(() => db.close());

test("opening the app with a workout in progress goes straight back into it", async () => {
  const id = await startWorkout(db, "seed-workout-upper-a");
  await updateSet(db, id, 0, 0, { weight: 65, amount: 10, done: true });
  renderApp(db);
  expect(await screen.findByRole("heading", { level: 1, name: "Upper A" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { level: 1, name: "Today" })).not.toBeInTheDocument();
});

test("leaving the reopened workout goes to Today, where it can be resumed", async () => {
  await startWorkout(db, "seed-workout-upper-a");
  const user = userEvent.setup();
  renderApp(db);
  await screen.findByRole("heading", { level: 1, name: "Upper A" });
  await user.click(screen.getByRole("button", { name: "Today" }));
  expect(await screen.findByRole("button", { name: "Resume" })).toBeInTheDocument();
});

test("with nothing in progress the app opens on Today", async () => {
  renderApp(db);
  expect(await screen.findByRole("heading", { level: 1, name: "Today" })).toBeInTheDocument();
});
