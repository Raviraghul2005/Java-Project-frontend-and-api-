import { describe, expect, it } from "vitest";
import type { Subscription } from "@/types";
import { cumulative, projectMonthlySpend } from "./projection";

const NOW = new Date(2026, 9, 24, 15, 30); // 24 Oct 2026, afternoon (local)

function sub(over: Partial<Subscription>): Subscription {
  return {
    id: "s",
    name: "Plan",
    price: 10,
    currency: "USD",
    frequency: "monthly",
    category: "other",
    paymentMethod: "Card",
    status: "active",
    startDate: "2026-01-01",
    renewalDate: "2026-11-15",
    ...over
  };
}

describe("projectMonthlySpend", () => {
  it("returns twelve buckets starting with the current month", () => {
    const out = projectMonthlySpend([], NOW);
    expect(out).toHaveLength(12);
    expect(out[0].month).toBe("2026-10");
    expect(out[0].label).toBe("Oct");
    expect(out[0].title).toBe("October 2026");
    expect(out[11].month).toBe("2027-09");
    expect(out.every((m) => m.total === 0 && m.charges === 0)).toBe(true);
  });

  it("charges a monthly plan in every month, including the one it already renewed in", () => {
    const out = projectMonthlySpend([sub({ price: 12.5, renewalDate: "2026-11-05" })], NOW);
    expect(out.every((m) => m.total === 12.5 && m.charges === 1)).toBe(true);
  });

  it("shows a yearly plan as one spike in its renewal month", () => {
    const out = projectMonthlySpend([sub({ price: 120, frequency: "yearly", renewalDate: "2027-02-21" })], NOW);
    expect(out.filter((m) => m.total > 0).map((m) => [m.month, m.total])).toEqual([["2027-02", 120]]);
  });

  it("counts weekly plans by the number of renewal days in each month", () => {
    // Mondays: October 2026 has the 5th, 12th, 19th and 26th; November has the 2nd, 9th, 16th, 23rd and 30th.
    const out = projectMonthlySpend([sub({ price: 7, frequency: "weekly", renewalDate: "2026-10-26" })], NOW);
    expect(out[0].charges).toBe(4);
    expect(out[0].total).toBe(28);
    expect(out[1].charges).toBe(5);
  });

  it("keeps the billing day across short months", () => {
    const out = projectMonthlySpend([sub({ price: 1, renewalDate: "2026-10-31" })], NOW);
    expect(out.every((m) => m.charges === 1)).toBe(true); // Feb 28 and Apr 30 still count once each
  });

  it("ignores cancelled plans, other currencies and plans without a usable renewal date", () => {
    const out = projectMonthlySpend(
      [
        sub({ id: "a", status: "cancelled" }),
        sub({ id: "b", currency: "INR", price: 999 }),
        sub({ id: "c", renewalDate: undefined }),
        sub({ id: "d", price: 0 }),
        sub({ id: "e", price: 5, renewalDate: "2026-11-02" })
      ],
      NOW
    );
    expect(out.every((m) => m.total === 5)).toBe(true);
  });

  it("sums several plans per month and rounds to cents", () => {
    const out = projectMonthlySpend(
      [sub({ id: "a", price: 15.49 }), sub({ id: "b", price: 11.99, renewalDate: "2026-11-03" }), sub({ id: "c", price: 0.1 })],
      NOW
    );
    expect(out[3].total).toBe(27.58);
    expect(out[3].charges).toBe(3);
  });

  it("uses the requested currency when given one", () => {
    const out = projectMonthlySpend([sub({ currency: "EUR", price: 9 }), sub({ id: "x", price: 4 })], NOW, 12, "EUR");
    expect(out.every((m) => m.total === 9)).toBe(true);
  });
});

describe("cumulative", () => {
  it("turns monthly totals into a running total", () => {
    const out = cumulative(projectMonthlySpend([sub({ price: 10 })], NOW, 4));
    expect(out.map((m) => m.total)).toEqual([10, 20, 30, 40]);
  });
});
