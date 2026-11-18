/**
 * Parses a typed weight, rep or second value. Accepts "42.5" and "42,5".
 * Returns undefined for blank or invalid input, so NaN is never saved.
 */
export function parseNumberInput(raw: string): number | undefined {
  const text = raw.trim().replace(",", ".");
  if (text === "" || !/^\d*\.?\d+$|^\d+\.$/.test(text)) return undefined;
  const value = Number(text);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

/** "Upper A: Horizontal Push & Pull" → title "Upper A", subtitle "Horizontal Push & Pull". */
export function splitWorkoutName(name: string): { title: string; subtitle?: string } {
  const at = name.indexOf(": ");
  if (at === -1) return { title: name };
  return { title: name.slice(0, at), subtitle: name.slice(at + 2) };
}
