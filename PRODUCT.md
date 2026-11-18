# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React + TypeScript built with Vite, `vite-plugin-pwa`, Dexie (IndexedDB), Supabase for sign-in and cloud sync, hosted on GitHub Pages. Chosen with the user during the design discussion; see `docs/superpowers/specs/2026-11-18-workout-tracker-design.md`.

## Users

One person: the owner, who trains on a fixed Upper A → Lower A → Upper B → Lower B rotation with rest days between. They use the app on an iPhone 14 Pro (393 × 852 CSS px viewport, Dynamic Island), installed to the home screen, standing in a gym between sets, often one-handed, with a timer running in their head.

## Product Purpose

Workout Tracker replaces logging workouts in iPhone Notes, where every session meant copying last time's table, pasting it, and editing numbers in a clumsy table. Success: logging a workout is faster and less fiddly than Notes, history is never lost, and over time the owner can see whether they're getting stronger.

## Positioning

A personal tool built around one person's actual rotation, not a general fitness app. Its core move: each set opens pre-filled with last time's numbers, so logging is mostly confirming, and the note from last time ("form shaky, maybe reduce weight") appears exactly when that exercise comes up again.

## Operating Context

- Used mid-workout: glance, adjust a number, tap ✓, put the phone down. Sessions last about an hour, with one interaction per set.
- Gym signal can be poor; the app works fully offline and syncs when it can.
- Targets are written as sets × rep range (4 × 6–10), plus timed holds (2 × 45 sec) and per-leg work.
- Weights are in pounds.

## Capabilities and Constraints

- Screens: Today (next up), Log Workout, Progress (per-exercise chart and history), Edit Workouts, Settings (cloud backup, backup file).
- Only sets marked done count. Pre-filled values are suggestions until confirmed.
- Every change autosaves; there are no save buttons.
- Sign-in is optional, uses a 6-digit email code, and nudges without blocking.
- No accounts beyond the owner's, no social features, no gamification.

## Brand Commitments

- Name: **Workout Tracker**.

## Evidence on Hand

- The owner's four real workouts (exercises, targets, order) are in the design doc's Seed data section. They're the real content for every screen.
- No logged history exists yet; the owner chose to start fresh. Demo history for design work must be labeled synthetic.

## Product Principles

1. **Faster than Notes, or it failed.** Every interaction on the logging screen is measured against copying and editing a note.
2. **Confirm, don't type.** The default action for a set is accepting what's pre-filled.
3. **Never lose a rep.** Data safety beats everything: autosave, offline-first, cloud backup.
4. **The owner's plan, not a generic program.** The rotation, targets, and wording are theirs.

## Accessibility & Inclusion

Standard contrast is fine (owner confirmed). Tap targets must work one-handed with sweaty thumbs. Layout is sized for the iPhone 14 Pro and must respect its safe areas.
