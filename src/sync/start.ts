// Starts syncing when signed in: on launch, when the app comes back to the foreground, when the
// phone gets a connection, and a few seconds after local changes. Nothing on screen waits on it.
import { liveQuery } from "dexie";
import { countUnsynced, forgetSyncProgress } from "../storage/repo";
import type { WorkoutDB } from "../storage/db";
import { createSyncScheduler, syncOnce, type SyncScheduler } from "./runner";
import { createSupabaseRemote, getSupabase, onAuthChange } from "./supabase";

let scheduler: SyncScheduler | undefined;

/** Syncs now if signed in (for example right after finishing a workout). Never throws, never waits on the screen. */
export function requestSync(): Promise<void> {
  return scheduler?.runNow() ?? Promise.resolve();
}

export function startSync(db: WorkoutDB): void {
  const supabase = getSupabase();
  if (!supabase) return; // no keys in this build: sync stays off
  let stop: (() => void) | undefined;

  onAuthChange((signedIn) => {
    if (signedIn && !scheduler) {
      const remote = createSupabaseRemote(supabase);
      const active = createSyncScheduler(() => syncOnce(db, remote));
      scheduler = active;
      const onVisible = () => document.visibilityState === "visible" && active.runNow();
      const onOnline = () => active.runNow();
      document.addEventListener("visibilitychange", onVisible);
      window.addEventListener("online", onOnline);
      // A few seconds after any local change that the cloud hasn't seen.
      const changes = liveQuery(() => countUnsynced(db)).subscribe((n) => n > 0 && active.trigger());
      stop = () => {
        document.removeEventListener("visibilitychange", onVisible);
        window.removeEventListener("online", onOnline);
        changes.unsubscribe();
        active.dispose();
      };
      void active.runNow();
    } else if (!signedIn && scheduler) {
      stop?.();
      stop = undefined;
      scheduler = undefined;
      void forgetSyncProgress(db);
    }
  });
}
