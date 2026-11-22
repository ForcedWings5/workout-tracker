import { createDb, type WorkoutDB } from "../../src/storage/db";
import { EPOCH } from "../../src/logic/clock";
import { finishWorkout, patchWorkout, startWorkout, updateSet, deleteSession } from "../../src/storage/repo";
import { seedIfEmpty } from "../../src/storage/seed";
import { save } from "../../src/storage/write";
import { createMemoryRemote, type RemoteStore } from "../../src/sync/remote";
import { createSyncScheduler, syncOnce } from "../../src/sync/runner";

const UPPER_A = "seed-workout-upper-a";
let dbs: WorkoutDB[] = [];
async function device(): Promise<WorkoutDB> {
  const db = createDb(crypto.randomUUID());
  await seedIfEmpty(db);
  dbs.push(db);
  return db;
}
afterEach(() => {
  dbs.forEach((d) => d.close());
  dbs = [];
  vi.useRealTimers();
});

async function finishedSession(db: WorkoutDB) {
  const id = await startWorkout(db, UPPER_A);
  await updateSet(db, id, 0, 0, { weight: 65, amount: 10, done: true });
  await finishWorkout(db, id);
  return id;
}

test("dirty rows are pushed and then clean", async () => {
  const db = await device();
  const remote = createMemoryRemote();
  const id = await finishedSession(db);
  const result = await syncOnce(db, remote);
  expect(result.pushed).toBe(1);
  expect(remote.rows.get(`session:${id}`)?.data).toMatchObject({ id, status: "finished" });
  expect((await db.sessions.get(id))?.dirty).toBe(0);
  expect((await db.syncState.get("state"))?.lastSyncedAt).toBeTruthy();
});

test("a row edited while its push is in flight stays dirty", async () => {
  const db = await device();
  const inner = createMemoryRemote();
  const id = await finishedSession(db);
  const remote: RemoteStore = {
    pull: (since) => inner.pull(since),
    async push(rows) {
      await inner.push(rows);
      // A new edit lands between reading the dirty rows and clearing them.
      await updateSet(db, id, 0, 0, { weight: 70 }, "finished");
    },
  };
  await syncOnce(db, remote);
  expect((await db.sessions.get(id))?.dirty).toBe(1);
  expect((await db.sessions.get(id))?.entries[0].sets[0].weight).toBe(70);
});

test("a pulled newer row replaces an older clean one", async () => {
  const a = await device();
  const b = await device();
  const remote = createMemoryRemote();
  await patchWorkout(a, UPPER_A, (w) => void (w.name = "Upper A: Push"));
  await syncOnce(a, remote);
  const result = await syncOnce(b, remote);
  expect(result.pulled).toBe(1);
  expect(await b.workouts.get(UPPER_A)).toMatchObject({ name: "Upper A: Push", dirty: 0 });
});

test("a pulled row never overwrites a dirty local one", async () => {
  const a = await device();
  const b = await device();
  const remote = createMemoryRemote();
  await patchWorkout(a, UPPER_A, (w) => void (w.name = "From A"));
  await syncOnce(a, remote);
  await patchWorkout(b, UPPER_A, (w) => void (w.name = "From B"));
  await syncOnce(b, remote);
  expect((await b.workouts.get(UPPER_A))?.name).toBe("From B");
  // B's own edit then reaches the cloud.
  expect((remote.rows.get(`workout:${UPPER_A}`)?.data as { name: string }).name).toBe("From B");
});

test("tombstones sync both ways", async () => {
  const a = await device();
  const b = await device();
  const remote = createMemoryRemote();
  const id = await finishedSession(a);
  await syncOnce(a, remote);
  await syncOnce(b, remote);
  expect((await b.sessions.get(id))?.deleted).toBe(false);
  await deleteSession(b, id);
  await syncOnce(b, remote);
  expect(remote.rows.get(`session:${id}`)?.deleted).toBe(true);
  await syncOnce(a, remote);
  expect((await a.sessions.get(id))?.deleted).toBe(true);
});

test("untouched seed rows are never pushed, and cloud rows replace them", async () => {
  const a = await device();
  const remote = createMemoryRemote();
  const result = await syncOnce(a, remote);
  expect(result.pushed).toBe(0);
  expect(remote.rows.size).toBe(0);
  expect((await a.workouts.get(UPPER_A))?.updatedAt).toBe(EPOCH);
});

test("a fresh install that signs in gets everything back, with no duplicate workouts", async () => {
  const a = await device();
  const remote = createMemoryRemote();
  const ids = [await finishedSession(a), await finishedSession(a)];
  await patchWorkout(a, UPPER_A, (w) => void (w.name = "Upper A: Push"));
  await syncOnce(a, remote);

  const b = await device(); // reinstalled: only the seed
  await syncOnce(b, remote);
  expect((await b.sessions.toArray()).map((s) => s.id).sort()).toEqual([...ids].sort());
  expect(await b.workouts.count()).toBe(4);
  expect((await b.workouts.get(UPPER_A))?.name).toBe("Upper A: Push");
  expect((await b.sessions.toArray()).every((s) => s.dirty === 0)).toBe(true);
});

test("pull only asks for rows newer than the last pull", async () => {
  const a = await device();
  const inner = createMemoryRemote();
  const asked: (string | undefined)[] = [];
  const remote: RemoteStore = { pull: (since) => (asked.push(since), inner.pull(since)), push: (rows) => inner.push(rows) };
  await finishedSession(a);
  await syncOnce(a, remote); // nothing in the cloud yet; pushes the session
  await syncOnce(a, remote); // pulls the session back (harmless: it isn't newer) and remembers its server time
  const seen = (await a.syncState.get("state"))?.lastPulledAt;
  await syncOnce(a, remote);
  expect(asked[0]).toBeUndefined();
  expect(seen).toBeTruthy();
  expect(asked[2]).toBe(seen);
});

test("the retired rotation is never pushed, and cloud rotation rows are ignored", async () => {
  const a = await device();
  const remote = createMemoryRemote();
  await save(a.rotation, { id: "rotation", workoutIds: [UPPER_A] });
  await syncOnce(a, remote);
  expect([...remote.rows.keys()].some((k) => k.startsWith("rotation:"))).toBe(false);
  await remote.push([{ kind: "rotation", id: "rotation", data: { workoutIds: [] }, updated_at: "2031-01-01T00:00:00.000Z", deleted: false }]);
  await expect(syncOnce(a, remote)).resolves.toBeDefined();
});

test("demo history (dev only) never reaches the cloud", async () => {
  const a = await device();
  const remote = createMemoryRemote();
  await save(a.sessions, { id: "demo-session-2026-11-16", workoutName: "Upper A", date: "2026-11-16", status: "finished", entries: [] });
  await syncOnce(a, remote);
  expect(remote.rows.size).toBe(0);
});

test("the scheduler runs once for several quick triggers", async () => {
  vi.useFakeTimers();
  const run = vi.fn().mockResolvedValue(undefined);
  const s = createSyncScheduler(run, { debounceMs: 5000 });
  s.trigger();
  s.trigger();
  s.trigger();
  await vi.advanceTimersByTimeAsync(5000);
  expect(run).toHaveBeenCalledTimes(1);
  s.dispose();
});

test("a trigger during a run queues exactly one more run", async () => {
  vi.useFakeTimers();
  let release!: () => void;
  const run = vi.fn().mockImplementation(() => new Promise<void>((r) => (release = r)));
  const s = createSyncScheduler(run, { debounceMs: 10 });
  void s.runNow();
  expect(run).toHaveBeenCalledTimes(1);
  s.trigger();
  s.trigger();
  await vi.advanceTimersByTimeAsync(10);
  void s.runNow();
  expect(run).toHaveBeenCalledTimes(1);
  release();
  await vi.advanceTimersByTimeAsync(0);
  expect(run).toHaveBeenCalledTimes(2);
  release();
  await vi.advanceTimersByTimeAsync(50);
  expect(run).toHaveBeenCalledTimes(2);
  s.dispose();
});

test("a failed sync is swallowed and the next trigger tries again", async () => {
  vi.useFakeTimers();
  const run = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
  const s = createSyncScheduler(run, { debounceMs: 10 });
  await expect(s.runNow()).resolves.toBeUndefined();
  s.trigger();
  await vi.advanceTimersByTimeAsync(10);
  expect(run).toHaveBeenCalledTimes(2);
  s.dispose();
});
