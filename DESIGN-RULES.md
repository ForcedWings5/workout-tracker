# Design Rules: Contract Board

The visual rules for Workout Tracker's UI. Every screen follows them. Product behavior lives in `docs/superpowers/specs/2026-11-18-workout-tracker-design.md`; product facts live in `PRODUCT.md`. After the first build, Impeccable records the shipped system in `DESIGN.md`. If the two ever disagree, fix the code or update this file on purpose. Never let them drift apart quietly.

## The idea

Each workout is a **contract posted on a village notice board**. The screen is the dark board; each exercise is a bone-colored notice nailed to it. Last time's numbers wait in faded draft ink. Every set you confirm is **stamped in red ink**. When you finish, the whole contract is stamped **Fulfilled**.

The fantasy lives in four places only: the palette, the title lettering, the nailed notices, and the red-ink stamp. Navigation, controls, and layout are the standard ones an iPhone user already knows.

**Original only.** Nothing from any specific franchise: no medallions, magic signs, sigils, character names, logos, lettering, maps, or game-interface elements from the Witcher, Lord of the Rings, Game of Thrones, or anything else. Generic dark-fantasy material (notice boards, nails, ink, blackletter, stamps) is fine.

## Principles

1. **The task comes first.** Someone who has used any workout app should know where everything is before they notice the theme.
2. **Data sits on notices, never on the bare board.** Every number, input, and chart is dark ink on a light notice, so it reads under bright gym lights. The dark board only frames them.
3. **Red ink means done.** Red is for confirmed sets and the one primary action on a screen. Nothing decorative is red.
4. **Flat, not costumed.** Solid colors only: no wood grain, parchment texture, burnt edges, grunge, or gradients.
5. **Faster than Notes.** If a flourish costs a tap or a second, it goes.

## Color

All colors are CSS custom properties. Components use the tokens, never raw hex values.

### Light (default)

| Token | Value | Job |
|---|---|---|
| `--board` | `#2a241f` | Page ground: the board |
| `--plank` | `#3d342c` | Raised board parts: tab bar, sheets, secondary buttons on the board |
| `--on-board` | `#efece6` | Primary text on the board (titles, active tab) |
| `--on-board-2` | `#c9c2b8` | Secondary text on the board (subtitles, timer) |
| `--on-board-3` | `#b0a89c` | Inactive tab labels and icons |
| `--notice` | `#efece6` | Notice surface: where all content sits |
| `--ink` | `#1d1a17` | Main text, confirmed numbers |
| `--ink-2` | `#5d574f` | Labels, targets, units, set numbers, note text |
| `--draft` | `#857e75` | Pre-filled numbers that aren't confirmed yet. **24px+ only.** |
| `--rule` | `#dcd8d0` | Dividers between set rows |
| `--mark-empty` | `#8f877c` | Border of an unconfirmed mark box |
| `--red-ink` | `#a3271f` | Confirmed mark, primary button, "+ Set", note dates |
| `--on-red` | `#efece6` | Text and icons on red ink |
| `--record` | `#8a5e0f` | Personal-best label and chart point |
| `--nail` | `#4a4a4a` | The two nail heads on a notice |
| `--focus` | `#1d1a17` on notices, `#efece6` on the board | Focus ring |

Measured contrast (WCAG 2.x):

| Pair | Ratio | Allowed use |
|---|---|---|
| ink on notice | 14.7 | anything |
| ink-2 on notice | 6.1 | anything |
| draft on notice | 3.4 | large text only (24px, or 19px bold) |
| red-ink on notice, and on-red on red-ink | 6.2 | anything |
| record on notice | 4.8 | anything |
| mark-empty on notice | 3.0 | borders of controls only, never text |
| on-board on board | 13.0 | anything |
| on-board-2 on board | 8.7 | anything |
| on-board-3 on plank | 5.2 | anything |

### Dark (follows the phone's setting)

The board gets darker and the notices turn into dark planks, so the screen doesn't glare at night. The structure stays the same.

| Token | Dark value |
|---|---|
| `--board` | `#1c1815` |
| `--plank` | `#2a241f` |
| `--notice` | `#37302a` |
| `--ink` | `#efece6` |
| `--ink-2` | `#c2b9ad` |
| `--draft` | `#9a9186` |
| `--rule` | `#4a423a` |
| `--mark-empty` | `#857c71` |
| `--red-ink` | `#ef7d6a` |
| `--on-red` | `#1c1815` |
| `--record` | `#e2b04a` |
| `--nail` | `#6b625a` |

Dark-mode contrast: ink 11.0, ink-2 6.7, draft 4.2, red-ink 4.8, on-red on red-ink 6.6, record 6.5, mark-empty 3.2. Dark mode applies with `@media (prefers-color-scheme: dark)`. There's no in-app toggle.

### Color jobs

- **Red ink:** confirmed sets, the primary action, "+ Set", and the date on a last note. Nothing else.
- **Record gold:** a new personal best, until you've seen it.
- **Draft:** pre-filled values, and nothing else.
- **No per-workout colors.** A workout is identified by its name and its place in the rotation.
- **Destructive actions aren't red.** Red already means "done." Delete and discard are plain ink text buttons inside a confirmation sheet, with a label that says exactly what happens ("Delete session").

## Type

### Faces

- **Titles:** UnifrakturCook 700 (a blackletter face, SIL Open Font License). **Screen titles only:** the workout name on Log Workout and Today, and the five screen titles. It's never used for labels, buttons, numbers, inputs, or anything under 28px. Self-hosted as `woff2` and precached by the service worker, since the app runs offline. No Google Fonts link.
- **Everything else:** the system stack `-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif`.
- **All numbers:** `font-variant-numeric: tabular-nums`, so digits line up and a changed digit doesn't shift its row.

### Scale

| Role | Size / line height | Weight | Face |
|---|---|---|---|
| Title | 38 / 38 px | 700 | blackletter |
| Title, compact (Today's other contracts, sheets) | 28 / 30 px | 700 | blackletter |
| Big number (Progress headline) | 34 / 40 px | 700 | sans, tabular |
| Set value (weight, reps, seconds) | 24 / 28 px | 600 (500 when draft) | sans, tabular |
| Exercise name | 18 / 24 px | 650 | sans |
| Body, buttons, inputs | 16 / 22 px | 400–650 | sans |
| Label (target, note, subtitle) | 15 / 20 px | 400–600 | sans |
| Small (units, chart axes, tab labels) | 13 / 18 px | 500 | sans |

- Nothing is smaller than 13px.
- Units sit after the value at 14px, 500 weight, in `--ink-2` ("65 lb", "10 reps").
- Sentence case everywhere: no all-caps labels, no letter-spaced eyebrow labels above headings.
- Blackletter titles stay short (workout names up to about 20 characters). Longer names wrap at 28px instead of shrinking.

## Space and layout

- **4px grid.** Every spacing, size, and position is a multiple of 4.
- **iPhone 14 Pro first:** a 393 × 852 viewport. Top safe area 59px, bottom 34px, always via `env(safe-area-inset-*)`, never hard-coded.
- **Screen gutter:** 16px for board-level text. Notices sit 12px from each screen edge.
- **Notice padding:** 16px on the sides, 20px on top (room for the nails), 12px on the bottom.
- **Gap between notices:** 12px.
- **Set row:** 56px tall, divided by 1px `--rule` lines. Columns: set number 28px, weight, reps or seconds, mark box 52px.
- **Space above a heading is larger than the space below it.**
- Other widths (a laptop, later) center a single 480px-max column on the board. There's no desktop layout.

## Shape and depth

| Element | Radius |
|---|---|
| Notice | 3px (paper is nearly square) |
| Buttons, inputs, mark boxes | 8px |
| Sheets (top corners) | 12px |

- **Nails:** two 8px `--nail` circles, 8px in from the top-left and top-right corners of every notice. They're the only ornament in the app.
- **One shadow:** notices get `0 1px 2px rgba(0, 0, 0, 0.35)`, the shadow of paper lying on wood. Nothing else has a shadow, and there are no hard offset shadows or glows.
- **Never nest notices.** A notice never contains another notice or a card.

## Icons

- One library: **Lucide**, at a 2px stroke, sized 20px in buttons and 24px in the tab bar.
- The ✓ in a mark box is the Lucide `check` icon, never a typed ✓ or ✕ character or an emoji.
- Tab icons: Today `scroll-text`, Progress `trending-up`, Workouts `list-ordered`, Settings `settings`.

## Components

### Notice

The base container for content: `--notice` fill, 3px radius, two nails, the one shadow. One exercise per notice on Log Workout. Settings groups and the Progress chart each get a notice.

### Set row: the five states

| State | Numbers | Mark box (44 × 44px) |
|---|---|---|
| **Suggested** (pre-filled from last time) | `--draft`, 500 weight | empty, 2px `--mark-empty` border |
| **Current** (first unconfirmed set) | `--draft`, 500 weight | empty, 2px `--ink` border |
| **Done** | `--ink`, 600 weight | filled `--red-ink`, `--on-red` check icon |
| **Skipped** (removed this session) | `--draft`, struck through | empty, dashed border, `minus` icon |
| **Personal best** | `--ink`, 600 weight | done, plus a "Record" label in `--record` after the reps until you've seen it |

- The whole mark box is the tap target. Tapping a done mark un-confirms it.
- Tapping a number edits it in place, with no popup. While editing: a `#ffffff` field (dark mode: `--plank`), a 2px `--ink` bottom border, and the iOS number keypad (`inputmode="decimal"` for weight, `"numeric"` for reps and seconds).
- Editing a value doesn't confirm the set.
- Timed sets show seconds with "sec" as the unit. A bar under the row, as long as the seconds held, fills in `--ink-2`.

### Exercise notice

Fixed furniture, always in this order:
1. Exercise name (left) and target (right), for example "4 × 6–10", with "per leg" added when it applies
2. Last note: the date in `--red-ink` 600 weight, then " · " and the note in `--ink-2`, read-only
3. Set rows
4. "+ Set" (text button, `--red-ink`, 16px, 600 weight)
5. Note field: "Add a note…" placeholder, a single line that grows as you type

### Buttons

| Kind | Look | Use |
|---|---|---|
| Primary | `--red-ink` fill, `--on-red` text, 54px tall, full width, 8px radius, 17px 650 | One per screen: "Start workout", "Fulfill contract" |
| Secondary on board | `--plank` fill, `--on-board` text, 48px | "Resume", "Start empty workout" |
| Secondary on notice | 2px `--ink` border, `--ink` text, 48px | "Export backup", "Sync now" |
| Text | no fill, `--red-ink` (on notice) or `--on-board` (on board), 16px 600, 44px tap area | "+ Set", "Edit", "Cancel" |

Every control has its default, pressed (`filter: brightness(0.92)`), focus, disabled (40% opacity, no pointer events), and loading states. Loading replaces the label with "Saving…" or "Syncing…" text; there's no spinner in the middle of content.

### Inputs

Text and number fields sit on notices: a `#ffffff` fill (dark mode: `--plank`), a 1px `--rule` border, an 8px radius, 48px tall, 16px text (16px also stops iOS from zooming in on focus). On focus the border becomes 2px `--ink`.

### Header

There's no colored bar. The screen title is set directly on the board: the back link ("‹ Today") on the left and the timer on the right in `--on-board-2` 16px, then the blackletter title, then the subtitle in `--on-board-2` 15px ("Horizontal Push & Pull · 2 of 14 sets").

### Tab bar

A `--plank` fill, 49px tall plus the bottom safe area, with four tabs: Today, Progress, Workouts, Settings. Active: `--on-board` icon and label. Inactive: `--on-board-3`. There's no red in the tab bar.

### Sheets

Bottom sheets (confirmations, picking an exercise) slide up as a notice with 12px top corners over a `rgba(0,0,0,0.5)` scrim. Use a sheet only when the action needs a confirmation (discard, delete, import). Everything else happens inline.

### Progress chart

- It sits on a notice, drawn in SVG.
- Line: 2px `--ink`, straight segments between sessions, never smoothed into curves.
- Points: 8px `--red-ink` dots. A personal-best point is 10px in `--record`.
- Axes: 13px `--ink-2` labels and 1px `--rule` gridlines, horizontal only.
- The chart's title is plain: "Heaviest set per session" (or "Best reps per session", "Longest hold per session").

### Empty states

An empty notice that says what to do, never "Nothing here." For example: "No sessions yet. Finish a workout with Bench Press and it shows up here."

## Screens

- **Today:** the board, with the title "Today". The next-up workout is a large notice with its name in the 38px blackletter, the subtitle, "6 exercises · last 11/12", and the primary "Start workout". Below it, the other three workouts are smaller notices with 28px titles, tappable to start instead. An in-progress session replaces the next-up notice with "Resume" and "Discard".
- **Log Workout:** see the direction contract's first viewport (`.impeccable/surfaces/src-app-tsx.md`). Confirming a set scrolls the next set into the same spot on screen.
- **Progress:** a list notice of exercises, most recent first. Tapping one opens its chart notice, then past sessions as rows with weight × reps and notes.
- **Workouts:** a notice per workout in rotation order, with Move up / Move down buttons to reorder. Editing a workout opens the same notice layout as Log Workout, but showing targets instead of sets.
- **Settings:** notices for Cloud backup (status line, "Sync now", sign in or out), Backup file (export and import), and a plain note: "Always open Workout Tracker from the home-screen icon."

## Motion

- **The signature moment, the stamp.** Tapping a mark box stamps it: the red fill scales from 1.15 to 1 and settles from −4° to −2° over 140ms with an exponential ease-out. The check icon is visible from the first frame.
- **Fulfilled.** Finishing a workout shows the summary notice with a red-ink "Fulfilled" stamp in the blackletter, which presses in once with the same curve over 220ms.
- **Everything else** is 150–200ms ease-out, for state changes only: sheets sliding up, a row being removed, the scroll to the next set. No entrance animations and no page-load sequences.
- **Reduced motion** (`prefers-reduced-motion: reduce`): the stamp and Fulfilled simply appear, and scrolling jumps instead of gliding.

## Copy and voice

- Plain English everywhere. The fantasy voice appears in exactly three places: "Fulfill contract" (the finish button), the "Fulfilled" stamp, and "Record" for a personal best.
- Never use franchise terms (contract names, monster names, signs, potions, place names).
- Buttons name their action ("Start workout", "Export backup"). Errors say what happened and what to do: "Couldn't sync. Your data is safe on this phone; we'll try again when you're online."
- US spelling, pounds ("lb"), and dates as month/day ("11/12").

## Browser details

These ship with browser defaults unless they're set, so they're themed too:
- Text selection: `--red-ink` at 25% opacity.
- Text caret: `--ink`.
- Focus ring: 2px `--focus`, 2px offset, on every control, visible for keyboard and switch control.
- `-webkit-tap-highlight-color: transparent`, with the pressed state above instead.
- `theme-color` meta and the manifest `background_color` and `theme_color`: `#2a241f`. In dark mode, `theme-color` is `#1c1815`.
- `overscroll-behavior-y: none` on the board, so the page doesn't rubber-band into white.

## Icon and imagery

- **Home-screen icon:** an original flat vector. A bone notice with two nails on the `--board` ground, stamped with a red-ink check. 1024px master, exported to the sizes iOS and the manifest need (180px `apple-touch-icon`, 192px and 512px manifest icons, plus a 512px maskable icon with the art inside the safe zone). Designed in the install/deploy slice.
- **Splash:** the board color with the icon centered. Nothing else.
- **No photos, illustrations, or textures in the app.** If workout emblems come later, they're simple original geometric marks in ink, never animals, medallions, or anything resembling a franchise symbol.
- Every shipped image records where it came from, in its file metadata or a sidecar.

## Accessibility

- Contrast as measured in the tables above. Draft ink is for large numbers only.
- Every tap target is at least 44 × 44px.
- Every control has a visible focus ring and an accessible name. Mark boxes say "Set 3: 85 lb, 8 reps, not done" / "done".
- Respect reduced motion, as above.
- The layout survives 200% browser zoom: text wraps and nothing gets cut off.
- Information is never carried by color alone. Set states differ by fill, border style, and icon too.

## Off-limits

- Blackletter in labels, buttons, numbers, inputs, or under 28px
- Wood grain, parchment, paper texture, burnt edges, stains, or any other texture image
- Gradients, glass, blur, glows, or hard offset shadows
- ✕ or a strikethrough for a *done* set (strikethrough means skipped)
- Red on anything that isn't confirmed or the primary action
- Typed glyphs or emoji as icons
- Uppercase letter-spaced eyebrow labels above headings
- Nested notices, or cards inside notices
- Any medallion, sign, sigil, logo, typeface, character, or interface element from an existing franchise
- Hosted fonts or anything else loaded from another site at runtime (the app must work offline)
