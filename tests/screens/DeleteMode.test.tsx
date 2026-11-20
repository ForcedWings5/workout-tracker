import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LogWorkout } from "../../src/screens/LogWorkout";
import { DbProvider } from "../../src/storage/DbContext";
import type { WorkoutDB } from "../../src/storage/db";
import { addExerciseToSession, startEmptyWorkout, startWorkout, updateSet } from "../../src/storage/repo";
import { seedExerciseId } from "../../src/storage/seed";
import { seededDb } from "./helpers";

const UPPER_A = "seed-workout-upper-a";
const BENCH = seedExerciseId("Barbell Bench Press");
let db: WorkoutDB;

beforeEach(async () => {
  db = await seededDb();
});
afterEach(() => db.close());

function renderLog(sessionId: string) {
  return render(
    <DbProvider db={db}>
      <LogWorkout sessionId={sessionId} onClose={() => {}} />
    </DbProvider>,
  );
}

/** Starts Upper A, opens it, and turns delete mode on. */
async function deleteMode(prepare?: (id: string) => Promise<void>) {
  const id = await startWorkout(db, UPPER_A);
  await prepare?.(id);
  const user = userEvent.setup();
  const view = renderLog(id);
  await user.click(await screen.findByRole("button", { name: "Delete sets or exercises" }));
  return { id, user, view };
}

const benchSets = async (id: string) => (await db.sessions.get(id))!.entries[0].sets;

test("the corner button turns delete mode on and Done turns it off", async () => {
  const { user } = await deleteMode();
  expect(screen.getByText("Tap a set or exercise to delete it.")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Done" }));
  expect(screen.queryByText("Tap a set or exercise to delete it.")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Delete sets or exercises" })).toBeInTheDocument();
});

test("in delete mode nothing else responds", async () => {
  await deleteMode();
  const bench = screen.getByRole("region", { name: "Barbell Bench Press" });
  expect(within(bench).queryByLabelText("Set 1 weight")).not.toBeInTheDocument();
  expect(within(bench).queryByRole("button", { name: /^Set 1: / })).not.toBeInTheDocument();
  expect(within(bench).queryByRole("button", { name: /^(Skip|Remove|Restore) set 1$/ })).not.toBeInTheDocument();
  expect(within(bench).getByRole("button", { name: "Add a set to Barbell Bench Press" })).toBeDisabled();
  expect(within(bench).getByLabelText("Note for Barbell Bench Press")).toBeDisabled();
  expect(screen.getByRole("button", { name: "Fulfill contract" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Add exercise" })).toBeDisabled();
});

test("deleting a set asks first, then removes it", async () => {
  const { id, user } = await deleteMode((id) => updateSet(db, id, 0, 1, { weight: 135, amount: 8, done: true }));
  await user.click(screen.getByRole("button", { name: "Delete set 2 of Barbell Bench Press" }));
  const sheet = screen.getByRole("dialog", { name: "Delete set 2?" });
  expect(within(sheet).getByText("Barbell Bench Press · 135 lb × 8 reps.")).toBeInTheDocument();
  await user.click(within(sheet).getByRole("button", { name: "Delete set" }));
  await waitFor(async () => expect(await benchSets(id)).toHaveLength(3));
  expect((await benchSets(id)).some((s) => s.done)).toBe(false);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
});

test("Keep set deletes nothing", async () => {
  const { id, user } = await deleteMode();
  await user.click(screen.getByRole("button", { name: "Delete set 2 of Barbell Bench Press" }));
  await user.click(within(screen.getByRole("dialog", { name: "Delete set 2?" })).getByRole("button", { name: "Keep set" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(await benchSets(id)).toHaveLength(4);
});

test("removing an exercise asks first, then takes it off today only", async () => {
  const { id, user } = await deleteMode();
  await user.click(screen.getByRole("button", { name: "Remove Barbell Bench Press from today" }));
  const sheet = screen.getByRole("dialog", { name: "Remove Barbell Bench Press from today?" });
  expect(within(sheet).getByText("Its sets from today go too.")).toBeInTheDocument();
  await user.click(within(sheet).getByRole("button", { name: "Remove exercise" }));
  await waitFor(() => expect(screen.queryByRole("region", { name: "Barbell Bench Press" })).not.toBeInTheDocument());
  expect((await db.sessions.get(id))!.entries.map((e) => e.exerciseId)).not.toContain(BENCH);
  expect((await db.workouts.get(UPPER_A))!.exercises[0].exerciseId).toBe(BENCH);
});

test("removing the last exercise shows the empty state", async () => {
  const id = await startEmptyWorkout(db);
  await addExerciseToSession(db, id, BENCH);
  const user = userEvent.setup();
  renderLog(id);
  await user.click(await screen.findByRole("button", { name: "Delete sets or exercises" }));
  await user.click(await screen.findByRole("button", { name: "Remove Barbell Bench Press from today" }));
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Remove exercise" }));
  expect(await screen.findByText(/No exercises yet/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
});

test("delete mode starts off when the screen opens again", async () => {
  const { id, view } = await deleteMode();
  view.unmount();
  renderLog(id);
  expect(await screen.findByRole("button", { name: "Delete sets or exercises" })).toBeInTheDocument();
  expect(screen.queryByText("Tap a set or exercise to delete it.")).not.toBeInTheDocument();
});
