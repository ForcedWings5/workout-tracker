// Everything the screens call. Screens never touch Dexie tables directly.
import { isLocalDate, todayLocal } from "../logic/clock";
import { cleanName, findExerciseByName, normalizeName } from "../logic/editing";
import { newId } from "../logic/ids";
import { exercisesByRecency, progressSeries, type ProgressMetric, type ProgressPoint } from "../logic/progress";
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

/** Which kind of session a write is for: the live workout, or a past one opened from history. */
export type SessionStatus = Session["status"];

/**
 * Reads a session, lets `change` edit a copy, and saves it, all in one transaction. Returns
 * false to skip the write. The session must be in the state the screen expects: the live
 * screen can't write to a finished session (a late tap can't rewrite history), and a past
 * session opened from history can't write to one still in progress.
 */
async function mutateSession(
  db: WorkoutDB,
  sessionId: string,
  change: (s: Session) => boolean | void,
  expected: SessionStatus = "in_progress",
): Promise<void> {
  await db.transaction("rw", db.sessions, async () => {
    const current = await db.sessions.get(sessionId);
    if (!current || current.deleted) throw new Error("Session not found");
    if (current.status !== expected) {
      throw new Error(expected === "in_progress" ? "This workout is already finished" : "This workout is still in progress");
    }
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
  status: SessionStatus = "in_progress",
): Promise<void> {
  await mutateSession(db, sessionId, (s) => {
    const entry = entryAt(s, entryIndex);
    const set = entry.sets[setIndex];
    if (!set) throw new Error("Set not found");
    entry.sets[setIndex] = { ...set, ...patch };
  }, status);
}

/** Confirms or un-confirms a set from its stored state; a skipped set is restored and confirmed. Returns the new done value. */
export async function toggleSetDone(db: WorkoutDB, sessionId: string, entryIndex: number, setIndex: number, status: SessionStatus = "in_progress"): Promise<boolean> {
  let done = false;
  await mutateSession(db, sessionId, (s) => {
    const entry = entryAt(s, entryIndex);
    const set = entry.sets[setIndex];
    if (!set) throw new Error("Set not found");
    done = set.skipped ? true : !set.done;
    entry.sets[setIndex] = { ...set, done, skipped: false };
  }, status);
  return done;
}

/** Adds a set, pre-filled the same way the session's sets were. */
export async function addSet(db: WorkoutDB, sessionId: string, entryIndex: number, status: SessionStatus = "in_progress"): Promise<void> {
  const history = live(await db.sessions.toArray());
  await mutateSession(db, sessionId, (s) => {
    const entry = entryAt(s, entryIndex);
    const source = prefillSource(entry.exerciseId, s.workoutId, history);
    entry.sets.push(prefillSetAt(source, entry.sets.length));
  }, status);
}

/** Toggles "skipped", except a blank extra set, which is removed. */
export async function skipOrRemoveSet(db: WorkoutDB, sessionId: string, entryIndex: number, setIndex: number, status: SessionStatus = "in_progress"): Promise<void> {
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
  }, status);
}

/** The entry at `entryIndex`, refused if it isn't the exercise the screen showed there. */
function expectedEntry(s: Session, entryIndex: number, exerciseId: string) {
  const entry = entryAt(s, entryIndex);
  if (entry.exerciseId !== exerciseId) throw new Error("Exercise not found in session");
  return entry;
}

/** Deletes one set from today's session, done or not. The workout is never touched. */
export async function deleteSessionSet(db: WorkoutDB, sessionId: string, entryIndex: number, setIndex: number, exerciseId: string, status: SessionStatus = "in_progress"): Promise<void> {
  await mutateSession(db, sessionId, (s) => {
    const entry = expectedEntry(s, entryIndex, exerciseId);
    if (!entry.sets[setIndex]) throw new Error("Set not found");
    entry.sets.splice(setIndex, 1);
  }, status);
}

/** Removes an exercise and its sets from today's session only. */
export async function removeSessionEntry(db: WorkoutDB, sessionId: string, entryIndex: number, exerciseId: string, status: SessionStatus = "in_progress"): Promise<void> {
  await mutateSession(db, sessionId, (s) => {
    expectedEntry(s, entryIndex, exerciseId);
    s.entries.splice(entryIndex, 1);
  }, status);
}

export async function setNote(db: WorkoutDB, sessionId: string, entryIndex: number, note: string, status: SessionStatus = "in_progress"): Promise<void> {
  await mutateSession(db, sessionId, (s) => {
    const entry = entryAt(s, entryIndex);
    const trimmed = note.trim();
    if (trimmed) entry.note = note;
    else delete entry.note;
  }, status);
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

/** Moves a past session to another day. Refuses anything that isn't a real YYYY-MM-DD date. */
export async function setSessionDate(db: WorkoutDB, sessionId: string, date: string): Promise<void> {
  if (!isLocalDate(date)) throw new Error("Pick a date");
  await mutateSession(db, sessionId, (s) => void (s.date = date), "finished");
}

/** Deletes a past session. A tombstone, so the delete syncs. */
export async function deleteSession(db: WorkoutDB, sessionId: string): Promise<void> {
  await remove(db.sessions, sessionId);
}

export type LogState = {
  session?: Session;
  exercises: Record<string, Exercise>;
  /** exerciseId → its most recent note from a finished session. */
  lastNotes: Record<string, { date: string; note: string }>;
  /** Every session that isn't deleted, for working out records. */
  sessions: Session[];
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
  return { session, exercises: Object.fromEntries(exercises.map((x) => [x.id, x])), lastNotes, sessions };
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

/** Reads the stored workout, lets `change` edit a copy, and saves it, in one step. */
export async function patchWorkout(db: WorkoutDB, id: string, change: (w: Workout) => void): Promise<void> {
  await db.transaction("rw", db.workouts, async () => {
    const current = await db.workouts.get(id);
    if (!current || current.deleted) throw new Error("Workout not found");
    const copy = structuredClone(current);
    change(copy);
    await save(db.workouts, copy);
  });
}

/** Measure belongs to the exercise, so this changes it in every workout. */
export async function setExerciseMeasure(db: WorkoutDB, id: string, measure: Measure): Promise<void> {
  await db.transaction("rw", db.exercises, async () => {
    const exercise = await db.exercises.get(id);
    if (!exercise || exercise.deleted) throw new Error("Exercise not found");
    if (exercise.measure !== measure) await save(db.exercises, { ...exercise, measure });
  });
}

export type WorkoutList = { workouts: Workout[]; rotationIds: string[] };

/** Workouts in rotation order, then any outside it. */
export async function loadWorkoutList(db: WorkoutDB): Promise<WorkoutList> {
  const [{ workouts }, ids] = await Promise.all([loadTodayState(db), rotationIds(db)]);
  return { workouts, rotationIds: ids.filter((id) => workouts.some((w) => w.id === id)) };
}

export type EditWorkoutState = { workout?: Workout; exercises: Record<string, Exercise> };

export async function loadEditWorkout(db: WorkoutDB, id: string): Promise<EditWorkoutState> {
  const [workout, exercises] = await Promise.all([db.workouts.get(id), db.exercises.toArray()]);
  return {
    workout: workout && !workout.deleted ? workout : undefined,
    exercises: Object.fromEntries(exercises.map((x) => [x.id, x])),
  };
}

// ---------- One-off workouts and the exercise picker ----------

/** A one-off workout: no workoutId, so it never moves next up. */
export async function startEmptyWorkout(db: WorkoutDB): Promise<string> {
  return db.transaction("rw", db.sessions, async () => {
    const sessions = live(await db.sessions.toArray());
    if (sessions.some((s) => s.status === "in_progress")) throw new Error("A workout is already in progress");
    const created = await save(db.sessions, {
      id: newId(),
      workoutName: "Workout",
      date: todayLocal(),
      status: "in_progress",
      entries: [],
    });
    return created.id;
  });
}

/** Adds an exercise to this session only, with one set pre-filled from last time. */
export async function addExerciseToSession(db: WorkoutDB, sessionId: string, exerciseId: string, status: SessionStatus = "in_progress"): Promise<void> {
  const history = live(await db.sessions.toArray());
  await mutateSession(db, sessionId, (s) => {
    const source = prefillSource(exerciseId, s.workoutId, history);
    s.entries.push({ exerciseId, planned: { sets: 1, targetMin: 0 }, sets: [prefillSetAt(source, 0)] });
  }, status);
}

export async function renameSession(db: WorkoutDB, sessionId: string, name: string, status: SessionStatus = "in_progress"): Promise<void> {
  const clean = cleanName(name);
  if (!clean) throw new Error("Give the workout a name");
  await mutateSession(db, sessionId, (s) => {
    s.workoutName = clean;
  }, status);
}

/** Exercises the picker offers: not deleted, not archived, by name. */
export async function loadExercises(db: WorkoutDB): Promise<Exercise[]> {
  return live(await db.exercises.toArray())
    .filter((e) => !e.archived)
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ---------- Progress ----------

/** Exercises with finished sets, most recently done first. */
export async function loadProgressList(db: WorkoutDB): Promise<{ exercise: Exercise; lastDate: string }[]> {
  const [exercises, sessions] = await Promise.all([db.exercises.toArray(), db.sessions.toArray()]);
  return exercisesByRecency(live(exercises), live(sessions));
}

export type ExerciseHistoryState = {
  exercise?: Exercise;
  metric: ProgressMetric;
  points: ProgressPoint[];
  /** Finished sessions with done sets of this exercise, newest first. */
  sessions: { id: string; date: string; sets: LoggedSet[]; note?: string }[];
};

export async function loadExerciseHistory(db: WorkoutDB, exerciseId: string): Promise<ExerciseHistoryState> {
  const [found, all] = await Promise.all([db.exercises.get(exerciseId), db.sessions.toArray()]);
  const exercise = found && !found.deleted ? found : undefined;
  if (!exercise) return { metric: "reps", points: [], sessions: [] };
  const finished = live(all).filter((s) => s.status === "finished");
  const { metric, points } = progressSeries(exercise, finished);
  const sessions = finished
    .map((s) => {
      const entries = s.entries.filter((e) => e.exerciseId === exerciseId);
      return {
        id: s.id,
        date: s.date,
        updatedAt: s.updatedAt,
        sets: entries.flatMap((e) => e.sets.filter((set) => set.done)),
        note: entries.find((e) => e.note?.trim())?.note,
      };
    })
    .filter((s) => s.sets.length > 0)
    .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt))
    .map(({ updatedAt: _, ...rest }) => rest);
  return { exercise, metric, points, sessions };
}
