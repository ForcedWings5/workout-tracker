// Everything the screens call. Screens never touch Dexie tables directly.
import { todayLocal } from "../logic/clock";
import { nextUp } from "../logic/rotation";
import { finishSession, prefillSetAt, prefillSource, startSession } from "../logic/session";
import type { LoggedSet, Session, Workout } from "../logic/types";
import type { WorkoutDB } from "./db";
import { live, remove, save } from "./write";

export type TodayState = {
  nextUpId?: string;
  /** Rotation order first, then any workouts not in the rotation. */
  workouts: Workout[];
  inProgress?: Session;
  /** workoutId → date of its latest finished session. */
  lastDateByWorkout: Record<string, string>;
};

async function rotationIds(db: WorkoutDB): Promise<string[]> {
  const rotation = await db.rotation.get("rotation");
  return rotation && !rotation.deleted ? rotation.workoutIds : [];
}

export async function loadTodayState(db: WorkoutDB): Promise<TodayState> {
  const [ids, allWorkouts, sessions] = await Promise.all([
    rotationIds(db),
    db.workouts.toArray().then(live),
    db.sessions.toArray().then(live),
  ]);
  const byId = new Map(allWorkouts.map((w) => [w.id, w]));
  const inRotation = ids.filter((id) => byId.has(id));
  const rest = allWorkouts.filter((w) => !inRotation.includes(w.id)).sort((a, b) => a.name.localeCompare(b.name));
  const workouts = [...inRotation.map((id) => byId.get(id)!), ...rest];

  const lastDateByWorkout: Record<string, string> = {};
  for (const s of sessions) {
    if (s.status !== "finished" || !s.workoutId) continue;
    const prev = lastDateByWorkout[s.workoutId];
    if (!prev || s.date > prev) lastDateByWorkout[s.workoutId] = s.date;
  }

  return {
    nextUpId: nextUp(inRotation, sessions),
    workouts,
    inProgress: sessions.find((s) => s.status === "in_progress"),
    lastDateByWorkout,
  };
}

export async function startWorkout(db: WorkoutDB, workoutId: string): Promise<string> {
  return db.transaction("rw", db.sessions, db.workouts, async () => {
    const sessions = live(await db.sessions.toArray());
    if (sessions.some((s) => s.status === "in_progress")) throw new Error("A workout is already in progress");
    const workout = await db.workouts.get(workoutId);
    if (!workout || workout.deleted) throw new Error("Workout not found");
    const created = await save(db.sessions, startSession(workout, sessions, todayLocal()));
    return created.id;
  });
}

/** Reads a session, lets `change` edit a copy, and saves it. Returns false to skip the write. */
async function mutateSession(db: WorkoutDB, sessionId: string, change: (s: Session) => boolean | void): Promise<void> {
  await db.transaction("rw", db.sessions, async () => {
    const current = await db.sessions.get(sessionId);
    if (!current || current.deleted) throw new Error("Session not found");
    const copy = structuredClone(current);
    if (change(copy) === false) return;
    await save(db.sessions, copy);
  });
}

function entryAt(s: Session, entryIndex: number) {
  const entry = s.entries[entryIndex];
  if (!entry) throw new Error("Exercise not found in session");
  return entry;
}

export async function updateSet(
  db: WorkoutDB,
  sessionId: string,
  entryIndex: number,
  setIndex: number,
  patch: Partial<LoggedSet>,
): Promise<void> {
  await mutateSession(db, sessionId, (s) => {
    const entry = entryAt(s, entryIndex);
    const set = entry.sets[setIndex];
    if (!set) throw new Error("Set not found");
    entry.sets[setIndex] = { ...set, ...patch };
  });
}

/** Adds a set, pre-filled the same way the session's sets were. */
export async function addSet(db: WorkoutDB, sessionId: string, entryIndex: number): Promise<void> {
  const history = live(await db.sessions.toArray());
  await mutateSession(db, sessionId, (s) => {
    const entry = entryAt(s, entryIndex);
    const source = prefillSource(entry.exerciseId, s.workoutId, history);
    entry.sets.push(prefillSetAt(source, entry.sets.length));
  });
}

/** A set with values toggles "skipped"; a blank set is removed. */
export async function skipOrRemoveSet(db: WorkoutDB, sessionId: string, entryIndex: number, setIndex: number): Promise<void> {
  await mutateSession(db, sessionId, (s) => {
    const entry = entryAt(s, entryIndex);
    const set = entry.sets[setIndex];
    if (!set) throw new Error("Set not found");
    if (set.weight === undefined && set.amount === undefined) {
      entry.sets.splice(setIndex, 1);
    } else {
      const skipped = !set.skipped;
      entry.sets[setIndex] = { ...set, skipped, done: skipped ? false : set.done };
    }
  });
}

export async function setNote(db: WorkoutDB, sessionId: string, entryIndex: number, note: string): Promise<void> {
  await mutateSession(db, sessionId, (s) => {
    const entry = entryAt(s, entryIndex);
    const trimmed = note.trim();
    if (trimmed) entry.note = note;
    else delete entry.note;
  });
}

/** "empty" means no set was done; nothing is written, so the user can choose to discard. */
export async function finishWorkout(db: WorkoutDB, sessionId: string): Promise<"finished" | "empty"> {
  let result: "finished" | "empty" = "empty";
  await mutateSession(db, sessionId, (s) => {
    const finished = finishSession(s);
    if (!finished) return false;
    Object.assign(s, finished);
    result = "finished";
  });
  return result;
}

export async function discardWorkout(db: WorkoutDB, sessionId: string): Promise<void> {
  await remove(db.sessions, sessionId);
}
