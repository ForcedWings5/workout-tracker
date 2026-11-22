# Weekly Schedule and History Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the free-running rotation with a fixed weekly schedule that Today follows (with a missed-day reminder), edit the week on the Workouts tab, and add a month calendar of past workouts to Progress.

**Architecture:**
- New pure rules in `src/logic/schedule.ts`: date math, what Today shows, the rotation-to-schedule rule, and the calendar grid.
- A new synced `Schedule` record, added in Dexie version 2 by migrating from the rotation, plus backup format version 2.
- Screens call only `src/storage/repo.ts`, as now.

**Tech Stack:** React 18 + TypeScript strict, Dexie 4, Vitest + Testing Library + fake-indexeddb, lucide-react.

**Spec:** `docs/superpowers/specs/2026-11-22-weekly-schedule-design.md`, which extends `docs/superpowers/specs/2026-11-18-workout-tracker-design.md`.

## Global Constraints

- **Dates:**
  - Every date is a local `YYYY-MM-DD` string.
  - Build `Date`s with `new Date(y, m - 1, d)`, never from a parsed ISO string, so DST and UTC never shift a weekday.
  - The week starts Monday. Weekday index 0 is Monday and 6 is Sunday.
- **The Schedule record:** a single row with id `"schedule"`, shaped `SyncMeta & { days: (string | null)[] }` with exactly 7 entries, where `null` means Rest.
- **Writes:**
  - Every write to `schedule` goes through `save()`.
  - The seed schedule has `updatedAt: EPOCH` and `dirty: 0`.
- **History is never rewritten:** changing the schedule never touches sessions.
- **Only finished, non-deleted sessions count.**
  - One-off sessions (no `workoutId`) never count toward the week.
  - Sessions dated after today are ignored.
- **The rotation is retired:**
  - Nothing reads or writes `db.rotation` after this plan, except the Dexie version 2 upgrade.
  - `src/logic/rotation.ts` and `tests/logic/rotation.test.ts` are deleted.
- **Copy is exactly as the spec fixes it:**
  - "Today · Monday"
  - "Done today"
  - "Done this week (Monday)"
  - "Rest day"
  - "Next: Upper B, Thursday", or "Next: Upper B, tomorrow"
  - "Missed Monday: Upper A"
  - "Do Upper A instead"
  - "No workouts scheduled. Set your week on the Workouts tab."
  - "This week"
  - "Rest"
  - "Not scheduled"
  - "No workout on Monday, Nov 16."
- **Workout names** shown in this copy are the title, from `splitWorkoutName(name).title`.
- **DESIGN-RULES:**
  - One primary (red) button per screen.
  - Red ink marks a calendar day that has a workout.
  - Every tap target is at least 44px.
  - Sheets are for picking.
- Run `npm test` and `npm run build` before calling work done.

## Review Focus

1. **App left open across midnight:** Today must recompute the date when the app comes back to the foreground (`visibilitychange`), not show yesterday's plan (Task 3 test).
2. **Sunday to Monday boundary:** on Monday nothing from last week is missed, and Sunday's "Next" wraps to Monday (Task 1 tests).
3. **A workout in progress started yesterday:** Today shows only Resume / Discard, whatever the date (Task 3 test).
4. **Upgrading a real install:**
   - The owner's database has the seed rotation (epoch, clean) but real sessions. It must get the seed schedule with `dirty: 0`.
   - An edited (dirty) rotation must give a `dirty: 1` schedule. (Task 2 tests)
5. **Deleting a scheduled workout:** its days become Rest on the Workouts tab, and Today never shows a deleted workout (Task 2 and Task 1 tests).

---

### Task 1: Schedule rules

**Files:**
- Create: `src/logic/schedule.ts`
- Test: `tests/logic/schedule.test.ts`

**Interfaces:**
- Produces:
  - `WEEKDAYS: readonly ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]`
  - `weekdayOf(date: string): number` (Monday is 0)
  - `addDays(date: string, n: number): string`
  - `weekStartOf(date: string): string` (the Monday on or before `date`)
  - `type TodayPlan = { weekday: number; today?: { workoutId: string; status: "todo" | "doneToday" | "doneThisWeek"; doneOn?: string }; next?: { workoutId: string; date: string }; missed: { workoutId: string; date: string }[] }`
  - `todayPlan(days: (string | null)[], liveWorkoutIds: string[], sessions: Session[], today: string): TodayPlan`
  - `scheduleFromRotation(rotationIds: string[], liveWorkoutIds: string[]): (string | null)[]`
  - `monthGrid(year: number, month: number): (string | null)[][]` (weeks of 7 cells, Monday first, `null` outside the month)

**The rules `todayPlan` follows:**
- A scheduled id that isn't in `liveWorkoutIds` counts as Rest.
- **Counted sessions** are finished, non-deleted sessions with a `workoutId`, dated from `weekStartOf(today)` to `today` inclusive.
- **Covering scheduled days:** for each workout, list its scheduled days from Monday up to today in order. The first `n` of those days are covered, where `n` is the number of counted sessions of that workout.
- **`today`:**
  - Absent on a rest day.
  - `"doneToday"` if a counted session of that workout is dated today.
  - `"doneThisWeek"` if today's day is covered but there's no session today. `doneOn` is the date of the covering session, sorted by date.
  - Otherwise `"todo"`.
- **`next`:** the first day after today, up to 7 days ahead, with a live workout. Absent when nothing is scheduled.
- **`missed`:** each scheduled day from Monday to yesterday that isn't covered, in day order.

- [ ] **Step 1: Write the failing tests**

Use the owner's week: `const WEEK = ["UA", "LA", null, "UB", "LB", null, null]` with live ids `["UA", "LA", "UB", "LB"]`. Monday is 2026-11-16. Build sessions with `session()`, `entry()` and `done()` from `tests/logic/fixtures.ts`.

- `weekdayOf("2026-11-16")` is 0, `weekdayOf("2026-11-22")` is 6, `weekdayOf("2028-02-29")` is 1.
- `addDays("2026-11-30", 1)` is `"2026-12-01"`, `addDays("2026-12-31", 1)` is `"2027-01-01"`, and `addDays("2026-03-08", 1)` is `"2026-03-09"` (US DST day).
- `weekStartOf` gives `"2026-11-16"` for both `"2026-11-22"` and `"2026-11-16"`.
- On a training day with nothing done, `todayPlan(WEEK, live, [], "2026-11-16")` equals `{ weekday: 0, today: { workoutId: "UA", status: "todo" }, next: { workoutId: "LA", date: "2026-11-17" }, missed: [] }`.
- On a rest day, Wednesday 2026-11-18 with UA done Monday and LA done Tuesday: `today` is undefined, `next` is `{ UB, "2026-11-19" }`, and `missed` is `[]`.
- **Sunday wraps:** on `"2026-11-22"`, `next` is `{ UA, "2026-11-23" }`.
- **Done today:** a finished UA session dated `"2026-11-16"` gives status `"doneToday"`.
- **Catch-up:** UA done on Tuesday 2026-11-17 clears Monday. On Tuesday, `today` is `{ LA, "todo" }` and `missed` is `[]`.
- **Missed, earliest first:** on Friday 2026-11-20 with nothing done, `missed` is `[{ UA, "2026-11-16" }, { LA, "2026-11-17" }, { UB, "2026-11-19" }]`.
- **Done this week:** LA done on Monday 2026-11-16. On Tuesday, `today` is `{ LA, status: "doneThisWeek", doneOn: "2026-11-16" }`, and `missed` contains UA.
- **Monday resets:** on Monday 2026-11-23 with nothing done last week, `missed` is `[]`.
- **Ignored sessions:** deleted, in-progress, one-off (no `workoutId`) and future-dated sessions never count.
- **Deleted workout:** with live ids `["LA", "UB", "LB"]` on Monday, `today` is undefined and `next` is LA.
- **Repeated workout:** with UA on Monday and Thursday and one UA session on Monday, on Friday `missed` contains `{ UA, Thursday's date }`.
- **Nothing scheduled:** `todayPlan([null x7], …)` has `today` and `next` both undefined.
- **`scheduleFromRotation`:**
  - `(["UA", "LA", "UB", "LB"], live)` equals `["UA", "LA", null, "UB", "LB", null, null]`.
  - With 8 live ids, the 8th is left out and Wed, Sat and Sun are filled in that order.
  - Ids not in `live` are skipped before filling.
- **`monthGrid(2026, 11)`:**
  - The first week is `[null x6, "2026-11-01"]`, since Nov 1, 2026 is a Sunday.
  - The last week starts `"2026-11-30"`.
  - Every week has length 7.
  - `monthGrid(2028, 2)` contains `"2028-02-29"`.

- [ ] **Step 2: Run** `npx vitest run tests/logic/schedule.test.ts`. Expected: FAIL, because the module doesn't exist.
- [ ] **Step 3: Implement** in `src/logic/schedule.ts`, with no React and no Dexie. The fill order for `scheduleFromRotation` is weekday indices `[0, 1, 3, 4, 2, 5, 6]`.
- [ ] **Step 4: Run** the file, then `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** "feat(logic): weekly schedule rules".

### Task 2: Schedule data, upgrade, backup v2

**Files:**
- Modify:
  - `src/logic/types.ts`: add `Schedule`, and `"schedule"` to `Kind`
  - `src/storage/db.ts`: version 2
  - `src/storage/seed.ts`
  - `src/storage/repo.ts`
  - `src/logic/backup.ts`
  - `src/storage/demo.ts`
- Delete: `src/logic/rotation.ts`, `tests/logic/rotation.test.ts`
- Test:
  - `tests/storage/schedule.test.ts` (new)
  - `tests/storage/upgrade.test.ts` (new)
  - `tests/logic/backup.test.ts`
  - `tests/storage/repo-backup.test.ts`
  - update `tests/storage/repo-editing.test.ts` and `tests/storage/seed.test.ts` where they assert the rotation

**Interfaces:**
- Consumes: `scheduleFromRotation`, `todayPlan`, `TodayPlan` (Task 1)
- Produces:
  - `type Schedule = SyncMeta & { days: (string | null)[] }`
  - `db.schedule: Table<Schedule, string>`
  - `SEED_SCHEDULE: (string | null)[]` in `seed.ts`
  - In repo:
    - `loadSchedule(db): Promise<(string | null)[]>`: 7 entries, all `null` if there's no row
    - `setScheduleDay(db, weekday: number, workoutId: string | null): Promise<void>`
    - `loadTodayState(db, today: string): Promise<TodayState>`, where `TodayState = { plan: TodayPlan; workouts: Workout[]; inProgress?: Session; lastDateByWorkout: Record<string, string> }`. `workouts` lists live workouts in first-scheduled order, then the unscheduled ones by name.
    - `loadWorkoutList(db): Promise<{ workouts: Workout[]; days: (string | null)[] }>`, in the same order
  - Backup: `Backup` becomes `{ version: 2; exportedAt; exercises; workouts; schedule: Schedule[]; sessions }`, with `BACKUP_VERSION = 2`.
  - Removed: `setRotation`, `rotationIds`, `nextUp`.

- [ ] **Step 1: Write the failing tests**
  - **`tests/storage/upgrade.test.ts`** opens a database at version 1 with a hand-built v1 Dexie class: the same stores as today, without `schedule`. It writes rows, closes it, then opens it with `createDb(sameName)`. It checks three cases:
    - **Seed rotation, clean:** the seed rotation (epoch, `dirty: 0`) plus a finished session gives `schedule` = `{ id: "schedule", days: SEED_SCHEDULE, dirty: 0, updatedAt: EPOCH }`. The session is untouched.
    - **Edited rotation:** a rotation `["seed-workout-lower-a", "seed-workout-upper-a"]` with `dirty: 1` gives `days[0] === "seed-workout-lower-a"`, `days[1] === "seed-workout-upper-a"`, and `dirty: 1`.
    - **No rotation row:** all days are `null`.
  - **`tests/storage/schedule.test.ts`:**
    - A fresh seed has `loadSchedule` equal to `SEED_SCHEDULE`, with a clean row.
    - `setScheduleDay(db, 2, "seed-workout-upper-a")` saves Wednesday as Upper A with `dirty: 1`.
    - Deleting Upper A sets Monday to `null`.
    - `createWorkout` leaves the schedule unchanged.
    - `loadTodayState(db, "2026-11-16").plan.today?.workoutId` is Upper A.
    - `loadWorkoutList` orders Upper A, Lower A, Upper B, Lower B, then a new unscheduled workout.
  - **Backup:**
    - A v2 round trip keeps `schedule`.
    - A v1 file with `rotation: [{ id: "rotation", workoutIds: [...seed ids] }]` parses to a v2 backup whose `schedule[0].days` equals `SEED_SCHEDULE`.
    - A v2 schedule row with 6 days, or a number in `days`, is refused as damaged.
    - Version 3 gives the "newer version" error.
  - Update the existing rotation assertions in `repo-editing` and `seed` tests to the schedule.
- [ ] **Step 2: Run** these files. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - **Dexie version 2:** `this.version(2).stores({ schedule: "id, dirty" }).upgrade(tx => …)`.
    - It reads `tx.table("rotation")` and the live workout ids.
    - If the rotation row is absent: all `null`, written clean with the epoch stamp.
    - If the rotation row has `dirty === 0` and `updatedAt === EPOCH`: the result is written with `dirty: 0` and the epoch stamp.
    - Otherwise: `updatedAt: nowIso()` and `dirty: 1`.
    - The upgrade writes `tx.table("schedule")` directly: `save()` can't run inside an upgrade transaction, and the stamps above are what `save()` would set. Leave a code comment saying so.
    - The `rotation` table stays in the schema, unused.
  - **Seed** writes the seed schedule the same way the seed rotation was written, and no longer writes a rotation.
  - **Repo:**
    - `deleteWorkout` sets every day equal to the id to `null`.
    - `createWorkout` doesn't touch the schedule.
  - **Backup:**
    - `parseBackup` accepts version 1 and converts its rotation with `scheduleFromRotation(rotation[0]?.workoutIds ?? [], workout ids)`, keeping that row's `updatedAt`.
    - `import` tombstones and saves `schedule` instead of `rotation`.
  - **Demo:** builds history from the schedule. Each workout's sessions fall on dates whose weekday it's scheduled on.
- [ ] **Step 4: Run** `npm test && npm run build`. Expected: PASS. Today and Workouts screen tests may fail until Tasks 3 and 4. If they do, those failures must come only from those two screens; note them and continue.
- [ ] **Step 5: Commit** "feat: weekly schedule replaces the rotation in storage and backups".

### Task 3: Today follows the week

**Files:**
- Modify: `src/screens/Today.tsx`, `src/screens/screens.css`
- Test: rewrite `tests/screens/Today.test.tsx`, and update `tests/screens/OneOff.test.tsx` so its date is a Monday

**Interfaces:**
- Consumes: `loadTodayState(db, today)`, `TodayPlan`, `WEEKDAYS`, `weekdayOf` (Tasks 1 and 2)
- Produces: none

**Behavior:** follow the spec's Today section, in its order:
1. While a workout is in progress, show only Resume / Discard.
2. Otherwise show the day notice:
   - **To do:** the large notice with the title line "Today · Monday" and the primary "Start workout".
   - **Done today:** "Done today" with no button, then "Next: …".
   - **Done this week:** "Done this week (Monday)" with no button, then "Next: …".
   - **Rest day:** "Rest day" with "Next: …".
   - **Nothing scheduled:** "No workouts scheduled. Set your week on the Workouts tab."
3. The missed-day reminder, "Missed Monday: Upper A", with a "Do Upper A instead" button. It's the primary only when there's no to-do workout today; otherwise it's a board secondary.
4. Other workouts: every workout except today's to-do workout and the reminder's workout.

"Next" says "tomorrow" when `next.date` is `addDays(today, 1)`. Today keeps `today` in state from `todayLocal()`, and updates it on `visibilitychange` to visible and on `focus`.

- [ ] **Step 1: Write the failing tests.** Fake only Date with `vi.useFakeTimers({ toFake: ["Date"] })` at 15:00 local on the given day.
  - **Monday 2026-11-16, fresh seed:**
    - The heading "Today · Monday" and "Upper A" show.
    - "Start workout" starts Upper A.
    - "Other workouts" lists Lower A, Upper B and Lower B, not Upper A.
  - **Wednesday, with UA and LA done this week:**
    - "Rest day" and "Next: Upper B, tomorrow" show.
    - There's no "Start workout" button.
    - Other workouts lists all four.
  - **Friday with nothing done:**
    - The day notice shows Lower B.
    - The reminder reads "Missed Monday: Upper A".
    - Clicking "Do Upper A instead" starts Upper A.
    - Only one button has the primary class.
  - **Monday with UA finished today:** "Done today" shows, "Next: Lower A, tomorrow" shows, and Upper A is in Other workouts.
  - **A workout in progress dated yesterday:** only Resume and Discard show, with no "Today ·" heading, no reminder and no Other workouts.
  - **Midnight rollover:**
    - Render on Monday 23:59. Set the system time to Tuesday 00:05.
    - Dispatch `document.dispatchEvent(new Event("visibilitychange"))` with `document.visibilityState` stubbed to `"visible"`.
    - Expect "Today · Tuesday" and Lower A.
  - **Nothing scheduled** (all days set to Rest through `setScheduleDay`): the copy shows.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test`. Expected: PASS, except Workouts tests, which are fixed in Task 4.
- [ ] **Step 5: Commit** "feat(screens): Today follows the weekly schedule".

### Task 4: This week on the Workouts tab

**Files:**
- Modify: `src/screens/Workouts.tsx`, `src/screens/screens.css`
- Test: `tests/screens/Workouts.test.tsx`. Replace the rotation-order and Move up tests; keep every editor test.

**Interfaces:**
- Consumes: `loadWorkoutList`, `setScheduleDay`, `WEEKDAYS` (Tasks 1 and 2)

**Behavior:**
- **The "This week" notice:** seven rows, each a button named like "Monday: Upper A" and showing the day and the workout title or "Rest". Tapping one opens a `Sheet` titled "Monday" listing every workout title plus "Rest". Picking one calls `setScheduleDay` and closes the sheet.
- **The workout list:** in `loadWorkoutList` order. Each row's detail line is "Monday · 6 exercises", or "Monday, Thursday · 6 exercises", or "Not scheduled · 5 exercises".
- The Move up / Move down buttons are removed. "New workout" stays.

- [ ] **Step 1: Write the failing tests:**
  - The week rows read Monday Upper A, Tuesday Lower A, Wednesday Rest, …, Sunday Rest.
  - Setting Wednesday to Upper B saves it, and the row reads "Wednesday: Upper B".
  - Setting Monday to Rest saves `null`.
  - The workout list order and detail lines match.
  - A new workout shows "Not scheduled".
  - Deleting Upper A in the editor makes Monday read "Rest".
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test && npm run build`. Expected: PASS, the whole suite.
- [ ] **Step 5: Commit** "feat(screens): set the week on the Workouts tab".

### Task 5: History calendar on Progress

**Files:**
- Create: `src/screens/HistoryCalendar.tsx`
- Modify: `src/screens/Progress.tsx`, `src/App.tsx`, `src/storage/repo.ts`, `src/screens/screens.css`
- Test: `tests/screens/Calendar.test.tsx` (new)

**Interfaces:**
- Consumes: `monthGrid` (Task 1), the existing `pastSession` overlay and `LogWorkout mode="edit"`
- Produces:
  - `loadMonthSessions(db, year, month): Promise<Record<string, { id: string; title: string; doneSets: number }[]>>`. It covers finished, non-deleted sessions keyed by date, one-offs included.
  - App's `View` gains `calendar?: { year: number; month: number; day?: string }` on the progress tab. It's passed to `Progress` and kept when a past session opened from the calendar closes.

**Behavior** follows the spec's History calendar section:
- **The header:**
  - The month and year, e.g. "November 2026".
  - Buttons "Previous month" and "Next month". Next month is disabled on the current month.
- **The grid:**
  - Weekday initials, Monday first.
  - Day cells are buttons with names like "Monday, November 16, Upper A" or "Wednesday, November 18, no workout".
  - A red-ink mark sits under the number on a day with a workout. Today's cell gets an outline.
- **Selecting a day** lists its sessions as buttons, e.g. "Upper A · 15 sets", or shows "No workout on Monday, Nov 16."
- **Opening a session** uses the `pastSession` overlay with back label "Progress". Closing returns to Progress with the same `calendar` state.

- [ ] **Step 1: Write the failing tests.** Fake the date as 2026-11-20 and finish sessions through repo functions.
  - The day 16 cell is named "Monday, November 16, Upper A" and has the mark class.
  - Day 18 is named "… no workout".
  - Clicking 16 lists "Upper A · 1 set"; clicking it opens the edit screen, with a "Date" field set to 2026-11-16. Clicking Done returns to Progress with "November 2026" and the day-16 list still shown.
  - Clicking day 18 shows "No workout on Wednesday, Nov 18."
  - "Next month" is disabled. "Previous month" shows "October 2026".
  - A one-off session is marked too.
  - With no history at all, the calendar still shows "November 2026", and the existing "No sessions yet. Finish a workout…" empty state shows below it.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test && npm run build`. Expected: PASS.
- [ ] **Step 5: Browser check** at 393 × 852 in light and dark, using `?demo` history in dev:
  - Today on a training day, on a rest day, and with a missed workout (use a scratch database or change the system date where possible; otherwise rely on the tests).
  - The Workouts week editor and its sheet.
  - The Progress calendar: select a day and open a session.
- [ ] **Step 6: Commit** "feat(screens): history calendar on Progress".

### Task 6: Documents

**Files:**
- Modify: `docs/superpowers/specs/2026-11-18-workout-tracker-design.md`, `CLAUDE.md`, `DESIGN-RULES.md`

- [ ] **Step 1: Make the edits.**
  - **Main spec:** replace the "Next up" paragraph, and the rotation wording in Edit Workouts and Seed data, with a pointer to the weekly schedule design.
  - **`CLAUDE.md`:** replace the "Next up" rule with: "Today follows the weekly schedule: today's scheduled workout, plus a reminder for one missed earlier this week; see `docs/superpowers/specs/2026-11-22-weekly-schedule-design.md`."
  - **`DESIGN-RULES.md`:**
    - **Screens — Today:** weekday title, rest day, reminder.
    - **Screens — Workouts:** This week notice, no Up/Down.
    - **Screens — Progress:** calendar notice above the list.
    - **A Calendar component entry:** Monday-first grid, a red-ink mark for a day with a workout, an outline for today, 44px cells.
  - **Ledger:** a note that the slice 5 plan must sync `kind: "schedule"` instead of `"rotation"`.
- [ ] **Step 2: Run** `npm test && npm run build`. Expected: PASS.
- [ ] **Step 3: Commit** "docs: the weekly schedule replaces the rotation".
