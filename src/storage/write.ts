import type { Table } from "dexie";
import { nowIso } from "../logic/clock";
import type { SyncMeta } from "../logic/types";

/**
 * The one way to write a synced record: stamps updatedAt and marks it dirty,
 * so the sync runner pushes it.
 */
export async function save<T extends SyncMeta>(
  table: Table<T, string>,
  record: Omit<T, "updatedAt" | "dirty" | "deleted"> & Partial<Pick<T, "deleted">>,
): Promise<T> {
  const row = { deleted: false, ...record, updatedAt: nowIso(), dirty: 1 } as unknown as T;
  await table.put(row);
  return row;
}

/** Deletes are tombstones, so they sync. */
export async function remove<T extends SyncMeta>(table: Table<T, string>, id: string): Promise<void> {
  const row = await table.get(id);
  if (!row) return;
  await save(table, { ...row, deleted: true });
}

/** Drops tombstones. Every read goes through this. */
export function live<T extends SyncMeta>(rows: T[]): T[] {
  return rows.filter((r) => !r.deleted);
}
