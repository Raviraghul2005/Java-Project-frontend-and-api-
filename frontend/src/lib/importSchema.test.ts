import { describe, expect, it } from "vitest";
import { MAX_IMPORT_RECORDS, validateImport } from "./importSchema";

const good = {
  name: "Netflix",
  price: 15.49,
  currency: "usd",
  frequency: "Monthly",
  category: "Entertainment",
  paymentMethod: "Visa",
  startDate: "2026-01-05"
};

describe("validateImport", () => {
  it("accepts a bare array and normalises casing", () => {
    const result = validateImport([good]);
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0]).toMatchObject({ currency: "USD", frequency: "monthly", category: "entertainment" });
    expect(result.rejected).toHaveLength(0);
  });

  it("accepts the object produced by the JSON export", () => {
    const result = validateImport({ app: "Bill Pilot", subscriptions: [good] });
    expect("error" in result).toBe(false);
  });

  it("keeps only writable fields, so ids, owners and status from a file cannot leak through", () => {
    const result = validateImport([{ ...good, id: "evil", user: "someone-else", status: "cancelled", createdAt: "x" }]);
    if ("error" in result) throw new Error(result.error);
    expect(Object.keys(result.valid[0]).sort()).toEqual(
      ["category", "currency", "frequency", "name", "paymentMethod", "price", "renewalDate", "startDate"].sort()
    );
  });

  it("rejects records that would crash the UI or the API", () => {
    const result = validateImport([
      { ...good, price: "15.49" }, // string price used to crash price.toFixed
      { ...good, price: -1 },
      { ...good, price: Number.POSITIVE_INFINITY },
      { ...good, name: "x" },
      { ...good, frequency: "fortnightly" },
      { ...good, startDate: "2026-02-30" },
      { ...good, currency: "DOLLARS" },
      { ...good, paymentMethod: "" },
      null,
      "text",
      good
    ]);
    if ("error" in result) throw new Error(result.error);
    expect(result.valid).toHaveLength(1);
    expect(result.rejected).toHaveLength(10);
  });

  it("returns errors for unusable top-level shapes", () => {
    expect(validateImport({})).toHaveProperty("error");
    expect(validateImport("nope")).toHaveProperty("error");
    expect(validateImport([])).toHaveProperty("error");
    expect(validateImport(null)).toHaveProperty("error");
  });

  it("refuses oversized imports", () => {
    const many = Array.from({ length: MAX_IMPORT_RECORDS + 1 }, () => good);
    expect(validateImport(many)).toHaveProperty("error");
  });
});
