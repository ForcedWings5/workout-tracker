// Sync merge rules. Plain functions: which side wins, and how records map to cloud rows.
import type { Kind, SyncMeta } from "./types";
import type { RemoteRow } from "../sync/remote";

/**
 * Whether a pulled row should replace the local copy: when there's none, or when the local copy
 * is clean and older. A dirty local row always wins; it's pushed next. Times compare as instants,
 * because the server writes "+00:00" and the phone writes "Z".
 */
export function shouldApplyRemote(local: SyncMeta | undefined, remote: { updatedAt: string }): boolean {
  if (!local) return true;
  return local.dirty === 0 && Date.parse(local.updatedAt) < Date.parse(remote.updatedAt);
}

/** The whole record goes to the cloud as `data`, without the local-only dirty flag. */
export function toRemoteRow(kind: Kind, record: SyncMeta): Omit<RemoteRow, "synced_at"> {
  const { dirty: _, ...data } = record;
  return { kind, id: record.id, data, updated_at: record.updatedAt, deleted: record.deleted };
}

/** A pulled row as a local record: clean, with the phone's time format. */
export function fromRemoteRow(row: RemoteRow): SyncMeta {
  const data = (row.data ?? {}) as Record<string, unknown>;
  return { ...data, id: row.id, updatedAt: new Date(row.updated_at).toISOString(), deleted: row.deleted, dirty: 0 } as SyncMeta;
}

/**
 * The newest server time seen, kept exactly as the server wrote it (it can carry microseconds,
 * which a Date would drop). All values come from the same server, so they compare as text.
 */
export function newestSyncedAt(rows: Pick<RemoteRow, "synced_at">[], prev?: string): string | undefined {
  let newest = prev;
  for (const r of rows) if (!newest || r.synced_at > newest) newest = r.synced_at;
  return newest;
}
