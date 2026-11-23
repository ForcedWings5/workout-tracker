import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { WorkoutDB } from "../../src/storage/db";
import { finishWorkout, startWorkout, updateSet } from "../../src/storage/repo";
import { renderApp, seededDb } from "./helpers";

type Status = "off" | "checking" | "signed-out" | "signed-in";

// A stand-in for Supabase sign-in, so the screens can be tested without a network.
const auth = vi.hoisted(() => {
  let state: { status: Status; email?: string } = { status: "signed-out" };
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(next: { status: Status; email?: string }) {
      state = next;
      listeners.forEach((l) => l());
    },
    subscribe(l: () => void) {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
  };
});

vi.mock("../../src/sync/supabase", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    getSupabase: () => null,
    createSupabaseRemote: vi.fn(),
    useAuth: () => useSyncExternalStore(auth.subscribe, auth.get),
    sendCode: vi.fn(async () => {}),
    verifyCode: vi.fn(async (email: string) => auth.set({ status: "signed-in", email })),
    signOut: vi.fn(async () => auth.set({ status: "signed-out" })),
  };
});

let db: WorkoutDB;
beforeEach(async () => {
  db = await seededDb();
  auth.set({ status: "signed-out" });
  localStorage.clear();
});
afterEach(() => db.close());

async function openSettings() {
  const user = userEvent.setup();
  renderApp(db);
  await user.click(await screen.findByRole("button", { name: "Settings" }));
  await screen.findByRole("heading", { level: 1, name: "Settings" });
  return user;
}

test("signed out, Cloud backup says the workouts aren't backed up", async () => {
  await openSettings();
  expect(screen.getByText("Not backed up")).toBeInTheDocument();
  expect(screen.getByLabelText("Email")).toHaveAttribute("placeholder", "you@example.com");
});

test("Send code asks for the 6-digit code; the right code signs in", async () => {
  const user = await openSettings();
  await user.type(screen.getByLabelText("Email"), "a@b.co");
  await user.click(screen.getByRole("button", { name: "Send code" }));
  const code = await screen.findByLabelText("6-digit code");
  expect(code).toHaveAttribute("inputmode", "numeric");
  expect(code).toHaveAttribute("autocomplete", "one-time-code");
  expect(screen.getByText("We sent a code to a@b.co.")).toBeInTheDocument();
  await user.type(code, "123456");
  await user.click(screen.getByRole("button", { name: "Sign in" }));
  expect(await screen.findByText("Signed in as a@b.co")).toBeInTheDocument();
});

test("a wrong code says so and lets you try again", async () => {
  const { verifyCode } = await import("../../src/sync/supabase");
  vi.mocked(verifyCode).mockRejectedValueOnce(new Error("Token has expired or is invalid"));
  const user = await openSettings();
  await user.type(screen.getByLabelText("Email"), "a@b.co");
  await user.click(screen.getByRole("button", { name: "Send code" }));
  await user.type(await screen.findByLabelText("6-digit code"), "000000");
  await user.click(screen.getByRole("button", { name: "Sign in" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("That code didn't work. Check it, or send a new one.");
  expect(screen.getByLabelText("6-digit code")).toBeInTheDocument();
});

test("signed in, it shows the account, when it last synced and what's waiting", async () => {
  auth.set({ status: "signed-in", email: "a@b.co" });
  const id = await startWorkout(db, "seed-workout-upper-a");
  await updateSet(db, id, 0, 0, { weight: 65, amount: 10, done: true });
  await finishWorkout(db, id);
  await openSettings();
  expect(screen.getByText("Signed in as a@b.co")).toBeInTheDocument();
  expect(await screen.findByText("Not synced yet · 1 change waiting")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Sync now" })).toBeInTheDocument();
});

test("without cloud keys in this build, the notice says so and Today has no reminder", async () => {
  auth.set({ status: "off" });
  const user = await openSettings();
  expect(screen.getByText("Cloud backup isn't set up in this build.")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Today" }));
  await screen.findByRole("heading", { level: 1, name: "Today" });
  expect(screen.queryByText(/aren't backed up yet/)).not.toBeInTheDocument();
});

test("signing out keeps every workout and session on the phone", async () => {
  auth.set({ status: "signed-in", email: "a@b.co" });
  const id = await startWorkout(db, "seed-workout-upper-a");
  await updateSet(db, id, 0, 0, { weight: 65, amount: 10, done: true });
  await finishWorkout(db, id);
  const before = { sessions: await db.sessions.count(), workouts: await db.workouts.count(), exercises: await db.exercises.count() };
  const user = await openSettings();
  await user.click(screen.getByRole("button", { name: "Sign out" }));
  expect(await screen.findByText("Not backed up")).toBeInTheDocument();
  expect({ sessions: await db.sessions.count(), workouts: await db.workouts.count(), exercises: await db.exercises.count() }).toEqual(before);
});

test("signed out, Today nudges once and the nudge can be dismissed for good", async () => {
  const user = userEvent.setup();
  const view = renderApp(db);
  expect(await screen.findByText("Your workouts aren't backed up yet. Sign in under Settings.")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Dismiss" }));
  await waitFor(() => expect(screen.queryByText(/aren't backed up yet/)).not.toBeInTheDocument());
  view.unmount();
  renderApp(db);
  await screen.findByRole("heading", { level: 1, name: "Today" });
  expect(screen.queryByText(/aren't backed up yet/)).not.toBeInTheDocument();
});

test("Final: while sign-in is still being checked, Today shows no nudge", async () => {
  auth.set({ status: "checking" as Status });
  renderApp(db);
  await screen.findByRole("heading", { level: 1, name: "Today" });
  expect(screen.queryByText(/aren't backed up yet/)).not.toBeInTheDocument();
});
