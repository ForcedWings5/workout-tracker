# Workout Tracker: Design

Date: 2026-11-18
Status: Approved 2026-11-18. Visual rules: `DESIGN-RULES.md`.

## Why

The user logs workouts in iPhone Notes as a table: exercise, target sets × reps, and the weights used. Every session they copy the previous entry, paste it, and edit the numbers. The Notes table is clumsy to edit on a phone, and copying and editing is tedious. They want a simple tracker of their own that fixes this.

Success: logging a workout at the gym is faster and less fiddly than Notes, the history is never lost (even if the app is deleted), and over time they can see whether they're getting stronger.

## Goals

- Log a workout on iPhone in the gym, set by set: weight, and the reps (or seconds) actually done.
- Keep the plan (target sets and rep range) next to what was actually done.
- Pre-fill each set with last time's numbers so only changes need typing.
- Optional free-text note per exercise per session ("form shaky at end of set, maybe reduce weight"), shown again the next time that exercise comes up.
- Follow the user's fixed rotation and open on "Next up."
- Edit workouts in the app (exercises, targets, order, rotation) with no code changes.
- Log a one-off workout that isn't in the rotation.
- A progress screen per exercise: a chart over time plus a list of past sessions.
- Work fully offline in the gym.
- When online, copy all data to a cloud database, so deleting the app or losing the phone loses nothing. A fresh install can sign in and get everything back.

## Non-goals (v1)

- Importing old Notes history. The user chose to start fresh.
- Using the app on two devices at the same time. The phone is the one place data is entered. A read-only laptop view may come later; the sync design shouldn't rule it out.
- Rest timers, plate calculators, exercise libraries or videos, social features.
- Volume, estimated 1RM, or other advanced metrics. Heaviest set only for now.
- kg support. Pounds only.

## Anti-goals (would be a failure even if it technically works)

- Logging takes longer or more taps than the Notes workflow.
- The app needs signal to work, or waits on the network before showing or saving anything.
- A workout in progress is lost because the phone locked, Safari reloaded, or the app was closed.
- Pre-filled numbers from last time get saved as if they were done today when the user didn't do them.
- Editing a workout changes or erases past history.
- A fresh install's starter workouts overwrite the user's real, edited workouts in the cloud.

## Constraints

- Primary device: iPhone, Safari, installed to the home screen. Must be comfortable one-handed with sweaty thumbs: large tap targets and number keypads.
- Gym signal may be poor, so the app must fully work offline after the first load.
- Single user. The phone's copy is the main copy; the cloud database holds a synced copy for safety.
- iOS home-screen web apps can't sync in the background. Syncing only happens while the app is open.
- Free services only: GitHub Pages for hosting, Supabase free tier for the database. The user has a GitHub account and will create the Supabase account.

## Approaches considered

### Platform

1. **Web app installed to the home screen (PWA).** Free, offline, no Apple developer account, updates arrive on next open. **Chosen:** it solves the real problem (logging on the phone) with the least setup and no ongoing cost.
2. **Native iPhone app (SwiftUI).** Smoothest feel. Rejected: with a free Apple account, sideloaded apps expire every 7 days. Avoiding that costs $99 a year, and every update means reinstalling from Xcode.
3. **Web app with cloud data only.** Rejected: needs signal to work, which fails in the gym.

### Keeping data safe (added after the user asked for data to survive deleting the app)

1. **Offline-first on the phone (IndexedDB), with sync to Supabase when online.** The phone saves first; a sync step sends changes up and pulls them back down on a new install. Little changes in the rest of the design. **Chosen:** keeps the offline guarantees under our control and adds the safety net with the fewest new parts. Supabase free tier pauses a project after 7 days with no activity; it's restored from the dashboard with no data loss, and with 4 workouts a week it rarely matters.
2. **Firebase Firestore with its built-in offline sync.** Less sync code to write. Rejected: it replaces the storage layer instead of adding to it, is harder to test, and has no email-code sign-in.
3. **Periodic backup files uploaded to the cloud.** Rejected: can lag several workouts behind, and still needs sign-in and storage, so it saves little over option 1.

## Architecture

**Stack:** React + TypeScript, built with Vite. `vite-plugin-pwa` for the service worker and manifest (offline + home-screen install). IndexedDB through Dexie for on-device storage. `@supabase/supabase-js` for sign-in and the cloud database. Hand-drawn SVG for the progress chart, with no chart library.

**Layers:**

```
 Screens (React components)
   Today · Log Workout · Progress · Edit Workouts · Settings
        │
 App logic (plain TypeScript, no React, unit-tested)
   rotation · pre-fill · progress series · finishing · backup format · sync merge rules
        │
 Storage (Dexie / IndexedDB)  ◄────►  Sync (supabase-js)  ◄────►  Supabase (Postgres)
   the main copy, on the phone        runs when online             cloud copy
```

Screens only ever read and write local storage, so they never wait on the network. Sync runs separately and moves changes between local storage and Supabase. The merge rules (what to push, which version wins) are pure functions in the app-logic layer, so they can be tested without a network.

## Data model

```ts
// Every synced record carries these fields.
type SyncMeta = {
  id: string;
  updatedAt: string;         // ISO timestamp, set on every local write
  deleted: boolean;          // deletes are tombstones, so they sync
  dirty: 0 | 1;              // 1 = changed locally, not yet pushed (0/1 so Dexie can index it)
};

type Exercise = SyncMeta & {
  name: string;              // "Barbell Bench Press"
  measure: "reps" | "seconds";
  archived: boolean;         // hidden from pickers, history kept
};

type PlannedExercise = {
  exerciseId: string;
  sets: number;              // 4
  targetMin: number;         // 6   (reps or seconds)
  targetMax?: number;        // 10  (absent for fixed targets like "45 sec")
  label?: string;            // "per leg"
};

type Workout = SyncMeta & {
  name: string;              // "Upper A: Horizontal Push & Pull"
  exercises: PlannedExercise[];   // in order
};

type Rotation = SyncMeta & { workoutIds: string[] };   // single record, id "rotation"

type LoggedSet = {
  weight?: number;           // lb, decimals allowed, blank = bodyweight
  amount?: number;           // reps or seconds, per the exercise's measure
  done: boolean;             // only done sets count
};

type SessionEntry = {
  exerciseId: string;
  planned: Omit<PlannedExercise, "exerciseId">;  // snapshot of targets at the time
  sets: LoggedSet[];
  note?: string;
};

type Session = SyncMeta & {
  workoutId?: string;        // absent for a one-off workout
  workoutName: string;       // snapshot
  date: string;              // YYYY-MM-DD, editable
  status: "in_progress" | "finished";
  entries: SessionEntry[];
};

// Local only, never synced.
type SyncState = {
  lastPulledAt?: string;     // server time of the newest row pulled
  lastSyncedAt?: string;     // when the last successful sync finished (shown in Settings)
};
```

Sessions keep snapshots of targets and workout name, so editing or deleting a workout never rewrites history. History belongs to the exercise (`exerciseId`), so Lat Pulldown's history covers both Upper A and Upper B.

Every write to a synced record goes through one storage helper that sets `updatedAt = now` and `dirty = 1`. Deleting sets `deleted = true` (also through that helper) instead of removing the row; every query filters out deleted rows.

## Behavior

**Next up.** The workout after the most recently *finished* rotation workout, wrapping around. With no history, the first in the rotation. Rest days aren't tracked; the app just shows what's next whenever it's opened. The user can start any other workout instead. Finishing a rotation workout sets "next up" to the one after *it*. One-off workouts don't affect the rotation. If the last finished workout is no longer in the rotation (deleted or removed), next up falls back to the first workout in the rotation.

**Starting a workout** creates an `in_progress` session with one entry per planned exercise, in order, with the target set count. Only one session can be in progress. If one exists, the Today screen offers "Resume" (or "Discard").

**Pre-fill.** For each exercise, find the most recent finished session of the *same workout* that included it, falling back to the most recent finished session of *any* workout that included it. Set *n* is pre-filled with weight and amount from that session's done set *n*. Sets beyond what last time had are pre-filled from last time's final set. With no history, sets are blank and show the target as a hint. Pre-filled values look visibly different (muted) until the set is marked done.

**Marking a set done.** Tapping ✓ marks the set done and locks in whatever values are showing (pre-filled or edited). Editing a value doesn't mark the set done by itself. Tapping ✓ again un-marks it.

**Adding and removing sets.** "+ Set" adds a set to an exercise in the current session. Sets can be removed. This only changes the session, never the workout.

**Adding exercises mid-session.** An exercise can be added to the current session (pick an existing one or create a new one). This doesn't change the workout.

**Notes.** One optional note per exercise per session. When the exercise comes up again, the most recent note for that exercise from any session is shown above its sets, read-only, with its date.

**Autosave.** Every change is written to IndexedDB immediately. No save button. On load, the app calls `navigator.storage.persist()` to ask the browser not to evict data.

**Finishing.** "Finish workout" marks the session finished. Exercises with no done sets are dropped from the saved session. If no sets at all are done, ask whether to discard instead.

**One-off workout.** "Start empty workout" creates a session with no `workoutId`. The user adds exercises as they go. Name defaults to "Workout" and can be edited.

**Editing past sessions.** From history, a past session can be opened to change values, the date, or notes, or be deleted (with confirmation).

## Sync

**Sign-in.** Optional, and the app works fully without it. Settings shows "Not backed up" with a Sign in button until the user signs in, and the Today screen shows a small, dismissible reminder. Sign-in uses Supabase **email one-time codes**: the user enters their email, receives a 6-digit code, and types it into the app. Email *links* aren't used, because on iOS they open in Safari, which doesn't share storage with the home-screen app. supabase-js keeps the session in the app's own storage, so the user signs in once per install. If the session ever expires, the app keeps working locally and Settings asks the user to sign in again.

**When sync runs** (only while signed in and online):
- when the app opens
- when the app comes back to the foreground (`visibilitychange`)
- when the device comes back online (`online` event)
- right after a workout is finished
- about 5 seconds after the last local change, while online

Only one sync runs at a time. Failures are silent and retried on the next trigger; nothing in the UI waits on sync.

**Push.** Upsert every row with `dirty = 1` to Supabase. After a successful upsert, clear `dirty` on each row, but only if its `updatedAt` hasn't changed since it was read (otherwise a newer local edit stays dirty for the next push).

**Pull.** Fetch rows whose server-side `synced_at` is later than `lastPulledAt`. For each one, apply it locally if the local copy doesn't exist, or if the local copy is not dirty and is older (by `updatedAt`) than the remote one. Then set `lastPulledAt` to the newest `synced_at` received. Pull filters on the server's clock (`synced_at`), not the phone's, so a wrong phone clock can't cause missed rows.

**Order:** pull, then push.

**Fresh install and restore.** On first launch the seed workouts (below) are written locally with **fixed IDs** (for example `seed-workout-upper-a`, `seed-exercise-barbell-bench-press`), `updatedAt` set to the Unix epoch (`1970-01-01T00:00:00Z`), and `dirty = 0`. When the user signs in, the first pull brings down their real history and edited workouts. Because the seed rows have the oldest possible timestamp and aren't dirty, any real version in the cloud replaces them, and the seed never overwrites the cloud. A seed record only gets pushed once the user edits it.

**Sign out.** Stops syncing and clears the auth session. Local data stays on the phone.

**Cloud schema.** One generic table, so the app's data shapes can change without database migrations:

```sql
create table records (
  user_id    uuid        not null references auth.users on delete cascade default auth.uid(),
  kind       text        not null check (kind in ('exercise','workout','rotation','session')),
  id         text        not null,
  data       jsonb       not null,       -- the full record
  updated_at timestamptz not null,       -- from the phone
  deleted    boolean     not null default false,
  synced_at  timestamptz not null default now(),  -- set by the server on every write
  primary key (user_id, kind, id)
);
-- trigger: set synced_at = now() on every insert and update
-- index on (user_id, synced_at)
-- row level security on: a user can select, insert and update only rows where user_id = auth.uid(); no delete policy
```

The SQL lives in the repo at `supabase/migrations/` so the project can be recreated.

**Keys.** The app uses only the Supabase project URL and the public (anon / publishable) key, provided at build time as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. They're safe to ship because row level security limits each user to their own rows. The service role key is never used in the app or committed. For local development they go in `.env.local` (gitignored); for deploys they're GitHub Actions repository variables.

**Supabase setup (done once, by the user with Claude's guidance):** create a free Supabase account and project, run the migration SQL in the SQL editor, edit the "Magic Link" email template to show the code (`{{ .Token }}`) instead of a link, then copy the project URL and anon key into the GitHub repo variables and `.env.local`. Supabase's built-in email sender is rate-limited to a few emails an hour, which is fine for one user.

## Screens

**Today** (home)
```
 Next up
 ┌─────────────────────────────┐
 │ Upper B                      │
 │ Vertical Pull & Incline Push │
 │ 6 exercises · last: 11/12    │
 │          [ Start ]           │
 └─────────────────────────────┘
 Other workouts: Upper A · Lower A · Lower B
 Start empty workout
```

**Log Workout**: exercises stacked in one scrolling list.
```
 Barbell Bench Press        4 × 6–10
 Last note (11/12): form shaky last set
   lb      reps
   65      10      ✓
   75       8      ✓
   85       8      ○   ← muted = pre-filled, not done
   95       6      ○
   + Set
   Note: ____________
```
Number inputs use the numeric keypad (`inputmode="decimal"` for weight, `"numeric"` for amount).

**Progress**: list of exercises (most recently done first). Tap one for:
```
 Barbell Bench Press
 Heaviest set per session
  95 ┤            ●
  85 ┤      ●  ●
  75 ┤  ●
     └───────────────
 11/12  65×10  75×8  85×8  95×6
        "form shaky last set"
```
Chart metric: the heaviest done weight per session. If the exercise has never had a weight logged (Toe Touches, unweighted plank), chart the best reps or seconds per session instead.

**Edit Workouts**: list of workouts in rotation order; reorder the rotation, add or delete a workout. In a workout: rename, add, remove or reorder exercises, and change sets, target range, label and measure. Renaming an exercise renames it everywhere, history included. Deleting an exercise with history archives it instead.

**Settings**
```
 Cloud backup
   Signed in as you@example.com
   Last synced: 2 min ago · 0 changes waiting
   [ Sync now ]   Sign out
 Backup file
   Export backup · Import backup
   Last export: 10/30
 Always open the app from the home-screen icon.
```
Signed out, the Cloud backup section shows "Not backed up" and a Sign in button. Export backup downloads a JSON file of everything; Import backup replaces all local data after confirmation. The backup file is kept as a second safety net beside the cloud copy.

Navigation: a bottom tab bar with Today, Progress, Workouts and Settings. Log Workout opens full screen from Today.

## Seed data

On first launch, load the user's current four workouts in this rotation order (with fixed IDs and epoch timestamps, as described under Sync):

- **Upper A: Horizontal Push & Pull.** Barbell Bench Press 4 × 6–10; Cable Row (Narrow Grip) 3 × 8–12; Seated Dumbbell Shoulder Press 2 × 8–12; Lat Pulldown 2 × 10–15; Triceps Pushdown (Rope) 2 × 10–15; EZ-Bar Curl 2 × 10–15
- **Lower A: Squat & Hamstrings.** Barbell Squats 3 × 6–10; Seated Leg Curl 3 × 10–15; Leg Press 2 × 10–15; Standing Calf Raise 3 × 10–15; Plank 2 × 45 sec (seconds)
- **Upper B: Vertical Pull & Incline Push.** Lat Pulldown 3 × 8–12; Incline Bench Dumbbell Press 4 × 8–12; Cable Row (Wide Grip) 2 × 10–15; Dumbbell Lateral Raise 3 × 12–20; Overhead Cable Triceps Extension (Bar) 2 × 10–15; Dumbbell Bicep Curl 2 × 10–15
- **Lower B: Hip Hinge & Single-Leg.** Romanian Deadlift 3 × 8–12; Bulgarian Split Squats (Dumbbell) 2 × 8–12 "per leg"; Leg Extension 2 × 10–15; Seated Calf Raise 3 × 12–20; Toe Touches 2 × 12–15

Lat Pulldown is one shared exercise. Cable Row (Narrow Grip) and Cable Row (Wide Grip) are separate exercises.

## Backup format

`{ version: 1, exportedAt, exercises, workouts, rotation, sessions }` as JSON, including tombstones. Import checks `version` and the shape before replacing anything, and marks every imported row dirty so it syncs. Plain file downloads are unreliable in iOS home-screen apps, so Export uses the share sheet (`navigator.share` with a file) when available, so the user can save the file to Files or iCloud Drive, and falls back to a normal download otherwise.

## Hosting and install

- Public GitHub repo `workout-tracker`, deployed to GitHub Pages by a GitHub Actions workflow on push to `main`. Vite `base` is set to `/workout-tracker/`. Free GitHub Pages needs a public repo; that's fine, since only the code is public. Workout data lives on the phone and in Supabase, never in the repo.
- Install: open the Pages URL in Safari, then Share → Add to Home Screen.
- iOS keeps home-screen app storage separate from Safari tab storage. The user should always log from the home-screen icon, and Settings says so.
- Updates: the service worker picks up a new version on the next open (auto-update, prompt-free).

## Testing

- Vitest unit tests for the app-logic layer: next-up rotation, pre-fill selection (same workout first, then any workout), extra-set pre-fill, progress series (weight vs reps/seconds fallback), finishing (dropping empty entries), backup export/import validation.
- Sync merge rules tested as pure functions: dirty rows are pushed; `dirty` stays set if the row changed during a push; pulled rows replace older clean rows but never dirty ones; tombstones sync both ways; epoch-dated seed rows are replaced by real cloud rows and never pushed unless edited; restoring onto a fresh install brings everything back.
- Dexie tested against `fake-indexeddb`. The Supabase client is behind a small interface, so sync tests use an in-memory fake instead of the network.
- Manual check on the user's iPhone: install, log a full workout offline, lock the phone mid-workout, reopen, finish, go online and see "Last synced" update, check the rows in the Supabase dashboard. Then delete the app, reinstall, sign in, and confirm history and edited workouts come back.

## Calls made by Claude (for the user to check)

- Pre-fill prefers the same workout's last session, then falls back to any workout. Lat Pulldown is 2 × 10–15 in Upper A and 3 × 8–12 in Upper B, so the same-workout numbers are usually more relevant.
- New sessions start with the *target* set count, not last time's count. Extra sets are added with "+ Set."
- The note shown is the most recent note for that exercise from any session.
- Finishing drops exercises with no done sets.
- Chart metric is the heaviest weight, falling back to best reps or seconds for exercises that never had a weight.
- Sign-in is optional; the app nudges but never blocks. Signing out keeps local data.
- If the phone and cloud disagree, the newer edit wins, but an unsynced local change is never overwritten.
- The JSON export stays as a second safety net.
- Bottom tab bar with four tabs. Light/dark mode follows the phone's setting.

## Left to the builder

Visual styling, component structure, ID generation for non-seed records, Dexie schema versioning details, chart drawing details, empty states, exact wording, and sync retry timing.

## Delivery

Built on short-lived feature branches merged into `main` one at a time, each a working vertical slice (for example: log a workout end to end; editing; progress; offline and deploy; then sign-in and sync). Not one branch per layer. The implementation plan defines the slices.
