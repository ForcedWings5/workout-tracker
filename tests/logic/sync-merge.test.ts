import { fromRemoteRow, newestSyncedAt, shouldApplyRemote, toRemoteRow } from "../../src/logic/sync-merge";
import type { SyncMeta } from "../../src/logic/types";

const local = (over: Partial<SyncMeta> = {}): SyncMeta => ({ id: "a", updatedAt: "2026-11-20T10:00:00.000Z", deleted: false, dirty: 0, ...over });

test("a remote row applies when there's no local copy", () => {
  expect(shouldApplyRemote(undefined, { updatedAt: "2026-11-20T10:00:00.000Z" })).toBe(true);
});

test("a newer remote row replaces a clean older local one", () => {
  expect(shouldApplyRemote(local(), { updatedAt: "2026-11-21T10:00:00.000Z" })).toBe(true);
});

test("a remote row never overwrites a dirty local one, however new", () => {
  expect(shouldApplyRemote(local({ dirty: 1 }), { updatedAt: "2099-01-01T00:00:00.000Z" })).toBe(false);
});

test("an older or equal remote row doesn't replace the local one", () => {
  expect(shouldApplyRemote(local(), { updatedAt: "2026-11-19T10:00:00.000Z" })).toBe(false);
  expect(shouldApplyRemote(local(), { updatedAt: "2026-11-20T10:00:00.000Z" })).toBe(false);
});

test("timestamps compare as times, not text (the server writes +00:00, the phone writes Z)", () => {
  expect(shouldApplyRemote(local({ updatedAt: "2026-11-20T10:00:00.000Z" }), { updatedAt: "2026-11-20T10:00:01+00:00" })).toBe(true);
  expect(shouldApplyRemote(local({ updatedAt: "2026-11-20T10:00:01.000Z" }), { updatedAt: "2026-11-20T10:00:00+00:00" })).toBe(false);
});

test("a record goes to the cloud whole, without its dirty flag, and comes back clean", () => {
  const record = { ...local({ dirty: 1, deleted: true }), name: "Bench" };
  const row = toRemoteRow("exercise", record);
  expect(row).toEqual({ kind: "exercise", id: "a", data: { id: "a", updatedAt: "2026-11-20T10:00:00.000Z", deleted: true, name: "Bench" }, updated_at: "2026-11-20T10:00:00.000Z", deleted: true });
  const back = fromRemoteRow({ ...row, updated_at: "2026-11-20T10:00:00+00:00", synced_at: "2030-01-01T00:00:00+00:00" });
  expect(back).toEqual({ id: "a", name: "Bench", updatedAt: "2026-11-20T10:00:00.000Z", deleted: true, dirty: 0 });
});

test("newestSyncedAt keeps the latest server time", () => {
  const rows = [{ synced_at: "2030-01-01T00:00:02+00:00" }, { synced_at: "2030-01-01T00:00:05.123456+00:00" }] as never[];
  expect(newestSyncedAt(rows)).toBe("2030-01-01T00:00:05.123456+00:00");
  expect(newestSyncedAt([], "2030-01-01T00:00:01+00:00")).toBe("2030-01-01T00:00:01+00:00");
  expect(newestSyncedAt(rows, "2031-01-01T00:00:00+00:00")).toBe("2031-01-01T00:00:00+00:00");
  expect(newestSyncedAt([])).toBeUndefined();
});
