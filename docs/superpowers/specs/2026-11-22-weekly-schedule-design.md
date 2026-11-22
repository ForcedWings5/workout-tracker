# Weekly schedule and history calendar: design

Status: approach chosen by the owner on 2026-11-22 (approach A below). This design extends and partly replaces `2026-11-18-workout-tracker-design.md`; where they disagree, this one wins for the topics it covers.

## Intent

The owner trains on a fixed week, not a free-running rotation:

| Mon | Tue | Wed | Thu | Fri | Sat | Sun |
|---|---|---|---|---|---|---|
| Upper A | Lower A | Rest | Upper B | Lower B | Rest | Rest |

They want the app to know what day it is: "Upper A was yesterday, so today is Lower A", rest days shown as rest days, and a calendar where they can tap a day and see the workout they did then.

Today the app has no idea of days. "Next up" is the workout after the last finished one, whenever the app is opened, and rest days aren't tracked (main spec, Next up).

## Goals

1. **A weekly schedule.** Each weekday (Monday to Sunday) is set to one workout or Rest. It is edited on the Workouts tab.
2. **Today follows the calendar.** Today shows the workout scheduled for today's local date. On a rest day it says so and names the next scheduled workout and its day.
3. **Missed-day reminder.** If a workout scheduled earlier this week hasn't been done this week, Today shows a reminder with a button to do it instead.
4. **History calendar.** A month view at the top of the Progress tab marks every day with a finished workout. Tapping a day lists that day's workouts; tapping one opens it in the existing past-session editor.
5. **Upgrade keeps the owner's week.** Existing installs (and old backups) come across with a sensible schedule and no lost data.

## Non-goals and anti-goals

- No Apple Calendar or other external calendar integration, no notifications or reminders outside the app.
- No multi-week programs, deloads, or alternating weeks. One repeating week.
- The app never moves workouts around on its own. A missed workout is not pushed to the next day; the week stays as planned.
- Anti-goal: Today must never hide a way to train. On a rest day, or when today's workout is done, every workout is still one tap away (the existing "Other workouts" list stays).
- Anti-goal: history is never rewritten. Changing the schedule never changes past sessions.

## Decisions made with the owner

- **Missed days follow the calendar.** If Monday is skipped, Tuesday is still Lower A. Upper A shows as a reminder ("Missed Monday: Upper A") with a button to do it now.
- **Approach A:** the week replaces the rotation (see Approaches).

## Approaches considered

- **A. The week replaces the rotation (chosen).** The Workouts tab gains a seven-day "This week" editor; "next up" becomes "today's workout" with the missed-day reminder; the rotation and its Up/Down ordering go away. Costs the most code change (next-up logic rewritten, a new record, a database upgrade, a new backup version) but is the only option that matches a fixed calendar.
- **B. Keep the rotation and tick training days.** Workouts land on ticked days in rotation order. Smaller, but a rotation always catches up, so a missed Monday would shift the week, which the owner rejected.
- **C. Rotation and a weekly map side by side.** Two settings that can disagree; more to explain and to break, for no gain.

## Behavior

All dates are the phone's local dates (`YYYY-MM-DD`), as everywhere else. The week starts on **Monday** (owner's week; my call).

### Today

Definitions, for a given local date `today`:
- `weekStart` = the Monday on or before `today`.
- `scheduled(day)` = the workout set for that weekday, or Rest. A scheduled workout that has since been deleted counts as Rest.
- A workout is **done this week** if a finished, non-deleted session of that workout (`workoutId` matches) is dated from `weekStart` to `today` inclusive. Sessions dated in the future are ignored.
- **Missed workouts** = workouts scheduled on days from `weekStart` up to yesterday that are not done this week, in day order, each listed once (if a workout is scheduled twice this week, it is missed once per scheduled day it isn't covered for: see "Repeated workouts" below).

What Today shows, in order:
1. **A workout in progress:** the existing Resume / Discard notice, exactly as today, and nothing else: no day notice, no reminder, no Other workouts (starting a second workout isn't allowed, so those buttons could only fail). Items 2–4 below apply only when no workout is in progress. (My call, from the builder check.)
2. **The main notice:**
   - **Training day, not done yet:** the existing large "next up" notice for today's workout, with the title line "Today · Monday" above the name in place of "Next up". "Start workout" as now.
   - **Training day, already done today** (a finished session of today's workout dated today): the notice says the workout is done, e.g. "Upper A · Done today", with no primary button, and below it "Next: Lower A, Tuesday".
   - **Rest day:** a notice "Rest day" with "Next: Upper B, Thursday" (the next scheduled workout after today, wrapping into next week; "tomorrow" when it is tomorrow). No primary button.
   - **No workouts scheduled at all:** "No workouts scheduled. Set your week on the Workouts tab." The Other workouts list still shows.
3. **Missed-day reminder:** when there is at least one missed workout and no workout is in progress, a notice "Missed Monday: Upper A" with a secondary button "Do Upper A instead". If several are missed, show the earliest; the rest appear one by one as each is done or the week rolls over. On a rest day the reminder is the main thing to do, so its button may be the primary (red) one; on a training day it is secondary (the primary stays on today's workout). DESIGN-RULES: one primary per screen.
4. **Other workouts:** every workout that doesn't already have its own start button above, as now, tappable to start. Only today's not-yet-done workout (2) and the reminder's workout (3) are left out. A workout that's done today, done this week, or only named in a "Next:" line stays in this list, so it can always be started or redone. (My call, from the builder check: this is what keeps the anti-goal "every workout is one tap away".)

"Start empty workout" stays as it is. One-off workouts never count as any scheduled workout.

#### Catch-up and repeated workouts

- A scheduled workout counts as done if it was done **any day this week up to today**, not only on its own day. Doing Upper A on Tuesday clears Monday's reminder. Doing Lower A on Monday means Tuesday's notice shows "Lower A · Done this week (Monday)" instead of a Start button. (Owner's "catch-up counts" — my call, agreed in the playback.)
- Repeated workouts: if the same workout is scheduled on two days in a week (e.g. Upper A on Monday and Thursday), each scheduled day needs its own finished session. Count sessions of that workout this week and match them to scheduled days in order. The owner's week has no repeats; this rule just keeps the logic well defined.
- The week resets each Monday: nothing from last week is ever "missed".

### Editing the week (Workouts tab)

- The Workouts tab starts with a notice titled **This week**: seven rows, Monday to Sunday, each showing the day and its workout's title (or "Rest"). Tapping a row opens a sheet listing every workout plus "Rest"; picking one saves immediately (autosave, no Save button) and closes the sheet.
- Below it, the list of workouts as now, each tappable to edit, plus "New workout". The order is: workouts in the order they first appear in the week (Monday first), then any unscheduled workouts by name. The Move up / Move down buttons are removed (they ordered the rotation, which no longer exists).
- Each workout row's detail line changes from "N of M · K exercises" to its scheduled days and exercise count, e.g. "Monday · 6 exercises", "Not scheduled · 5 exercises".
- **New workout** no longer joins anything automatically; it starts unscheduled.
- **Deleting a workout** sets every day it was scheduled on to Rest.
- The same workout may be scheduled on more than one day.

### History calendar (Progress tab)

- The Progress tab shows, above the exercise list, a calendar notice for one month: a header with the month and year and previous/next month buttons, weekday initials starting Monday, and a grid of day numbers.
- A day with at least one finished, non-deleted session gets a red-ink mark (DESIGN-RULES: red ink means done). One-off workouts are marked too. Today's date is outlined. Days outside the month are blank.
- It opens on the current month. The next-month button is disabled on the current month (nothing is logged in the future).
- Tapping a marked day selects it and lists that day's sessions under the grid, e.g. "Upper A · 15 sets" (done sets). Tapping a session opens it in the existing past-session editor (`LogWorkout mode="edit"`), and closing returns to Progress with the same month and day selected. Tapping an unmarked day selects it and shows "No workout on Monday, Nov 16." (Copy is my call.)
- With no history at all the calendar still shows the current month; the existing Progress empty state stays below it.
- Every day cell is a 44px-minimum tap target and has an accessible name like "Monday, November 16, Upper A" or "Wednesday, November 18, no workout".

## Data

- **New synced record `Schedule`**, single row with fixed id `"schedule"`: `SyncMeta & { days: (string | null)[] }` where `days` has exactly 7 entries, index 0 = Monday … 6 = Sunday, each a workout id or `null` for Rest. Written only through the storage helper (`save`), like every synced record.
- **It replaces `Rotation`.** After the upgrade nothing reads or writes the rotation.
- **Dexie version 2:** adds a `schedule` table (`"id, dirty"`) and drops the `rotation` table, with an upgrade function that creates the schedule from the rotation:
  - If the rotation is exactly the four seed workouts in seed order (the owner's current state), the schedule is the seed schedule: Mon Upper A, Tue Lower A, Thu Upper B, Fri Lower B, others Rest.
  - Otherwise, the rotation's workouts (live ones only, in order) fill Mon, Tue, Thu, Fri, then Wed, Sat, Sun; any beyond seven are left unscheduled; remaining days are Rest.
  - The migrated row is written dirty (it's a real change), unless it equals the seed schedule, in which case it gets the seed treatment below.
- **Seed:** fresh installs get the seed schedule with the fixed id `"schedule"`, epoch `updatedAt`, `dirty: 0` (same rule as other seed records, so a fresh install never overwrites the cloud).
- **Backup format version 2:** `schedule: Schedule[]` replaces `rotation`. `parseBackup` still accepts version 1 and converts its `rotation` with the same rule as the Dexie upgrade. Version 2 files are checked as strictly as version 1 rows (7 entries, each a string or null). Import tombstones or replaces `schedule` like the other tables.
- **Dev demo seed** (`?demo`) builds history from the schedule instead of the rotation: each demo session dated on a day whose weekday is scheduled for that workout.
- **Cloud (slice 5):** the `records` table's `kind` gains `"schedule"`; the sync slice must handle it. Nothing to do now since sync isn't built yet, but the slice 5 plan must be updated (note it in the ledger).

## Logic placement

New rules live in `src/logic/schedule.ts` with unit tests (written first), never in components:
- weekday of a local date (Monday = 0), `weekStart`, adding days to a local date
- `todayPlan(schedule, workouts, sessions, today)` → what Today shows: today's workout or rest, done-today / done-this-week, the next scheduled workout and its date, and the missed list in order
- `scheduleFromRotation(rotationIds, liveWorkoutIds)` → the migration/backup-v1 rule
- `sessionsByDate(sessions, month)` → for the calendar marks

`src/logic/rotation.ts` (`nextUp`) is removed once nothing uses it.

## Updates to other documents

- Main spec: replace the "Next up" paragraph and the Edit Workouts rotation wording with a pointer to this design.
- `CLAUDE.md`: replace the "Next up" rule with "Today follows the weekly schedule: today's scheduled workout, a missed-day reminder for earlier this week; see the weekly schedule design".
- `DESIGN-RULES.md`: Today screen description (weekday title, rest day, reminder), Workouts screen (This week notice, no Up/Down), Progress screen (calendar notice above the list), and a short Calendar component entry (grid, red mark for a training day, outline for today, 44px cells).

## Testing

- Logic (unit, written first): weekday/weekStart across a Sunday→Monday boundary and month/year boundaries; today's workout; rest day with next workout wrapping to next week; "tomorrow"; done today; catch-up clears a reminder; reminder lists earliest missed first; nothing missed on Monday; future-dated and deleted sessions ignored; deleted scheduled workout counts as Rest; repeated workout on two days; migration rule for the seed rotation, a reordered rotation, more than seven workouts, and deleted workouts; backup v1 → v2 conversion.
- Storage: Dexie v1 → v2 upgrade on a v1 database (seed rotation and a custom rotation); setting a day; deleting a scheduled workout sets its days to Rest; export/import round trip with `schedule`.
- Screens: Today on a training day, done day, rest day and with a missed workout (fake the date); the week editor sets a day; the calendar marks days, selects a day and opens a session, disables next month.
- Browser check at 393 × 852, light and dark: Today (training, rest, missed), Workouts week editor, Progress calendar.

## Left to the builder

- Exact visual layout of the calendar grid and the This week rows within DESIGN-RULES.
- Copy not fixed above (keeping DESIGN-RULES' plain-English rule).
- Whether the day picker sheet reuses the exercise picker's layout or a simpler list.
