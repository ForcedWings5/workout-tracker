import { useLiveQuery } from "dexie-react-hooks";
import { useRef, useState, type ChangeEvent } from "react";
import { parseBackup, type Backup } from "../logic/backup";
import { shortDate, todayLocal } from "../logic/clock";
import { useDb } from "../storage/DbContext";
import { exportBackup, importBackup, loadSyncState, markExported } from "../storage/repo";
import { Button } from "../ui/Button";
import { Notice } from "../ui/Notice";
import { ScreenHeader } from "../ui/ScreenHeader";
import { Sheet } from "../ui/Sheet";

/** "11/12" from an ISO timestamp, in the phone's local date. */
const localShortDate = (iso: string) => shortDate(todayLocal(new Date(iso)));

/**
 * Hands the file to the iOS share sheet (Save to Files, AirDrop…), or downloads it where that
 * isn't available. Safari only allows sharing shortly after the tap; if building a big backup
 * took too long it refuses with NotAllowedError, and the file downloads instead.
 */
async function deliver(file: File): Promise<"saved" | "cancelled"> {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return "saved";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
      if (!(err instanceof DOMException && err.name === "NotAllowedError")) throw err;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "saved";
}

export function Settings() {
  const db = useDb();
  const state = useLiveQuery(() => loadSyncState(db), [db]);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState<Backup>();
  const [importing, setImporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const exportFile = async () => {
    setExporting(true);
    setError(undefined);
    setMessage(undefined);
    try {
      const backup = await exportBackup(db);
      const file = new File([JSON.stringify(backup)], `workout-tracker-backup-${todayLocal()}.json`, { type: "application/json" });
      if ((await deliver(file)) === "saved") await markExported(db);
    } catch (err) {
      console.error("Export failed", err);
      setError("Couldn't export the backup. Try again.");
    } finally {
      setExporting(false);
    }
  };

  const pickFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // so picking the same file again still fires
    if (!file) return;
    setError(undefined);
    setMessage(undefined);
    const result = parseBackup(await file.text());
    if (result.ok) setPending(result.backup);
    else setError(result.error);
  };

  const replace = async () => {
    if (!pending) return;
    setImporting(true);
    try {
      await importBackup(db, pending);
      setPending(undefined);
      setMessage("Backup imported.");
    } catch (err) {
      console.error("Import failed", err);
      setPending(undefined);
      setError("Couldn't import the backup. Nothing was changed.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <ScreenHeader title="Settings" />

      <Notice aria-labelledby="cloud-title">
        <h2 className="settings__title" id="cloud-title">
          Cloud backup
        </h2>
        <p className="empty-text">Cloud backup is coming soon.</p>
      </Notice>

      <Notice aria-labelledby="file-title">
        <h2 className="settings__title" id="file-title">
          Backup file
        </h2>
        <p className="settings__status">{state?.lastExportAt ? `Last export: ${localShortDate(state.lastExportAt)}` : "No backup exported yet."}</p>
        <div className="settings__actions">
          <Button variant="outline" onClick={exportFile} loading={exporting} loadingLabel="Exporting…">
            Export backup
          </Button>
          <Button variant="outline" onClick={() => fileInput.current?.click()}>
            Import backup
          </Button>
          <input ref={fileInput} className="visually-hidden" type="file" accept="application/json,.json" aria-label="Choose a backup file" tabIndex={-1} onChange={pickFile} />
        </div>
        {error && (
          <p className="form-field__error" role="alert">
            {error}
          </p>
        )}
        <p className="settings__message" role="status">
          {message ?? ""}
        </p>
      </Notice>

      <Notice>
        <p className="empty-text">Always open Workout Tracker from the home-screen icon.</p>
      </Notice>

      <Sheet open={pending !== undefined} onClose={() => setPending(undefined)} title="Replace everything on this phone with this backup?">
        <p className="sheet__body">
          Your workouts and history here are replaced by the backup
          {pending ? ` from ${localShortDate(pending.exportedAt)}` : ""}. This can't be undone.
        </p>
        <div className="sheet__actions">
          <Button variant="outline" onClick={() => setPending(undefined)}>
            Keep what's here
          </Button>
          <Button variant="plain" onClick={replace} loading={importing} loadingLabel="Importing…">
            Replace everything
          </Button>
        </div>
      </Sheet>
    </>
  );
}
