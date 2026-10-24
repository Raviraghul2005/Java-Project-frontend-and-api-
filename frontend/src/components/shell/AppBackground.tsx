import React from "react";

/** Fixed backdrop behind every page: violet/cyan/pink glows, a fading grid, and two slowly drifting blurred orbs. */
export function AppBackground() {
  return (
    <div className="app-bg" aria-hidden="true">
      <div className="orb orb-a -left-24 top-[-10%] size-[34rem] bg-brand-600/25" />
      <div className="orb orb-b -right-20 top-[35%] size-[30rem] bg-aqua-400/10" />
    </div>
  );
}
