import React, { useId } from "react";
import { areaPath, smoothPath, type Point } from "@/lib/chart";

interface SparklineProps {
  values: number[];
  color?: string;
  className?: string;
}

const W = 100;
const H = 32;

/** Tiny trend line for stat cards. Stretches to its container; non-scaling strokes keep the line width constant. */
export function Sparkline({ values, color = "#a78bfa", className }: SparklineProps) {
  const id = `spark-${useId().replace(/:/g, "")}`;
  if (values.length < 2) return null;

  // Scale from zero (or the lowest value if negative) so a flat run is drawn mid-height, not on the bottom edge.
  const min = Math.min(0, ...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points: Point[] = values.map((v, i) => [(i / (values.length - 1)) * W, H - 3 - ((v - min) / span) * (H - 8)]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Revealed left to right with a clip wipe: dash-array drawing is unreliable together with non-scaling strokes. */}
      <g className="chart-area">
        <path d={areaPath(points, H)} fill={`url(#${id})`} />
        <path d={smoothPath(points)} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </g>
    </svg>
  );
}
