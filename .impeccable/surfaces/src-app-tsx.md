---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: []
---

# Surface brief: Workout Tracker app (all screens)

Scope: the whole app UI (Today, Log Workout, Progress, Edit Workouts, Settings). Mode: Operate.

Audience and job: the owner, on an iPhone 14 Pro, mid-workout under gym lighting, confirming pre-filled sets one-handed. Success is logging faster than Notes.

Constraints: offline PWA, so fonts are self-hosted. Original fantasy only: nothing taken from any specific franchise (no medallions, signs, sigils, logos or lettering from LOTR, Game of Thrones or the Witcher). Full rules live in `DESIGN-RULES.md`.

Memorable moment: confirming a set stamps it in red ink; finishing stamps the whole contract "Fulfilled".

Unresolved: home-screen icon and any workout emblems are designed in the install/deploy slice.

## Direction contract

THESIS: Each workout is a contract posted on a village notice board, and every set is a line you strike off in red ink. It refuses the category's dark-grey card stack with a blue accent.

OWN-WORLD: Dark weathered-board ground (#2a241f) with bone notices (#efece6) nailed at two top corners. Iron-gall ink text, a single red ink (#a3271f) for confirmed sets and the primary action, faded draft ink for pre-fills. Blackletter for screen titles only; the platform sans with tabular numerals for everything else. Flat color, no wood grain.

STORY: The owner opens the app, sees the next contract pinned up, takes it, stamps each set as it's done, and fulfills the contract at the end. They believe their numbers are safe and their progress is real.

FIRST VIEWPORT: Log Workout on a 393 × 852 screen. Board ground; back link and timer in the top 59px safe area; the workout name in blackletter at 38px; then the current exercise as a nailed notice filling the width minus 12px margins, with the target top right, last note under the name, four 56px set rows with 44px mark boxes on the right, and "+ Set". The next notice starts below. A full-width red "Fulfill contract" button sits 34px above the bottom edge.

FORM: Contract Board, position 1 on my ordered list for the monster-hunter round (shown as the pick card); chosen by the owner. seed:6efd4ac94407ea8d

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
