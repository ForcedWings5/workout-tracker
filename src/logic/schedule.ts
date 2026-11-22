// The weekly schedule: which workout belongs to which weekday, and what Today should show.
// Dates are local YYYY-MM-DD strings; Date objects are built from their parts so a UTC
// offset or the clock change can never shift a weekday. The week starts on Monday (index 0).
import type { Session } from "./types";

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

function parts(date: string): [number, number, number] {
  const [y, m, d] = date.split("-").map(Number);
  return [y, m, d];
}

function fromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Monday is 0, Sunday is 6. */
export function weekdayOf(date: string): number {
  const [y, m, d] = parts(date);
  return (new Date(y, m - 1, d).getDay() + 6) % 7;
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = parts(date);
  return fromDate(new Date(y, m - 1, d + n));
}

/** The Monday on or before `date`. */
export function weekStartOf(date: string): string {
  return addDays(date, -weekdayOf(date));
}

export type TodayPlan = {
  weekday: number;
  /** Today's scheduled workout; absent on a rest day. */
  today?: { workoutId: string; status: "todo" | "doneToday" | "doneThisWeek"; doneOn?: string };
  /** The next scheduled workout after today, up to a week ahead. */
  next?: { workoutId: string; date: string };
  /** Scheduled days earlier this week whose workout hasn't been done this week, earliest first. */
  missed: { workoutId: string; date: string }[];
};

/**
 * What Today shows. A workout counts as done if a finished session of it is dated any day from
 * this Monday up to today (catching up counts). A workout scheduled on several days needs one
 * session per day, matched to those days in order.
 */
export function todayPlan(days: (string | null)[], liveWorkoutIds: string[], sessions: Session[], today: string): TodayPlan {
  const live = new Set(liveWorkoutIds);
  const at = (weekday: number) => {
    const id = days[weekday];
    return id && live.has(id) ? id : undefined;
  };
  const weekday = weekdayOf(today);
  const monday = weekStartOf(today);

  // Finished sessions this week, per workout, oldest first.
  const doneDates = new Map<string, string[]>();
  for (const s of sessions) {
    if (s.deleted || s.status !== "finished" || !s.workoutId || s.date < monday || s.date > today) continue;
    doneDates.set(s.workoutId, [...(doneDates.get(s.workoutId) ?? []), s.date]);
  }
  for (const dates of doneDates.values()) dates.sort();

  // Match each workout's scheduled days (Monday up to today) to its sessions, in order.
  const covered = new Map<number, string>(); // weekday → date of the session that covers it
  const seen = new Map<string, number>();
  for (let w = 0; w <= weekday; w++) {
    const id = at(w);
    if (!id) continue;
    const k = seen.get(id) ?? 0;
    seen.set(id, k + 1);
    const date = doneDates.get(id)?.[k];
    if (date) covered.set(w, date);
  }

  const missed: TodayPlan["missed"] = [];
  for (let w = 0; w < weekday; w++) {
    const id = at(w);
    if (id && !covered.has(w)) missed.push({ workoutId: id, date: addDays(monday, w) });
  }

  let todayPart: TodayPlan["today"];
  const todayId = at(weekday);
  if (todayId) {
    const doneToday = (doneDates.get(todayId) ?? []).includes(today);
    const cover = covered.get(weekday);
    todayPart = doneToday
      ? { workoutId: todayId, status: "doneToday" }
      : cover
        ? { workoutId: todayId, status: "doneThisWeek", doneOn: cover }
        : { workoutId: todayId, status: "todo" };
  }

  let next: TodayPlan["next"];
  for (let i = 1; i <= 7 && !next; i++) {
    const id = at((weekday + i) % 7);
    if (id) next = { workoutId: id, date: addDays(today, i) };
  }

  return { weekday, ...(todayPart ? { today: todayPart } : {}), ...(next ? { next } : {}), missed };
}

/** Rotation order onto Monday, Tuesday, Thursday, Friday, then Wednesday, Saturday, Sunday. Used when upgrading and for old backups. */
export function scheduleFromRotation(rotationIds: string[], liveWorkoutIds: string[]): (string | null)[] {
  const live = new Set(liveWorkoutIds);
  const order = [0, 1, 3, 4, 2, 5, 6];
  const days: (string | null)[] = [null, null, null, null, null, null, null];
  rotationIds.filter((id) => live.has(id)).slice(0, 7).forEach((id, i) => (days[order[i]] = id));
  return days;
}

/** Weeks of seven dates for a month (1–12), Monday first, null outside the month. */
export function monthGrid(year: number, month: number): (string | null)[][] {
  const first = `${year}-${String(month).padStart(2, "0")}-01`;
  const length = new Date(year, month, 0).getDate();
  const cells: (string | null)[] = Array(weekdayOf(first)).fill(null);
  for (let d = 0; d < length; d++) cells.push(addDays(first, d));
  while (cells.length % 7) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
