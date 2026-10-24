"use client";

import React from "react";
import { cn } from "@/lib/cn";

interface FilterPillsProps {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}

/** Horizontally scrolling row of toggle pills (aria-pressed); the chosen one glows violet. */
export function FilterPills({ options, value, onChange, className }: FilterPillsProps) {
  return (
    <div className={cn("scrollbar-none -mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1", className)}>
      {options.map((option) => {
        const active = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.id)}
            className={cn(
              "cursor-pointer whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-semibold capitalize transition-all duration-300",
              active
                ? "border-brand-400/40 bg-brand-500/20 text-brand-100 shadow-[0_6px_20px_-8px_rgb(124_92_255/0.8)]"
                : "border-white/[0.07] bg-white/[0.03] text-zinc-400 hover:border-white/[0.15] hover:bg-white/[0.07] hover:text-zinc-100"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
