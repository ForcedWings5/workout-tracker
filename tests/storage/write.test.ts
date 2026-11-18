import { createDb, type WorkoutDB } from "../../src/storage/db";
import { live, remove, save } from "../../src/storage/write";
import type { Exercise } from "../../src/logic/types";

let db: WorkoutDB;

beforeEach(() => {
  db = createDb(crypto.randomUUID());
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-18T15:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  db.close();
});

const bench = { id: "ex-1", name: "Barbell Bench Press", measure: "reps", archived: false } as const;

test("save stamps updatedAt, dirty and deleted", async () => {
  const saved = await save(db.exercises, bench);
  expect(saved).toMatchObject({ updatedAt: "2026-11-18T15:00:00.000Z", dirty: 1, deleted: false });
  expect(await db.exercises.get("ex-1")).toEqual(saved);
});

test("saving again updates updatedAt", async () => {
  await save(db.exercises, bench);
  vi.setSystemTime(new Date("2026-11-18T16:00:00Z"));
  await save(db.exercises, { ...bench, name: "Bench Press" });
  const row = await db.exercises.get("ex-1");
  expect(row?.updatedAt).toBe("2026-11-18T16:00:00.000Z");
  expect(row?.name).toBe("Bench Press");
});

test("save clears the dirty flag only through a save, never leaves it 0", async () => {
  await db.exercises.put({ ...bench, updatedAt: "1970-01-01T00:00:00.000Z", dirty: 0, deleted: false });
  await save(db.exercises, bench);
  expect((await db.exercises.get("ex-1"))?.dirty).toBe(1);
});

test("remove keeps the row as a dirty tombstone", async () => {
  await save(db.exercises, bench);
  await remove(db.exercises, "ex-1");
  expect(await db.exercises.get("ex-1")).toMatchObject({ deleted: true, dirty: 1, name: "Barbell Bench Press" });
});

test("live drops deleted rows", () => {
  const meta = { updatedAt: "x", dirty: 0 as const };
  const rows: Exercise[] = [
    { ...bench, ...meta, deleted: false },
    { ...bench, ...meta, id: "ex-2", deleted: true },
  ];
  expect(live(rows).map((r) => r.id)).toEqual(["ex-1"]);
});
