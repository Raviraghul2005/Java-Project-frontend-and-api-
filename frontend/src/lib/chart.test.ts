import { describe, expect, it } from "vitest";
import { areaPath, compactNumber, niceCeil, smoothPath, type Point } from "./chart";

/** Reads every number out of a path string. */
const numbers = (d: string) => (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

describe("smoothPath", () => {
  it("is empty without points and a single move for one point", () => {
    expect(smoothPath([])).toBe("");
    expect(smoothPath([[5, 7]])).toBe("M5 7");
  });

  it("is a straight line for two points", () => {
    expect(smoothPath([[0, 0], [10, 4]])).toBe("M0 0L10 4");
  });

  it("starts at the first point, ends at the last and has one curve per gap", () => {
    const pts: Point[] = [[0, 10], [10, 4], [20, 12], [30, 2]];
    const d = smoothPath(pts);
    expect(d.startsWith("M0 10C")).toBe(true);
    expect(d.endsWith("30 2")).toBe(true);
    expect((d.match(/C/g) ?? []).length).toBe(3);
    expect(numbers(d).every(Number.isFinite)).toBe(true);
  });

  it("never overshoots the data (monotone): a flat run stays flat and peaks are not exceeded", () => {
    // y grows downwards in SVG, so "highest" is the smallest y. Data range here is 20..60.
    const pts: Point[] = [[0, 60], [10, 20], [20, 20], [30, 60]];
    const ys = numbers(smoothPath(pts)).filter((_, i) => i % 2 === 1);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(20);
    expect(Math.max(...ys)).toBeLessThanOrEqual(60);
  });

  it("copes with repeated x values without producing NaN", () => {
    const d = smoothPath([[0, 1], [0, 3], [5, 2]]);
    expect(d).not.toMatch(/NaN|Infinity/);
  });
});

describe("areaPath", () => {
  it("closes the curve down to the baseline", () => {
    const d = areaPath([[0, 10], [10, 4], [20, 8]], 50);
    expect(d.endsWith("L20 50L0 50Z")).toBe(true);
  });

  it("is empty without points", () => {
    expect(areaPath([], 50)).toBe("");
  });
});

describe("niceCeil", () => {
  it("rounds up to a readable axis maximum", () => {
    expect(niceCeil(248.94)).toBe(250);
    expect(niceCeil(1300)).toBe(1500);
    expect(niceCeil(7)).toBe(8);
    expect(niceCeil(100)).toBe(100);
    expect(niceCeil(0.42)).toBeCloseTo(0.5, 10);
  });

  it("never returns less than the value and survives bad input", () => {
    for (const v of [0.01, 3.3, 99, 101, 12345]) expect(niceCeil(v)).toBeGreaterThanOrEqual(v);
    expect(niceCeil(0)).toBe(1);
    expect(niceCeil(-5)).toBe(1);
    expect(niceCeil(Number.NaN)).toBe(1);
  });
});

describe("compactNumber", () => {
  it("shortens thousands and millions", () => {
    expect(compactNumber(0)).toBe("0");
    expect(compactNumber(250)).toBe("250");
    expect(compactNumber(1200)).toBe("1.2k");
    expect(compactNumber(2000)).toBe("2k");
    expect(compactNumber(3_400_000)).toBe("3.4M");
  });
});
