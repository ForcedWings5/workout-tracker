import type { LoggedSet, Measure, PlannedExercise } from "./types";

type Planned = Omit<PlannedExercise, "exerciseId">;

export const unitFor = (measure: Measure) => (measure === "seconds" ? "sec" : "reps");

/** The range a blank set shows as a hint: "6–10" or "45". None for an exercise added mid-session. */
export function targetHint(planned: Pick<Planned, "targetMin" | "targetMax">): string | undefined {
  if (planned.targetMax !== undefined) return `${planned.targetMin}–${planned.targetMax}`;
  return planned.targetMin > 0 ? `${planned.targetMin}` : undefined;
}

/** "4 × 6–10", "2 × 45 sec", "2 × 8–12 per leg". Empty for an exercise added mid-session, which has no target. */
export function formatTarget(planned: Planned, measure: Measure): string {
  const range = targetHint(planned);
  if (range === undefined) return "";
  const unit = measure === "seconds" ? " sec" : "";
  const label = planned.label ? ` ${planned.label}` : "";
  return `${planned.sets} × ${range}${unit}${label}`;
}

/** The mark box's accessible name: "Set 3: 85 lb, 8 reps, not done". */
export function setLabel(index: number, set: LoggedSet, measure: Measure): string {
  const unit = unitFor(measure);
  const weight = set.weight !== undefined ? `${set.weight} lb` : "bodyweight";
  const amount = set.amount !== undefined ? `${set.amount} ${unit}` : `no ${unit}`;
  const state = set.done ? "done" : set.skipped ? "skipped" : "not done";
  return `Set ${index + 1}: ${weight}, ${amount}, ${state}`;
}

/** What a delete confirmation names: "135 lb × 8 reps", "Bodyweight × 45 sec", or just "135 lb" with no amount. */
export function describeSet(set: LoggedSet, measure: Measure): string {
  const weight = set.weight !== undefined ? `${set.weight} lb` : "Bodyweight";
  return set.amount !== undefined ? `${weight} × ${set.amount} ${unitFor(measure)}` : weight;
}

/** A set in a history row: "65×10", "12" (bodyweight reps), "45s", "25×30s". */
export function shortSet(set: LoggedSet, measure: Measure): string {
  const amount = set.amount === undefined ? "–" : `${set.amount}${measure === "seconds" ? "s" : ""}`;
  return set.weight !== undefined && set.weight > 0 ? `${set.weight}×${amount}` : amount;
}

/** "32:14", or "1:02:03" past an hour. */
export function formatElapsed(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** Width of a timed set's hold bar: seconds held as a share of the target, capped at 100. */
export function holdPercent(seconds: number | undefined, target: Pick<Planned, "targetMin" | "targetMax">): number {
  const goal = target.targetMax ?? target.targetMin;
  if (!seconds || goal <= 0) return 0;
  return Math.min(100, (seconds / goal) * 100);
}
