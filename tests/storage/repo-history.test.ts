import { createDb, type WorkoutDB } from "../../src/storage/db";
import { seedIfEmpty } from "../../src/storage/seed";
import { deleteSession, finishWorkout, setSessionDate, startWorkout, updateSet } from "../../src/storage/repo";

let db: WorkoutDB;
beforeEach(async () => {
  db = createDb(crypto.randomUUID());
  await seedIfEmpty(db);
});
afterEach(() => db.close());

async function finished() {
  const id = await startWorkout(db, "seed-workout-upper-a");
  await updateSet(db, id, 0, 0, { weight: 65, amount: 10, done: true });
  await finishWorkout(db, id);
  return id;
}

test("a finished session can be edited when the write says so", async () => {
  const id = await finished();
  await updateSet(db, id, 0, 0, { weight: 70 }, "finished");
  expect((await db.sessions.get(id))!.entries[0].sets[0].weight).toBe(70);
});

test("a past-session write refuses a workout still in progress", async () => {
  const id = await startWorkout(db, "seed-workout-upper-a");
  await expect(updateSet(db, id, 0, 0, { weight: 70 }, "finished")).rejects.toThrow("This workout is still in progress");
});

test("setSessionDate saves a valid date and refuses anything else", async () => {
  const id = await finished();
  await setSessionDate(db, id, "2026-11-13");
  expect((await db.sessions.get(id))!.date).toBe("2026-11-13");
  await expect(setSessionDate(db, id, "")).rejects.toThrow("Pick a date");
  await expect(setSessionDate(db, id, "2026-13-40")).rejects.toThrow("Pick a date");
  expect((await db.sessions.get(id))!.date).toBe("2026-11-13");
});

test("deleteSession leaves a tombstone so it syncs", async () => {
  const id = await finished();
  await deleteSession(db, id);
  expect(await db.sessions.get(id)).toMatchObject({ deleted: true, dirty: 1 });
});

test("Final: setSessionDate refuses a day after today", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-20T15:00:00Z"));
  const id = await finished();
  await expect(setSessionDate(db, id, "2026-11-21")).rejects.toThrow("Pick today or an earlier day");
  await setSessionDate(db, id, "2026-11-20");
  expect((await db.sessions.get(id))!.date).toBe("2026-11-20");
  vi.useRealTimers();
});
