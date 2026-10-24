"use client";

import React, { useId, useMemo, useState } from "react";
import { areaPath, compactNumber, niceCeil, smoothPath, type Point } from "@/lib/chart";
import { useElementWidth } from "@/lib/useElementWidth";

export interface ChartDatum {
  /** Short x-axis label, "Oct". */
  label: string;
  /** Longer name for the tooltip, "October 2026". */
  title?: string;
  value: number;
}

interface AreaChartProps {
  data: ChartDatum[];
  height?: number;
  /** Full value text for tooltips ("$1,234.50"). */
  format: (value: number) => string;
  /** Short text for y-axis ticks; defaults to 1.2k style. */
  formatTick?: (value: number) => string;
  ariaLabel: string;
  /** Show "+10.4%" against the previous point in the tooltip. */
  showDelta?: boolean;
}

const PAD = { top: 62, right: 16, bottom: 32, left: 50 };

/**
 * Smooth area chart drawn in SVG: the line draws itself in, the fill wipes in after it, and hovering (or touching)
 * moves a crosshair and tooltip. With no hover it rests on the highest point, like a pinned annotation.
 */
export function AreaChart({ data, height = 300, format, formatTick = compactNumber, ariaLabel, showDelta = true }: AreaChartProps) {
  const gradientId = `area-${useId().replace(/:/g, "")}`;
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const n = data.length;

  const peak = useMemo(() => data.reduce((best, d, i) => (d.value > data[best].value ? i : best), 0), [data]);

  const layout = useMemo(() => {
    if (width <= 0 || n === 0) return null;
    const innerW = Math.max(1, width - PAD.left - PAD.right);
    const innerH = height - PAD.top - PAD.bottom;
    const yMax = niceCeil(Math.max(...data.map((d) => d.value), 0) * 1.04);
    const step = n > 1 ? innerW / (n - 1) : 0;
    const points: Point[] = data.map((d, i) => [
      PAD.left + (n > 1 ? i * step : innerW / 2),
      PAD.top + innerH * (1 - d.value / yMax)
    ]);
    const baseY = PAD.top + innerH;
    const ticks = [0, 1, 2, 3, 4].map((k) => ({ value: (yMax * k) / 4, y: PAD.top + innerH * (1 - k / 4) }));
    return { innerW, innerH, step, points, baseY, ticks, line: smoothPath(points), area: areaPath(points, baseY) };
  }, [data, width, height, n]);

  const active = hover ?? peak;
  const labelEvery = width < 460 ? 3 : width < 640 ? 2 : 1;

  const onMove = (event: React.PointerEvent<SVGRectElement>) => {
    if (!layout || n < 2) return;
    const box = event.currentTarget.getBoundingClientRect();
    const index = Math.round((event.clientX - box.left) / layout.step);
    setHover(Math.min(n - 1, Math.max(0, index)));
  };

  const point = layout && n > 0 ? layout.points[active] : null;
  const datum = n > 0 ? data[active] : null;
  const prev = active > 0 ? data[active - 1] : null;
  const delta = showDelta && prev && prev.value > 0 && datum ? (datum.value / prev.value - 1) * 100 : null;

  return (
    <div ref={ref} className="relative w-full select-none" style={{ height }}>
      {layout && point && datum && (
        <>
          <svg width={width} height={height} role="img" aria-label={ariaLabel} className="block overflow-visible">
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#8b6bff" stopOpacity="0.5" />
                <stop offset="70%" stopColor="#6842f0" stopOpacity="0.08" />
                <stop offset="100%" stopColor="#6842f0" stopOpacity="0" />
              </linearGradient>
            </defs>

            {layout.ticks.map((tick) => (
              <g key={tick.y}>
                <line x1={PAD.left} x2={width - PAD.right} y1={tick.y} y2={tick.y} stroke="rgb(255 255 255 / 0.06)" strokeDasharray="3 5" />
                <text x={PAD.left - 10} y={tick.y + 4} textAnchor="end" className="fill-zinc-500 text-[10px] tabular-nums">
                  {formatTick(tick.value)}
                </text>
              </g>
            ))}

            <path d={layout.area} fill={`url(#${gradientId})`} className="chart-area" />
            <path
              d={layout.line}
              pathLength={1}
              fill="none"
              stroke="#a78bfa"
              strokeWidth={2.6}
              strokeLinecap="round"
              className="chart-line"
              style={{ filter: "drop-shadow(0 0 7px rgb(124 92 255 / 0.65))" }}
            />

            <line
              x1={point[0]}
              x2={point[0]}
              y1={PAD.top}
              y2={layout.baseY}
              stroke="rgb(167 139 250 / 0.45)"
              strokeDasharray="3 4"
              style={{ transition: "x1 0.25s var(--ease-out-expo), x2 0.25s var(--ease-out-expo)" }}
            />
            <g style={{ transform: `translate(${point[0]}px, ${point[1]}px)`, transition: "transform 0.3s var(--ease-out-expo)" }}>
              <circle r={11} fill="rgb(124 92 255 / 0.22)" className="animate-ping-slow" style={{ transformBox: "fill-box", transformOrigin: "center" }} />
              <circle r={5.5} fill="#0c0b13" stroke="#c4b5fd" strokeWidth={2.5} />
            </g>

            {data.map((d, i) =>
              i % labelEvery === 0 || i === active ? (
                <text
                  key={d.label + i}
                  x={layout.points[i][0]}
                  y={height - 9}
                  textAnchor="middle"
                  className={`text-[10.5px] ${i === active ? "fill-zinc-100 font-semibold" : "fill-zinc-500"}`}
                  style={{ transition: "fill 0.2s" }}
                >
                  {d.label}
                </text>
              ) : null
            )}

            <rect
              x={PAD.left - 6}
              y={0}
              width={layout.innerW + 12}
              height={height}
              fill="transparent"
              onPointerMove={onMove}
              onPointerDown={onMove}
              onPointerLeave={() => setHover(null)}
            />
          </svg>

          <div
            className="pointer-events-none absolute z-10 flex flex-col gap-0.5 rounded-xl border border-white/10 bg-zinc-950/90 px-3 py-2 shadow-xl backdrop-blur-md"
            style={{
              left: Math.min(Math.max(point[0], 74), width - 74),
              top: Math.max(point[1] - 14, 6),
              transform: "translate(-50%, -100%)",
              transition: "left 0.3s var(--ease-out-expo), top 0.3s var(--ease-out-expo)"
            }}
          >
            <span className="text-[10px] font-medium text-zinc-400">{datum.title ?? datum.label}</span>
            <span className="flex items-center gap-2">
              <span className="text-sm font-bold tabular-nums text-zinc-50">{format(datum.value)}</span>
              {delta !== null && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
                    delta > 0 ? "bg-amber-400/15 text-amber-300" : delta < 0 ? "bg-emerald-400/15 text-emerald-300" : "bg-white/10 text-zinc-300"
                  }`}
                >
                  {delta > 0 ? "+" : ""}
                  {delta.toFixed(1)}%
                </span>
              )}
            </span>
          </div>

          <ul className="sr-only">
            {data.map((d) => (
              <li key={d.label + d.value}>
                {d.title ?? d.label}: {format(d.value)}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
