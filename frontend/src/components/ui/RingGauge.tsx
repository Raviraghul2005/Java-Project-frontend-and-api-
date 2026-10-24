import React from "react";

interface RingGaugeProps {
  /** 0-100 */
  value: number;
  color: string;
  size?: number;
  thickness?: number;
  children?: React.ReactNode;
  className?: string;
}

/** Circular progress ring that sweeps to its value on mount, with a soft glow in the ring's own colour. */
export function RingGauge({ value, color, size = 96, thickness = 3.4, children, className }: RingGaugeProps) {
  const clamped = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
  return (
    <div className={`relative inline-flex shrink-0 items-center justify-center ${className ?? ""}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 36 36" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="18" cy="18" r="15.9155" fill="none" stroke="rgb(255 255 255 / 0.07)" strokeWidth={thickness} />
        <circle
          cx="18"
          cy="18"
          r="15.9155"
          fill="none"
          pathLength={100}
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          className="ring-progress"
          style={{ "--len": clamped, filter: `drop-shadow(0 0 3px ${color}99)` } as React.CSSProperties}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}
