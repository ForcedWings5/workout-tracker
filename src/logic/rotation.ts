import type { Session } from "./types";

/**
 * The workout after the most recently finished rotation workout, wrapping
 * around. One-off sessions (no workoutId) don't count. If the latest finished
 * workout is no longer in the rotation, falls back to the first.
 */
export function nextUp(workoutIds: string[], sessions: Session[]): string | undefined {
  if (workoutIds.length === 0) return undefined;

  let latest: Session | undefined;
  for (const s of sessions) {
    if (s.deleted || s.status !== "finished" || s.workoutId === undefined) continue;
    if (!latest || s.date > latest.date || (s.date === latest.date && s.updatedAt > latest.updatedAt)) {
      latest = s;
    }
  }
  if (!latest) return workoutIds[0];

  const at = workoutIds.indexOf(latest.workoutId!);
  if (at === -1) return workoutIds[0];
  return workoutIds[(at + 1) % workoutIds.length];
}
