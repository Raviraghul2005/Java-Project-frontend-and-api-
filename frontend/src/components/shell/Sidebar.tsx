"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { cn } from "@/lib/cn";
import { initialsOf } from "@/lib/people";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { LogoMark, LogOutIcon, ArrowUpRightIcon } from "@/components/ui/icons";
import { RingGauge } from "@/components/ui/RingGauge";
import { NAV_ITEMS, activeIndexFor } from "./nav";
import { useSlidingThumb } from "./useSlidingThumb";

/** Desktop navigation: a floating glass panel whose active pill glides from one page to the next. */
export function Sidebar() {
  const pathname = usePathname();
  const { user, analytics, logout } = useApp();
  const listRef = useRef<HTMLUListElement>(null);
  const thumbRef = useRef<HTMLSpanElement>(null);
  useSlidingThumb(listRef, thumbRef, activeIndexFor(pathname), "y");

  return (
    <aside className="glass fixed bottom-4 left-4 top-4 z-40 hidden w-64 flex-col rounded-3xl p-3.5 lg:flex xl:w-[17rem]">
      <Link href="/" className="group flex items-center gap-3 px-2 pb-5 pt-2">
        <LogoMark className="size-10 transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-105" />
        <span className="flex flex-col leading-tight">
          <span className="text-gradient text-[17px] font-extrabold tracking-tight">Bill Pilot</span>
          <span className="text-[11px] text-zinc-500">Subscription intelligence</span>
        </span>
      </Link>

      <nav aria-label="Primary" className="relative">
        <span
          ref={thumbRef}
          aria-hidden="true"
          className="slider-thumb pointer-events-none absolute inset-x-0 top-0 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 opacity-0 shadow-glow"
        />
        <ul ref={listRef} className="relative flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = item.href === pathname;
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13.5px] font-semibold transition-colors duration-300",
                    active ? "text-white" : "text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100"
                  )}
                >
                  <Icon className={cn("size-[18px] shrink-0 transition-transform duration-300", !active && "group-hover:-rotate-6 group-hover:scale-110")} />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-auto flex flex-col gap-3 pt-4">
        {analytics && (
          <Link
            href="/analytics"
            className="spotlight surface group flex items-center gap-3 p-3"
            aria-label={`Fatigue index ${analytics.fatigueIndex} out of 100, ${analytics.fatigueLevel}. Open the audit`}
          >
            <RingGauge value={analytics.fatigueIndex} color={analytics.fatigueColor} size={52} thickness={4}>
              <AnimatedNumber value={analytics.fatigueIndex} className="text-[13px] font-extrabold text-zinc-50" />
            </RingGauge>
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="text-[11px] font-medium text-zinc-400">Fatigue index</span>
              <span className="truncate text-sm font-bold capitalize" style={{ color: analytics.fatigueColor }}>
                {analytics.fatigueLevel.toLowerCase()}
              </span>
            </span>
            <ArrowUpRightIcon className="size-4 text-zinc-500 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand-300" />
          </Link>
        )}

        {user && (
          <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-2.5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-blush-400 text-[13px] font-extrabold text-white shadow-inner">
              {initialsOf(user.name)}
            </span>
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate text-sm font-semibold text-zinc-100">{user.name}</span>
              <span className="truncate text-[11px] text-zinc-500">{user.email}</span>
            </span>
            <button
              type="button"
              onClick={logout}
              aria-label="Sign out"
              title="Sign out"
              className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-zinc-400 transition-colors duration-200 hover:bg-rose-500/15 hover:text-rose-300"
            >
              <LogOutIcon className="size-[18px]" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
