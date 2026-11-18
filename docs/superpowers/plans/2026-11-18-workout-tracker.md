# Workout Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An offline-first iPhone home-screen web app that logs workouts against the owner's Upper/Lower rotation, pre-fills last time's numbers, shows progress per exercise, and syncs to Supabase when online.

**Architecture:** React screens read and write only local IndexedDB (Dexie) through a repository layer. Every rule lives in pure TypeScript in `src/logic/`, unit-tested. A separate sync runner moves dirty rows to Supabase and pulls newer ones back. The app ships as a PWA on GitHub Pages.

**Tech Stack:** React 18 + TypeScript (strict), Vite, Vitest + jsdom + fake-indexeddb + Testing Library, Dexie + dexie-react-hooks, vite-plugin-pwa, lucide-react, @fontsource/unifrakturcook, @supabase/supabase-js, sharp (dev, icon export).

**Spec:** `docs/superpowers/specs/2026-11-18-workout-tracker-design.md` (behavior) and `DESIGN-RULES.md` (UI). Also read `CLAUDE.md` and `PRODUCT.md`.

## Global Constraints

- Node 20+. TypeScript `strict: true`.
- Screens never import Dexie tables or Supabase directly: screens → `src/storage/repo.ts` → `src/storage/write.ts`.
- Every write to a synced table goes through `save()` / `remove()` in `src/storage/write.ts`, which set `updatedAt = nowIso()` and `dirty = 1`.
- Deletes are tombstones (`deleted: true`); every read filters them out.
- Only `done` sets count anywhere (pre-fill, progress, finishing).
- Sessions snapshot `workoutName` and each entry's `planned` targets.
- Weight in lb, decimals allowed, blank = bodyweight. Dates are local `YYYY-MM-DD`.
- Seed records: fixed IDs, `updatedAt: "1970-01-01T00:00:00.000Z"`, `dirty: 0`.
- UI follows `DESIGN-RULES.md` exactly: tokens, type scale, set-row states, copy ("Fulfill contract", "Fulfilled", "Record"), off-limits list. No router, chart library, UI kit, or state library.
- No runtime requests to other hosts except Supabase. Fonts come from `@fontsource`, bundled and precached.
- Vite `base: "/workout-tracker/"`.
- Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. The app runs with sync off when they're missing. Never the service role key.
- Run `npm test` and `npm run build` before every commit that changes code.

## Decisions made in this plan (not in the spec)

- `LoggedSet` gains `skipped?: boolean`. "Skip set" on a set toggles it (the DESIGN-RULES "skipped" state); a blank set added with "+ Set" is deleted outright instead. Finishing drops skipped and undone sets.
- Workout display: `name` is split at the first `": "` into title ("Upper A") and subtitle ("Horizontal Push & Pull").
- Personal best: a done set whose value beats every earlier done set of that exercise. The "Record" label shows in the session where it happened and on its chart point. There's no separate "seen" state. (Task 16 updates DESIGN-RULES to match.)
- Reordering exercises and the rotation uses Move up / Move down buttons, not drag. (Task 13 updates DESIGN-RULES to match.)
- Creating an exercise whose name matches an existing one (case- and space-insensitive) reuses the existing exercise.
- Import sets `updatedAt = now` and `dirty = 1` on every row.

## Review Focus

1. **Local dates near midnight.** `todayLocal()` must use the phone's local date, not UTC. Logging at 9 pm in New York gives today's date, not tomorrow's. Tested in Task 2.
2. **Typed numbers.** "42.5", "42,5", "", " 10 " and "abc" must parse to 42.5, 42.5, undefined, 10 and undefined. A bad value never saves NaN. Tested in Task 2.
3. **A workout left in progress for days.** Reopening shows Resume. Finishing keeps the session's original date, and next-up still advances. Tested in Task 8.
4. **Editing a workout mid-session.** Changing Upper A's targets while an Upper A session is in progress doesn't change that session's entries. Tested in Task 12.
5. **Duplicate exercise names.** Creating "bench press " when "Bench Press" exists reuses it instead of splitting history. Tested in Task 12.

## File Structure

```
src/
  logic/                 pure TypeScript, no React, no Dexie
    types.ts             domain types (spec Data model + skipped)
    clock.ts             nowIso, todayLocal, EPOCH
    ids.ts               newId
    input.ts             parseNumberInput, splitWorkoutName
    rotation.ts          nextUp
    session.ts           startSession, prefillSets, lastNoteFor, finishSession
    progress.ts          progressSeries, isRecordSet, exercisesByRecency
    editing.ts           workout/rotation edit helpers, findExerciseByName
    backup.ts            Backup type, buildBackup, parseBackup
    sync-merge.ts        shouldApplyRemote, toRemoteRow, fromRemoteRow, newestSyncedAt
  storage/
    db.ts                Dexie schema, createDb, db
    write.ts             save, remove, live
    seed.ts              SEED data, seedIfEmpty
    repo.ts              everything screens call
  sync/
    remote.ts            RemoteStore interface + in-memory fake
    supabase.ts          Supabase RemoteStore + email-code auth
    runner.ts            syncOnce, createSyncScheduler
  ui/
    tokens.css           DESIGN-RULES tokens, light + dark
    global.css           base, browser details, font
    Notice.tsx  Button.tsx  TabBar.tsx  ScreenHeader.tsx  MarkBox.tsx  Sheet.tsx  NumberField.tsx
  screens/
    Today.tsx  LogWorkout.tsx  SetRow.tsx  ExerciseNotice.tsx  ExercisePicker.tsx
    Progress.tsx  ProgressChart.tsx  ExerciseHistory.tsx
    Workouts.tsx  EditWorkout.tsx  Settings.tsx
  App.tsx  main.tsx
tests/                   mirrors src/ (logic/*.test.ts, storage/*.test.ts, ui/*.test.tsx, sync/*.test.ts)
supabase/migrations/001_records.sql
scripts/icons.mjs        renders public/icon.svg to PNGs
public/icon.svg  public/icons/*.png
.github/workflows/deploy.yml
```

## Branches

Each slice is a branch off `main`, merged into `main` once all its tasks pass: `slice/1-logging` (Tasks 1–11), `slice/2-editing` (12–14), `slice/3-progress` (15–16), `slice/4-offline-deploy` (17–20), `slice/5-sync` (21–24). Task 25 runs on `main`.

---

## Slice 1: Log a workout end to end

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `tests/setup.ts`, `tests/smoke.test.tsx`, `.gitignore`

**Interfaces:**
- Produces: scripts `dev`, `test` (`vitest run`), `build` (`tsc -b && vite build`). Vitest uses `environment: "jsdom"` and `setupFiles: ["tests/setup.ts"]`, which imports `fake-indexeddb/auto` and `@testing-library/jest-dom/vitest`.

- [ ] **Step 1: Create git history.** Run `git init -b main`. Commit the existing docs (`README.md`, `CLAUDE.md`, `PRODUCT.md`, `DESIGN-RULES.md`, `docs/`, `.impeccable/surfaces/`) as "docs: design, product and UI rules". Then `git switch -c slice/1-logging`.
- [ ] **Step 2: Scaffold.** Create a Vite React-TS project in place. Install runtime deps `dexie dexie-react-hooks lucide-react @fontsource/unifrakturcook` and dev deps `vitest jsdom fake-indexeddb @testing-library/react @testing-library/user-event @testing-library/jest-dom`. Set `base: "/workout-tracker/"`. `.gitignore`: `node_modules`, `dist`, `.env.local`, `.DS_Store`.
- [ ] **Step 3: Write the smoke test** `tests/smoke.test.tsx`: render `<App />` and assert `screen.getByText("Today")` is in the document. `App` is a stub that renders the text "Today".
- [ ] **Step 4: Verify.** Run `npm test`: 1 passed. Run `npm run build`: exits 0.
- [ ] **Step 5: Commit** "chore: scaffold Vite React TS app with Vitest".

### Task 2: Domain types, clock, ids, input parsing

**Files:**
- Create: `src/logic/types.ts`, `src/logic/clock.ts`, `src/logic/ids.ts`, `src/logic/input.ts`
- Test: `tests/logic/clock.test.ts`, `tests/logic/input.test.ts`

**Interfaces:**
- Produces:
  - `types.ts`: exactly the spec's `SyncMeta`, `Exercise`, `PlannedExercise`, `Workout`, `Rotation`, `LoggedSet` (plus `skipped?: boolean`), `SessionEntry`, `Session`, `SyncState` (plus `lastExportAt?: string`, local only), plus `type Measure = "reps" | "seconds"` and `type Kind = "exercise" | "workout" | "rotation" | "session"`.
  - `clock.ts`: `EPOCH = "1970-01-01T00:00:00.000Z"`, `nowIso(): string`, `todayLocal(d?: Date): string`.
  - `ids.ts`: `newId(): string` (`crypto.randomUUID()`).
  - `input.ts`: `parseNumberInput(raw: string): number | undefined`, `splitWorkoutName(name: string): { title: string; subtitle?: string }`.

- [ ] **Step 1: Write the failing tests.**

```ts
// clock.test.ts (run with process.env.TZ = "America/New_York" set at top of file)
test("todayLocal uses local date, not UTC", () => {
  expect(todayLocal(new Date("2026-11-19T02:30:00Z"))).toBe("2026-11-18");
});
test("todayLocal pads month and day", () => {
  expect(todayLocal(new Date(2026, 0, 5, 12))).toBe("2026-01-05");
});
// input.test.ts
test.each([["42.5", 42.5], ["42,5", 42.5], [" 10 ", 10], ["", undefined], ["abc", undefined], ["-5", undefined], ["0", 0]])(
  "parseNumberInput(%j)", (raw, out) => expect(parseNumberInput(raw)).toBe(out));
test("splitWorkoutName", () => {
  expect(splitWorkoutName("Upper A: Horizontal Push & Pull")).toEqual({ title: "Upper A", subtitle: "Horizontal Push & Pull" });
  expect(splitWorkoutName("Workout")).toEqual({ title: "Workout" });
});
```

- [ ] **Step 2: Run** `npm test`. Expected: FAIL (modules not found).
- [ ] **Step 3: Implement** the four files. `parseNumberInput` trims the input, replaces "," with ".", rejects anything that isn't a finite number ≥ 0, and returns `undefined` for blank.
- [ ] **Step 4: Run** `npm test`. Expected: all pass.
- [ ] **Step 5: Commit** "feat(logic): domain types, clock, ids, number parsing".

### Task 3: Dexie schema and the write helper

**Files:**
- Create: `src/storage/db.ts`, `src/storage/write.ts`
- Test: `tests/storage/write.test.ts`

**Interfaces:**
- Consumes: `types.ts`, `nowIso`.
- Produces:
  - `class WorkoutDB extends Dexie` with tables `exercises: Table<Exercise, string>`, `workouts: Table<Workout, string>`, `rotation: Table<Rotation, string>`, `sessions: Table<Session, string>`, `syncState: Table<SyncState & { id: "state" }, string>`. Version 1 indexes: exercises `id, dirty, name`; workouts `id, dirty`; rotation `id, dirty`; sessions `id, dirty, status, date, workoutId`; syncState `id`.
  - `createDb(name: string): WorkoutDB`, and `db = createDb("workout-tracker")`.
  - `save<T extends SyncMeta>(table: Table<T, string>, record: Omit<T, "updatedAt" | "dirty" | "deleted"> & Partial<Pick<T, "deleted">>): Promise<T>`
  - `remove<T extends SyncMeta>(table: Table<T, string>, id: string): Promise<void>`
  - `live<T extends SyncMeta>(rows: T[]): T[]` (filters out deleted rows)

- [ ] **Step 1: Write the failing tests.** Each test uses `createDb(crypto.randomUUID())`.
  - `save` stamps `updatedAt` with `nowIso()` (use fake timers set to `2026-11-18T15:00:00Z`), `dirty: 1`, `deleted: false`.
  - Saving again updates `updatedAt`.
  - `remove` keeps the row with `deleted: true, dirty: 1`.
  - `live([...])` drops deleted rows.
- [ ] **Step 2: Run** `npm test -- write`. Expected: FAIL.
- [ ] **Step 3: Implement** `db.ts` and `write.ts`.
- [ ] **Step 4: Run** `npm test`. Expected: pass.
- [ ] **Step 5: Commit** "feat(storage): Dexie schema and save/remove helper".

### Task 4: Seed data

**Files:**
- Create: `src/storage/seed.ts`
- Test: `tests/storage/seed.test.ts`

**Interfaces:**
- Consumes: `WorkoutDB`, `EPOCH`.
- Produces: `seedIfEmpty(db: WorkoutDB): Promise<void>`, and the ID helpers `seedExerciseId(name: string): string` (`"seed-exercise-" + kebab(name)`, e.g. `seed-exercise-cable-row-narrow-grip`) and `SEED_WORKOUT_IDS = ["seed-workout-upper-a", "seed-workout-lower-a", "seed-workout-upper-b", "seed-workout-lower-b"]`.

Seed content is the spec's Seed data section, verbatim: workout names as written ("Upper A: Horizontal Push & Pull", ...), exercises in order with sets/targetMin/targetMax. Plank is `measure: "seconds"`, 2 sets, `targetMin: 45`, no max. Bulgarian Split Squats has `label: "per leg"`. Toe Touches is 2 × 12–15. Rotation is `{ id: "rotation", workoutIds: SEED_WORKOUT_IDS }`. Seed rows are written with `bulkPut` directly (not `save`), with `updatedAt: EPOCH, dirty: 0, deleted: false`.

- [ ] **Step 1: Write the failing tests.**
  - 4 workouts and rotation order equal `SEED_WORKOUT_IDS`.
  - Upper A's and Upper B's Lat Pulldown share `seedExerciseId("Lat Pulldown")`. Narrow and wide cable rows are different ids.
  - Plank has `measure: "seconds"` and `targetMin: 45`. Bulgarian Split Squats has `label: "per leg"`.
  - Every seed row has `updatedAt === EPOCH`, `dirty === 0`.
  - There are exactly 21 exercises (22 listed, Lat Pulldown shared). Calling `seedIfEmpty` twice leaves the counts unchanged.
  - It doesn't seed when any workout row already exists.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: pass.
- [ ] **Step 5: Commit** "feat(storage): seed the owner's four workouts".

### Task 5: Next up in the rotation

**Files:**
- Create: `src/logic/rotation.ts`
- Test: `tests/logic/rotation.test.ts`

**Interfaces:**
- Produces: `nextUp(workoutIds: string[], sessions: Session[]): string | undefined`

It looks at sessions with `status: "finished"`, `!deleted`, and a `workoutId` in the rotation, takes the latest by `date`, then `updatedAt`, and returns the id after it, wrapping around.

- [ ] **Step 1: Write the failing tests:** no history → first id; after A → B; after the last → first; one-off sessions (no `workoutId`) ignored; in-progress and deleted sessions ignored; the latest finished workout not in the rotation → first id; empty rotation → `undefined`; two sessions on the same date → the later `updatedAt` wins.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: pass.
- [ ] **Step 5: Commit** "feat(logic): next-up rotation".

### Task 6: Starting a session and pre-fill

**Files:**
- Create: `src/logic/session.ts`
- Test: `tests/logic/session.test.ts`

**Interfaces:**
- Consumes: types, `newId`.
- Produces:
  - `prefillSets(exerciseId: string, workoutId: string | undefined, setCount: number, history: Session[]): LoggedSet[]`
  - `startSession(workout: Workout, history: Session[], date: string): Omit<Session, "updatedAt" | "dirty" | "deleted">`
  - `lastNoteFor(exerciseId: string, history: Session[]): { date: string; note: string } | undefined`

Pre-fill source: the most recent finished, non-deleted session of the same `workoutId` that has an entry for the exercise with at least one done set. Otherwise the most recent such session of any workout. Set n copies `weight` and `amount` from that entry's nth done set. Sets beyond the source's count copy its last done set. Every pre-filled set has `done: false`. With no source, sets are `{ done: false }`. `startSession` creates one entry per planned exercise in order, with `planned` copied (minus `exerciseId`), `setCount = planned.sets`, `status: "in_progress"`, and `workoutName: workout.name`.

- [ ] **Step 1: Write the failing tests:**
  - Prefers the same workout over a more recent other workout (Lat Pulldown: Upper A on 11/10 with 70×12, Upper B on 11/12 with 80×10, starting Upper A → 70×12).
  - Falls back to another workout when the same one has none.
  - Copies by done-set index, skipping undone sets.
  - The 4th set copies the 3rd when the source had 3 done sets.
  - No history → `[{done:false} × sets]`.
  - Deleted and in-progress sessions are never a source.
  - `startSession` snapshots `planned` and `workoutName`.
  - `lastNoteFor` returns the newest non-empty note from any finished session, with its date.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: pass.
- [ ] **Step 5: Commit** "feat(logic): start session with pre-fill and last note".

### Task 7: Finishing a session

**Files:**
- Modify: `src/logic/session.ts`
- Test: `tests/logic/session.test.ts`

**Interfaces:**
- Produces: `finishSession(session: Session): Session | null`

It returns a copy with `status: "finished"`, each entry's `sets` filtered to `done && !skipped`, and entries with no remaining sets removed. It returns `null` when nothing remains.

- [ ] **Step 1: Write the failing tests:** drops undone and skipped sets; drops empty entries; keeps the note on kept entries; returns `null` with zero done sets; doesn't mutate its input.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: pass.
- [ ] **Step 5: Commit** "feat(logic): finish session".

### Task 8: Repository for Today and Log Workout

**Files:**
- Create: `src/storage/repo.ts`
- Test: `tests/storage/repo.test.ts`

**Interfaces:**
- Consumes: Tasks 3–7.
- Produces (every function takes `db: WorkoutDB` first, which keeps it testable; screens pass the default `db`):
  - `loadTodayState(db): Promise<{ nextUpId?: string; workouts: Workout[]; inProgress?: Session; lastDateByWorkout: Record<string, string> }>`
  - `startWorkout(db, workoutId: string): Promise<string>`: returns the session id, and throws `Error("A workout is already in progress")` if one exists
  - `updateSet(db, sessionId: string, entryIndex: number, setIndex: number, patch: Partial<LoggedSet>): Promise<void>`
  - `addSet(db, sessionId, entryIndex): Promise<void>`: a new set pre-filled like `prefillSets` for index n
  - `skipOrRemoveSet(db, sessionId, entryIndex, setIndex): Promise<void>`: toggles `skipped` on a set that had pre-filled values, and deletes a blank one
  - `setNote(db, sessionId, entryIndex, note: string): Promise<void>`
  - `finishWorkout(db, sessionId): Promise<"finished" | "empty">`: on `"empty"` nothing is written
  - `discardWorkout(db, sessionId): Promise<void>` (tombstone)

Every mutation reads the session, changes a copy, and writes it with `save()`.

- [ ] **Step 1: Write the failing tests** (fresh `createDb` + `seedIfEmpty`):
  - With no history, next up is Upper A.
  - `startWorkout` → `inProgress` is set.
  - A second `startWorkout` throws.
  - `updateSet` writes immediately (`dirty: 1`) and doesn't set `done` unless the patch does.
  - `finishWorkout` with zero done sets returns `"empty"` and the session stays in progress.
  - After finishing Upper A, next up is Lower A.
  - **Review Focus 3:** start a session dated `2026-11-10` (fake timers), finish it with fake time at `2026-11-14`. It keeps `date: "2026-11-10"` and next up still advances.
  - `discardWorkout` → no in-progress session, row tombstoned.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: pass.
- [ ] **Step 5: Commit** "feat(storage): repository for logging".

### Task 9: UI foundation (tokens and base components)

**Files:**
- Create: `src/ui/tokens.css`, `src/ui/global.css`, `src/ui/Notice.tsx`, `src/ui/Button.tsx`, `src/ui/ScreenHeader.tsx`, `src/ui/TabBar.tsx`, `src/ui/MarkBox.tsx`, `src/ui/Sheet.tsx`, `src/ui/NumberField.tsx`
- Test: `tests/ui/MarkBox.test.tsx`, `tests/ui/NumberField.test.tsx`

**Interfaces:**
- Produces:
  - `tokens.css`: every token in DESIGN-RULES Color (light on `:root`, dark under `@media (prefers-color-scheme: dark)`), plus spacing and radius tokens.
  - `global.css`: imports `@fontsource/unifrakturcook/700.css`, and covers the body ground, safe areas, and the Browser details section verbatim.
  - `<Notice>`: nails, padding, shadow per DESIGN-RULES.
  - `<Button variant="primary" | "board" | "outline" | "text" loading?>`
  - `<ScreenHeader back?: {label, onClick} right?: ReactNode title subtitle?>`
  - `<TabBar active: Tab onChange>` with `type Tab = "today" | "progress" | "workouts" | "settings"` and the DESIGN-RULES Lucide icons.
  - `<MarkBox state: "suggested" | "current" | "done" | "skipped" label: string onToggle>`
  - `<Sheet open onClose title>`
  - `<NumberField value?: number unit: string kind: "weight" | "amount" draft: boolean onCommit(v: number | undefined)>`

- [ ] **Step 1: Write the failing tests:**
  - `MarkBox` renders a button with the given accessible name.
  - In `done` state it contains an `svg` (Lucide check) and no "✓"/"✕" text.
  - Click calls `onToggle` once.
  - `NumberField` uses `inputMode="decimal"` for weight and `"numeric"` for amount.
  - Typing "42,5" then blur calls `onCommit(42.5)`.
  - Typing "abc" then blur calls `onCommit(undefined)` and doesn't throw.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** to DESIGN-RULES: sizes, states, stamp motion on MarkBox (140ms, scale 1.15→1, rotate −4°→−2°), and reduced motion.
- [ ] **Step 4: Run** `npm test && npm run build`. Expected: pass.
- [ ] **Step 5: Commit** "feat(ui): design tokens and base components".

### Task 10: App shell and the Today screen

**Files:**
- Create: `src/screens/Today.tsx`, `src/storage/DbContext.tsx`
- Modify: `src/App.tsx`, `src/main.tsx`
- Test: `tests/screens/Today.test.tsx`

**Interfaces:**
- Consumes: repo (Task 8), UI (Task 9), `splitWorkoutName`.
- Produces: an `App` state of `{ tab: Tab; overlay?: { kind: "log"; sessionId: string } }`. No router. `DbContext.tsx` exports `<DbProvider db>` and `useDb(): WorkoutDB` (defaulting to the app `db`); every screen gets its db from `useDb()`, so tests pass a fresh one. `main.tsx` calls `seedIfEmpty(db)` before rendering. Screens read with `useLiveQuery`.

Today layout and copy follow DESIGN-RULES Screens → Today: the next-up notice with "Start workout"; the other three as smaller notices (tap → start that one); an in-progress session replaces next-up with "Resume" / "Discard" (Discard confirms in a Sheet).

- [ ] **Step 1: Write the failing tests** (render `App` against a seeded test db, passed via a `DbContext` provider):
  - Shows the "Upper A" title and "Start workout".
  - Clicking Start opens Log Workout with "Barbell Bench Press" visible.
  - With an in-progress session, "Resume" is shown instead of "Start workout".
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test && npm run build`. Expected: pass.
- [ ] **Step 5: Commit** "feat(screens): app shell and Today".

### Task 11: Log Workout screen

**Files:**
- Create: `src/screens/LogWorkout.tsx`, `src/screens/ExerciseNotice.tsx`, `src/screens/SetRow.tsx`
- Test: `tests/screens/LogWorkout.test.tsx`

**Interfaces:**
- Consumes: repo, UI, `lastNoteFor`.
- Produces: `<LogWorkout sessionId onClose>`. A set row's state is `current` for the first set (across the whole session, in order) that isn't done or skipped, and otherwise `done` / `skipped` / `suggested`.

Follow DESIGN-RULES (Exercise notice furniture, set row states, the header with back + elapsed timer since the session's first render, "Fulfill contract"). After a set is confirmed, scroll the next current row to the same offset (`scrollIntoView({ block: "center" })`, instant under reduced motion). Finish: `"empty"` → a Sheet "Nothing logged yet. Discard this workout?" with "Discard workout" / "Keep logging". `"finished"` → the summary notice with the "Fulfilled" stamp and a "Done" button back to Today.

- [ ] **Step 1: Write the failing tests:**
  - Pre-filled numbers render with the draft style and the mark labeled "Set 1: … not done".
  - Clicking the mark → label "… done" and the db set `done: true`.
  - Editing weight to 70 keeps `done: false`.
  - "+ Set" adds a 5th bench row.
  - Fulfill with nothing done shows the discard sheet.
  - Fulfill after one done set shows "Fulfilled".
  - The last note shows its date and text when history has one.
  - Plank rows show "sec" as the unit and a hold bar whose width is proportional to the seconds entered.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Verify in the browser.** Run `npm run dev` and open it at 393 × 852 in the Browser pane. Log three sets, lock-reload mid-session (reload the page) and confirm the sets persist, then finish. Fix layout issues against DESIGN-RULES.
- [ ] **Step 5: Run** `npm test && npm run build`. Expected: pass.
- [ ] **Step 6: Commit** "feat(screens): Log Workout", then merge `slice/1-logging` into `main`.

---

## Slice 2: Editing workouts and one-off sessions

### Task 12: Editing logic and repository

**Files:**
- Create: `src/logic/editing.ts`
- Modify: `src/storage/repo.ts`
- Test: `tests/logic/editing.test.ts`, `tests/storage/repo-editing.test.ts`

**Interfaces:**
- Produces:
  - logic: `normalizeName(s: string): string` (trim, collapse spaces, lowercase), `findExerciseByName(exercises: Exercise[], name: string): Exercise | undefined`, `moveItem<T>(list: T[], from: number, to: number): T[]`
  - repo: `getOrCreateExercise(db, name: string, measure: Measure): Promise<Exercise>`, `saveWorkout(db, workout: Omit<Workout, "updatedAt" | "dirty" | "deleted">): Promise<void>`, `createWorkout(db, name: string): Promise<string>` (appended to the rotation), `deleteWorkout(db, id): Promise<void>` (tombstones it and removes it from the rotation), `setRotation(db, workoutIds: string[]): Promise<void>`, `renameExercise(db, id, name): Promise<void>`, `deleteExercise(db, id): Promise<"archived" | "deleted">` (archives when any non-deleted session references it, and removes it from every workout's plan)

- [ ] **Step 1: Write the failing tests:**
  - **Review Focus 5:** after `getOrCreateExercise(db, "Bench Press", "reps")`, calling `getOrCreateExercise(db, "bench  press ", "reps")` returns the same id, and the exercise count is unchanged.
  - `moveItem` up and down at the edges.
  - `deleteWorkout` removes the id from the rotation, and the session's `workoutName` is unchanged.
  - `deleteExercise` with history → `"archived"`, without → `"deleted"`.
  - **Review Focus 4:** start an Upper A session, change Upper A's bench target to 5 × 5 via `saveWorkout`. The in-progress session still has `planned.sets === 4`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: pass.
- [ ] **Step 5: Commit** "feat: workout and exercise editing".

### Task 13: Workouts and Edit Workout screens

**Files:**
- Create: `src/screens/Workouts.tsx`, `src/screens/EditWorkout.tsx`
- Modify: `src/App.tsx` (overlay `{ kind: "editWorkout"; workoutId: string }`), `DESIGN-RULES.md` (Screens → Workouts: replace "drag handles to reorder" with "Move up / Move down buttons to reorder")
- Test: `tests/screens/Workouts.test.tsx`

Workouts lists notices in rotation order, with Move up / Move down, "New workout", and tap to edit. EditWorkout has a name field and one row per planned exercise: name, sets, targetMin, targetMax, label, a reps/seconds toggle, Move up / Move down, and Remove. "Add exercise" opens the ExercisePicker (Task 14). There's "Delete workout" with a confirmation Sheet. Every field autosaves on blur through `saveWorkout`.

- [ ] **Step 1: Write the failing tests:**
  - Moving Lower A up makes it first in `rotation.workoutIds`.
  - Changing bench sets to 5 and blurring persists.
  - Delete workout → it's gone from the list.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test && npm run build`. Expected: pass.
- [ ] **Step 5: Commit** "feat(screens): edit workouts and rotation".

### Task 14: Exercise picker, mid-session exercises, one-off workouts

**Files:**
- Create: `src/screens/ExercisePicker.tsx`
- Modify: `src/storage/repo.ts`, `src/screens/Today.tsx`, `src/screens/LogWorkout.tsx`, `src/screens/EditWorkout.tsx`
- Test: `tests/storage/repo-oneoff.test.ts`, `tests/screens/ExercisePicker.test.tsx`

**Interfaces:**
- Produces: `startEmptyWorkout(db): Promise<string>` (`workoutName: "Workout"`, no `workoutId`), `addExerciseToSession(db, sessionId, exerciseId): Promise<void>` (one pre-filled set, `planned: { sets: 1, targetMin: 0 }`), `renameSession(db, sessionId, name): Promise<void>`. `<ExercisePicker open onPick(exercise: Exercise) onClose>`: a Sheet with a search field, the non-archived exercises sorted by name, and "Create '<typed>'", which offers the reps/seconds choice and goes through `getOrCreateExercise`.

- [ ] **Step 1: Write the failing tests:**
  - A one-off session doesn't change next up after finishing.
  - An added exercise gets pre-fill from history.
  - The picker filters by substring, case-insensitively.
  - Create reuses a duplicate name.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Add "Start empty workout" (a board button) on Today, and "Add exercise" at the end of Log Workout.
- [ ] **Step 4: Run** `npm test && npm run build`. Expected: pass.
- [ ] **Step 5: Commit** "feat: one-off workouts and exercise picker", then merge `slice/2-editing` into `main`.

---

## Slice 3: Progress

### Task 15: Progress logic

**Files:**
- Create: `src/logic/progress.ts`
- Test: `tests/logic/progress.test.ts`

**Interfaces:**
- Produces:
  - `type ProgressPoint = { sessionId: string; date: string; value: number; weight?: number; amount?: number; isRecord: boolean }`
  - `progressSeries(exercise: Exercise, sessions: Session[]): { metric: "weight" | "reps" | "seconds"; points: ProgressPoint[] }`
  - `isRecordSet(exercise: Exercise, set: LoggedSet, history: Session[]): boolean`
  - `exercisesByRecency(exercises: Exercise[], sessions: Session[]): { exercise: Exercise; lastDate: string }[]`

The metric is `"weight"` if any done set of the exercise ever had a weight, otherwise `exercise.measure`. There's one point per finished, non-deleted session containing the exercise: the max weight (or amount) over its done sets, sorted by date. `isRecord` is true when the value is strictly greater than every earlier point. The first point is never a record.

- [ ] **Step 1: Write the failing tests:**
  - Weight series for bench across 3 sessions.
  - Toe Touches (never weighted) uses reps.
  - Plank with 25 lb uses weight.
  - Unweighted Plank uses seconds.
  - The record flag is set only on strict increases.
  - `isRecordSet` is false with no history.
  - Deleted and in-progress sessions are excluded.
  - Recency ordering.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: pass.
- [ ] **Step 5: Commit** "feat(logic): progress series and records".

### Task 16: Progress screens and editing past sessions

**Files:**
- Create: `src/screens/Progress.tsx`, `src/screens/ProgressChart.tsx`, `src/screens/ExerciseHistory.tsx`
- Modify: `src/screens/SetRow.tsx` (the "Record" label via `isRecordSet`), `src/screens/LogWorkout.tsx` (a `mode: "live" | "edit"` prop: edit mode shows a date field, "Delete session" in a confirmation Sheet, and "Done" instead of "Fulfill contract"), `src/storage/repo.ts` (`setSessionDate`, `deleteSession`), `DESIGN-RULES.md` (Set row Personal best: "shows on a set that beats your previous best for that exercise, in the session where it happened, and on its chart point")
- Test: `tests/screens/Progress.test.tsx`

ProgressChart is a hand-written SVG per DESIGN-RULES Progress chart: straight segments, record points in `--record`, and the title by metric ("Heaviest set per session" / "Best reps per session" / "Longest hold per session"). One point shows a single dot with no line. ExerciseHistory lists past sessions as "11/12 · 65×10 75×8 85×8 95×6" plus the note; tapping one opens LogWorkout in edit mode. The empty state copy follows DESIGN-RULES Empty states.

- [ ] **Step 1: Write the failing tests:**
  - The Progress list orders by recency.
  - The bench chart renders 3 circles and an aria-label "Heaviest set per session".
  - The record point has the record class.
  - Edit mode changing the date persists.
  - "Delete session" tombstones it and it leaves the list.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Verify in the browser** at 393 × 852 with synthetic history (a dev-only `?demo` seed that's clearly labeled and never runs in production builds). Check the chart and list against DESIGN-RULES.
- [ ] **Step 5: Run** `npm test && npm run build`. Expected: pass.
- [ ] **Step 6: Commit** "feat(screens): progress and past session editing", then merge `slice/3-progress` into `main`.

---

## Slice 4: Offline, backup, icon, deploy

### Task 17: Backup format

**Files:**
- Create: `src/logic/backup.ts`
- Modify: `src/storage/repo.ts`
- Test: `tests/logic/backup.test.ts`, `tests/storage/repo-backup.test.ts`

**Interfaces:**
- Produces: `type Backup = { version: 1; exportedAt: string; exercises: Exercise[]; workouts: Workout[]; rotation: Rotation[]; sessions: Session[] }`, `parseBackup(text: string): { ok: true; backup: Backup } | { ok: false; error: string }`, and in the repo `exportBackup(db): Promise<Backup>` (includes tombstones) and `importBackup(db, backup: Backup): Promise<void>` (clears all four tables in one transaction, then writes every row with `updatedAt: nowIso()`, `dirty: 1`).

- [ ] **Step 1: Write the failing tests:**
  - A round trip preserves every row, including tombstones.
  - `parseBackup` rejects invalid JSON ("This file isn't a Workout Tracker backup."), `version: 2` ("This backup is from a newer version of the app."), and a missing `sessions` array.
  - Import marks every row dirty.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: pass.
- [ ] **Step 5: Commit** "feat: backup export and import".

### Task 18: Settings screen (backup file)

**Files:**
- Create: `src/screens/Settings.tsx`
- Modify: `src/App.tsx`
- Test: `tests/screens/Settings.test.tsx`

Export builds a `File` named `workout-tracker-backup-YYYY-MM-DD.json`. When `navigator.canShare?.({ files: [file] })` is true it uses `navigator.share`, otherwise an `<a download>` click. It then stores `lastExportAt` in `syncState` and shows "Last export: 11/12". Import uses an `<input type="file" accept="application/json">` and `parseBackup`; on success it shows a confirmation Sheet ("Replace everything on this phone with this backup?") then `importBackup`; on failure it shows the error inline. The Cloud backup notice is a placeholder: "Cloud backup is coming soon." (replaced in Task 23). The home-screen line follows DESIGN-RULES.

- [ ] **Step 1: Write the failing tests:**
  - Export calls `navigator.share` with one file when `canShare` is mocked true, and falls back to the anchor otherwise.
  - An invalid file shows "This file isn't a Workout Tracker backup."
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test && npm run build`. Expected: pass.
- [ ] **Step 5: Commit** "feat(screens): settings with backup file".

### Task 19: Offline PWA and the home-screen icon

**Files:**
- Create: `public/icon.svg`, `scripts/icons.mjs`, `public/icons/` (generated PNGs)
- Modify: `vite.config.ts`, `index.html`, `src/main.tsx`, `package.json` (add a `"icons"` script and dev deps `vite-plugin-pwa sharp`)
- Test: `tests/pwa.test.ts`

The icon is an original flat vector per DESIGN-RULES Icon and imagery: a bone notice with two nails on `#2a241f`, stamped with a red-ink check, no text, nothing franchise-like. `scripts/icons.mjs` uses sharp to render `apple-touch-icon.png` (180), `icon-192.png`, `icon-512.png`, and `icon-maskable-512.png` (art inside the central 80%). The manifest: `name` "Workout Tracker", `short_name` "Workouts", `display: "standalone"`, `start_url` and `scope` "/workout-tracker/", `background_color` and `theme_color` `#2a241f`. Workbox `globPatterns: ["**/*.{js,css,html,woff2,png,svg}"]`, `registerType: "autoUpdate"`. `main.tsx` calls `navigator.storage?.persist?.()` once on load. `index.html` gets the `theme-color` metas for light and dark, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style: black-translucent`, and the apple-touch-icon link.

- [ ] **Step 1: Write the failing test** `tests/pwa.test.ts`: import the PWA options object exported from `vite.config.ts` (`export const pwaOptions`) and assert `start_url`, `scope`, `theme_color`, `display`, the four icon entries, and that `globPatterns` includes `woff2`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement**, and run `npm run icons`.
- [ ] **Step 4: Show the icon to the owner** (open `public/icons/icon-512.png`) and adjust until they approve it.
- [ ] **Step 5: Verify offline.** `npm run build && npx vite preview --base /workout-tracker/`, load it once in the Browser pane, switch to offline, reload: the app loads and the title shows in blackletter.
- [ ] **Step 6: Run** `npm test && npm run build`. Expected: pass.
- [ ] **Step 7: Commit** "feat: offline PWA and home-screen icon".

### Task 20: Deploy to GitHub Pages

**Files:**
- Create: `.github/workflows/deploy.yml`

On push to `main`: checkout, setup-node 20 with the npm cache, `npm ci`, `npm test`, then `npm run build` with `VITE_SUPABASE_URL: ${{ vars.VITE_SUPABASE_URL }}` and `VITE_SUPABASE_ANON_KEY: ${{ vars.VITE_SUPABASE_ANON_KEY }}`, then `actions/upload-pages-artifact` (path `dist`) and `actions/deploy-pages`. Permissions: `pages: write`, `id-token: write`, `contents: read`.

- [ ] **Step 1: Write the workflow.**
- [ ] **Step 2: Ask the owner before anything leaves the machine.** Confirm creating a **public** GitHub repo named `workout-tracker` and pushing. On a yes: `gh repo create workout-tracker --public --source . --remote origin`, then merge `slice/4-offline-deploy` into `main` and `git push -u origin main`.
- [ ] **Step 3: Turn on Pages** with the source "GitHub Actions" (`gh api -X POST repos/{owner}/workout-tracker/pages -f build_type=workflow`), and confirm with the owner first.
- [ ] **Step 4: Verify.** `gh run watch` → success. Open `https://<owner>.github.io/workout-tracker/` in the Browser pane: Today shows Upper A.
- [ ] **Step 5: Owner installs it on their iPhone** (Safari → Share → Add to Home Screen), logs a set offline, and reopens. Record the result.

---

## Slice 5: Cloud sync

### Task 21: Cloud schema and the remote interface

**Files:**
- Create: `supabase/migrations/001_records.sql`, `src/sync/remote.ts`
- Test: `tests/sync/remote.test.ts`

**Interfaces:**
- Produces:
  - SQL: the spec's Cloud schema verbatim, plus a `set_synced_at()` trigger function `before insert or update`, the index `records_user_synced (user_id, synced_at)`, RLS enabled, and policies `select`, `insert`, `update` using/with check `user_id = auth.uid()`. No delete policy.
  - `type RemoteRow = { kind: Kind; id: string; data: unknown; updated_at: string; deleted: boolean; synced_at: string }`
  - `interface RemoteStore { pull(since?: string): Promise<RemoteRow[]>; push(rows: Omit<RemoteRow, "synced_at">[]): Promise<void> }`
  - `createMemoryRemote(): RemoteStore & { rows: Map<string, RemoteRow> }`: it stamps `synced_at` from an incrementing counter-based ISO time, so tests can order writes.

- [ ] **Step 1: Write the failing tests** for the memory remote: push then pull returns the rows; `pull(since)` returns only later `synced_at`; a re-push of the same key replaces it.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: pass.
- [ ] **Step 5: Commit** "feat(sync): cloud schema and remote interface", on branch `slice/5-sync` (installing `@supabase/supabase-js`).

### Task 22: Merge rules and the sync runner

**Files:**
- Create: `src/logic/sync-merge.ts`, `src/sync/runner.ts`
- Test: `tests/logic/sync-merge.test.ts`, `tests/sync/runner.test.ts`

**Interfaces:**
- Produces:
  - `shouldApplyRemote(local: SyncMeta | undefined, remote: { updatedAt: string }): boolean`: true when local is missing, or `local.dirty === 0 && local.updatedAt < remote.updatedAt`
  - `toRemoteRow(kind: Kind, record: SyncMeta): Omit<RemoteRow, "synced_at">`, `fromRemoteRow(row: RemoteRow): SyncMeta` (sets `dirty: 0`)
  - `newestSyncedAt(rows: RemoteRow[], prev?: string): string | undefined`
  - `syncOnce(db: WorkoutDB, remote: RemoteStore): Promise<{ pulled: number; pushed: number }>`: pull since `lastPulledAt` → apply → save `lastPulledAt`; then push every `dirty: 1` row across the four tables → for each pushed row, clear `dirty` only if its `updatedAt` still equals the pushed value; set `lastSyncedAt`. Pulled rows are written with `bulkPut`, never `save()`.
  - `createSyncScheduler(run: () => Promise<unknown>, opts?: { debounceMs?: number }): { trigger(): void; dispose(): void }`: single-flight (a trigger during a run queues exactly one more run), with a default debounce of 5000 ms for `trigger`, and errors swallowed.

- [ ] **Step 1: Write the failing tests** (the spec's Testing → Sync list, each its own test):
  - Dirty rows are pushed and then clean.
  - A row edited between read and push stays dirty.
  - A pulled newer row replaces an older clean row.
  - A pulled row never overwrites a dirty one.
  - Tombstones sync both ways.
  - Epoch seed rows are replaced by cloud rows and are never pushed unless edited.
  - **Fresh install restore:** device A logs and syncs; device B (a new db plus seed) syncs and ends with A's sessions and edited workouts, with no duplicate workouts.
  - The scheduler runs once for 3 rapid triggers, and queues one rerun when triggered mid-run.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: pass.
- [ ] **Step 5: Commit** "feat(sync): merge rules and sync runner".

### Task 23: Sign-in, triggers, and the Cloud backup UI

**Files:**
- Create: `src/sync/supabase.ts`
- Modify: `src/main.tsx`, `src/screens/Settings.tsx`, `src/screens/Today.tsx`
- Test: `tests/screens/Settings-cloud.test.tsx`

**Interfaces:**
- Produces: `getSupabase(): SupabaseClient | null` (null when the env vars are missing), `createSupabaseRemote(client): RemoteStore`, `sendCode(email: string): Promise<void>` (`signInWithOtp` with `shouldCreateUser: true`), `verifyCode(email: string, code: string): Promise<void>` (`verifyOtp` type `"email"`), `signOut(): Promise<void>`, `useAuth(): { email?: string; status: "off" | "signed-out" | "signed-in" }`.

`main.tsx`: when signed in, create the scheduler with `syncOnce(db, remote)`, run it on start, and trigger on `visibilitychange` (visible), `online`, and Dexie `db.on("changes")` (debounced). Finishing a workout calls the run directly. Settings → Cloud backup, signed out: "Not backed up", email field, "Send code", then a 6-digit code field (`inputmode="numeric"`, `autocomplete="one-time-code"`) and "Sign in". Signed in: "Signed in as …", "Last synced: 2 min ago · N changes waiting", "Sync now", "Sign out". Errors show inline with DESIGN-RULES copy. Today: a dismissible board-level line "Your workouts aren't backed up yet. Sign in under Settings." when signed out and status isn't `"off"` (dismissal stored in `localStorage`).

- [ ] **Step 1: Write the failing tests** (mock `src/sync/supabase.ts`):
  - Signed out shows "Not backed up".
  - Send code → the code field appears.
  - Verify → "Signed in as a@b.co".
  - With env vars missing (`status: "off"`), the cloud notice says "Cloud backup isn't set up in this build." and there's no Today reminder.
  - Sign out keeps every local session and workout (the row counts are unchanged).
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test && npm run build`. Expected: pass.
- [ ] **Step 5: Commit** "feat(sync): email-code sign-in and cloud backup settings".

### Task 24: Supabase setup and the end-to-end check

- [ ] **Step 1: Walk the owner through the README Supabase setup.** They create the account and project themselves. Run the migration SQL in the SQL editor, edit the Magic Link template to show `{{ .Token }}`, and put the URL and anon key in `.env.local` and the GitHub repo variables.
- [ ] **Step 2: Local check.** `npm run dev`, sign in with a code, log a set, and see the row in the Supabase table editor with `user_id` filled.
- [ ] **Step 3: Merge** `slice/5-sync` into `main` and push. CI deploys.
- [ ] **Step 4: Phone check** (the spec's Testing manual list): log offline, go online, "Last synced" updates, the rows appear in Supabase. Delete the home-screen app, reinstall, sign in, and history plus edited workouts come back.

---

## Task 25: Design finish review and DESIGN.md

- [ ] **Step 1: Capture.** Take `desktop.png` (1440 wide) and `mobile.png` (393 × 852) of Today, Log Workout mid-session, Progress, Workouts and Settings, in light and dark, into `.impeccable/review/`.
- [ ] **Step 2: Run** `impeccable detect --json` on `src/`, fix the mechanical findings, and note the rest.
- [ ] **Step 3: Run the Impeccable finish review.** Spawn `impeccable-finish-reviewer` with the request, the screenshots, the direction contract (`.impeccable/surfaces/src-app-tsx.md`), the decision sketch `.impeccable/mocks/decision/model-pick-r3.html` as the critique reference, and DESIGN-RULES.md. Act on its disposition.
- [ ] **Step 4: Generate DESIGN.md** with `impeccable-documenter` from the built app. Commit `DESIGN.md` and `.impeccable/design.json`.
