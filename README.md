# Workout Tracker

A simple personal workout tracker for iPhone, built to replace logging workouts in Notes.

It follows a fixed rotation (Upper A → Lower A → Upper B → Lower B), opens on the workout that's next, and fills in each set with last time's numbers, so you only change what's different.

## Features

- **Log set by set:** weight, plus the reps or seconds you actually did, next to your target (for example 4 × 6–10).
- **Last time's numbers already filled in.** A set only counts once you tap ✓.
- **Notes per exercise** ("form shaky last set, maybe reduce weight"), shown again the next time that exercise comes up.
- **Next up:** follows your rotation automatically. You can also start any other workout, or an empty one-off workout.
- **Editable workouts:** add, remove, or reorder exercises, change targets, and change the rotation, all in the app.
- **Progress:** a chart per exercise showing your heaviest set over time, plus a list of past sessions.
- **Works offline,** so bad gym signal doesn't matter. Every change saves to your phone the moment you make it.
- **Cloud backup:** sign in with a code sent to your email, and your data syncs to a Supabase database whenever you're online. If the app is deleted or you get a new phone, sign in again and everything comes back.
- **Backup file:** export all your data to a file and import it back, as a second safety net.

## Install on iPhone

1. Open the app's GitHub Pages URL in **Safari**.
2. Tap **Share → Add to Home Screen**.
3. Always open it from the home-screen icon. iOS keeps the home-screen app's data separate from a regular Safari tab.
4. In **Settings → Cloud backup**, sign in with your email. You'll get a 6-digit code to type in.

Your phone holds the main copy of your data, and the app syncs it to the cloud whenever it's open and online. iPhone web apps can't sync in the background, so open the app on Wi-Fi after a workout logged with no signal. Settings shows when it last synced.

To restore after reinstalling, install the app again and sign in with the same email.

## Development

Requires Node.js 20+.

```bash
npm install
```

Create `.env.local` (it's gitignored) with your Supabase project's URL and public anon key:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

The app runs without these; sign-in and sync are just unavailable.

```bash
npm run dev
```

```bash
npm test
```

```bash
npm run build
```

### Tech stack

- React + TypeScript, built with Vite
- `vite-plugin-pwa` for offline support and home-screen install
- IndexedDB through Dexie for on-device storage (the main copy)
- Supabase (Postgres + email-code sign-in) for the cloud copy
- Vitest for tests
- Hand-drawn SVG charts, no chart library

### Project layout

```
src/
  screens/   React screens: Today, Log Workout, Progress, Edit Workouts, Settings
  logic/     App rules in plain TypeScript (rotation, pre-fill, progress, backup, sync merging), unit-tested
  storage/   Dexie database and data access
  sync/      Sign-in and syncing between Dexie and Supabase
supabase/
  migrations/          SQL for the cloud database
docs/
  superpowers/specs/   Design docs
```

## Supabase setup (one time)

1. Create a free account at supabase.com and a new project.
2. In the SQL editor, run the files in `supabase/migrations/`, in order. When a new file is added later, run just that one.
3. Under **Authentication → Email Templates → Magic Link**, change the email to show the code (`{{ .Token }}`) instead of a link.
4. Copy the project URL and anon key from **Project Settings → API** into `.env.local` and into the GitHub repo's **Settings → Secrets and variables → Actions → Variables** as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

Never put the service role key in the app or the repo.

Free Supabase projects pause after 7 days with no activity. If that happens, restore the project from the Supabase dashboard. No data is lost, and the app keeps working offline in the meantime.

## Deploy

Pushing to `main` deploys to GitHub Pages through GitHub Actions. The app updates on your phone the next time you open it.

## Design

The full design (data model, behavior rules, and screens) is in [docs/superpowers/specs/2026-11-18-workout-tracker-design.md](docs/superpowers/specs/2026-11-18-workout-tracker-design.md).
