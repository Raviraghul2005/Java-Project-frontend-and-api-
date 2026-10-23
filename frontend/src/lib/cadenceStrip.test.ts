import { describe, expect, it } from "vitest";
import { buildStrip, monthSpan } from "./cadenceStrip";

const charge = (date: string, grouped = false) => ({ date, grouped });

describe("buildStrip", () => {
  it("makes one cell per month across a year boundary (Nov 2025 -> Oct 2026)", () => {
    const strip = buildStrip([], "2025-11", "2026-10");
    expect(strip).toHaveLength(12);
    expect(strip.map((c) => c.month)).toEqual([
      "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04",
      "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"
    ]);
    expect(strip.map((c) => c.label)).toEqual([
      "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"
    ]);
  });

  it("marks charged, grouped and empty months", () => {
    const strip = buildStrip(
      [charge("2026-01-14"), charge("2026-02-14", true), charge("2026-04-15")],
      "2026-01",
      "2026-04"
    );
    expect(strip.map((c) => c.mark)).toEqual(["charge", "grouped", "none", "charge"]);
  });

  it("calls a month grouped when any of its charges is grouped", () => {
    const strip = buildStrip([charge("2026-03-02"), charge("2026-03-28", true)], "2026-03", "2026-03");
    expect(strip).toEqual([{ month: "2026-03", label: "Mar", mark: "grouped" }]);
  });

  it("puts a charge on the first or last day of a month in that month", () => {
    const strip = buildStrip([charge("2026-03-31"), charge("2026-04-01")], "2026-03", "2026-04");
    expect(strip.map((c) => c.mark)).toEqual(["charge", "charge"]);
  });

  it("ignores charges outside the span and malformed dates", () => {
    const strip = buildStrip([charge("2025-12-31"), charge("not-a-date"), charge("2026-05-01")], "2026-01", "2026-02");
    expect(strip.map((c) => c.mark)).toEqual(["none", "none"]);
  });

  it("returns nothing for a backwards or malformed span", () => {
    expect(buildStrip([], "2026-05", "2026-01")).toEqual([]);
    expect(buildStrip([], "soon", "2026-01")).toEqual([]);
  });
});

describe("monthSpan", () => {
  it("covers the first to the last month of the dates", () => {
    expect(monthSpan(["2026-03-09", "2025-11-02", "2026-10-15"])).toEqual({ firstMonth: "2025-11", lastMonth: "2026-10" });
  });

  it("keeps only the latest 12 months of a longer statement", () => {
    expect(monthSpan(["2024-01-05", "2026-10-15"])).toEqual({ firstMonth: "2025-11", lastMonth: "2026-10" });
  });

  it("is null without a valid date", () => {
    expect(monthSpan([])).toBeNull();
    expect(monthSpan(["garbage"])).toBeNull();
  });
});
