# Simpler Today: design

A small change, chosen by the owner on 2026-11-22. It replaces the Today section of
`2026-11-22-weekly-schedule-design.md` where they differ.

## Intent

Today should show one thing: today's workout (or a rest day) and what's up next. The missed-day
reminder read as noise (on a Sunday rest day it said "Missed Monday: Upper A" when the owner hadn't
logged that Monday in the app), and the Other workouts list crowded the screen.

## Approaches considered

- **A. Only "Start empty workout."** Cleanest, but a missed session could only be redone as a blank
  one-off that never counts toward the week.
- **B. Start buttons on the Workouts tab.** Keeps Today clean but mixes starting with editing.
- **C. One "Start a different workout" button under today's card, opening a list (chosen by the owner).**
  Today stays a single card; any workout is still two taps away.

## Behavior

- **Workout in progress:** unchanged — only Resume / Discard.
- **Otherwise, one card:**
  - Training day, not done: "Today · Monday · 6 exercises · last 11/12", the title and subtitle,
    the primary "Start workout", then "Next: Lower A, tomorrow" (the Next line is new on this state).
  - Done today / done this week, rest day, nothing scheduled: unchanged.
- **Below the card:** a text button on the board, "Start a different workout". It opens a sheet titled
  "Start a workout" listing every workout (title, then subtitle) and, last, "Empty workout" (a one-off).
  Picking one starts it and opens Log Workout, as tapping a workout did before.
- **Removed from Today:** the missed-day reminder, the "Other workouts" list, and the separate
  "Start empty workout" button (it's now the sheet's last option).
- The sign-in nudge stays.

## Calls (mine)

- The missed-workout rule stays in `src/logic/schedule.ts` (tested, harmless); only the screen stops
  showing it.
- The sheet lists all workouts, today's included, in week order then by name.
- Doing a scheduled workout on another day still counts toward the week, as before.

## Docs to update

The weekly schedule design's Today section, DESIGN-RULES (Today screen), and CLAUDE.md's Today rule
(drop "plus a reminder for one missed earlier this week").
