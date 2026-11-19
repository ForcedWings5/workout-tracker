import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { WorkoutDB } from "../../src/storage/db";
import { seedExerciseId } from "../../src/storage/seed";
import { renderApp, seededDb } from "./helpers";

const UPPER_A = "seed-workout-upper-a";
const LOWER_A = "seed-workout-lower-a";
const BENCH = seedExerciseId("Barbell Bench Press");
let db: WorkoutDB;

beforeEach(async () => {
  db = await seededDb();
});
afterEach(() => db.close());

async function openWorkouts() {
  const user = userEvent.setup();
  renderApp(db);
  await user.click(await screen.findByRole("button", { name: "Workouts" }));
  return user;
}

async function openEditor(title: string) {
  const user = await openWorkouts();
  await user.click(await screen.findByRole("button", { name: `Edit ${title}` }));
  await screen.findByRole("heading", { level: 1, name: title });
  return user;
}

/** Opens the editor and unfolds the bench press fields. */
async function editBench() {
  const user = await openEditor("Upper A");
  const bench = screen.getByRole("region", { name: "Barbell Bench Press" });
  await user.click(within(bench).getByRole("button", { name: "Edit Barbell Bench Press" }));
  return { user, bench };
}

test("lists the workouts in rotation order", async () => {
  await openWorkouts();
  const edits = await screen.findAllByRole("button", { name: /^Edit / });
  expect(edits.map((b) => b.getAttribute("aria-label"))).toEqual(["Edit Upper A", "Edit Lower A", "Edit Upper B", "Edit Lower B"]);
});

test("moving Lower A up makes it first in the rotation", async () => {
  const user = await openWorkouts();
  await user.click(await screen.findByRole("button", { name: "Move Lower A up" }));
  await waitFor(async () => expect((await db.rotation.get("rotation"))?.workoutIds[0]).toBe(LOWER_A));
  expect(screen.getByRole("button", { name: "Move Lower A up" })).toBeDisabled();
});

test("changing bench sets to 5 and leaving the field saves it", async () => {
  const { user, bench } = await editBench();
  const sets = within(bench).getByLabelText("Sets");
  await user.clear(sets);
  await user.type(sets, "5");
  await user.tab();
  await waitFor(async () => expect((await db.workouts.get(UPPER_A))?.exercises[0].sets).toBe(5));
  expect(await within(bench).findByText("5 × 6–10")).toBeInTheDocument();
});

test("a blank sets field shows what's wrong and saves nothing", async () => {
  const { user, bench } = await editBench();
  await user.clear(within(bench).getByLabelText("Sets"));
  expect(await within(bench).findByRole("alert")).toHaveTextContent("At least 1 set");
  expect((await db.workouts.get(UPPER_A))?.exercises[0].sets).toBe(4);
  await user.tab();
  expect(within(bench).getByLabelText("Sets")).toHaveValue("4");
});

test("renaming the workout saves as you type", async () => {
  const user = await openEditor("Upper A");
  const name = screen.getByLabelText("Workout name");
  await user.clear(name);
  await user.type(name, "Upper A: Push");
  await waitFor(async () => expect((await db.workouts.get(UPPER_A))?.name).toBe("Upper A: Push"));
  expect(await screen.findByText("Push")).toBeInTheDocument();
});

test("renaming an exercise renames it everywhere", async () => {
  const { user, bench } = await editBench();
  const name = within(bench).getByLabelText("Exercise name");
  await user.clear(name);
  await user.type(name, "Flat Bench");
  await waitFor(async () => expect((await db.exercises.get(BENCH))?.name).toBe("Flat Bench"));
});

test("switching an exercise to seconds changes its measure", async () => {
  const { user, bench } = await editBench();
  await user.click(within(bench).getByRole("button", { name: "Seconds" }));
  await waitFor(async () => expect((await db.exercises.get(BENCH))?.measure).toBe("seconds"));
  expect(within(bench).getByRole("button", { name: "Seconds" })).toHaveAttribute("aria-pressed", "true");
});

test("an exercise's fields stay folded until Edit", async () => {
  const user = await openEditor("Upper A");
  const bench = screen.getByRole("region", { name: "Barbell Bench Press" });
  expect(within(bench).queryByLabelText("Sets")).not.toBeInTheDocument();
  const edit = within(bench).getByRole("button", { name: "Edit Barbell Bench Press" });
  expect(edit).toHaveAttribute("aria-expanded", "false");
  await user.click(edit);
  expect(edit).toHaveAttribute("aria-expanded", "true");
  expect(within(bench).getByLabelText("Sets")).toHaveValue("4");
});

test("moving and removing exercises changes only the workout", async () => {
  const user = await openEditor("Upper A");
  await user.click(screen.getByRole("button", { name: "Move Barbell Bench Press down" }));
  await waitFor(async () => expect((await db.workouts.get(UPPER_A))?.exercises[1].exerciseId).toBe(BENCH));
  await user.click(screen.getByRole("button", { name: "Edit Barbell Bench Press" }));
  await user.click(screen.getByRole("button", { name: "Remove Barbell Bench Press" }));
  await waitFor(async () => expect((await db.workouts.get(UPPER_A))?.exercises.map((p) => p.exerciseId)).not.toContain(BENCH));
  expect((await db.exercises.get(BENCH))?.deleted).toBe(false);
});

test("delete workout asks first, then it's gone from the list", async () => {
  const user = await openEditor("Upper A");
  await user.click(screen.getByRole("button", { name: "Delete workout" }));
  const sheet = screen.getByRole("dialog", { name: "Delete this workout?" });
  await user.click(within(sheet).getByRole("button", { name: "Delete workout" }));
  await screen.findByRole("heading", { level: 1, name: "Workouts" });
  await waitFor(() => expect(screen.queryByRole("button", { name: "Edit Upper A" })).not.toBeInTheDocument());
  expect((await db.rotation.get("rotation"))?.workoutIds).not.toContain(UPPER_A);
});

test("new workout opens the editor for an empty workout at the end of the rotation", async () => {
  const user = await openWorkouts();
  await user.click(await screen.findByRole("button", { name: "New workout" }));
  await screen.findByRole("heading", { level: 1, name: "New workout" });
  expect(screen.getByText(/No exercises yet/)).toBeInTheDocument();
  const ids = (await db.rotation.get("rotation"))!.workoutIds;
  expect(ids).toHaveLength(5);
  expect((await db.workouts.get(ids[4]))?.name).toBe("New workout");
});
