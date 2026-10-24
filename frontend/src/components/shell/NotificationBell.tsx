"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { cn } from "@/lib/cn";
import { daysUntil } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { DUE_TONE_CLASSES, describeDue } from "@/lib/renewal";
import { BellIcon, CheckIcon } from "@/components/ui/icons";
import { SubLogo } from "@/components/ui/SubLogo";

/** Bell with a count of renewals due within a week (or overdue); opens a small list of them. */
export function NotificationBell() {
  const { subscriptions } = useApp();
  const pathname = usePathname();
  // The dropdown belongs to the page it was opened on: remembering that path closes it when you navigate.
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;
  const setOpen = (next: boolean) => setOpenPath(next ? pathname : null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const due = useMemo(
    () =>
      subscriptions
        .filter((s) => s.status === "active")
        .map((s) => ({ sub: s, days: daysUntil(s.renewalDate) }))
        .filter((x): x is { sub: typeof x.sub; days: number } => x.days !== null && x.days <= 7)
        .sort((a, b) => a.days - b.days),
    [subscriptions]
  );

  // Close on outside click and Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpenPath(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenPath(null);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={due.length > 0 ? `Renewal alerts, ${due.length} due soon` : "Renewal alerts, nothing due soon"}
        className={cn(
          "relative flex size-10 cursor-pointer items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-zinc-300 transition-all duration-300 hover:border-white/[0.18] hover:bg-white/[0.08] hover:text-white",
          open && "border-brand-400/50 bg-brand-500/15 text-white"
        )}
      >
        <BellIcon className={cn("size-[18px] origin-top transition-transform", due.length > 0 && "hover:animate-[bell-ring_0.7s_ease-in-out]")} />
        {due.length > 0 && (
          <span className="absolute -right-1 -top-1 flex size-[18px] items-center justify-center">
            <span className="animate-ping-slow absolute inline-flex size-full rounded-full bg-rose-400/60" />
            <span className="relative flex size-[18px] items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2 ring-zinc-950">
              {due.length}
            </span>
          </span>
        )}
      </button>

      {open && (
        <div
          role="region"
          aria-label="Upcoming renewals"
          className="glass animate-scale-in absolute right-0 top-[calc(100%+0.6rem)] z-50 w-[min(22rem,calc(100vw-2rem))] origin-top-right rounded-2xl p-2"
        >
          <div className="flex items-center justify-between px-3 pb-2 pt-2">
            <p className="text-sm font-bold text-zinc-100">Renewals this week</p>
            <span className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[11px] font-semibold text-zinc-300">{due.length}</span>
          </div>

          {due.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 pb-6 pt-4 text-center">
              <span className="flex size-11 items-center justify-center rounded-full bg-emerald-400/12 text-emerald-300 ring-1 ring-emerald-300/25">
                <CheckIcon className="size-5" />
              </span>
              <p className="text-sm font-semibold text-zinc-200">You&apos;re all clear</p>
              <p className="text-xs text-zinc-500">Nothing renews in the next 7 days.</p>
            </div>
          ) : (
            <ul className="max-h-80 space-y-0.5 overflow-y-auto pr-0.5">
              {due.map(({ sub, days }, i) => {
                const info = describeDue(days)!;
                return (
                  <li key={sub.id} className="reveal" style={{ "--i": i } as React.CSSProperties}>
                    <Link
                      href="/"
                      className="flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors duration-200 hover:bg-white/[0.06]"
                    >
                      <SubLogo name={sub.name} className="size-9" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-zinc-100">{sub.name}</span>
                        <span className="block text-[11px] tabular-nums text-zinc-500">
                          {formatMoney(sub.price, sub.currency)} / {sub.frequency}
                        </span>
                      </span>
                      <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold", DUE_TONE_CLASSES[info.tone])}>
                        {info.label}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
