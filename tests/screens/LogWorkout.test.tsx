import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LogWorkout } from "../../src/screens/LogWorkout";
import { DbProvider } from "../../src/storage/DbContext";
import type { WorkoutDB } from "../../src/storage/db";
import { finishWorkout, setNote, startWorkout, updateSet } from "../../src/storage/repo";
import { seedExerciseId } from "../../src/storage/seed";
import { seededDb } from "./helpers";

const UPPER_A = "seed-workout-upper-a";
const LOWER_A = "seed-workout-lower-a";
let db: WorkoutDB;

beforeEach(async () => {
  db = await seededDb();
});
afterEach(() => db.close());

function renderLog(sessionId: string, onClose = () => {}) {
  return render(
    <DbProvider db={db}>
      <LogWorkout sessionId={sessionId} onClose={onClose} />
    </DbProvider>,
  );
}

/** Finishes an Upper A with bench 65×10 on 11/12, with a note. */
async function benchHistory() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-12T15:00:00Z"));
  const id = await startWorkout(db, UPPER_A);
  await updateSet(db, id, 0, 0, { weight: 65, amount: 10, done: true });
  await setNote(db, id, 0, "form shaky last set");
  await finishWorkout(db, id);
  vi.useRealTimers();
}

const sets = async (id: string) => (await db.sessions.get(id))!.entries[0].sets;

test("pre-filled numbers show in draft ink and the mark says not done", async () => {
  await benchHistory();
  const id = await startWorkout(db, UPPER_A);
  renderLog(id);
  const mark = await screen.findByRole("button", { name: "Set 1: 65 lb, 10 reps, not done" });
  expect(mark).toHaveAttribute("aria-pressed", "false");
  const weight = screen.getAllByLabelText("Set 1 weight")[0];
  expect(weight).toHaveValue("65");
  expect(weight.closest(".num")).toHaveClass("num--draft");
});

test("the first unconfirmed set is the current one", async () => {
  const id = await startWorkout(db, UPPER_A);
  renderLog(id);
  const bench = await screen.findByRole("region", { name: "Barbell Bench Press" });
  const row = await screen.findByRole("region", { name: "Cable Row (Narrow Grip)" });
  expect(within(bench).getByRole("button", { name: "Set 1: bodyweight, no reps, not done" })).toHaveClass("mark--current");
  expect(within(bench).getByRole("button", { name: "Set 2: bodyweight, no reps, not done" })).toHaveClass("mark--suggested");
  expect(within(row).getByRole("button", { name: "Set 1: bodyweight, no reps, not done" })).toHaveClass("mark--suggested");
});

test("tapping the mark confirms the set in red and saves done", async () => {
  await benchHistory();
  const id = await startWorkout(db, UPPER_A);
  renderLog(id);
  await userEvent.click(await screen.findByRole("button", { name: "Set 1: 65 lb, 10 reps, not done" }));
  const mark = await screen.findByRole("button", { name: "Set 1: 65 lb, 10 reps, done" });
  expect(mark).toHaveClass("mark--done");
  expect((await sets(id))[0].done).toBe(true);
  expect(screen.getAllByLabelText("Set 1 weight")[0].closest(".num")).not.toHaveClass("num--draft");
});

test("tapping a done mark un-confirms it", async () => {
  const id = await startWorkout(db, UPPER_A);
  await updateSet(db, id, 0, 0, { weight: 65, amount: 10, done: true });
  renderLog(id);
  await userEvent.click(await screen.findByRole("button", { name: "Set 1: 65 lb, 10 reps, done" }));
  await screen.findByRole("button", { name: "Set 1: 65 lb, 10 reps, not done" });
  expect((await sets(id))[0].done).toBe(false);
});

test("editing the weight saves it and keeps the set not done", async () => {
  await benchHistory();
  const id = await startWorkout(db, UPPER_A);
  renderLog(id);
  const weight = (await screen.findAllByLabelText("Set 1 weight"))[0];
  await userEvent.clear(weight);
  await userEvent.type(weight, "70");
  await userEvent.tab();
  await waitFor(async () => expect((await sets(id))[0]).toMatchObject({ weight: 70, done: false }));
});

test("+ Set adds a fifth bench row", async () => {
  const id = await startWorkout(db, UPPER_A);
  renderLog(id);
  await userEvent.click(await screen.findByRole("button", { name: "Add a set to Barbell Bench Press" }));
  expect(await screen.findByRole("button", { name: "Set 5: bodyweight, no reps, not done" })).toBeInTheDocument();
  expect(await sets(id)).toHaveLength(5);
});

test("tapping a set number skips a pre-filled set and tapping again restores it", async () => {
  await benchHistory();
  const id = await startWorkout(db, UPPER_A);
  renderLog(id);
  await userEvent.click((await screen.findAllByRole("button", { name: "Skip set 1" }))[0]);
  expect(await screen.findByRole("button", { name: "Set 1: 65 lb, 10 reps, skipped" })).toHaveClass("mark--skipped");
  expect((await sets(id))[0].skipped).toBe(true);
  await userEvent.click(screen.getAllByRole("button", { name: "Restore set 1" })[0]);
  await screen.findByRole("button", { name: "Set 1: 65 lb, 10 reps, not done" });
});

test("Fulfill with nothing done offers to discard", async () => {
  const id = await startWorkout(db, UPPER_A);
  const onClose = vi.fn();
  renderLog(id, onClose);
  await userEvent.click(await screen.findByRole("button", { name: "Fulfill contract" }));
  const sheet = await screen.findByRole("dialog", { name: "Nothing logged yet" });
  expect(within(sheet).getByText("Discard this workout?")).toBeInTheDocument();
  await userEvent.click(within(sheet).getByRole("button", { name: "Keep logging" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect((await db.sessions.get(id))?.status).toBe("in_progress");
  await userEvent.click(screen.getByRole("button", { name: "Fulfill contract" }));
  await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Discard workout" }));
  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect((await db.sessions.get(id))?.deleted).toBe(true);
});

test("Fulfill after one done set stamps Fulfilled and Done returns to Today", async () => {
  const id = await startWorkout(db, UPPER_A);
  await updateSet(db, id, 0, 0, { weight: 65, amount: 10, done: true });
  const onClose = vi.fn();
  renderLog(id, onClose);
  await userEvent.click(await screen.findByRole("button", { name: "Fulfill contract" }));
  expect(await screen.findByText("Fulfilled")).toBeInTheDocument();
  expect((await db.sessions.get(id))?.status).toBe("finished");
  await userEvent.click(screen.getByRole("button", { name: "Done" }));
  expect(onClose).toHaveBeenCalled();
});

test("the last note shows its date and text", async () => {
  await benchHistory();
  const id = await startWorkout(db, UPPER_A);
  renderLog(id);
  const bench = await screen.findByRole("region", { name: "Barbell Bench Press" });
  expect(within(bench).getByText("11/12")).toBeInTheDocument();
  expect(within(bench).getByText("form shaky last set")).toBeInTheDocument();
  expect(within(bench).getByText("4 × 6–10")).toBeInTheDocument();
});

test("typing a note saves it on blur", async () => {
  const id = await startWorkout(db, UPPER_A);
  renderLog(id);
  const note = await screen.findByLabelText("Note for Barbell Bench Press");
  await userEvent.type(note, "felt strong");
  await userEvent.tab();
  await waitFor(async () => expect((await db.sessions.get(id))?.entries[0].note).toBe("felt strong"));
});

test("Plank rows use sec and a hold bar proportional to the seconds", async () => {
  const id = await startWorkout(db, LOWER_A);
  const plankIndex = (await db.sessions.get(id))!.entries.findIndex((e) => e.exerciseId === seedExerciseId("Plank"));
  await updateSet(db, id, plankIndex, 0, { amount: 30 });
  renderLog(id);
  const plank = await screen.findByRole("region", { name: "Plank" });
  expect(within(plank).getAllByText("sec").length).toBeGreaterThan(0);
  expect(within(plank).getByText("2 × 45 sec")).toBeInTheDocument();
  const bars = plank.querySelectorAll<HTMLElement>(".hold__fill");
  expect(bars).toHaveLength(2);
  expect(parseFloat(bars[0].style.width)).toBeCloseTo(66.67, 1);
  expect(parseFloat(bars[1].style.width)).toBe(0);
});

test("the header shows the set count", async () => {
  const id = await startWorkout(db, UPPER_A);
  await updateSet(db, id, 0, 0, { weight: 65, amount: 10, done: true });
  renderLog(id);
  expect(await screen.findByText("Horizontal Push & Pull · 1 of 15 sets")).toBeInTheDocument();
});
