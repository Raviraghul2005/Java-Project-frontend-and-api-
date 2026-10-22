import { describe, expect, it } from "vitest";
import {
  addPeriods,
  daysUntil,
  firstRenewal,
  formatLocalDate,
  nextRenewalOnOrAfter,
  parseLocalDate,
  todayLocal
} from "./dates";

describe("parseLocalDate", () => {
  it("parses a valid calendar date as local midnight", () => {
    const d = parseLocalDate("2026-10-22");
    expect(d).not.toBeNull();
    expect([d!.getFullYear(), d!.getMonth(), d!.getDate()]).toEqual([2026, 9, 22]);
    expect([d!.getHours(), d!.getMinutes()]).toEqual([0, 0]);
  });

  it("rejects malformed and impossible dates", () => {
    expect(parseLocalDate("")).toBeNull();
    expect(parseLocalDate(undefined)).toBeNull();
    expect(parseLocalDate("22/10/2026")).toBeNull();
    expect(parseLocalDate("2026-13-01")).toBeNull();
    expect(parseLocalDate("2026-02-30")).toBeNull();
    expect(parseLocalDate("2026-10-22T10:00:00Z")).toBeNull();
  });
});

describe("formatLocalDate / todayLocal", () => {
  it("round-trips a date", () => {
    expect(formatLocalDate(parseLocalDate("2026-01-05")!)).toBe("2026-01-05");
  });

  it("uses the local calendar day, not the UTC day", () => {
    // 23:30 local on Oct 22 is already Oct 23 in UTC for zones west of UTC; the local day must win.
    const lateEvening = new Date(2026, 9, 22, 23, 30);
    expect(todayLocal(lateEvening)).toBe("2026-10-22");
  });
});

describe("daysUntil", () => {
  const now = new Date(2026, 9, 22, 15, 45); // Oct 22 2026, afternoon

  it("counts whole calendar days regardless of time of day", () => {
    expect(daysUntil("2026-10-22", now)).toBe(0);
    expect(daysUntil("2026-10-23", now)).toBe(1);
    expect(daysUntil("2026-10-29", now)).toBe(7);
    expect(daysUntil("2026-10-21", now)).toBe(-1);
  });

  it("is not thrown off by a daylight-saving change in between", () => {
    expect(daysUntil("2026-11-05", new Date(2026, 10, 1, 12, 0))).toBe(4);
    expect(daysUntil("2027-03-15", new Date(2027, 2, 1, 23, 59))).toBe(14);
  });

  it("returns null for missing or invalid dates", () => {
    expect(daysUntil(undefined, now)).toBeNull();
    expect(daysUntil("not-a-date", now)).toBeNull();
  });
});

describe("addPeriods / firstRenewal", () => {
  it("uses calendar months and preserves the billing day", () => {
    const jan31 = parseLocalDate("2026-01-31")!;
    expect(formatLocalDate(addPeriods(jan31, "monthly", 1, 31))).toBe("2026-02-28");
    expect(formatLocalDate(addPeriods(jan31, "monthly", 2, 31))).toBe("2026-03-31");
    expect(formatLocalDate(addPeriods(jan31, "monthly", 3, 31))).toBe("2026-04-30");
  });

  it("handles year boundaries and negative periods", () => {
    const nov = parseLocalDate("2026-11-15")!;
    expect(formatLocalDate(addPeriods(nov, "monthly", 3, 15))).toBe("2027-02-15");
    expect(formatLocalDate(addPeriods(nov, "monthly", -11, 15))).toBe("2025-12-15");
  });

  it("handles leap days for yearly plans", () => {
    const leap = parseLocalDate("2024-02-29")!;
    expect(formatLocalDate(addPeriods(leap, "yearly", 1, 29))).toBe("2025-02-28");
    expect(formatLocalDate(addPeriods(leap, "yearly", 4, 29))).toBe("2028-02-29");
  });

  it("matches the backend's first-renewal rule", () => {
    expect(firstRenewal("2026-03-10", "daily")).toBe("2026-03-11");
    expect(firstRenewal("2026-03-10", "weekly")).toBe("2026-03-17");
    expect(firstRenewal("2026-03-10", "monthly")).toBe("2026-04-10");
    expect(firstRenewal("2026-03-10", "yearly")).toBe("2027-03-10");
    expect(firstRenewal("garbage", "monthly")).toBeNull();
  });
});

describe("nextRenewalOnOrAfter", () => {
  const now = new Date(2026, 9, 22, 9, 0);

  it("keeps a future renewal unchanged", () => {
    expect(nextRenewalOnOrAfter("2026-11-01", "monthly", now)).toBe("2026-11-01");
  });

  it("keeps a renewal that is due today", () => {
    expect(nextRenewalOnOrAfter("2026-10-22", "monthly", now)).toBe("2026-10-22");
  });

  it("rolls a stale renewal forward to the next upcoming date", () => {
    expect(nextRenewalOnOrAfter("2026-02-15", "monthly", now)).toBe("2026-11-15");
    expect(nextRenewalOnOrAfter("2024-12-25", "yearly", now)).toBe("2026-12-25");
  });

  it("does not drift after short months when given the preferred day", () => {
    expect(nextRenewalOnOrAfter("2026-02-28", "monthly", new Date(2026, 2, 1), 31)).toBe("2026-03-31");
  });
});
