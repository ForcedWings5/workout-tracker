import { useLiveQuery } from "dexie-react-hooks";
import { useRef, useState, type ChangeEvent } from "react";
import { parseBackup, type Backup } from "../logic/backup";
import { shortDate, todayLocal } from "../logic/clock";
import { useDb } from "../storage/DbContext";
import { countUnsynced, exportBackup, importBackup, loadSyncState, markExported } from "../storage/repo";
import { requestSync } from "../sync/start";
import { sendCode, signOut, useAuth, verifyCode } from "../sync/supabase";
import { timeAgo } from "../logic/format";
import { Button } from "../ui/Button";
import { Notice } from "../ui/Notice";
import { ScreenHeader } from "../ui/ScreenHeader";
import { Sheet } from "../ui/Sheet";

/** "11/12" from an ISO timestamp, in the phone's local date. */
const localShortDate = (iso: string) => shortDate(todayLocal(new Date(iso)));

/** How long a downloaded backup's file stays readable: long enough for a slow save. */
const DOWNLOAD_URL_LIFETIME_MS = 60_000;

/**
 * Hands the file to the iOS share sheet (Save to Files, AirDrop…), or downloads it where sharing
 * isn't available. Safari only allows sharing shortly after the tap; if building a big backup took
 * too long it refuses with NotAllowedError, and the file waits for one more tap ("retry"). A
 * download is no fallback there: the home-screen app has no way to save one.
 */
async function deliver(file: File): Promise<"saved" | "cancelled" | "retry"> {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return "saved";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
      if (err instanceof DOMException && err.name === "NotAllowedError") return "retry";
      throw err;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_URL_LIFETIME_MS);
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
  /** A backup built but refused by the share sheet: the next tap shares it at once, inside the tap's time limit. */
  const ready = useRef<File>();

  const exportFile = async () => {
    setExporting(true);
    setError(undefined);
    setMessage(undefined);
    try {
      const retrying = ready.current;
      ready.current = undefined;
      let file = retrying;
      if (!file) {
        const backup = await exportBackup(db);
        file = new File([JSON.stringify(backup)], `workout-tracker-backup-${todayLocal()}.json`, { type: "application/json" });
      }
      const result = await deliver(file);
      if (result === "saved") await markExported(db);
      // Refused again, straight after a tap: it isn't the time limit, so asking for another tap won't help.
      if (result === "retry" && retrying) throw new Error("Sharing refused");
      if (result === "retry") {
        ready.current = file;
        setMessage("Your backup is ready. Tap Export backup again to save it.");
      }
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
    ready.current = undefined; // a backup built before the import no longer matches what's here
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

      <CloudBackup />

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
        <p className="empty-text">Always open Workouts from the home-screen icon.</p>
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

/** Sign in with an emailed 6-digit code (never a link: links open in Safari, which can't reach the home-screen app's data). */
function CloudBackup() {
  const db = useDb();
  const auth = useAuth();
  const state = useLiveQuery(() => loadSyncState(db), [db]);
  const waiting = useLiveQuery(() => countUnsynced(db), [db]) ?? 0;
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string>();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const attempt = async (action: () => Promise<void>, failure: string) => {
    setBusy(true);
    setError(undefined);
    try {
      await action();
    } catch (err) {
      console.error(err);
      setError(failure);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Notice aria-labelledby="cloud-title">
      <h2 className="settings__title" id="cloud-title">
        Cloud backup
      </h2>

      {auth.status === "off" && <p className="empty-text">Cloud backup isn't set up in this build.</p>}

      {auth.status === "signed-in" && (
        <>
          <p className="settings__status">Signed in as {auth.email}</p>
          <p className="settings__status">
            {state?.lastSyncedAt ? `Last synced: ${timeAgo(state.lastSyncedAt)}` : "Not synced yet"} · {waiting} {waiting === 1 ? "change" : "changes"} waiting
          </p>
          <div className="settings__actions">
            <Button
              variant="outline"
              onClick={() =>
                attempt(async () => {
                  if (!(await requestSync())) throw new Error("Sync failed");
                }, "Couldn't sync. Your data is safe on this phone; we'll try again when you're online.")
              }
              loading={busy}
              loadingLabel="Syncing…"
            >
              Sync now
            </Button>
            <Button variant="text" onClick={() => attempt(signOut, "Couldn't sign out. Try again.")}>
              Sign out
            </Button>
          </div>
        </>
      )}

      {auth.status === "signed-out" && (
        <>
          <p className="settings__status">Not backed up</p>
          {sentTo === undefined ? (
            <form
              className="settings__form"
              onSubmit={(e) => {
                e.preventDefault();
                const to = email.trim();
                if (!to) return setError("Enter your email address.");
                void attempt(async () => {
                  await sendCode(to);
                  setSentTo(to);
                }, "Couldn't send the code. Check the email address and your connection, then try again.");
              }}
            >
              <label className="form-field">
                <span className="form-field__label">Email</span>
                <input className="field" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <Button variant="outline" type="submit" loading={busy} loadingLabel="Sending…">
                Send code
              </Button>
            </form>
          ) : (
            <form
              className="settings__form"
              onSubmit={(e) => {
                e.preventDefault();
                void attempt(() => verifyCode(sentTo, code.trim()), "That code didn't work. Check it, or send a new one.");
              }}
            >
              <p className="settings__status">We sent a code to {sentTo}.</p>
              <label className="form-field">
                <span className="form-field__label">6-digit code</span>
                <input
                  className="field"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                />
              </label>
              <Button variant="outline" type="submit" loading={busy} loadingLabel="Signing in…">
                Sign in
              </Button>
              <Button
                variant="text"
                onClick={() => {
                  setSentTo(undefined);
                  setCode("");
                  setError(undefined);
                }}
              >
                Use a different email
              </Button>
            </form>
          )}
        </>
      )}

      {error && (
        <p className="form-field__error" role="alert">
          {error}
        </p>
      )}
    </Notice>
  );
}
