import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { WorkoutDB } from "../../src/storage/db";
import { exportBackup, finishWorkout, startWorkout, updateSet } from "../../src/storage/repo";
import { renderApp, seededDb } from "./helpers";

let db: WorkoutDB;
beforeEach(async () => {
  db = await seededDb();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  // jsdom has no share API; remove anything a test put on navigator.
  delete (navigator as { canShare?: unknown }).canShare;
  delete (navigator as { share?: unknown }).share;
  db.close();
});

async function openSettings() {
  const user = userEvent.setup();
  renderApp(db);
  await user.click(await screen.findByRole("button", { name: "Settings" }));
  await screen.findByRole("heading", { level: 1, name: "Settings" });
  return user;
}

test("export shares one backup file when the phone can share files", async () => {
  const share = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { canShare: () => true, share });
  const user = await openSettings();
  await user.click(screen.getByRole("button", { name: "Export backup" }));
  await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
  const files: File[] = share.mock.calls[0][0].files;
  expect(files).toHaveLength(1);
  expect(files[0].name).toMatch(/^workout-tracker-backup-\d{4}-\d{2}-\d{2}\.json$/);
  expect(JSON.parse(await files[0].text()).version).toBe(2);
  expect(await screen.findByText(/^Last export: \d+\/\d+$/)).toBeInTheDocument();
  expect((await db.syncState.get("state"))?.lastExportAt).toBeTruthy();
});

test("without file sharing, export downloads the file instead", async () => {
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:backup"), revokeObjectURL: vi.fn() }));
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  const user = await openSettings();
  await user.click(screen.getByRole("button", { name: "Export backup" }));
  await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
  const anchor = click.mock.instances[0] as unknown as HTMLAnchorElement;
  expect(anchor.download).toMatch(/^workout-tracker-backup-\d{4}-\d{2}-\d{2}\.json$/);
  expect(await screen.findByText(/^Last export: /)).toBeInTheDocument();
});

test("closing the share sheet without saving isn't counted as an export", async () => {
  const share = vi.fn().mockRejectedValue(new DOMException("cancelled", "AbortError"));
  Object.assign(navigator, { canShare: () => true, share });
  const user = await openSettings();
  await user.click(screen.getByRole("button", { name: "Export backup" }));
  await waitFor(() => expect(share).toHaveBeenCalled());
  expect(screen.getByText("No backup exported yet.")).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("an invalid file shows what's wrong and changes nothing", async () => {
  const user = await openSettings();
  await user.upload(screen.getByLabelText("Choose a backup file"), new File(["not a backup"], "notes.json", { type: "application/json" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("This file isn't a Workout Tracker backup.");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("a valid file asks first, then replaces everything", async () => {
  const id = await startWorkout(db, "seed-workout-upper-a");
  await updateSet(db, id, 0, 0, { weight: 65, amount: 10, done: true });
  await finishWorkout(db, id);
  const backup = await exportBackup(db);
  await db.sessions.clear();
  const user = await openSettings();
  await user.upload(screen.getByLabelText("Choose a backup file"), new File([JSON.stringify(backup)], "b.json", { type: "application/json" }));
  const sheet = await screen.findByRole("dialog", { name: "Replace everything on this phone with this backup?" });
  await user.click(within(sheet).getByRole("button", { name: "Replace everything" }));
  expect(await screen.findByText("Backup imported.")).toBeInTheDocument();
  expect((await db.sessions.get(id))?.status).toBe("finished");
});

test("Keep what's here leaves the phone as it was", async () => {
  const backup = await exportBackup(db);
  const id = await startWorkout(db, "seed-workout-upper-a");
  const user = await openSettings();
  await user.upload(screen.getByLabelText("Choose a backup file"), new File([JSON.stringify(backup)], "b.json", { type: "application/json" }));
  await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Keep what's here" }));
  expect(await db.sessions.get(id)).toBeDefined();
});

test("the home-screen note is there", async () => {
  await openSettings();
  expect(screen.getByText("Always open Workouts from the home-screen icon.")).toBeInTheDocument();
});

test("Final: if iOS refuses to share (too long after the tap), the file downloads instead", async () => {
  const share = vi.fn().mockRejectedValue(new DOMException("needs a fresh tap", "NotAllowedError"));
  Object.assign(navigator, { canShare: () => true, share });
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:backup"), revokeObjectURL: vi.fn() }));
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  const user = await openSettings();
  await user.click(screen.getByRole("button", { name: "Export backup" }));
  await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(await screen.findByText(/^Last export: /)).toBeInTheDocument();
});
