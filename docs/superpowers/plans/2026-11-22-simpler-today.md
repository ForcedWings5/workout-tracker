# Simpler Today Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Today shows one card, either today's workout or a rest day, with what's next, plus a single "Start a different workout" button that opens a list of workouts.

**Architecture:** This changes the screen only, in `src/screens/Today.tsx`. `loadTodayState` and `todayPlan` stay as they are; the screen just stops rendering `plan.missed` and the Other workouts list. The new sheet reuses `Sheet` and the picker option styles.

**Tech Stack:** React 18 + TypeScript strict, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-22-simpler-today-design.md`. It replaces the Today section of `2026-11-22-weekly-schedule-design.md` wherever the two differ.

## Global Constraints

**Copy is exactly:**
- the button "Start a different workout"
- the sheet title "Start a workout"
- the sheet's last option "Empty workout"
- "Next: Lower A, tomorrow" (or a weekday name instead of "tomorrow")

**Behavior and style:**
- While a workout is in progress, Today shows only Resume / Discard.
- DESIGN-RULES: one primary (red) button per screen, 44px tap targets, and a sheet for picking.
- Run `npm test` and `npm run build` before calling work done.

## Review Focus

1. **A workout in progress:** the "Start a different workout" button is hidden, because starting a second workout isn't allowed (Task 1 test).
2. **Nothing scheduled, or a rest day:** the button still shows, so a workout can always be started (Task 1 test).
3. **Double taps:** tapping an option while a start is under way does nothing more. It reuses Today's existing `starting` guard (Task 1 test: the options are disabled while starting).
4. **Order of the list:** week order first, then unscheduled workouts by name, then "Empty workout" (Task 1 test).
5. **Old missed-day data:** a week with missed workouts shows no reminder anywhere on Today (Task 1 test).

---

### Task 1: One card and a "Start a different workout" sheet

**Files:**
- Modify: `src/screens/Today.tsx`, `src/screens/screens.css`
- Modify docs:
  - `docs/superpowers/specs/2026-11-22-weekly-schedule-design.md` (Today section: point to the new design)
  - `DESIGN-RULES.md` (Screens: Today)
  - `CLAUDE.md` (drop "plus a reminder for one missed earlier this week")
- Test: `tests/screens/Today.test.tsx` (rewrite the missed and Other workouts tests), and `tests/screens/OneOff.test.tsx` (start the empty workout through the sheet)

**Interfaces:**
- Consumes: `loadTodayState(db, today)`, which gives `{ plan, workouts, inProgress, lastDateByWorkout }`. `workouts` is already in week order, then by name. It also uses `startWorkout`, `startEmptyWorkout` and `Sheet`.

- [ ] **Step 1: Write the failing tests** in `tests/screens/Today.test.tsx`, faking the date with the existing `at()` helper:
  - **Monday 2026-11-16:**
    - The card is named "Today: Upper A" and contains "Start workout" and "Next: Lower A, tomorrow".
    - There is no "Other workouts" heading.
    - There is no text matching `/^Missed /`.
    - There is one button named "Start a different workout".
  - **Sunday 2026-11-22 with nothing logged:**
    - The "Rest day" card shows "Next: Upper A, tomorrow".
    - There is no text matching `/^Missed /`.
    - The "Start a different workout" button is present.
  - **The sheet's contents:**
    - Clicking "Start a different workout" opens the dialog "Start a workout".
    - Its button names, in order, are Upper A, Lower A, Upper B, Lower B, Empty workout.
    - Clicking "Lower A" opens Log Workout ("Barbell Squats" shows), and `inProgress.workoutId` is Lower A.
  - **Empty workout:** clicking "Empty workout" in the sheet opens a one-off workout (heading "Workout").
  - **In progress:** with a workout in progress, Resume and Discard show, and "Start a different workout" doesn't.
  - **Nothing scheduled:** the "No workouts scheduled…" copy shows, and "Start a different workout" is present.
  - **Kept as they are:** Start workout, rest day after workouts, done today (now finding Upper A through the sheet, not Other workouts), done this week, Discard, midnight, and the backup nudge tests.
  - **`OneOff.test.tsx`:** "start empty workout…" now goes through "Start a different workout" → "Empty workout".
- [ ] **Step 2: Run** `npx vitest run tests/screens/Today.test.tsx tests/screens/OneOff.test.tsx`. Expected: FAIL, because there's no "Start a different workout" button yet.
- [ ] **Step 3: Implement:**
  - Remove the missed notice, the Other workouts section and the "Start empty workout" board button.
  - Add "Next: …" to the to-do card, under the Start button.
  - Add a `btn--text-board` "Start a different workout" button below the card, shown whenever no workout is in progress. It opens a `Sheet` titled "Start a workout" with one `picker__option` per workout (title, plus the subtitle in `picker__unit` style), then "Empty workout".
  - Options are disabled while `starting`.
- [ ] **Step 4: Update the three docs** as listed under Files.
- [ ] **Step 5: Run** `npm test && npm run build`. Expected: PASS.
- [ ] **Step 6: Check in the browser** at 393 × 852 in light and dark: a training day, a rest day, and the open sheet.
- [ ] **Step 7: Commit** "feat(screens): one card on Today, other workouts in a sheet".
