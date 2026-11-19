import { newId } from "./ids";
import type { LoggedSet, Session, SessionEntry, Workout } from "./types";

type NewSession = Omit<Session, "updatedAt" | "dirty" | "deleted">;

/** Finished, non-deleted sessions, newest first (by date, then updatedAt). */
function finishedNewestFirst(history: Session[]): Session[] {
  return history
    .filter((s) => !s.deleted && s.status === "finished")
    .sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : a.updatedAt < b.updatedAt ? 1 : -1));
}

function doneSetsOf(s: Session, exerciseId: string): LoggedSet[] | undefined {
  for (const e of s.entries) {
    if (e.exerciseId !== exerciseId) continue;
    const doneSets = e.sets.filter((set) => set.done && !set.skipped);
    if (doneSets.length > 0) return doneSets;
  }
  return undefined;
}

/** The done sets to copy from: the same workout's last session first, then any workout's. */
export function prefillSource(exerciseId: string, workoutId: string | undefined, history: Session[]): LoggedSet[] | undefined {
  const sessions = finishedNewestFirst(history);
  if (workoutId !== undefined) {
    for (const s of sessions) {
      if (s.workoutId !== workoutId) continue;
      const sets = doneSetsOf(s, exerciseId);
      if (sets) return sets;
    }
  }
  for (const s of sessions) {
    const sets = doneSetsOf(s, exerciseId);
    if (sets) return sets;
  }
  return undefined;
}

/** Set n is copied from the source's done set n; extra sets copy its last done set. */
export function prefillSetAt(source: LoggedSet[] | undefined, index: number): LoggedSet {
  if (!source) return { done: false };
  const from = source[Math.min(index, source.length - 1)];
  return { weight: from.weight, amount: from.amount, done: false };
}

export function prefillSets(exerciseId: string, workoutId: string | undefined, setCount: number, history: Session[]): LoggedSet[] {
  const source = prefillSource(exerciseId, workoutId, history);
  return Array.from({ length: setCount }, (_, i) => prefillSetAt(source, i));
}

export function startSession(workout: Workout, history: Session[], date: string): NewSession {
  const entries: SessionEntry[] = workout.exercises.map(({ exerciseId, ...planned }) => ({
    exerciseId,
    planned: { ...planned },
    sets: prefillSets(exerciseId, workout.id, planned.sets, history),
  }));
  return {
    id: newId(),
    workoutId: workout.id,
    workoutName: workout.name,
    date,
    status: "in_progress",
    entries,
  };
}

/** The most recent note for the exercise from any finished session. */
export function lastNoteFor(exerciseId: string, history: Session[]): { date: string; note: string } | undefined {
  for (const s of finishedNewestFirst(history)) {
    for (const e of s.entries) {
      const note = e.note?.trim();
      if (e.exerciseId === exerciseId && note) return { date: s.date, note };
    }
  }
  return undefined;
}

/**
 * Keeps only done, unskipped sets and drops exercises left with none.
 * Returns null when nothing was done, so the caller can offer to discard.
 */
export function finishSession(session: Session): Session | null {
  const entries = session.entries
    .map((e) => ({ ...e, planned: { ...e.planned }, sets: e.sets.filter((s) => s.done && !s.skipped).map((s) => ({ ...s })) }))
    .filter((e) => e.sets.length > 0);
  if (entries.length === 0) return null;
  return { ...session, status: "finished", entries };
}

/** "2 of 14 sets": done sets out of every set that isn't skipped. */
export function sessionProgress(session: Session): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const e of session.entries) {
    for (const s of e.sets) {
      if (s.skipped) continue;
      total += 1;
      if (s.done) done += 1;
    }
  }
  return { done, total };
}

/** True for a blank set added with "+ Set" beyond the plan: removing it loses nothing. */
export function isRemovableSet(set: LoggedSet, setIndex: number, plannedSets: number): boolean {
  return setIndex >= plannedSets && set.weight === undefined && set.amount === undefined && !set.done;
}
