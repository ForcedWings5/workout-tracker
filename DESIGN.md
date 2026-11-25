---
name: Workout Tracker
description: A personal iPhone workout log where each workout is a contract nailed to a dark notice board and every confirmed set is stamped in red ink.
colors:
  board: "#2a241f"
  plank: "#3d342c"
  on-board: "#efece6"
  on-board-2: "#c9c2b8"
  on-board-3: "#b0a89c"
  notice: "#efece6"
  ink: "#1d1a17"
  ink-2: "#5d574f"
  draft: "#857e75"
  rule: "#dcd8d0"
  mark-empty: "#8f877c"
  red-ink: "#a3271f"
  on-red: "#efece6"
  record: "#8a5e0f"
  nail: "#4a4a4a"
  field: "#ffffff"
  scrim: "rgba(0, 0, 0, 0.5)"
  selection: "rgba(163, 39, 31, 0.25)"
  board-dark: "#1c1815"
  plank-dark: "#2a241f"
  notice-dark: "#37302a"
  ink-dark: "#efece6"
  ink-2-dark: "#c2b9ad"
  draft-dark: "#9a9186"
  rule-dark: "#4a423a"
  mark-empty-dark: "#857c71"
  red-ink-dark: "#ef7d6a"
  on-red-dark: "#1c1815"
  record-dark: "#e2b04a"
  nail-dark: "#6b625a"
  field-dark: "#2a241f"
  selection-dark: "rgba(239, 125, 106, 0.25)"
typography:
  title:
    fontFamily: "UnifrakturCook, Georgia, serif"
    fontSize: "38px"
    fontWeight: 700
    lineHeight: "38px"
  title-compact:
    fontFamily: "UnifrakturCook, Georgia, serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: "30px"
  set-value:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: "28px"
    fontFeature: "tnum"
  exercise-name:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 650
    lineHeight: "24px"
  row:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: "22px"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "22px"
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "20px"
  unit:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: "18px"
  small:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: "18px"
rounded:
  notice: "3px"
  control: "8px"
  sheet: "12px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
  "10": "40px"
components:
  notice:
    backgroundColor: "{colors.notice}"
    textColor: "{colors.ink}"
    rounded: "{rounded.notice}"
    padding: "20px 16px 12px"
  button-primary:
    backgroundColor: "{colors.red-ink}"
    textColor: "{colors.on-red}"
    rounded: "{rounded.control}"
    height: "54px"
    width: "100%"
    padding: "0 16px"
  button-board:
    backgroundColor: "{colors.plank}"
    textColor: "{colors.on-board}"
    rounded: "{rounded.control}"
    height: "48px"
    width: "100%"
  button-outline:
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "48px"
    padding: "0 16px"
  button-text:
    textColor: "{colors.red-ink}"
    typography: "{typography.body}"
    height: "44px"
    padding: "0 8px"
  button-text-board:
    textColor: "{colors.on-board}"
    height: "44px"
    padding: "0 8px"
  button-plain:
    textColor: "{colors.ink}"
    height: "44px"
    padding: "0 8px"
  mark-box:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.control}"
    size: "44px"
  mark-box-done:
    backgroundColor: "{colors.red-ink}"
    textColor: "{colors.on-red}"
    rounded: "{rounded.control}"
    size: "44px"
  set-row:
    height: "56px"
  number-field:
    textColor: "{colors.ink}"
    typography: "{typography.set-value}"
    height: "44px"
  number-field-draft:
    textColor: "{colors.draft}"
  number-field-editing:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
  text-field:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "48px"
    padding: "12px"
  sheet:
    backgroundColor: "{colors.notice}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sheet}"
    padding: "24px 16px 16px"
  tab-bar:
    backgroundColor: "{colors.plank}"
    textColor: "{colors.on-board-3}"
    height: "49px"
  tab-bar-active:
    textColor: "{colors.on-board}"
  fulfilled-stamp:
    textColor: "{colors.red-ink}"
    typography: "{typography.title}"
    rounded: "{rounded.control}"
    padding: "4px 16px 8px"
---

# Design System: Workout Tracker

## Overview

**Creative North Star: "The Contract Board"**

Each workout is a contract posted on a village notice board. The screen is the dark board; every piece of content sits on a bone notice nailed to it at two top corners. Last time's numbers wait in faded draft ink, each set the owner confirms is stamped in red ink, and a finished workout is stamped "Fulfilled". The app is a one-handed gym tool on an iPhone 14 Pro (393 × 852), so density is moderate, tap targets are large, and the fantasy never costs a tap.

The fantasy lives in four places only: the palette, the blackletter title lettering, the nailed notices, and the red-ink stamp. Navigation, controls and layout are the standard ones an iPhone user already knows: a bottom tab bar, bottom sheets, inline editing. Everything is flat solid color; the single paper-on-wood shadow under each notice is the only depth.

All fantasy material is generic and original (notice boards, nails, ink, blackletter, stamps). Nothing comes from any existing franchise.

**Key Characteristics:**
- Dark board ground, bone notices, iron-gall ink, one red ink, one record gold.
- Blackletter for titles at 28px and up; the platform sans with tabular numerals for everything else.
- Data always sits on a notice, never on the bare board.
- One signature motion: the 140ms red-ink stamp on a mark box.
- Light and dark follow the system; the structure stays identical, only the tokens change.

## Colors

A warm, near-monochrome brown-and-bone palette with exactly two hues of meaning: red ink for "done" and gold for a personal best.

### Primary
- **Red Ink** (`red-ink`; dark `red-ink-dark`): confirmed mark boxes, the one primary button per screen ("Start workout", "Fulfill contract", "Done"), text buttons on a notice ("+ Set", "Cancel"), the last-note date, the Fulfilled stamp, finished-day dots on the calendar, and ordinary chart points. Text and icons on it use **Bone on Red** (`on-red`), which flips to the board brown in dark mode.

### Secondary
- **Record Gold** (`record`; dark `record-dark`): the "Record" label after a personal-best set and its larger chart point and chart label. Nothing else.

### Neutral
- **Weathered Board** (`board`): the page ground, the fixed footer behind "Fulfill contract", the browser `theme-color` and the manifest `background_color`/`theme_color`.
- **Plank** (`plank`): raised board parts: the tab bar and secondary buttons on the board. In dark mode it also fills inputs (`field-dark`).
- **Bone** (`notice`): every notice and sheet surface. In dark mode notices become a dark plank (`notice-dark`).
- **Iron-Gall Ink** (`ink`): main text and confirmed numbers on notices, outline-button borders, the current mark box's border, the chart line, today's calendar outline, the focus ring inside notices and sheets.
- **Faded Ink** (`ink-2`): labels, targets, units, set numbers, note text, chevrons, chart axis labels, timed-hold fill.
- **Draft Ink** (`draft`): pre-filled numbers that aren't confirmed, and number placeholders. Large text only (24px).
- **Rule** (`rule`): 1px dividers between rows, chart gridlines, the text-field border, the empty hold track.
- **Unmarked** (`mark-empty`): the 2px border of an unconfirmed mark box. Never text.
- **Board Text** (`on-board`, `on-board-2`, `on-board-3`): titles and the active tab; subtitles, the timer and the backup nudge; inactive tab labels and icons.
- **Nail** (`nail`): the two 8px nail heads on every notice.
- **Field White** (`field`): the fill of a focused number field, text fields, and the selected calendar day.
- **Scrim** (`scrim`): behind bottom sheets. **Selection** (`selection`): red ink at 25% for selected text.

### Named Rules
**The Red Means Done Rule.** Red ink marks completion and the one action that leads to it. Destructive actions are never red: delete and discard are plain ink text buttons inside a confirmation sheet, labelled with exactly what happens ("Delete session").

**The Notice Carries the Data Rule.** Every number, input, list and chart is ink on a notice. The bare board holds only titles, subtitles, the timer, the backup nudge and board buttons.

**The No Per-Workout Color Rule.** A workout is identified by its name and its days, never by a color.

## Typography

**Display Font:** UnifrakturCook 700 (fallback Georgia, serif), self-hosted via `@fontsource/unifrakturcook` and precached by the service worker.
**Body Font:** the platform sans (`-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif`).

**Character:** A heavy blackletter gives each contract its name and its seal; the iPhone's own sans does all the work, with tabular numerals so a changed digit never shifts its row.

### Hierarchy
- **Title** (700, 38/38px, blackletter): the five screen titles, the workout name on Today and Log Workout, "Rest day", and the Fulfilled stamp. A screen-header title longer than 20 characters steps down to 28/30px and wraps.
- **Title, compact** (700, 28/30px, blackletter): workout names on the Workouts notices and every sheet title.
- **Set value** (600, 24/28px, tabular; 500 when draft): weight, reps and seconds in a set row.
- **Exercise name** (650, 18/24px): exercise names, notice headings ("This week", "Cloud backup", "Backup file"), the calendar month.
- **Row** (600, 17/22px): list rows: picker options, week-day workouts, Progress exercise names, history sets, calendar sessions, "Done today". The primary button also sits at 17px, 650.
- **Body** (400–650, 16/22px): body copy, buttons, inputs (16px also stops iOS zooming on focus), calendar day numbers.
- **Label** (400–600, 15/20px): targets, notes, subtitles, meta lines ("Today · Monday · 6 exercises · last 11/12"), set numbers, form labels, chart titles.
- **Unit** (500, 14/18px, `ink-2`): the unit after a value ("65 lb", "10 reps", "sec").
- **Small** (500, 13/18px): tab labels, chart axes, calendar weekday initials; the "Record" label uses 13px at 600.

### Named Rules
**The Blackletter Floor Rule.** Blackletter appears at 28px or larger, on titles only: never on labels, buttons, numbers, inputs or meta lines.

**The Tabular Numbers Rule.** Every number the owner compares (set values, dates, targets, timers, chart labels, calendar days) uses `tabular-nums`.

**The Sentence Case Rule.** Sentence case everywhere; no uppercase, letter-spaced labels. Nothing is smaller than 13px.

## Layout

A single column, at most 480px wide, centered on the board at every width; there is no desktop layout. Spacing sits on a 4px scale (4, 8, 12, 16, 20, 24, 32, 40).

- **Safe areas** always come from `env(safe-area-inset-*)`: the screen header pads the top inset plus 12px; the tab bar and the fixed "Fulfill contract" footer pad the bottom inset.
- **Gutters:** board-level text sits 16px from the screen edge; notices sit 12px from each edge, 12px apart.
- **Notice padding:** 20px top (room for the nails), 16px sides, 12px bottom.
- **Board headings** take 32px above and 12px below: space above a heading is larger than below.
- **Set row:** a 56px grid of set number (28px), weight, reps or seconds, and the mark-box column (52px), divided by 1px rules.
- **Fixed furniture:** the tab bar (49px plus the bottom inset) on the four tab screens; on Log Workout a board-colored footer holds the full-width primary button, with a spacer so the last notice clears it.
- **Narrow phones (under 360px):** the calendar notice drops its side margins so each day stays a 44px target.

## Elevation & Depth

Flat by default. The only shadow is the notice's paper-on-wood shadow; depth otherwise comes from tonal layers (board, plank, notice) and the sheet's scrim.

### Shadow Vocabulary
- **Paper on wood** (`box-shadow: 0 1px 2px rgba(0, 0, 0, 0.35)`): every notice. Nothing else has a shadow.

### Named Rules
**The One Shadow Rule.** No glows, gradients, blur, glass or hard offset shadows. A sheet is lifted by its scrim, not by a shadow.

## Shapes

Paper is nearly square; things you press are gently rounded.

- **Notice** (3px): the nailed paper.
- **Controls** (8px): buttons, inputs, mark boxes, calendar days, set-number tap targets, the Fulfilled stamp.
- **Sheets** (12px top corners only).
- **Nails:** two 8px circles in `nail`, 8px in from the top-left and top-right corners of every notice. They are the only ornament.
- **Lines:** 1px `rule` dividers; 2px strokes for emphasis (outline buttons, mark boxes, the segmented control, today's calendar day, the Fulfilled stamp, the chart line).
- Notices are never nested, and never hold a card.

## Components

### Notice
The base container, a bone sheet of paper nailed to the board.
- **Fill / text:** `notice` with `ink`; focus rings inside switch to `ink`.
- **Shape:** 3px radius, the paper-on-wood shadow, two nails.
- **Padding:** 20px / 16px / 12px.
- **Tap variant:** a whole notice can be one button (Workouts cards): it keeps the notice padding, adds a right chevron in `ink-2`, and presses with `brightness(0.92)`.

### Exercise notice and set row
Fixed furniture in order: exercise name (left) and target (right, "4 × 6–10"); last note (date in `red-ink` 600, " · ", note in `ink-2`); set rows; "+ Set" (red text button with a Lucide `plus`); a single-line note field ("Add a note…") that grows as you type.

Set-row states:
- **Suggested:** numbers in `draft` 500; empty mark box, 2px `mark-empty` border.
- **Current** (first unconfirmed set): numbers in `draft` 500; empty mark box, 2px `ink` border.
- **Done:** numbers in `ink` 600; mark box filled `red-ink`, an `on-red` check, resting at −2°.
- **Skipped:** numbers and set number struck through; dashed border with a Lucide `minus`. Tapping the set number toggles it.
- **Record:** a done set that beats the exercise's previous best shows "Record" (13px 600, `record`) after the reps.
- **Editing:** tapping a number edits in place: `field` fill, 2px `ink` bottom border, the iOS keypad (`decimal` for weight, `numeric` for reps and seconds). Editing never confirms the set.
- **Timed sets:** "sec" unit and a 4px hold bar under the row, filling in `ink-2` on a `rule` track.
- **Delete mode:** the mark box is replaced in place by a 44px Lucide `circle-minus` in plain ink.

### Mark box
The 44 × 44px tap target, 8px radius, 2px border. Becoming done plays the stamp (see Motion); it never animates on first render. Its accessible name reads like "Set 3: 85 lb, 8 reps, not done".

### Buttons
- **Shape:** 8px radius; minimum 44px tall; 16px 600 label.
- **Primary:** `red-ink` fill, `on-red` text, full width, 54px, 17px 650. One per screen.
- **Secondary on board:** `plank` fill, `on-board` text, full width, 48px ("Resume").
- **Secondary on notice (outline):** 2px `ink` border, `ink` text, 48px ("Export backup", "Sync now").
- **Text:** `red-ink` on a notice, `on-board` on the board ("Start a different workout", the "‹ Today" back link), plain `ink` for destructive actions in sheets.
- **States:** pressed `filter: brightness(0.92)` over 150ms; disabled 40% opacity, no pointer events; loading swaps the label for "Saving…", "Syncing…" or "Exporting…", never a spinner.
- **Icon button:** 44 × 44px, `ink`, same pressed and disabled states.

### Inputs / Fields
- **Text field:** `field` fill, 1px `rule` border, 8px radius, 48px min height, 12px padding, 16px text, `ink-2` placeholder.
- **Focus:** the border becomes 2px `ink`.
- **Error:** a 2px dashed `ink` border plus a 15px 600 `ink` message; never red.
- **Segmented choice:** a 2px `ink` frame divided by 2px lines; the pressed option fills `ink` with `notice` text.

### Sheets and pickers
Bottom sheets slide up as a notice-colored panel (no nails) with 12px top corners over the 50% scrim, padded 24px / 16px plus the bottom inset. The title is compact blackletter, the body 16px `ink-2`, and actions stack in an 8px grid. Scrim tap and Escape close it; focus moves in and returns on close.
- **Confirmations:** discard, delete, import, remove exercise.
- **Pickers:** "Start a workout" on Today, the weekday picker on Workouts (a check marks the current choice), and the exercise picker (a tall sheet, `min(85dvh, 720px)`, whose list scrolls while the title and search stay put). Picker rows are 52px, 17px 600, divided by rules.

### Calendar
A notice headed by the month and year (18px 650) between previous and next icon buttons; next is disabled on the current month. Weekday initials (13px) run Monday first. Days are 44px, 16px tabular `ink`; a finished workout puts a 6px `red-ink` dot under the number; today has a 2px `ink` outline; the selected day fills with `field`. Below a rule, the selected day lists its sessions as 17px rows or says "No workout on Monday, Nov 16."

### Progress chart
Hand-written SVG on a notice (320 × 180 viewBox). Title in 15px 600 `ink-2` ("Heaviest set per session"). Line: 2px `ink`, straight segments. Points: 8px `red-ink` dots; a personal-best point is 10px `record` with a "Record" label. Axes: 13px `ink-2` labels and 1px `rule` gridlines, horizontal only.

### Screen header
No colored bar. On the board: an optional 44px row (back link left; timer, delete toggle or other extra right, in `on-board-2` tabular), then the blackletter title, then a 15px `on-board-2` subtitle ("Horizontal Push & Pull · 3 of 15 sets").

### Tab bar
Fixed to the bottom on `plank`, 49px plus the inset, four equal tabs: Today (`scroll-text`), Progress (`trending-up`), Workouts (`list-ordered`), Settings (`settings`). Icons 24px at 2px stroke over a 13px 500 label. Active is `on-board`; inactive `on-board-3`. No red.

### Fulfilled stamp (signature)
On the summary notice after finishing: "Fulfilled" in 38px blackletter `red-ink`, inside a 2px `red-ink` border with an 8px radius, rotated −2°. It presses in once (see Motion). Below: a 15px tabular meta line and the exercises with their sets ("65×10 70×9 200×8").

### Screens
- **Today:** "Today" title; an optional dismissible backup nudge on the board; one notice: the meta line, the workout name in 38px blackletter, its subtitle, the primary "Start workout" and the "Next" line, or "Done today" / "Done this week (Monday)" once done; on a rest day "Rest day" with the Next line. Below it, a board text button "Start a different workout" opens the "Start a workout" picker sheet listing every workout and, last, "Empty workout". An in-progress session replaces all of this with "Resume" and "Discard".
- **Log Workout:** back link and timer, the blackletter workout name, the progress subtitle, one exercise notice per exercise, then the fixed "Fulfill contract" footer. A trash toggle enters delete mode. Finishing shows the Fulfilled summary with a primary "Done".
- **Progress:** the history calendar notice, then a notice listing exercises (most recent first, "last 11/12" and a chevron). An exercise opens its chart notice and past sessions as rows of weight × reps with notes.
- **Workouts:** a "This week" notice with seven rows (day in `ink-2`, workout in 17px 600 or "Rest" in 500 `ink-2`, chevron), each opening the weekday picker; below, one tap notice per workout in week order with its compact blackletter name, subtitle and "Monday · 6 exercises" meta.
- **Settings:** a Cloud backup notice (status, email one-time-code sign-in, "Sync now", sign out), a Backup file notice (last export, "Export backup", "Import backup"), and a plain note: "Always open Workouts from the home-screen icon."

### Motion
- **Stamp:** a mark box turning done scales 1.15 → 1 and rotates −4° → −2° over 140ms on `cubic-bezier(0.16, 1, 0.3, 1)`. The check is visible from the first frame.
- **Fulfilled:** the same keyframes over 220ms, once.
- **State changes:** 150ms ease-out for pressed filters, border and segmented changes and the hold bar; 200ms ease-out for the sheet rising 24px. No entrance or page-load animation.
- **Reduced motion:** every animation and transition collapses to 0.01ms; the stamp and the stamp-press simply appear.

### Iconography
Lucide only, 2px stroke by default: 20px in buttons and rows, 24px in the tab bar. The done check is Lucide `check` (24px, 2.5 stroke); never a typed ✓, ✕ or emoji.

**Home-screen icon:** original flat vector art (`public/icon.svg`, 1024px): a torn bone contract pinned to the `board` ground with a dagger, struck through with a red-ink check, with faint plank seams. The maskable icon is the same picture at 80%. PNGs (180px apple-touch, 192, 512, maskable 512) are rendered from the SVGs; provenance is in `scripts/ICONS.md`.

### Accessibility
- Measured contrast (light / dark), all on the notice: ink 14.7 / 11.0; ink-2 6.1 / 6.7; red-ink 6.2 / 4.8; on-red on red-ink 6.2 / 6.6; record 4.8 / 6.5; draft 3.4 / 4.2 (24px only); mark-empty 3.0 / 3.2 (borders only). On the board: on-board 13.0; on-board-2 8.7; on-board-3 on plank 5.2.
- Every tap target is at least 44 × 44px (the set number extends its target into the notice padding to reach 44px).
- A 2px focus ring with a 2px offset on every control, in `ink` on notices and `on-board` on the board.
- State never rides on color alone: fill, border style and icon change too.

## Do's and Don'ts

### Do:
- **Do** put every number, input, list and chart on a notice with two nails and the one shadow.
- **Do** keep red ink for done sets, the single primary action, text buttons on a notice, the last-note date, calendar done-dots and chart points.
- **Do** use tabular numerals for every compared number and 16px for every text input.
- **Do** make every control at least 44 × 44px with pressed, focus, disabled and loading states.
- **Do** follow the system light/dark setting through the token swap; keep the structure identical.

### Don't:
- **Don't** set blackletter under 28px or on labels, buttons, numbers or inputs.
- **Don't** add wood grain, parchment, paper texture, burnt edges, gradients, glass, blur, glows or hard offset shadows.
- **Don't** use ✕ or a strikethrough for a done set; strikethrough means skipped.
- **Don't** make destructive actions or errors red.
- **Don't** use typed glyphs or emoji as icons, or uppercase letter-spaced labels above headings.
- **Don't** nest notices or put cards inside notices.
- **Don't** load fonts or anything else from another site at runtime.
- **Don't** borrow any medallion, sign, sigil, logo, typeface, character or interface element from an existing franchise.

## Drift

Where DESIGN-RULES.md and the shipped code still disagree. This file records the code. (Settled on 2026-11-22 and no longer drift: sheets are also used as pickers; red ink also marks calendar workout days and chart points.)

1. **Long blackletter sheet titles.** DESIGN-RULES keeps blackletter titles to about 20 characters; sheet titles are full questions in 28px blackletter ("Replace everything on this phone with this backup?", "Remove {exercise} from {scope}?").
2. **No "big number" style.** DESIGN-RULES lists a 34/40px Progress headline number; nothing in the code uses it.
3. **A 17px row size.** Picker options, week-day workouts, Progress exercise names, history sets, calendar sessions and "Done today" use 17/22px 600, a size missing from the DESIGN-RULES scale (which has 17px only for the primary button). The "Record" label is 13px at 600, not 500.
4. **Icon sizes and strokes.** DESIGN-RULES says 2px stroke, 20px in buttons, 24px in the tab bar. The mark-box and weekday-picker checks use a 2.5 stroke (the mark check at 24px); the trash toggle and calendar chevrons are 22px; the delete-mode `circle-minus` is 24px.
5. **Off the 4px grid.** History rows use a 2px gap, calendar days a 3px gap, the hold bar a 2px radius, and the delete button a −10px block margin.
6. **Undocumented tokens.** `--field`, `--scrim` and `--selection` are tokens in code; DESIGN-RULES describes their values only in prose.
