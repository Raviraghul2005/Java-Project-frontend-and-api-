"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { NAV_ITEMS, activeIndexFor } from "./nav";
import { useSlidingThumb } from "./useSlidingThumb";

/** Phone / small-tablet navigation: a floating tab bar along the bottom edge (the sidebar takes over from lg up). */
export function MobileTabBar() {
  const pathname = usePathname();
  const listRef = useRef<HTMLUListElement>(null);
  const thumbRef = useRef<HTMLSpanElement>(null);
  useSlidingThumb(listRef, thumbRef, activeIndexFor(pathname), "x");

  return (
    <nav aria-label="Primary (mobile)" className="glass fixed inset-x-3 bottom-3 z-40 rounded-2xl p-1.5 lg:hidden">
      <div className="relative">
        <span
          ref={thumbRef}
          aria-hidden="true"
          className="slider-thumb pointer-events-none absolute inset-y-0 left-0 rounded-xl bg-gradient-to-b from-brand-500 to-brand-600 opacity-0 shadow-glow"
        />
        <ul ref={listRef} className="relative flex">
          {NAV_ITEMS.map((item) => {
            const active = item.href === pathname;
            const Icon = item.icon;
            return (
              <li key={item.href} className="min-w-0 flex-1">
                <Link
                  href={item.href}
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[10px] font-semibold transition-colors duration-300",
                    active ? "text-white" : "text-zinc-400 active:text-zinc-100"
                  )}
                >
                  <Icon className="size-[19px]" />
                  <span className="max-w-full truncate" aria-hidden="true">
                    {item.short}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
