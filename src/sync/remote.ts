// The cloud copy, behind a small interface so the sync runner can be tested against memory.
import type { Kind } from "../logic/types";

/** One row of the cloud `records` table. `synced_at` is the server's clock, set on every write. */
export type RemoteRow = { kind: Kind; id: string; data: unknown; updated_at: string; deleted: boolean; synced_at: string };

export interface RemoteStore {
  /** Rows written after `since` (server time), oldest first; everything when `since` is absent. */
  pull(since?: string): Promise<RemoteRow[]>;
  /** Inserts or replaces rows by kind and id. */
  push(rows: Omit<RemoteRow, "synced_at">[]): Promise<void>;
}

/** An in-memory cloud for tests. Server times come from a counter, so later writes always sort later. */
export function createMemoryRemote(): RemoteStore & { rows: Map<string, RemoteRow> } {
  const rows = new Map<string, RemoteRow>();
  let clock = 0;
  const stamp = () => new Date(Date.UTC(2030, 0, 1) + ++clock * 1000).toISOString();
  return {
    rows,
    async pull(since) {
      return [...rows.values()].filter((r) => !since || r.synced_at > since).sort((a, b) => a.synced_at.localeCompare(b.synced_at));
    },
    async push(batch) {
      for (const r of batch) rows.set(`${r.kind}:${r.id}`, { ...structuredClone(r), synced_at: stamp() });
    },
  };
}
