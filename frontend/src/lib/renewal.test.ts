import { describe, expect, it } from "vitest";
import { describeDue } from "./renewal";

describe("describeDue", () => {
  it("has nothing to say without a date", () => {
    expect(describeDue(null)).toBeNull();
    expect(describeDue(Number.NaN)).toBeNull();
  });

  it("flags anything in the past as overdue", () => {
    expect(describeDue(-1)).toEqual({ label: "Overdue", tone: "overdue" });
    expect(describeDue(-30)?.tone).toBe("overdue");
  });

  it("uses plain words for today and tomorrow", () => {
    expect(describeDue(0)).toEqual({ label: "Due today", tone: "urgent" });
    expect(describeDue(1)).toEqual({ label: "Due tomorrow", tone: "urgent" });
  });

  it("grades the next weeks by urgency", () => {
    expect(describeDue(2)).toEqual({ label: "Due in 2 days", tone: "urgent" });
    expect(describeDue(3)?.tone).toBe("urgent");
    expect(describeDue(4)?.tone).toBe("soon");
    expect(describeDue(7)?.tone).toBe("soon");
    expect(describeDue(8)).toEqual({ label: "Due in 8 days", tone: "later" });
    expect(describeDue(120)?.tone).toBe("later");
  });
});
