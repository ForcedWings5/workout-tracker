import type { Exercise, LoggedSet, Session } from "./types";

export type ProgressMetric = "weight" | "reps" | "seconds";

export type ProgressPoint = {
  sessionId: string;
  date: string;
  /** The heaviest weight, or the best reps or seconds, over the session's done sets. */
  value: number;
  /** The set that gave the value. */
  weight?: number;
  amount?: number;
  /** Strictly beats every earlier point. The first point never is. */
  isRecord: boolean;
};

const counted = (s: Session) => !s.deleted && s.status === "finished";
const weighted = (set: LoggedSet) => set.weight !== undefined && set.weight > 0;

/** Done sets of one exercise in one session. */
function doneSets(session: Session, exerciseId: string): LoggedSet[] {
  return session.entries.filter((e) => e.exerciseId === exerciseId).flatMap((e) => e.sets.filter((s) => s.done));
}

/** Weight if the exercise has ever been done with a weight, otherwise its own measure. */
function metricFor(exercise: Exercise, sets: LoggedSet[]): ProgressMetric {
  return sets.some(weighted) ? "weight" : exercise.measure;
}

/** The value a set scores under a metric, or undefined if it doesn't count (no weight on a weight chart). */
function valueOf(set: LoggedSet, metric: ProgressMetric): number | undefined {
  if (metric === "weight") return weighted(set) ? set.weight : undefined;
  return set.amount;
}

/** The best set under the metric. Ties on weight go to more reps or seconds. */
function bestSet(sets: LoggedSet[], metric: ProgressMetric): { set: LoggedSet; value: number } | undefined {
  let best: { set: LoggedSet; value: number } | undefined;
  for (const set of sets) {
    const value = valueOf(set, metric);
    if (value === undefined) continue;
    if (!best || value > best.value || (value === best.value && (set.amount ?? 0) > (best.set.amount ?? 0))) best = { set, value };
  }
  return best;
}

/** One point per finished session that has the exercise, oldest first. */
export function progressSeries(exercise: Exercise, sessions: Session[]): { metric: ProgressMetric; points: ProgressPoint[] } {
  const history = sessions
    .filter(counted)
    .map((session) => ({ session, sets: doneSets(session, exercise.id) }))
    .filter((h) => h.sets.length > 0)
    .sort((a, b) => a.session.date.localeCompare(b.session.date) || a.session.updatedAt.localeCompare(b.session.updatedAt));
  const metric = metricFor(exercise, history.flatMap((h) => h.sets));

  const points: ProgressPoint[] = [];
  let top: number | undefined;
  for (const { session, sets } of history) {
    const best = bestSet(sets, metric);
    if (!best) continue;
    points.push({
      sessionId: session.id,
      date: session.date,
      value: best.value,
      weight: best.set.weight,
      amount: best.set.amount,
      isRecord: top !== undefined && best.value > top,
    });
    top = top === undefined ? best.value : Math.max(top, best.value);
  }
  return { metric, points };
}

/**
 * Whether a done set beats every earlier done set of the exercise. `history` is the sessions
 * before it; with none, nothing is a record.
 */
export function isRecordSet(exercise: Exercise, set: LoggedSet, history: Session[]): boolean {
  if (!set.done) return false;
  const { metric, points } = progressSeries(exercise, history);
  if (points.length === 0) return false;
  const value = valueOf(set, metric);
  return value !== undefined && value > Math.max(...points.map((p) => p.value));
}

/** Exercises with at least one done set in a finished session, most recently done first. */
export function exercisesByRecency(exercises: Exercise[], sessions: Session[]): { exercise: Exercise; lastDate: string }[] {
  const last = new Map<string, string>();
  for (const session of sessions.filter(counted)) {
    for (const e of session.entries) {
      if (!e.sets.some((s) => s.done)) continue;
      const seen = last.get(e.exerciseId);
      if (!seen || session.date > seen) last.set(e.exerciseId, session.date);
    }
  }
  return exercises
    .filter((x) => !x.deleted && last.has(x.id))
    .map((exercise) => ({ exercise, lastDate: last.get(exercise.id)! }))
    .sort((a, b) => b.lastDate.localeCompare(a.lastDate) || a.exercise.name.localeCompare(b.exercise.name));
}

/**
 * Keys ("entryIndex:setIndex") of the done sets in `session` that are records: each beats every
 * earlier done set of its exercise, from sessions on earlier dates and from earlier sets that day.
 * An in-progress session counts every finished session as earlier.
 */
export function recordSets(session: Session, exercises: Record<string, Exercise>, sessions: Session[]): Set<string> {
  const earlier = sessions.filter(
    (s) => s.id !== session.id && counted(s) && (session.status === "in_progress" || s.date < session.date),
  );
  const records = new Set<string>();
  const sameDay: { exerciseId: string; set: LoggedSet }[] = [];
  session.entries.forEach((e, ei) => {
    const exercise = exercises[e.exerciseId];
    e.sets.forEach((set, si) => {
      // The first session of an exercise sets the bar; nothing in it is a record (like the chart's first point).
      if (exercise && set.done && progressSeries(exercise, earlier).points.length > 0) {
        const before = sameDay.filter((x) => x.exerciseId === e.exerciseId).map((x) => x.set);
        const history = before.length
          ? [...earlier, { ...session, id: `${session.id}:before`, status: "finished" as const, entries: [{ ...e, sets: before }] }]
          : earlier;
        if (isRecordSet(exercise, set, history)) records.add(`${ei}:${si}`);
        sameDay.push({ exerciseId: e.exerciseId, set });
      }
    });
  });
  return records;
}
