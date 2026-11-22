// One sync: pull, then push. Talks to Dexie and the cloud; screens never wait on it.
import type { Table } from "dexie";
import { nowIso } from "../logic/clock";
import { fromRemoteRow, isDemoId, newestSyncedAt, shouldApplyRemote, toRemoteRow } from "../logic/sync-merge";
import type { Kind, SyncMeta } from "../logic/types";
import type { WorkoutDB } from "../storage/db";
import type { RemoteStore } from "./remote";

type SyncedKind = Extract<Kind, "exercise" | "workout" | "schedule" | "session">;

const PULL_OVERLAP_MS = 5 * 60 * 1000;

/** The synced tables. The retired rotation table is deliberately not here: it's never pushed or pulled. */
function tables(db: WorkoutDB): Record<SyncedKind, Table<SyncMeta, string>> {
  return {
    exercise: db.exercises as unknown as Table<SyncMeta, string>,
    workout: db.workouts as unknown as Table<SyncMeta, string>,
    schedule: db.schedule as unknown as Table<SyncMeta, string>,
    session: db.sessions as unknown as Table<SyncMeta, string>,
  };
}


export async function syncOnce(db: WorkoutDB, remote: RemoteStore): Promise<{ pulled: number; pushed: number }> {
  const byKind = tables(db);
  const all = [...Object.values(byKind), db.syncState] as Table[];

  // Pull: everything the server wrote since last time, by the server's clock.
  const state = (await db.syncState.get("state")) ?? { id: "state" as const };
  // Ask from a few minutes before the last server time seen: a write's server time is when its
  // transaction began, so one that committed late could otherwise be skipped for good. Re-pulled
  // rows are harmless; they aren't newer, so they're not applied again.
  const since = state.lastPulledAt ? new Date(Date.parse(state.lastPulledAt) - PULL_OVERLAP_MS).toISOString() : undefined;
  const rows = await remote.pull(since);
  let pulled = 0;
  await db.transaction("rw", all, async () => {
    for (const row of rows) {
      const table = byKind[row.kind as SyncedKind];
      if (!table) continue; // e.g. "rotation": retired
      const local = await table.get(row.id);
      if (!shouldApplyRemote(local, { updatedAt: row.updated_at })) continue;
      // Pulled rows are written as they are, clean: never through save(), which would mark them dirty.
      await table.put(fromRemoteRow(row));
      pulled++;
    }
    const current = (await db.syncState.get("state")) ?? { id: "state" as const };
    await db.syncState.put({ ...current, id: "state", lastPulledAt: newestSyncedAt(rows, state.lastPulledAt) });
  });

  // Push: every dirty row, then clear dirty only where nothing changed meanwhile.
  const pending: { kind: SyncedKind; record: SyncMeta }[] = [];
  for (const [kind, table] of Object.entries(byKind) as [SyncedKind, Table<SyncMeta, string>][]) {
    for (const record of await table.where("dirty").equals(1).toArray()) if (!isDemoId(record.id)) pending.push({ kind, record });
  }
  if (pending.length) await remote.push(pending.map(({ kind, record }) => toRemoteRow(kind, record)));
  await db.transaction("rw", all, async () => {
    for (const { kind, record } of pending) {
      const table = byKind[kind];
      const now = await table.get(record.id);
      if (now && now.dirty === 1 && now.updatedAt === record.updatedAt) await table.put({ ...now, dirty: 0 });
    }
    const current = (await db.syncState.get("state")) ?? { id: "state" as const };
    await db.syncState.put({ ...current, id: "state", lastSyncedAt: nowIso() });
  });

  return { pulled, pushed: pending.length };
}

export type SyncScheduler = {
  /** Runs after `debounceMs` of quiet. */
  trigger(): void;
  /** Runs now (or right after the current run). Never rejects. */
  runNow(): Promise<void>;
  dispose(): void;
};

/** One sync at a time: a request during a run queues exactly one more. Failures are silent; the next trigger retries. */
export function createSyncScheduler(run: () => Promise<unknown>, opts: { debounceMs?: number } = {}): SyncScheduler {
  const debounceMs = opts.debounceMs ?? 5000;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running: Promise<void> | undefined;
  let queued = false;
  let disposed = false;

  const start = (): Promise<void> => {
    if (disposed) return Promise.resolve();
    if (running) {
      queued = true;
      return running;
    }
    running = (async () => {
      do {
        queued = false;
        try {
          await run();
        } catch {
          // Offline, signed out, server down: try again on the next trigger.
        }
      } while (queued && !disposed);
      running = undefined;
    })();
    return running;
  };

  return {
    trigger() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        void start();
      }, debounceMs);
    },
    runNow: start,
    dispose() {
      disposed = true;
      if (timer) clearTimeout(timer);
    },
  };
}
