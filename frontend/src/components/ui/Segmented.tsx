"use client";

import React from "react";
import { cn } from "@/lib/cn";

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  ariaLabel: string;
  className?: string;
}

/** Pill toggle with a thumb that glides to the chosen option. Each option is a toggle button (aria-pressed). */
export function Segmented<T extends string>({ value, onChange, options, ariaLabel, className }: SegmentedProps<T>) {
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div role="group" aria-label={ariaLabel} className={cn("relative inline-grid rounded-xl border border-white/[0.07] bg-black/30 p-1", className)} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      <span
        aria-hidden="true"
        className="slider-thumb pointer-events-none absolute inset-y-1 left-1 rounded-lg bg-gradient-to-b from-brand-500 to-brand-600 shadow-[0_6px_18px_-6px_rgb(124_92_255/0.9)]"
        style={{ width: `calc((100% - 0.5rem) / ${options.length})`, transform: `translateX(${index * 100}%)` }}
      />
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            "relative z-10 cursor-pointer rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors duration-300",
            option.value === value ? "text-white" : "text-zinc-400 hover:text-zinc-200"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
