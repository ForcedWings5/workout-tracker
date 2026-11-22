// DEV ONLY. Fills an empty history with made-up finished sessions so the Progress screens can be
// checked in the browser. Loaded from main.tsx only when `import.meta.env.DEV` and the URL has
// `?demo`, so production builds never include or run it. Every demo session is labelled in its note.
import { nowIso, todayLocal } from "../logic/clock";
import { addDays, weekdayOf } from "../logic/schedule";
import type { LoggedSet, Session } from "../logic/types";
import type { WorkoutDB } from "./db";
import { loadSchedule } from "./repo";
import { live } from "./write";

export async function seedDemoHistory(db: WorkoutDB): Promise<void> {
  const sessions = live(await db.sessions.toArray());
  if (sessions.some((s) => s.status === "finished")) return;
  const [days, workouts, exercises] = await Promise.all([loadSchedule(db), db.workouts.toArray(), db.exercises.toArray()]);
  const byId = new Map(live(workouts).map((w) => [w.id, w]));
  const measure = Object.fromEntries(exercises.map((e) => [e.id, e.measure]));
  const today = todayLocal();
  const rounds = new Map<string, number>();

  // The last three weeks before today, each workout on the days the week schedules it.
  for (let back = 21; back >= 1; back--) {
    const date = addDays(today, -back);
    const workout = byId.get(days[weekdayOf(date)] ?? "");
    if (!workout) continue;
    const round = rounds.get(workout.id) ?? 0;
    rounds.set(workout.id, round + 1);
    const entries: Session["entries"] = workout.exercises.map((p, i) => {
      const timed = measure[p.exerciseId] === "seconds";
      const sets: LoggedSet[] = Array.from({ length: p.sets }, (_, n) =>
        timed
          ? { amount: 40 + round * 5 + n, done: true }
          : { weight: 45 + i * 10 + round * 10 + n * 5, amount: (p.targetMax ?? p.targetMin) - n, done: true },
      );
      return { exerciseId: p.exerciseId, planned: { sets: p.sets, targetMin: p.targetMin, targetMax: p.targetMax, label: p.label }, sets, ...(i === 0 ? { note: "Demo history (dev only)" } : {}) };
    });
    // Written clean, like seed rows, so sync never pushes made-up history to the cloud
    // (the sync runner also skips "demo-" ids). Direct put on purpose: save() would mark it dirty.
    await db.sessions.put({ id: `demo-session-${date}`, workoutId: workout.id, workoutName: workout.name, date, status: "finished", entries, updatedAt: nowIso(), deleted: false, dirty: 0 });
  }
}
