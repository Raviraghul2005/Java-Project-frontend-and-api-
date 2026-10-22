import type { Frequency } from "@/types";

/**
 * Monthly equivalent of a recurring price. Uses exact calendar ratios and matches the backend's
 * AnalyticsService (52 weeks and 365 days per year), so numbers on screen add up with the audit.
 */
export function toMonthly(price: number, frequency: Frequency): number {
  if (!Number.isFinite(price) || price <= 0) return 0;
  switch (frequency) {
    case "daily":
      return (price * 365) / 12;
    case "weekly":
      return (price * 52) / 12;
    case "yearly":
      return price / 12;
    case "monthly":
    default:
      return price;
  }
}

/** Formats an amount in the given ISO-4217 currency, falling back to a plain number for unknown codes. */
export function formatMoney(amount: number, currency = "USD"): string {
  const value = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

export const DEFAULT_CURRENCY = "USD";

/**
 * The currency used by the most subscriptions; ties go to USD, then to the alphabetically first code.
 * Mirrors the backend's AnalyticsService so the simulator and the audit agree on which plans count.
 */
export function primaryCurrency(subs: { currency?: string }[]): string {
  const counts = new Map<string, number>();
  for (const s of subs) {
    const code = (s.currency || DEFAULT_CURRENCY).trim().toUpperCase() || DEFAULT_CURRENCY;
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  let best = DEFAULT_CURRENCY;
  let bestCount = -1;
  for (const [code, count] of [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const beatsBest = count > bestCount || (count === bestCount && code === DEFAULT_CURRENCY);
    if (beatsBest) {
      best = code;
      bestCount = count;
    }
  }
  return best;
}
