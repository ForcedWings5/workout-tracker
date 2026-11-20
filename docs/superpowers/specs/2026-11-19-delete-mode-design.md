# Delete mode: design

Approved by the owner on 2026-11-19. This is a short design for a small change. It extends the main spec (`2026-11-18-workout-tracker-design.md`), which describes how adding and removing sets works.

## Intent

During a workout, the owner wants to delete a set or a whole exercise without risking a misclick. Deleting happens in its own mode that you turn on from a corner button, and every delete asks for confirmation first.

## Goals

- A trash button in the top-right corner of the Log Workout screen, next to the timer, turns delete mode on. While delete mode is on, the button reads **Done** and turns it off.
- In delete mode, every set row and every exercise heading shows a ⊖ button where the ✓ box usually sits. A hint notice at the top says "Tap a set or exercise to delete it."
- Tapping a set's ⊖ opens a sheet:
  - Title: "Delete set 2?"
  - Body: "Barbell Bench Press · 135 lb × 8 reps."
  - Buttons: **Keep set** and **Delete set**.
  - Sets that are already done can be deleted too.
- Tapping an exercise's ⊖ opens a sheet:
  - Title: "Remove Barbell Bench Press from today?"
  - Body: "Its sets from today go too."
  - Buttons: **Keep** and **Remove exercise**.
- Delete mode stays on after a delete. It turns off when you tap Done or leave the screen. It is never saved.

## Non-goals and anti-goals

- **Only today's session changes.** Deleting never changes the workout plan, past sessions, or the exercise itself. The owner decided this.
- **Nothing else on the screen responds in delete mode.** Numbers, ✓ boxes, notes, "+ Set", "Add exercise" and "Fulfill contract" are inert. A stray tap must not confirm a set or edit a value.
- **No undo.** The confirmation is the guard against misclicks.
- **Not in the workout editor.** The editor keeps its own Remove button.

## Constraints

- Writes go through the existing `mutateSession` transaction, which only accepts in-progress sessions.
- Each delete names the exerciseId it expects. If the entry at that index has changed since the sheet opened, the delete is refused instead of removing the wrong exercise.
- Following DESIGN-RULES:
  - Destructive buttons are plain ink, not red.
  - The trash and Done buttons are on the board, so they use `--on-board`.
  - Every tap target is at least 44px.
  - The ⊖ icon is Lucide `circle-minus`, and the trash icon is Lucide `trash-2`.
- An exercise whose sets have all been deleted stays on screen with "+ Set". Finishing the workout already drops exercises that have no done sets.
- Tapping a set's number still skips it, as it does today, because skipping is a different action that can be undone.

## Approaches

1. **A screen-wide delete mode with a corner button.** The owner chose this. It keeps the normal screen free of delete controls, and combined with the confirmation it makes misclicks cheap.
2. **Swipe a row to delete.** This is the native iOS pattern, but it is easy to trigger by accident while scrolling with one hand, and it fits exercises poorly.
3. **A ⊖ on every row at all times.** This adds clutter beside the ✓ box, which is exactly where a misclick is most likely.

## Left to the builder

- The exact copy of the set description when weight or amount is blank. Use "Bodyweight" for a blank weight, and leave out a blank amount.
- How the inert controls look. They use the disabled style: 40% opacity and no pointer events.
