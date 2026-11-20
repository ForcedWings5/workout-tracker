# Delete Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a corner button on Log Workout that turns on a delete mode. In delete mode, tapping a set or an exercise asks for confirmation and then removes it from today's session only.

**Architecture:** Two new repo writes go through the existing `mutateSession` transaction, along with one new formatting rule in `src/logic/format.ts`. Delete mode is screen state in `LogWorkout` and is never stored. `ExerciseNotice` and `SetRow` take a `deleting` flag: when it's on, they show ⊖ buttons in place of the inputs and the ✓ box.

**Tech Stack:** React 18 + TypeScript strict, Dexie, Vitest + Testing Library + fake-indexeddb, and lucide-react.

**Spec:** `docs/superpowers/specs/2026-11-19-delete-mode-design.md`, which extends `docs/superpowers/specs/2026-11-18-workout-tracker-design.md`.

## Global Constraints

- Only today's in-progress session changes. Workouts, past sessions, and exercises are never touched.
- Screens call `src/storage/repo.ts` and never touch Dexie directly. Writes go through `mutateSession`, which saves through `save`.
- Every delete names the `exerciseId` it expects. If the entry at that index has a different exerciseId, the delete throws `"Exercise not found in session"` and nothing is written.
- Copy is exactly as the spec gives it:
  - Hint: "Tap a set or exercise to delete it."
  - Set sheet: title `Delete set {n}?`, body `{exercise name} · {describeSet}.`, buttons **Keep set** / **Delete set**.
  - Exercise sheet: title `Remove {name} from today?`, body "Its sets from today go too.", buttons **Keep** / **Remove exercise**.
- Styling follows DESIGN-RULES:
  - The destructive sheet button is `plain` (ink), and the keep button is `outline`.
  - The corner button is on the board.
  - Every tap target is at least 44px.
  - Icons are Lucide `Trash2` and `CircleMinus`.
- In delete mode, these are inert: ✓ boxes, number inputs, set-number skip, notes, "+ Set", "Add exercise", and "Fulfill contract". They are either disabled or replaced.
- Delete mode starts off every time the screen mounts.
- Run `npm test` and `npm run build` before calling work done.

## Review Focus

1. **A stale index after an earlier delete:** a sheet must not delete the wrong exercise. The exerciseId guard refuses a mismatch (Task 1 test).
2. **The same exercise twice in one session:** removing the second copy leaves the first (Task 1 test).
3. **A stray tap in delete mode:** no ✓ box, weight, or reps field is reachable, and Fulfill is disabled (Task 2 test).
4. **Dismissing the sheet** with Keep, the scrim, or Escape deletes nothing (Task 2 test, using Keep).
5. **Removing the last exercise** shows the "No exercises yet" empty state, and delete mode stays usable (Task 2 test).

---

### Task 1: Session delete writes and set description

**Files:**
- Modify: `src/logic/format.ts`, to add `describeSet`
- Modify: `src/storage/repo.ts`, to add `deleteSessionSet` and `removeSessionEntry` next to `skipOrRemoveSet`
- Test: `tests/logic/format.test.ts` (add to it), `tests/storage/repo-delete.test.ts` (new)

**Interfaces:**
- Consumes: `mutateSession` and `entryAt` (private in repo.ts), `unitFor`
- Produces:
  - `describeSet(set: LoggedSet, measure: Measure): string`
  - `deleteSessionSet(db: WorkoutDB, sessionId: string, entryIndex: number, setIndex: number, exerciseId: string): Promise<void>`
  - `removeSessionEntry(db: WorkoutDB, sessionId: string, entryIndex: number, exerciseId: string): Promise<void>`

- [ ] **Step 1: Write the failing tests**

`tests/logic/format.test.ts`:
```ts
test("describeSet reads like the row", () => {
  expect(describeSet({ weight: 135, amount: 8, done: true, skipped: false }, "reps")).toBe("135 lb × 8 reps");
  expect(describeSet({ amount: 8, done: false, skipped: false }, "reps")).toBe("Bodyweight × 8 reps");
  expect(describeSet({ weight: 20, amount: 45, done: false, skipped: false }, "seconds")).toBe("20 lb × 45 sec");
  expect(describeSet({ weight: 135, done: false, skipped: false }, "reps")).toBe("135 lb");
  expect(describeSet({ done: false, skipped: false }, "reps")).toBe("Bodyweight");
});
```
Match `LoggedSet`'s real required fields if they differ from `done`/`skipped`.

`tests/storage/repo-delete.test.ts`. Use `seededDb` and `startWorkout(db, "seed-workout-upper-a")`. Bench is entry 0 and has 4 sets.
- `"deleting a set removes only that set from today"`:
  1. Mark set 1 done with 135×8.
  2. Call `deleteSessionSet(db, id, 0, 0, BENCH)`.
  3. Expect 3 sets, and the first is no longer the 135×8 set.
  4. Expect `db.workouts.get(UPPER_A)` exercises[0].sets to still be 4.
- `"a done set can be deleted"`: covered by the previous test, which deletes a done set. Assert `updatedAt` changed and `dirty` is 1.
- `"removing an exercise takes its sets with it, and the workout keeps it"`:
  1. Call `removeSessionEntry(db, id, 0, BENCH)`.
  2. Expect the session's entries to no longer start with BENCH.
  3. Expect the workout's plan to still start with BENCH.
- `"a mismatched exerciseId changes nothing"`:
  1. Expect `removeSessionEntry(db, id, 0, "not-bench")` and `deleteSessionSet(db, id, 0, 0, "not-bench")` to reject with `"Exercise not found in session"`.
  2. Expect the session to be unchanged (deep equal to before).
- `"with the same exercise twice, removing the second keeps the first"`:
  1. Call `addExerciseToSession(db, id, BENCH)`, then `removeSessionEntry(db, id, lastIndex, BENCH)`.
  2. Expect entries[0] to still be BENCH with 4 sets, and the entry count back to the original.
- `"a missing set is refused"`: expect `deleteSessionSet(db, id, 0, 99, BENCH)` to reject with `"Set not found"`.
- `"a finished session can't be changed"`:
  1. Finish the session after marking one set done.
  2. Expect `removeSessionEntry` to reject with `"This workout is already finished"`.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/logic/format.test.ts tests/storage/repo-delete.test.ts`
Expected: FAIL, because `describeSet`, `deleteSessionSet` and `removeSessionEntry` are not exported.

- [ ] **Step 3: Implement**

- `describeSet`: the weight part is `"{w} lb"` or `"Bodyweight"`. Append `" × {amount} {unitFor(measure)}"` only when there is an amount.
- Both repo writes: call `entryAt`, then check `entry.exerciseId === exerciseId`, otherwise throw `"Exercise not found in session"`. Then `splice` inside `mutateSession`. `deleteSessionSet` throws `"Set not found"` when the set doesn't exist.

- [ ] **Step 4: Run to verify they pass, then the suite**

Run: `npx vitest run tests/logic/format.test.ts tests/storage/repo-delete.test.ts && npm test`
Expected: PASS, with every test green.

- [ ] **Step 5: Commit**

```bash
git add src/logic/format.ts src/storage/repo.ts tests/logic/format.test.ts tests/storage/repo-delete.test.ts
git commit -m "feat(storage): delete a set or exercise from today's session"
```

### Task 2: Delete mode on Log Workout

**Files:**
- Modify: `src/screens/LogWorkout.tsx`, `src/screens/ExerciseNotice.tsx`, `src/screens/SetRow.tsx`, `src/screens/screens.css`
- Test: `tests/screens/DeleteMode.test.tsx` (new). Reuse the `renderLog` pattern from `tests/screens/LogWorkout.test.tsx`.

**Interfaces:**
- Consumes: `describeSet`, `deleteSessionSet`, `removeSessionEntry` (Task 1), and `Sheet`, `Button`, `Notice`, `ScreenHeader` (`right` slot).
- Produces:
  - `ExerciseNotice` gets the props `deleting?: boolean`, `onDeleteSet: (setIndex: number) => void` and `onRemove: () => void`.
  - `SetRow` gets the props `deleting?: boolean` and `onDelete: () => void`.

- [ ] **Step 1: Write the failing tests**

Each test starts Upper A, renders it, and turns on delete mode by clicking the button named `"Delete sets or exercises"`.
- `"the corner button turns delete mode on and Done turns it off"`:
  1. After the click, expect `getByText("Tap a set or exercise to delete it.")` and a button named `"Done"`.
  2. Click Done, then expect the hint to be gone and the `"Delete sets or exercises"` button to be back.
- `"in delete mode nothing else responds"`:
  1. Expect `queryByLabelText("Set 1 weight")` to be null.
  2. Expect no button matching `/^Set 1: /` (the mark box).
  3. Expect `getByRole("button", { name: "Fulfill contract" })` to be disabled.
  4. Expect `getByRole("button", { name: "Add exercise" })` to be disabled.
  5. Expect the bench `"Add a set to Barbell Bench Press"` button to be disabled.
- `"deleting a set asks first, then removes it"`:
  1. Mark bench set 2 as 135×8 through `updateSet` before rendering.
  2. Click `"Delete set 2 of Barbell Bench Press"`.
  3. Expect the dialog `"Delete set 2?"` with the text `"Barbell Bench Press · 135 lb × 8 reps."`.
  4. Click **Delete set**, then `waitFor` the session's bench sets to have length 3.
  5. Expect the `"Done"` button to still be there (the mode stays on).
- `"Keep set deletes nothing"`:
  1. Open the same sheet and click **Keep set**.
  2. Expect the dialog to be gone and the bench sets to still number 4.
- `"removing an exercise asks first, then takes it off today only"`:
  1. Click `"Remove Barbell Bench Press from today"`.
  2. Expect the dialog `"Remove Barbell Bench Press from today?"`, then click **Remove exercise**.
  3. `waitFor` the region `"Barbell Bench Press"` to be gone.
  4. Expect the workout plan in the DB to still include BENCH.
- `"removing the last exercise shows the empty state"`:
  1. Start an empty workout and add one exercise through `addExerciseToSession`.
  2. Render, enter delete mode, and remove it.
  3. Expect `findByText(/No exercises yet/)`.
- `"delete mode starts off when the screen opens again"`:
  1. Enter delete mode, `unmount()`, and render again.
  2. Expect the `"Delete sets or exercises"` button and no hint.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/screens/DeleteMode.test.tsx`
Expected: FAIL, because no button named "Delete sets or exercises" exists.

- [ ] **Step 3: Implement**

**LogWorkout:**
- Add `deleting` state (false) and `pending` state:
  `{ kind: "set"; entry: number; set: number; exerciseId: string } | { kind: "entry"; entry: number; exerciseId: string } | undefined`.
- In the header's `right` slot, render the timer, then:
  - when off, a `btn--text-board` icon button with aria-label `"Delete sets or exercises"` and `Trash2`;
  - when on, a `btn--text-board` button labelled "Done".
  Lay them out in a flex row with an 8px gap.
- When `deleting` is on:
  - Show a `Notice` with `<p className="empty-text" role="status">Tap a set or exercise to delete it.</p>` right after the header.
  - Disable "Add exercise" and "Fulfill contract".
- The two confirmation `Sheet`s use the copy from Global Constraints.
- The confirm button runs `run(deleteSessionSet(...))` or `run(removeSessionEntry(...))`, then clears `pending`. The sheet's `onClose` clears `pending` too.

**ExerciseNotice:**
- When `deleting` is on:
  - The head gets a ⊖ button (`CircleMinus`, 44×44, `btn--plain`, aria-label `Remove {name} from today`).
  - "+ Set" is disabled.
  - The note textarea is `disabled`.
- Pass `deleting` and `onDelete` down to each `SetRow`.

**SetRow:**
- When `deleting` is on:
  - The number is a plain span, not the skip button.
  - Weight and amount are plain text: `"{w} lb"` or `"–"`, then `"{a} {unit}"` or `"–"`. They use the row's existing classes, so the columns line up.
  - In place of the `MarkBox`, show a 44×44 `btn--plain` ⊖ button with aria-label `Delete set {n} of {exerciseName}`. Add an `exerciseName: string` prop to SetRow for this.

**screens.css:** add only what the layout needs: the header's right-side group, the ⊖ button sized to the mark box, and the read-only values aligned with the inputs.

- [ ] **Step 4: Run to verify they pass, then the suite and the build**

Run: `npx vitest run tests/screens/DeleteMode.test.tsx && npm test && npm run build`
Expected: PASS, every test green, and the build is clean.

- [ ] **Step 5: Check it in the browser at 393×852, light and dark**

Check these:
- The corner button sits beside the timer and is 44px or larger.
- The ⊖ buttons line up with where the ✓ boxes were.
- The sheets read as specified.
- nothing new is red, and a done set still reads as done (ink, 600 weight) even though its ✓ is replaced by ⊖.

- [ ] **Step 6: Commit**

```bash
git add src/screens/LogWorkout.tsx src/screens/ExerciseNotice.tsx src/screens/SetRow.tsx src/screens/screens.css tests/screens/DeleteMode.test.tsx
git commit -m "feat(screens): delete mode on Log Workout"
```
