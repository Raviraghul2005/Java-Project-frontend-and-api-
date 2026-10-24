/** Geometry helpers for the hand-drawn SVG charts (no charting library). */

export type Point = readonly [number, number];

const r2 = (v: number) => Math.round(v * 100) / 100;

/**
 * SVG path through the points as a monotone cubic curve (Fritsch-Carlson): smooth like a spline, but it never
 * overshoots the data, so a flat month does not dip below zero and a peak is not drawn higher than it is.
 * Points must be sorted by x.
 */
export function smoothPath(points: readonly Point[]): string {
  const n = points.length;
  if (n === 0) return "";
  const [x0, y0] = points[0];
  if (n === 1) return `M${r2(x0)} ${r2(y0)}`;
  if (n === 2) return `M${r2(x0)} ${r2(y0)}L${r2(points[1][0])} ${r2(points[1][1])}`;

  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(points[i + 1][0] - points[i][0]);
    slope.push(dx[i] === 0 ? 0 : (points[i + 1][1] - points[i][1]) / dx[i]);
  }

  const tangent: number[] = new Array(n).fill(0);
  tangent[0] = slope[0];
  tangent[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i++) {
    tangent[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2;
  }
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      tangent[i] = 0;
      tangent[i + 1] = 0;
      continue;
    }
    const a = tangent[i] / slope[i];
    const b = tangent[i + 1] / slope[i];
    const s = a * a + b * b;
    if (s > 9) {
      const tau = 3 / Math.sqrt(s);
      tangent[i] = tau * a * slope[i];
      tangent[i + 1] = tau * b * slope[i];
    }
  }

  let d = `M${r2(x0)} ${r2(y0)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i];
    const [xa, ya] = points[i];
    const [xb, yb] = points[i + 1];
    d += `C${r2(xa + h / 3)} ${r2(ya + (tangent[i] * h) / 3)} ${r2(xb - h / 3)} ${r2(yb - (tangent[i + 1] * h) / 3)} ${r2(xb)} ${r2(yb)}`;
  }
  return d;
}

/** The same curve closed down to `baseY`, for the gradient fill under a line. */
export function areaPath(points: readonly Point[], baseY: number): string {
  if (points.length === 0) return "";
  const last = points[points.length - 1];
  return `${smoothPath(points)}L${r2(last[0])} ${r2(baseY)}L${r2(points[0][0])} ${r2(baseY)}Z`;
}

const NICE_STEPS = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

/** Rounds up to a "nice" axis maximum: 248.94 -> 250, 1300 -> 1500, 0 -> 1. */
export function niceCeil(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const exp = Math.floor(Math.log10(value));
  const base = value / 10 ** exp;
  const step = NICE_STEPS.find((s) => base <= s + 1e-9) ?? 10;
  return step * 10 ** exp;
}

/** "$1.2k" style label for a y-axis tick (the full amount is in the tooltip). */
export function compactNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${trim(value / 1_000_000)}M`;
  if (abs >= 1000) return `${trim(value / 1000)}k`;
  return trim(value);
}

function trim(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1).replace(/\.0$/, "");
}
