"use client";

import { useEffect } from "react";

/**
 * One pointermove listener for the whole app: whichever `.spotlight` card the cursor is over gets its --mx / --my
 * custom properties updated, which the CSS turns into the following glow. Renders nothing.
 */
export function SpotlightTracker() {
  useEffect(() => {
    let raf = 0;
    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const card = (event.target as Element | null)?.closest?.<HTMLElement>(".spotlight");
      if (!card) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const box = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${event.clientX - box.left}px`);
        card.style.setProperty("--my", `${event.clientY - box.top}px`);
      });
    };
    document.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      document.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return null;
}
