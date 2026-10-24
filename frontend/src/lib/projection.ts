import type { Subscription } from "@/types";
import { addPeriods, formatLocalDate, parseLocalDate } from "./dates";
import { primaryCurrency } from "./money";

export interface MonthSpend {
  /** "YYYY-MM" */
  month: string;
  /** "Oct" */
  label: string;
  /** Full month and year for tooltips, "October 2026". */
  title: string;
  total: number;
  /** How many charges land in this month. */
  charges: number;
}

const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

/** How many billing periods either side of the anchor can fall inside a 12-month window. */
function periodRange(frequency: Subscription["frequency"], months: number): number {
  switch (frequency) {
    case "daily":
      return months * 31 + 40;
    case "weekly":
      return months * 5 + 10;
    case "yearly":
      return Math.ceil(months / 12) + 2;
    case "monthly":
    default:
      return months + 2;
  }
}

/**
 * What the active subscriptions are expected to cost, month by month, from this month on. Each plan repeats from
 * its renewal date (the billing day is kept: Jan 31 -> Feb 28 -> Mar 31), so a yearly plan shows up as a single
 * spike in its renewal month and a plan that already renewed this month still counts for it. Only the main
 * currency is summed, like the audit does, so amounts in other currencies are not mixed in.
 */
export function projectMonthlySpend(
  subscriptions: Subscription[],
  now: Date = new Date(),
  months = 12,
  currency?: string
): MonthSpend[] {
  const active = subscriptions.filter((s) => s.status === "active");
  const code = (currency ?? primaryCurrency(active)).toUpperCase();

  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const buckets: MonthSpend[] = [];
  const index = new Map<string, number>();
  for (let i = 0; i < months; i++) {
    const d = new Date(first.getFullYear(), first.getMonth() + i, 1);
    const key = formatLocalDate(d).slice(0, 7);
    index.set(key, i);
    buckets.push({
      month: key,
      label: SHORT[d.getMonth()],
      title: `${LONG[d.getMonth()]} ${d.getFullYear()}`,
      total: 0,
      charges: 0
    });
  }
  const windowEnd = new Date(first.getFullYear(), first.getMonth() + months, 1);

  for (const sub of active) {
    if ((sub.currency || "USD").toUpperCase() !== code) continue;
    if (!Number.isFinite(sub.price) || sub.price <= 0) continue;
    const anchor = parseLocalDate(sub.renewalDate);
    if (!anchor) continue;

    const range = periodRange(sub.frequency, months);
    for (let k = -range; k <= range; k++) {
      const due = addPeriods(anchor, sub.frequency, k, anchor.getDate());
      if (due < first || due >= windowEnd) continue;
      const slot = index.get(formatLocalDate(due).slice(0, 7));
      if (slot === undefined) continue;
      buckets[slot].total += sub.price;
      buckets[slot].charges += 1;
    }
  }

  return buckets.map((b) => ({ ...b, total: Math.round(b.total * 100) / 100 }));
}

/** Running total of a projection, for the "cumulative" view. */
export function cumulative(series: MonthSpend[]): MonthSpend[] {
  let running = 0;
  return series.map((m) => {
    running += m.total;
    return { ...m, total: Math.round(running * 100) / 100 };
  });
}
