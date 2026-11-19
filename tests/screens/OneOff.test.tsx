import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { WorkoutDB } from "../../src/storage/db";
import { seedExerciseId } from "../../src/storage/seed";
import { renderApp, seededDb } from "./helpers";

let db: WorkoutDB;
beforeEach(async () => {
  db = await seededDb();
});
afterEach(() => db.close());

test("start empty workout, name it, and add an exercise", async () => {
  const user = userEvent.setup();
  renderApp(db);
  await user.click(await screen.findByRole("button", { name: "Start empty workout" }));
  await screen.findByRole("heading", { level: 1, name: "Workout" });
  expect(screen.getByText(/No exercises yet/)).toBeInTheDocument();

  const name = screen.getByLabelText("Workout name");
  await user.clear(name);
  await user.type(name, "Arms");
  await screen.findByRole("heading", { level: 1, name: "Arms" });

  await user.click(screen.getByRole("button", { name: "Add exercise" }));
  const dialog = await screen.findByRole("dialog", { name: "Add exercise" });
  await user.click(await within(dialog).findByRole("button", { name: /EZ-Bar Curl/ }));
  expect(await screen.findByRole("region", { name: "EZ-Bar Curl" })).toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("a rotation workout can take an extra exercise mid-session", async () => {
  const user = userEvent.setup();
  renderApp(db);
  await user.click(await screen.findByRole("button", { name: "Start workout" }));
  await user.click(await screen.findByRole("button", { name: "Add exercise" }));
  await user.click(await screen.findByRole("button", { name: /Plank/ }));
  expect(await screen.findByRole("region", { name: "Plank" })).toBeInTheDocument();
  expect(screen.queryByLabelText("Workout name")).not.toBeInTheDocument();
});

test("Edit Workout's Add exercise appends it with starting targets, unfolded", async () => {
  const user = userEvent.setup();
  renderApp(db);
  await user.click(await screen.findByRole("button", { name: "Workouts" }));
  await user.click(await screen.findByRole("button", { name: "Edit Upper A" }));
  await user.click(await screen.findByRole("button", { name: "Add exercise" }));
  await user.click(await screen.findByRole("button", { name: /Plank/ }));
  await waitFor(async () =>
    expect((await db.workouts.get("seed-workout-upper-a"))?.exercises.at(-1)).toEqual({
      exerciseId: seedExerciseId("Plank"),
      sets: 3,
      targetMin: 30,
    }),
  );
  const plank = await screen.findByRole("region", { name: "Plank" });
  expect(within(plank).getByRole("button", { name: "Edit Plank" })).toHaveAttribute("aria-expanded", "true");
});
