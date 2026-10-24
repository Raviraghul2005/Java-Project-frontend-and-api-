import React from "react";
import { AppBackground } from "@/components/shell/AppBackground";
import { LogoMark } from "./icons";

/** Full-screen loading state: the logo floating inside a spinning ring. Used while the session loads or a redirect runs. */
export function BrandLoader({ label = "Loading", caption = "Getting things ready…" }: { label?: string; caption?: string }) {
  return (
    <>
      <AppBackground />
      <div role="status" aria-label={label} className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6">
        <div className="relative">
          <span className="animate-ping-slow absolute -inset-4 rounded-full border border-brand-400/30" />
          <span className="absolute -inset-2 animate-spin rounded-full border-2 border-transparent border-t-brand-400 border-r-brand-400/40" />
          <LogoMark className="animate-float size-14" />
        </div>
        <p className="animate-fade-in text-xs font-medium tracking-wide text-zinc-500">{caption}</p>
      </div>
    </>
  );
}
