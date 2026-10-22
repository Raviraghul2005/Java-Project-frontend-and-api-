import { describe, expect, it } from "vitest";
import { formatMoney, primaryCurrency, toMonthly } from "./money";

describe("toMonthly", () => {
  it("uses exact calendar ratios (same as the backend audit)", () => {
    expect(toMonthly(10, "monthly")).toBe(10);
    expect(toMonthly(120, "yearly")).toBe(10);
    expect(toMonthly(12, "weekly")).toBeCloseTo(52, 9);
    expect(toMonthly(12, "daily")).toBeCloseTo(365, 9);
  });

  it("treats invalid prices as zero", () => {
    expect(toMonthly(NaN, "monthly")).toBe(0);
    expect(toMonthly(-5, "monthly")).toBe(0);
    expect(toMonthly(Infinity, "yearly")).toBe(0);
  });
});

describe("formatMoney", () => {
  it("formats in the given currency", () => {
    expect(formatMoney(1234.5, "USD")).toBe("$1,234.50");
    expect(formatMoney(9.99, "EUR")).toContain("9.99");
    expect(formatMoney(9.99, "EUR")).toContain("€");
  });

  it("falls back gracefully for unknown currencies and bad numbers", () => {
    expect(formatMoney(5, "ZZZZ")).toBe("ZZZZ 5.00");
    expect(formatMoney(NaN, "USD")).toBe("$0.00");
  });
});

describe("primaryCurrency", () => {
  it("picks the most used currency", () => {
    expect(primaryCurrency([{ currency: "INR" }, { currency: "INR" }, { currency: "USD" }])).toBe("INR");
  });

  it("breaks ties in favour of USD, then alphabetically", () => {
    expect(primaryCurrency([{ currency: "INR" }, { currency: "USD" }])).toBe("USD");
    expect(primaryCurrency([{ currency: "GBP" }, { currency: "EUR" }])).toBe("EUR");
  });

  it("defaults to USD for no subscriptions or missing currency", () => {
    expect(primaryCurrency([])).toBe("USD");
    expect(primaryCurrency([{}])).toBe("USD");
  });
});
