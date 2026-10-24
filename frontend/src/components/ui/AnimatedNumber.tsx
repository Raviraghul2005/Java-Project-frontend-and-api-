"use client";

import React, { useEffect, useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";

// useLayoutEffect warns during server rendering, and these components are server-rendered once before hydration.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

interface AnimatedNumberProps {
  value: number;
  /** How to print a value; also used for every frame of the count-up. */
  format?: (value: number) => string;
  /** Milliseconds. */
  duration?: number;
  className?: string;
}

const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

/**
 * Counts up to `value`. The final text is always in the DOM (for screen readers, tests and copy/paste); while the
 * count runs, an aria-hidden overlay paints the running value on top of it. A new value counts on from where the
 * old one stopped.
 */
export function AnimatedNumber({ value, format = (v) => String(Math.round(v)), duration = 1200, className }: AnimatedNumberProps) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const liveRef = useRef<HTMLSpanElement>(null);
  const shown = useRef(0);
  const formatRef = useRef(format);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    formatRef.current = format;
  });

  useIsoLayoutEffect(() => {
    const root = rootRef.current;
    const live = liveRef.current;
    if (!root || !live) return;

    const to = value;
    if (reduced || !Number.isFinite(to) || shown.current === to) {
      shown.current = to;
      root.removeAttribute("data-animating");
      return;
    }

    const from = shown.current;
    const start = performance.now();
    let raf = 0;

    const paint = (current: number) => {
      shown.current = current;
      live.dataset.live = formatRef.current(current);
    };

    // First frame is painted before the browser draws, so the final value never flashes first.
    root.dataset.animating = "true";
    paint(from);

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      if (t >= 1) {
        paint(to);
        root.removeAttribute("data-animating");
        return;
      }
      paint(from + (to - from) * easeOutExpo(t));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, reduced]);

  return (
    <span ref={rootRef} className={cn("count", className)}>
      <span className="count-real">{format(value)}</span>
      <span ref={liveRef} className="count-live" aria-hidden="true" />
    </span>
  );
}
