import { describe, expect, it } from "vitest";
import { csvEscape, subscriptionsToCsv } from "./export";
import type { Subscription } from "@/types";

const sub = (overrides: Partial<Subscription> = {}): Subscription => ({
  id: "s1",
  name: "Netflix",
  price: 15.49,
  currency: "USD",
  frequency: "monthly",
  category: "entertainment",
  paymentMethod: "Visa",
  status: "active",
  startDate: "2026-01-05",
  renewalDate: "2026-11-05",
  ...overrides
});

describe("csvEscape", () => {
  it("quotes every field and doubles embedded quotes", () => {
    expect(csvEscape("plain")).toBe('"plain"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape("a,b\nc")).toBe('"a,b\nc"');
    expect(csvEscape(12.5)).toBe('"12.5"');
    expect(csvEscape(null)).toBe('""');
    expect(csvEscape(undefined)).toBe('""');
  });

  it("neutralises spreadsheet formula injection", () => {
    expect(csvEscape("=HYPERLINK(\"http://evil\",\"x\")")).toBe('"\'=HYPERLINK(""http://evil"",""x"")"');
    expect(csvEscape("+1+1")).toBe("\"'+1+1\"");
    expect(csvEscape("-2+3")).toBe("\"'-2+3\"");
    expect(csvEscape("@SUM(A1)")).toBe("\"'@SUM(A1)\"");
    expect(csvEscape("\t=1")).toBe("\"'\t=1\"");
  });

  it("leaves harmless text that merely contains operators alone", () => {
    expect(csvEscape("Disney+")).toBe('"Disney+"');
    expect(csvEscape("A=B")).toBe('"A=B"');
  });
});

describe("subscriptionsToCsv", () => {
  it("writes a header plus one quoted row per subscription", () => {
    const lines = subscriptionsToCsv([sub(), sub({ id: "s2", name: "Spotify" })]).split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('"ID","Name","Price","Currency","Frequency","Category","Payment Method","Status","Start Date","Renewal Date"');
    expect(lines[1]).toBe('"s1","Netflix","15.49","USD","monthly","entertainment","Visa","active","2026-01-05","2026-11-05"');
  });

  it("is safe for hostile names", () => {
    const csv = subscriptionsToCsv([sub({ name: '=cmd|" /C calc"!A0', paymentMethod: "+evil" })]);
    expect(csv).toContain("\"'=cmd|\"\" /C calc\"\"!A0\"");
    expect(csv).toContain("\"'+evil\"");
  });
});
