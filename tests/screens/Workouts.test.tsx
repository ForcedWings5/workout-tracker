import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { WorkoutDB } from "../../src/storage/db";
import { seedExerciseId } from "../../src/storage/seed";
import { renderApp, seededDb } from "./helpers";

const UPPER_A = "seed-workout-upper-a";
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

test("This week shows each day's workout or Rest, Monday first", async () => {
  await openWorkouts();
  const week = await screen.findByRole("region", { name: "This week" });
  const days = within(week).getAllByRole("button").map((b) => b.getAttribute("aria-label"));
  expect(days).toEqual([
    "Monday: Upper A",
    "Tuesday: Lower A",
    "Wednesday: Rest",
    "Thursday: Upper B",
    "Friday: Lower B",
    "Saturday: Rest",
    "Sunday: Rest",
  ]);
});

test("picking a workout for a day saves it", async () => {
  const user = await openWorkouts();
  await user.click(await screen.findByRole("button", { name: "Wednesday: Rest" }));
  const sheet = screen.getByRole("dialog", { name: "Wednesday" });
  await user.click(within(sheet).getByRole("button", { name: "Upper B" }));
  await waitFor(async () => expect((await db.schedule.get("schedule"))?.days[2]).toBe("seed-workout-upper-b"));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(await screen.findByRole("button", { name: "Wednesday: Upper B" })).toBeInTheDocument();
});

test("picking Rest clears a day", async () => {
  const user = await openWorkouts();
  await user.click(await screen.findByRole("button", { name: "Monday: Upper A" }));
  await user.click(within(screen.getByRole("dialog", { name: "Monday" })).getByRole("button", { name: "Rest" }));
  await waitFor(async () => expect((await db.schedule.get("schedule"))?.days[0]).toBeNull());
});

test("workouts are listed in week order with their days", async () => {
  await openWorkouts();
  const edits = await screen.findAllByRole("button", { name: /^Edit / });
  expect(edits.map((b) => b.getAttribute("aria-label"))).toEqual(["Edit Upper A", "Edit Lower A", "Edit Upper B", "Edit Lower B"]);
  expect(edits[0]).toHaveTextContent("Monday · 6 exercises");
  expect(screen.queryByRole("button", { name: /^Move / })).not.toBeInTheDocument();
});

test("a workout on two days lists both", async () => {
  const user = await openWorkouts();
  await user.click(await screen.findByRole("button", { name: "Saturday: Rest" }));
  await user.click(within(screen.getByRole("dialog", { name: "Saturday" })).getByRole("button", { name: "Upper A" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Edit Upper A" })).toHaveTextContent("Monday, Saturday · 6 exercises"));
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
  await waitFor(() => expect(within(bench).getByRole("button", { name: "Seconds" })).toHaveAttribute("aria-pressed", "true"));
});

test("the Reps/Seconds switch says it changes the exercise everywhere", async () => {
  const { bench } = await editBench();
  expect(within(bench).getByRole("group", { name: "Measured in" })).toHaveAccessibleDescription(
    "Changes Barbell Bench Press everywhere, its past sets included.",
  );
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
  // Wait for the moved order on screen, so the click lands on the redrawn notice.
  await waitFor(() => expect(screen.getAllByRole("region")[2]).toHaveAccessibleName("Barbell Bench Press"));
  await user.click(screen.getByRole("button", { name: "Edit Barbell Bench Press" }));
  await user.click(screen.getByRole("button", { name: "Remove Barbell Bench Press" }));
  await waitFor(async () => expect((await db.workouts.get(UPPER_A))?.exercises.map((p) => p.exerciseId)).not.toContain(BENCH));
  expect((await db.exercises.get(BENCH))?.deleted).toBe(false);
});

test("delete workout asks first, then it's gone from the list", async () => {
  const user = await openEditor("Upper A");
  await user.click(screen.getByRole("button", { name: "Delete workout" }));
  const sheet = screen.getByRole("dialog", { name: "Delete this workout?" });
  // Final: the copy says what actually happens now that there's no rotation.
  expect(within(sheet).getByText("Upper A's days become Rest. Past sessions keep their sets.")).toBeInTheDocument();
  await user.click(within(sheet).getByRole("button", { name: "Delete workout" }));
  await screen.findByRole("heading", { level: 1, name: "Workouts" });
  await waitFor(() => expect(screen.queryByRole("button", { name: "Edit Upper A" })).not.toBeInTheDocument());
  expect((await db.schedule.get("schedule"))?.days[0]).toBeNull();
  expect(await screen.findByRole("button", { name: "Monday: Rest" })).toBeInTheDocument();
});

test("new workout opens the editor for an empty, unscheduled workout", async () => {
  const user = await openWorkouts();
  await user.click(await screen.findByRole("button", { name: "New workout" }));
  await screen.findByRole("heading", { level: 1, name: "New workout" });
  expect(screen.getByText(/No exercises yet/)).toBeInTheDocument();
  const added = (await db.workouts.toArray()).find((w) => w.name === "New workout");
  expect(added).toBeDefined();
  expect((await db.schedule.get("schedule"))?.days).not.toContain(added!.id);
  // The back link (the tab bar has a "Workouts" button too).
  await user.click(screen.getAllByRole("button", { name: "Workouts" })[0]);
  expect(await screen.findByRole("button", { name: "Edit New workout" })).toHaveTextContent("Not scheduled · 0 exercises");
});

test("Final #1: deleting a name one character at a time and leaving puts the old name back", async () => {
  const { user, bench } = await editBench();
  const name = within(bench).getByLabelText("Exercise name");
  await user.click(name);
  await user.keyboard("{End}" + "{Backspace}".repeat("Barbell Bench Press".length));
  // The message appears once the refused save settles, a moment after the last keystroke.
  expect(await within(bench).findByRole("alert")).toHaveTextContent("Give the exercise a name");
  await user.tab();
  await waitFor(async () => expect((await db.exercises.get(BENCH))?.name).toBe("Barbell Bench Press"));
  // The field follows the saved name through a live query, so give the screen a moment to catch up.
  await waitFor(() => expect(within(bench).getByLabelText("Exercise name")).toHaveValue("Barbell Bench Press"));
});

test("Final #1: a number backspaced to blank and left goes back to what it was", async () => {
  const { user, bench } = await editBench();
  const max = within(bench).getByLabelText("Max reps");
  await user.click(max);
  await user.keyboard("{End}{Backspace}{Backspace}");
  await user.tab();
  // A blank max is valid (a fixed target), so it stays blank.
  await waitFor(async () => expect((await db.workouts.get(UPPER_A))?.exercises[0].targetMax).toBeUndefined());
  const sets = within(bench).getByLabelText("Sets");
  await user.click(sets);
  await user.keyboard("{End}{Backspace}2{Backspace}");
  await user.tab();
  await waitFor(async () => expect((await db.workouts.get(UPPER_A))?.exercises[0].sets).toBe(4));
  await waitFor(() => expect(within(bench).getByLabelText("Sets")).toHaveValue("4"));
});

test("Final #2: a typo in min on the way to the right value keeps max", async () => {
  const { user, bench } = await editBench();
  const min = within(bench).getByLabelText("Min reps");
  await user.click(min);
  await user.keyboard("{End}0{Backspace}");
  await user.tab();
  const plan = (await db.workouts.get(UPPER_A))?.exercises[0];
  expect(plan).toMatchObject({ targetMin: 6, targetMax: 10 });
});

test("design: each workout card shows a chevron, like the week rows, so it reads as tappable", async () => {
  await openWorkouts();
  const edit = await screen.findByRole("button", { name: "Edit Upper A" });
  expect(edit.querySelector("svg.lucide-chevron-right")).not.toBeNull();
});
