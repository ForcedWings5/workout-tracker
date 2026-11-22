# CLAUDE.md

Personal workout tracker: an iPhone home-screen web app (PWA) for one user. It replaces logging workouts in iPhone Notes. Full design: `docs/superpowers/specs/2026-11-18-workout-tracker-design.md`. Read it before changing behavior.

## UI design

All UI follows `DESIGN-RULES.md` (the "Contract Board" look): its color tokens, type scale, set-row states, components, motion, and off-limits list. Read it before touching any screen or style. Product facts for design work are in `PRODUCT.md`; the direction contract is in `.impeccable/surfaces/src-app-tsx.md`. Fantasy elements must be original: nothing from any existing franchise.

## Stack

React + TypeScript (strict), Vite, `vite-plugin-pwa`, Dexie (IndexedDB), `@supabase/supabase-js` (email-code sign-in + cloud copy), Vitest with `fake-indexeddb`. Charts are hand-written SVG. Icons are Lucide (`lucide-react`). The title font (UnifrakturCook) is self-hosted and precached. Don't add a chart library, UI kit, state library, or router without asking.

## Commands

- `npm run dev`: dev server
- `npm test`: Vitest
- `npm run build`: production build (also type-checks)

Run `npm test` and `npm run build` before calling work done.

## Architecture

```
src/screens/   React UI. Calls logic/, never touches Dexie directly.
src/logic/     Plain TypeScript rules. No React imports. Every rule has unit tests.
src/storage/   Dexie database, schema, and data access. The main copy of all data.
src/sync/      Supabase sign-in and the sync runner (pull, then push). Talks to Dexie and Supabase.
supabase/migrations/   SQL for the cloud `records` table and its row level security.
```

The rules live in `src/logic/`: the weekly schedule (what Today shows), pre-fill, progress series, finishing a session, backup export and import, and sync merge rules. New rules go there with tests (write the test first), not inside components. The Supabase client sits behind a small interface so sync tests use an in-memory fake.

## Rules that must not break

- **History is never rewritten.** A `Session` keeps snapshots of the workout name and each exercise's targets. Editing or deleting a workout must not change past sessions.
- **History belongs to the exercise** (`exerciseId`), not the workout. An exercise used in two workouts has one history. Renaming an exercise renames it everywhere. Deleting an exercise that has history archives it instead.
- **Only done sets count.** Pre-filled values are suggestions until the user taps ✓. Saved sessions, pre-fill, and progress all read only `done` sets.
- **Autosave on every change.** No save buttons. An in-progress workout must survive the phone locking, Safari reloading, or the app being closed.
- **Pre-fill source:** the most recent finished session of the same workout that has the exercise, otherwise the most recent finished session of any workout that has it.
- **Today follows the weekly schedule:** today's scheduled workout (or a rest day) and what's next, with "Start a different workout" for anything else. A workout done any day this week counts. One-off workouts never count. See `docs/superpowers/specs/2026-11-22-weekly-schedule-design.md` and `docs/superpowers/specs/2026-11-22-simpler-today-design.md`.
- **Offline first.** Screens read and write only local Dexie, never Supabase, and never wait on the network. Sync runs separately and fails silently, retrying on the next trigger.
- **All writes to synced records go through the one storage helper** that sets `updatedAt` and `dirty = 1`. Never write a synced table directly.
- **Deletes are tombstones** (`deleted = true`), so they sync. Every query filters them out.
- **Never overwrite a dirty local row** during a pull. Otherwise the newer `updatedAt` wins. Pull filters on the server's `synced_at`, not the phone's clock.
- **Seed records** have fixed IDs, an epoch `updatedAt`, and `dirty = 0`, so a fresh install never overwrites the user's real data in the cloud.
- **Schema changes** need a new Dexie version with a migration, and a bump to the backup format `version` if the export shape changes. Record shapes are stored as JSON in the cloud, so old rows pulled from Supabase must still load. Cloud schema changes go in a new file in `supabase/migrations/`.

## Conventions

- Weight is in pounds, decimals allowed. Blank weight means bodyweight.
- Exercises are measured in `reps` or `seconds`; the logged value is stored as `amount`.
- Dates are local `YYYY-MM-DD` strings.
- Mobile first: design for an iPhone in one hand. Large tap targets, `inputmode="decimal"` for weight and `inputmode="numeric"` for reps and seconds. Light/dark follows the system.
- Sign-in uses email one-time codes, never email links (links open in Safari, which doesn't share storage with the home-screen app). Sign-in is optional; nudge, never block.
- Keep it simple. This is a personal tool; no analytics, no multi-device editing.

## Secrets

The app uses only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (public, protected by row level security). Locally they're in `.env.local` (gitignored); for deploys they're GitHub Actions repository variables. Never use, request, or commit the Supabase service role key. The app must still run when these are missing, with sync turned off.

## Deploy

GitHub Pages from `main` through GitHub Actions. Vite `base` is `/workout-tracker/`. The repo is public; user data lives on the phone and in Supabase, never in the repo.

## Workflow

Work on short feature branches, one working vertical slice each, merged into `main` in order. Not one branch per layer.
