// Everything the screens call. Screens never touch Dexie tables directly.
import { todayLocal } from "../logic/clock";
import { cleanName, findExerciseByName, normalizeName } from "../logic/editing";
import { newId } from "../logic/ids";
import { nextUp } from "../logic/rotation";
import { finishSession, isRemovableSet, lastNoteFor, prefillSetAt, prefillSource, startSession } from "../logic/session";
import type { Exercise, LoggedSet, Measure, Session, Workout } from "../logic/types";
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

/**
 * Reads an in-progress session, lets `change` edit a copy, and saves it, all in one
 * transaction. Returns false to skip the write. A finished session is refused, so a
 * late tap can't rewrite history (editing past sessions gets its own path).
 */
async function mutateSession(db: WorkoutDB, sessionId: string, change: (s: Session) => boolean | void): Promise<void> {
  await db.transaction("rw", db.sessions, async () => {
    const current = await db.sessions.get(sessionId);
    if (!current || current.deleted) throw new Error("Session not found");
    if (current.status !== "in_progress") throw new Error("This workout is already finished");
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

/** Confirms or un-confirms a set from its stored state; a skipped set is restored and confirmed. Returns the new done value. */
export async function toggleSetDone(db: WorkoutDB, sessionId: string, entryIndex: number, setIndex: number): Promise<boolean> {
  let done = false;
  await mutateSession(db, sessionId, (s) => {
    const entry = entryAt(s, entryIndex);
    const set = entry.sets[setIndex];
    if (!set) throw new Error("Set not found");
    done = set.skipped ? true : !set.done;
    entry.sets[setIndex] = { ...set, done, skipped: false };
  });
  return done;
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

/** Toggles "skipped", except a blank extra set, which is removed. */
export async function skipOrRemoveSet(db: WorkoutDB, sessionId: string, entryIndex: number, setIndex: number): Promise<void> {
  await mutateSession(db, sessionId, (s) => {
    const entry = entryAt(s, entryIndex);
    const set = entry.sets[setIndex];
    if (!set) throw new Error("Set not found");
    if (set.done) return false; // un-confirm first
    if (isRemovableSet(set, setIndex, entry.planned.sets)) {
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

export type LogState = {
  session?: Session;
  exercises: Record<string, Exercise>;
  /** exerciseId → its most recent note from a finished session. */
  lastNotes: Record<string, { date: string; note: string }>;
};

export async function loadLogState(db: WorkoutDB, sessionId: string): Promise<LogState> {
  const [current, exercises, sessions] = await Promise.all([
    db.sessions.get(sessionId),
    db.exercises.toArray(),
    db.sessions.toArray().then(live),
  ]);
  const session = current && !current.deleted ? current : undefined;
  const lastNotes: LogState["lastNotes"] = {};
  for (const e of session?.entries ?? []) {
    const note = lastNoteFor(e.exerciseId, sessions.filter((s) => s.id !== sessionId));
    if (note) lastNotes[e.exerciseId] = note;
  }
  // Archived and deleted exercises stay visible here: a session may still reference them.
  return { session, exercises: Object.fromEntries(exercises.map((x) => [x.id, x])), lastNotes };
}

// ---------- Editing workouts, the rotation and exercises ----------

/**
 * The exercise with this name (ignoring case and extra spaces), or a new one.
 * An archived match comes back un-archived, so its history stays in one place.
 */
export async function getOrCreateExercise(db: WorkoutDB, name: string, measure: Measure): Promise<Exercise> {
  const clean = cleanName(name);
  if (!clean) throw new Error("Give the exercise a name");
  return db.transaction("rw", db.exercises, async () => {
    const existing = findExerciseByName(live(await db.exercises.toArray()), clean);
    if (existing) return existing.archived ? save(db.exercises, { ...existing, archived: false }) : existing;
    return save(db.exercises, { id: newId(), name: clean, measure, archived: false });
  });
}

/** Saves a workout's name and plan. In-progress and past sessions keep their own snapshots. */
export async function saveWorkout(db: WorkoutDB, workout: Omit<Workout, "updatedAt" | "dirty" | "deleted">): Promise<void> {
  await save(db.workouts, { ...workout, deleted: false });
}

/** A new, empty workout at the end of the rotation. */
export async function createWorkout(db: WorkoutDB, name: string): Promise<string> {
  return db.transaction("rw", db.workouts, db.rotation, async () => {
    const id = newId();
    await save(db.workouts, { id, name: cleanName(name) || "New workout", exercises: [] });
    await setRotation(db, [...(await rotationIds(db)), id]);
    return id;
  });
}

/** Tombstones the workout and takes it out of the rotation. Past sessions keep its name. */
export async function deleteWorkout(db: WorkoutDB, id: string): Promise<void> {
  await db.transaction("rw", db.workouts, db.rotation, async () => {
    await remove(db.workouts, id);
    const ids = await rotationIds(db);
    if (ids.includes(id)) await setRotation(db, ids.filter((x) => x !== id));
  });
}

export async function setRotation(db: WorkoutDB, workoutIds: string[]): Promise<void> {
  await save(db.rotation, { id: "rotation", workoutIds });
}

/** Renames an exercise everywhere: sessions store its id, so history follows. */
export async function renameExercise(db: WorkoutDB, id: string, name: string): Promise<void> {
  const clean = cleanName(name);
  if (!clean) throw new Error("Give the exercise a name");
  await db.transaction("rw", db.exercises, async () => {
    const all = live(await db.exercises.toArray());
    const exercise = all.find((e) => e.id === id);
    if (!exercise) throw new Error("Exercise not found");
    const clash = all.find((e) => e.id !== id && normalizeName(e.name) === normalizeName(clean));
    if (clash) throw new Error("Another exercise is already called that");
    if (exercise.name !== clean) await save(db.exercises, { ...exercise, name: clean });
  });
}

/**
 * Removes the exercise from every workout's plan. With history (any session that
 * isn't deleted, in progress included) it's archived; otherwise it's deleted.
 */
export async function deleteExercise(db: WorkoutDB, id: string): Promise<"archived" | "deleted"> {
  return db.transaction("rw", db.exercises, db.workouts, db.sessions, async () => {
    const exercise = await db.exercises.get(id);
    if (!exercise || exercise.deleted) throw new Error("Exercise not found");
    for (const w of live(await db.workouts.toArray())) {
      if (w.exercises.some((p) => p.exerciseId === id)) {
        await save(db.workouts, { ...w, exercises: w.exercises.filter((p) => p.exerciseId !== id) });
      }
    }
    const sessions = live(await db.sessions.toArray());
    if (sessions.some((s) => s.entries.some((e) => e.exerciseId === id))) {
      await save(db.exercises, { ...exercise, archived: true });
      return "archived";
    }
    await remove(db.exercises, id);
    return "deleted";
  });
}
