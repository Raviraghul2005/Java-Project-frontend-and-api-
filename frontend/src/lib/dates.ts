import type { Frequency } from "@/types";

/**
 * Date helpers for "YYYY-MM-DD" calendar dates (what the API sends and receives).
 *
 * `new Date("2026-10-22")` parses as UTC midnight while `new Date()` is local time, so comparing
 * them is off by one day in any timezone west of UTC, and `toISOString()` returns the UTC date.
 * Everything here works with local calendar dates instead.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parses "YYYY-MM-DD" as a local-midnight Date, or returns null when the string is not a real date. */
export function parseLocalDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  const valid = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return valid ? date : null;
}

/** Formats a Date as the local calendar day "YYYY-MM-DD". */
export function formatLocalDate(date: Date): string {
  const y = String(date.getFullYear()).padStart(4, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Today's local calendar date as "YYYY-MM-DD". */
export function todayLocal(now: Date = new Date()): string {
  return formatLocalDate(now);
}

/**
 * Whole calendar days from `now`'s local date until `dateStr` (negative when in the past).
 * Returns null when `dateStr` is missing or invalid.
 */
export function daysUntil(dateStr: string | undefined | null, now: Date = new Date()): number | null {
  const target = parseLocalDate(dateStr);
  if (!target) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // Compare via UTC-normalised day numbers so DST changes never produce a 23h/25h day.
  const toDay = (d: Date) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
  return toDay(target) - toDay(today);
}

function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/**
 * `base` moved forward by `periods` billing periods. Months and years are calendar-based and the
 * intended day of month is preserved (Jan 31 -> Feb 28 -> Mar 31). Mirrors the backend's
 * RenewalCalculator so the UI and the server always agree.
 */
export function addPeriods(base: Date, frequency: Frequency, periods: number, preferredDay: number): Date {
  switch (frequency) {
    case "daily":
      return new Date(base.getFullYear(), base.getMonth(), base.getDate() + periods);
    case "weekly":
      return new Date(base.getFullYear(), base.getMonth(), base.getDate() + 7 * periods);
    case "monthly":
    case "yearly": {
      const monthsToAdd = frequency === "monthly" ? periods : periods * 12;
      const total = base.getFullYear() * 12 + base.getMonth() + monthsToAdd;
      const year = Math.floor(total / 12);
      const monthIndex = total % 12;
      const day = Math.min(preferredDay, lastDayOfMonth(year, monthIndex));
      return new Date(year, monthIndex, day);
    }
  }
}

/** The first renewal after a subscription starts: one billing period after `startDate`. */
export function firstRenewal(startDate: string, frequency: Frequency): string | null {
  const start = parseLocalDate(startDate);
  if (!start) return null;
  return formatLocalDate(addPeriods(start, frequency, 1, start.getDate()));
}

/** The earliest billing date on or after today in the sequence anchored at `anchorDate`. */
export function nextRenewalOnOrAfter(
  anchorDate: string,
  frequency: Frequency,
  now: Date = new Date(),
  preferredDay?: number
): string | null {
  const anchor = parseLocalDate(anchorDate);
  if (!anchor) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = preferredDay ?? anchor.getDate();
  let periods = 0;
  let candidate = anchor;
  // Bounded loop: 10,000 daily periods is ~27 years, far beyond any sensible subscription.
  while (candidate < today && periods < 10_000) {
    periods++;
    candidate = addPeriods(anchor, frequency, periods, day);
  }
  return formatLocalDate(candidate);
}
