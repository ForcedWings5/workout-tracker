import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { WorkoutDB } from "../../src/storage/db";
import { finishWorkout, startWorkout, updateSet } from "../../src/storage/repo";
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

/** Finishes a workout on `date` with the first exercise's sets done as given. */
async function finish(workoutId: string, date: string, sets: [number, number][], note?: string) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${date}T15:00:00Z`));
  const id = await startWorkout(db, workoutId);
  for (const [i, [weight, amount]] of sets.entries()) await updateSet(db, id, 0, i, { weight, amount, done: true });
  if (note) {
    const { setNote } = await import("../../src/storage/repo");
    await setNote(db, id, 0, note);
  }
  await finishWorkout(db, id);
  vi.useRealTimers();
  return id;
}

async function benchHistory() {
  await finish(UPPER_A, "2026-11-05", [[65, 10], [85, 6]]);
  await finish(UPPER_A, "2026-11-08", [[65, 10], [85, 8]]);
  return finish(UPPER_A, "2026-11-12", [[65, 10], [75, 8], [85, 8], [95, 6]], "form shaky last set");
}

async function openProgress() {
  const user = userEvent.setup();
  renderApp(db);
  await user.click(await screen.findByRole("button", { name: "Progress" }));
  return user;
}

async function openBench() {
  const user = await openProgress();
  await user.click(await screen.findByRole("button", { name: /^Barbell Bench Press/ }));
  await screen.findByRole("heading", { level: 1, name: "Barbell Bench Press" });
  return user;
}

test("the Progress list orders exercises by when they were last done", async () => {
  await finish(UPPER_A, "2026-11-05", [[65, 10]]);
  await finish(LOWER_A, "2026-11-10", [[135, 5]]);
  await openProgress();
  const rows = await screen.findAllByRole("button", { name: /last \d+\/\d+$/ });
  expect(rows.map((r) => r.textContent)).toEqual(["Barbell Squats, last 11/10", "Barbell Bench Press, last 11/5"]);
});

test("with no finished workouts, Progress says what to do", async () => {
  await openProgress();
  expect(await screen.findByText(/No sessions yet\. Finish a workout/)).toBeInTheDocument();
});

test("the bench chart has a point per session and a plain title", async () => {
  await benchHistory();
  await openBench();
  const chart = screen.getByRole("img", { name: "Heaviest set per session" });
  expect(chart.querySelectorAll("circle")).toHaveLength(3);
});

test("only the record point gets the record look", async () => {
  await benchHistory();
  await openBench();
  const points = screen.getByRole("img", { name: "Heaviest set per session" }).querySelectorAll("circle");
  expect([...points].map((p) => p.classList.contains("chart__point--record"))).toEqual([false, false, true]);
});

test("past sessions list newest first, with sets and the note", async () => {
  await benchHistory();
  await openBench();
  const rows = screen.getAllByRole("button", { name: /^\d+\/\d+ · / });
  expect(rows[0]).toHaveTextContent("11/12 · 65×10 75×8 85×8 95×6");
  expect(rows[0]).toHaveTextContent("form shaky last set");
  expect(rows).toHaveLength(3);
});

test("opening a past session edits it: no timer, Done instead of Fulfill contract", async () => {
  await benchHistory();
  const user = await openBench();
  await user.click(screen.getAllByRole("button", { name: /^11\/12 · / })[0]);
  expect(await screen.findByLabelText("Date")).toHaveValue("2026-11-12");
  expect(screen.queryByRole("button", { name: "Fulfill contract" })).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/^Elapsed/)).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Done" }));
  expect(await screen.findByRole("heading", { level: 1, name: "Barbell Bench Press" })).toBeInTheDocument();
});

test("changing a past session's date saves it", async () => {
  const id = await benchHistory();
  const user = await openBench();
  await user.click(screen.getAllByRole("button", { name: /^11\/12 · / })[0]);
  fireEvent.change(await screen.findByLabelText("Date"), { target: { value: "2026-11-13" } });
  await waitFor(async () => expect((await db.sessions.get(id))?.date).toBe("2026-11-13"));
});

test("editing a past set saves it", async () => {
  const id = await benchHistory();
  const user = await openBench();
  await user.click(screen.getAllByRole("button", { name: /^11\/12 · / })[0]);
  const bench = await screen.findByRole("region", { name: "Barbell Bench Press" });
  const weight = within(bench).getByLabelText("Set 4 weight");
  await user.clear(weight);
  await user.type(weight, "100");
  await user.tab();
  await waitFor(async () => expect((await db.sessions.get(id))?.entries[0].sets[3].weight).toBe(100));
});

test("Delete session asks first, then the session leaves the list", async () => {
  const id = await benchHistory();
  const user = await openBench();
  await user.click(screen.getAllByRole("button", { name: /^11\/12 · / })[0]);
  await user.click(await screen.findByRole("button", { name: "Delete session" }));
  const sheet = screen.getByRole("dialog", { name: "Delete this session?" });
  await user.click(within(sheet).getByRole("button", { name: "Delete session" }));
  await screen.findByRole("heading", { level: 1, name: "Barbell Bench Press" });
  await waitFor(() => expect(screen.getAllByRole("button", { name: /^\d+\/\d+ · / })).toHaveLength(2));
  expect((await db.sessions.get(id))?.deleted).toBe(true);
});

test("a set that beats every earlier one shows Record, in the session where it happened", async () => {
  await benchHistory();
  const user = await openBench();
  await user.click(screen.getAllByRole("button", { name: /^11\/12 · / })[0]);
  const bench = await screen.findByRole("region", { name: "Barbell Bench Press" });
  expect(within(bench).getAllByText("Record")).toHaveLength(1);
  const rows = bench.querySelectorAll(".set");
  expect(rows[3]).toHaveTextContent("Record");
});

test("Final: closing a past session with nothing ticked asks to delete it, since it can't be found again", async () => {
  const id = await benchHistory();
  const user = await openBench();
  await user.click(screen.getAllByRole("button", { name: /^11\/12 · / })[0]);
  await user.click(await screen.findByRole("button", { name: "Delete sets or exercises" }));
  await user.click(screen.getByRole("button", { name: "Remove Barbell Bench Press from this session" }));
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Remove exercise" }));
  await waitFor(() => expect(screen.queryByRole("region", { name: "Barbell Bench Press" })).not.toBeInTheDocument());
  await user.click(screen.getByRole("button", { name: "Done deleting" }));
  await user.click(screen.getByRole("button", { name: "Done" }));
  const sheet = await screen.findByRole("dialog", { name: "Delete this session?" });
  expect(within(sheet).getByText(/Nothing in it is ticked/)).toBeInTheDocument();
  await user.click(within(sheet).getByRole("button", { name: "Keep editing" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect((await db.sessions.get(id))?.deleted).toBe(false);
  await user.click(screen.getByRole("button", { name: "Barbell Bench Press" }));
  await user.click(within(await screen.findByRole("dialog", { name: "Delete this session?" })).getByRole("button", { name: "Delete session" }));
  await screen.findByRole("heading", { level: 1, name: "Barbell Bench Press" });
  expect((await db.sessions.get(id))?.deleted).toBe(true);
});

test("Final: the date field doesn't offer days after today", async () => {
  await benchHistory();
  const user = await openBench();
  await user.click(screen.getAllByRole("button", { name: /^11\/12 · / })[0]);
  const { todayLocal } = await import("../../src/logic/clock");
  expect(await screen.findByLabelText("Date")).toHaveAttribute("max", todayLocal());
});
