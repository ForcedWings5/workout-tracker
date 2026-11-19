/** The oldest possible timestamp. Seed rows use it so real cloud rows always win. */
export const EPOCH = "1970-01-01T00:00:00.000Z";

export function nowIso(): string {
  return new Date().toISOString();
}

/** The phone's local calendar date as YYYY-MM-DD (not the UTC date). */
export function todayLocal(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** "2026-11-12" → "11/12" (US month/day). */
export function shortDate(date: string): string {
  const [, m, d] = date.split("-");
  return `${Number(m)}/${Number(d)}`;
}
