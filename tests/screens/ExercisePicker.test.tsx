import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Exercise } from "../../src/logic/types";
import { ExercisePicker } from "../../src/screens/ExercisePicker";
import { DbProvider } from "../../src/storage/DbContext";
import type { WorkoutDB } from "../../src/storage/db";
import { seedExerciseId } from "../../src/storage/seed";
import { seededDb } from "./helpers";

let db: WorkoutDB;
beforeEach(async () => {
  db = await seededDb();
});
afterEach(() => db.close());

function renderPicker(onPick: (e: Exercise) => void = () => {}) {
  const user = userEvent.setup();
  render(
    <DbProvider db={db}>
      <ExercisePicker open onPick={onPick} onClose={() => {}} />
    </DbProvider>,
  );
  return user;
}

test("filters by substring, ignoring case", async () => {
  const user = renderPicker();
  const dialog = await screen.findByRole("dialog", { name: "Add exercise" });
  await within(dialog).findByRole("button", { name: /Barbell Bench Press/ });
  await user.type(within(dialog).getByLabelText("Search exercises"), "PULL");
  expect(within(dialog).getByRole("button", { name: /Lat Pulldown/ })).toBeInTheDocument();
  expect(within(dialog).queryByRole("button", { name: /Barbell Bench Press/ })).not.toBeInTheDocument();
});

test("picking an exercise hands it back", async () => {
  const onPick = vi.fn();
  const user = renderPicker(onPick);
  await user.click(await screen.findByRole("button", { name: /Lat Pulldown/ }));
  expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: seedExerciseId("Lat Pulldown") }));
});

test("a name that already exists offers no Create, so history isn't split", async () => {
  const user = renderPicker();
  await user.type(await screen.findByLabelText("Search exercises"), "  lat   PULLDOWN ");
  expect(screen.getByRole("button", { name: /Lat Pulldown/ })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /^Create/ })).not.toBeInTheDocument();
});

test("create makes a new exercise with the chosen measure and hands it back", async () => {
  const onPick = vi.fn();
  const user = renderPicker(onPick);
  await user.type(await screen.findByLabelText("Search exercises"), "Face Pull");
  expect(screen.getByText("No exercise matches “Face Pull”.")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Seconds" }));
  await user.click(screen.getByRole("button", { name: "Create “Face Pull”" }));
  await waitFor(() => expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ name: "Face Pull", measure: "seconds" })));
  expect(await db.exercises.where("name").equals("Face Pull").count()).toBe(1);
});

test("create reuses an archived exercise with the same name", async () => {
  const bench = seedExerciseId("Barbell Bench Press");
  await db.exercises.update(bench, { archived: true });
  const onPick = vi.fn();
  const user = renderPicker(onPick);
  await user.type(await screen.findByLabelText("Search exercises"), "barbell bench press");
  await user.click(screen.getByRole("button", { name: "Create “barbell bench press”" }));
  await waitFor(() => expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: bench, archived: false })));
});
