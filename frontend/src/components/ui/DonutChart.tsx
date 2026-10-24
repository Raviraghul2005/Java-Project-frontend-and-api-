"use client";

import React, { useState } from "react";

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
  /** Text shown in the middle while this segment is hovered ("$120.00"). */
  detail?: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  /** Small caption in the centre when nothing is hovered ("Monthly"). */
  centerLabel: string;
  /** Large text in the centre when nothing is hovered. */
  centerValue: React.ReactNode;
  ariaLabel: string;
  size?: number;
}

const GAP = 1.6; // percent of the ring left empty between segments

/** Donut whose segments sweep in one after another; hovering a segment or its legend row isolates it. */
export function DonutChart({ segments, centerLabel, centerValue, ariaLabel, size = 190 }: DonutChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);

  const shares = segments.map((s) => (total > 0 ? (Math.max(0, s.value) / total) * 100 : 0));
  const arcs = segments.map((segment, i) => {
    const before = shares.slice(0, i).reduce((sum, pct) => sum + pct, 0);
    return { ...segment, i, pct: shares[i], len: Math.max(0, shares[i] - (segments.length > 1 ? GAP : 0)), offset: -(before + GAP / 2) };
  });
  const focused = hover === null ? null : arcs[hover];

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={ariaLabel} className="-rotate-90 overflow-visible">
          <circle cx="50" cy="50" r="40" fill="none" stroke="rgb(255 255 255 / 0.05)" strokeWidth="11" />
          {arcs.map((arc) => (
            <circle
              key={arc.label}
              cx="50"
              cy="50"
              r="40"
              fill="none"
              pathLength={100}
              stroke={arc.color}
              strokeWidth={hover === arc.i ? 14 : 11}
              strokeLinecap="round"
              strokeDashoffset={arc.offset}
              className="donut-seg cursor-pointer"
              opacity={hover === null || hover === arc.i ? 1 : 0.28}
              style={{ "--len": arc.len, "--i": arc.i, filter: hover === arc.i ? `drop-shadow(0 0 6px ${arc.color})` : undefined } as React.CSSProperties}
              onPointerEnter={() => setHover(arc.i)}
              onPointerLeave={() => setHover(null)}
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[11px] font-medium text-zinc-400">{focused ? focused.label : centerLabel}</span>
          <span className="text-2xl font-bold tracking-tight text-zinc-50 tabular-nums">{focused ? (focused.detail ?? `${focused.pct.toFixed(0)}%`) : centerValue}</span>
          {focused && <span className="text-[11px] tabular-nums text-zinc-400">{focused.pct.toFixed(0)}% of spend</span>}
        </div>
      </div>

      <ul className="w-full space-y-1">
        {arcs.map((arc) => (
          <li
            key={arc.label}
            onPointerEnter={() => setHover(arc.i)}
            onPointerLeave={() => setHover(null)}
            className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-all duration-200 ${
              hover === arc.i ? "bg-white/[0.07] text-zinc-50" : hover === null ? "text-zinc-300" : "text-zinc-500"
            }`}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: arc.color, boxShadow: `0 0 10px ${arc.color}80` }} />
              <span className="truncate capitalize">{arc.label}</span>
            </span>
            <span className="tabular-nums text-zinc-400">{arc.pct.toFixed(0)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
