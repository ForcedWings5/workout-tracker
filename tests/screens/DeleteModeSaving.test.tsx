import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LogWorkout } from "../../src/screens/LogWorkout";
import { DbProvider } from "../../src/storage/DbContext";
import type { WorkoutDB } from "../../src/storage/db";
import { startWorkout } from "../../src/storage/repo";
import { seededDb } from "./helpers";

// Lets a test hold a delete "in flight", or make it fail.
const control = vi.hoisted(() => ({ next: undefined as undefined | (() => Promise<void>) }));
vi.mock("../../src/storage/repo", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../src/storage/repo")>();
  return {
    ...real,
    deleteSessionSet: vi.fn((...args: Parameters<typeof real.deleteSessionSet>) => (control.next ? control.next() : real.deleteSessionSet(...args))),
  };
});

let db: WorkoutDB;
beforeEach(async () => {
  db = await seededDb();
  control.next = undefined;
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  db.close();
});

async function confirmDeleteOfSet2() {
  const id = await startWorkout(db, "seed-workout-upper-a");
  const user = userEvent.setup();
  render(
    <DbProvider db={db}>
      <LogWorkout sessionId={id} onClose={() => {}} />
    </DbProvider>,
  );
  await user.click(await screen.findByRole("button", { name: "Delete sets or exercises" }));
  await user.click(screen.getByRole("button", { name: "Delete set 2 of Barbell Bench Press" }));
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete set" }));
}

test("while a delete is saving, the other delete buttons wait", async () => {
  control.next = () => new Promise(() => {});
  await confirmDeleteOfSet2();
  expect(screen.getByRole("button", { name: "Delete set 1 of Barbell Bench Press" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Remove Barbell Bench Press from today" })).toBeDisabled();
});

test("a failed delete frees the buttons again", async () => {
  control.next = () => Promise.reject(new Error("disk full"));
  await confirmDeleteOfSet2();
  await waitFor(() => expect(screen.getByRole("button", { name: "Delete set 1 of Barbell Bench Press" })).toBeEnabled());
});
