// DEV ONLY. Fills an empty history with made-up finished sessions so the Progress screens can be
// checked in the browser. Loaded from main.tsx only when `import.meta.env.DEV` and the URL has
// `?demo`, so production builds never include or run it. Every demo session is labelled in its note.
import { todayLocal } from "../logic/clock";
import type { LoggedSet, Session } from "../logic/types";
import type { WorkoutDB } from "./db";
import { live, save } from "./write";

export async function seedDemoHistory(db: WorkoutDB): Promise<void> {
  const sessions = live(await db.sessions.toArray());
  if (sessions.some((s) => s.status === "finished")) return;
  const [rotation, workouts, exercises] = await Promise.all([db.rotation.get("rotation"), db.workouts.toArray(), db.exercises.toArray()]);
  const order = (rotation?.workoutIds ?? []).map((id) => workouts.find((w) => w.id === id)).filter((w) => w !== undefined);
  const measure = Object.fromEntries(exercises.map((e) => [e.id, e.measure]));

  for (let k = 0; k < 12; k++) {
    const workout = order[k % order.length];
    if (!workout) return;
    const day = new Date();
    day.setDate(day.getDate() - (12 - k) * 3);
    const round = Math.floor(k / order.length);
    const entries: Session["entries"] = workout.exercises.map((p, i) => {
      const timed = measure[p.exerciseId] === "seconds";
      const sets: LoggedSet[] = Array.from({ length: p.sets }, (_, n) =>
        timed
          ? { amount: 40 + round * 5 + n, done: true }
          : { weight: 45 + i * 10 + round * 10 + n * 5, amount: (p.targetMax ?? p.targetMin) - n, done: true },
      );
      return { exerciseId: p.exerciseId, planned: { sets: p.sets, targetMin: p.targetMin, targetMax: p.targetMax, label: p.label }, sets, ...(i === 0 ? { note: "Demo history (dev only)" } : {}) };
    });
    await save(db.sessions, { id: `demo-session-${k}`, workoutId: workout.id, workoutName: workout.name, date: todayLocal(day), status: "finished", entries });
  }
}
