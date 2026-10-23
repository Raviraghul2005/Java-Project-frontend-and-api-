import { addPeriods, formatLocalDate, parseLocalDate } from "./dates";

export type StripMark = "charge" | "grouped" | "none";

export interface StripCell {
  /** "YYYY-MM" */
  month: string;
  /** Short month name, "Jan" */
  label: string;
  mark: StripMark;
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// Guards the loop against a malformed span; no statement covers 50 years.
const MAX_CELLS = 600;

/** "YYYY-MM" of a "YYYY-MM-DD" calendar date, or null when it is not a real date. */
function monthOf(date: string): string | null {
  const parsed = parseLocalDate(date);
  return parsed ? formatLocalDate(parsed).slice(0, 7) : null;
}

/**
 * One cell per calendar month from `firstMonth` to `lastMonth` ("YYYY-MM", inclusive). A month is "grouped" when
 * any of its charges was part of a grouped debit, "charge" when it has charges, otherwise "none".
 */
export function buildStrip(
  charges: { date: string; grouped: boolean }[],
  firstMonth: string,
  lastMonth: string
): StripCell[] {
  const start = parseLocalDate(`${firstMonth}-01`);
  const end = parseLocalDate(`${lastMonth}-01`);
  if (!start || !end || start > end) return [];

  const marks = new Map<string, StripMark>();
  for (const c of charges) {
    const month = monthOf(c.date);
    if (!month) continue;
    if (c.grouped) marks.set(month, "grouped");
    else if (!marks.has(month)) marks.set(month, "charge");
  }

  const cells: StripCell[] = [];
  for (let i = 0; i < MAX_CELLS; i++) {
    const date = addPeriods(start, "monthly", i, 1);
    if (date > end) break;
    const month = formatLocalDate(date).slice(0, 7);
    cells.push({ month, label: MONTH_LABELS[date.getMonth()], mark: marks.get(month) ?? "none" });
  }
  return cells;
}

/**
 * First and last month ("YYYY-MM") covered by a set of "YYYY-MM-DD" dates, limited to the latest `maxMonths`
 * months. Null when there is no valid date.
 */
export function monthSpan(dates: string[], maxMonths = 12): { firstMonth: string; lastMonth: string } | null {
  const months = dates.map(monthOf).filter((m): m is string => m !== null).sort();
  if (months.length === 0) return null;
  const lastMonth = months[months.length - 1];
  const earliest = parseLocalDate(`${months[0]}-01`)!;
  const latest = parseLocalDate(`${lastMonth}-01`)!;
  const earliestAllowed = addPeriods(latest, "monthly", -(maxMonths - 1), 1);
  const first = earliest < earliestAllowed ? earliestAllowed : earliest;
  return { firstMonth: formatLocalDate(first).slice(0, 7), lastMonth };
}
