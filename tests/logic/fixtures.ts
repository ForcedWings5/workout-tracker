import type { LoggedSet, Session, SessionEntry } from "../../src/logic/types";

let n = 0;

/** A finished session with sensible defaults; override anything. */
export function session(over: Partial<Session> = {}): Session {
  n += 1;
  return {
    id: `s-${n}`,
    workoutId: "A",
    workoutName: "A",
    date: "2026-11-10",
    status: "finished",
    entries: [],
    updatedAt: `2026-11-10T12:00:${String(n % 60).padStart(2, "0")}.000Z`,
    dirty: 0,
    deleted: false,
    ...over,
  };
}

export function entry(exerciseId: string, sets: LoggedSet[], over: Partial<SessionEntry> = {}): SessionEntry {
  return { exerciseId, planned: { sets: sets.length, targetMin: 8, targetMax: 12 }, sets, ...over };
}

export const done = (weight: number | undefined, amount: number): LoggedSet => ({ weight, amount, done: true });
