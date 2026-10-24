"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useApp } from "@/context/AppContext";
import { cn } from "@/lib/cn";
import { initialsOf } from "@/lib/people";
import { LogOutIcon, LogoMark, PlusIcon, SearchIcon } from "@/components/ui/icons";
import { NotificationBell } from "./NotificationBell";
import { useShell } from "./ShellContext";

/** Small avatar menu for screens without the sidebar: shows who is signed in and offers Sign out. */
function UserMenu() {
  const { user, logout } = useApp();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;
  return (
    <div ref={rootRef} className="relative lg:hidden">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((v) => !v)}
        className="flex size-10 cursor-pointer items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-blush-400 text-[13px] font-extrabold text-white shadow-inner"
      >
        {initialsOf(user.name)}
      </button>
      {open && (
        <div className="glass animate-scale-in absolute right-0 top-[calc(100%+0.6rem)] z-50 w-60 origin-top-right rounded-2xl p-2">
          <div className="px-3 py-2">
            <p className="truncate text-sm font-semibold text-zinc-100">{user.name}</p>
            <p className="truncate text-[11px] text-zinc-500">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-rose-300 transition-colors hover:bg-rose-500/12"
          >
            <LogOutIcon className="size-[18px]" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function Topbar() {
  const { isBackendConnected } = useApp();
  const { openCreate, openPalette } = useShell();
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 6);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex items-center gap-3 px-4 py-3.5 transition-[background-color,box-shadow,backdrop-filter] duration-500 sm:px-6 lg:px-8",
        stuck ? "border-b border-white/[0.06] bg-[#07060c]/70 backdrop-blur-xl" : "border-b border-transparent"
      )}
    >
      <Link href="/" className="flex items-center gap-2.5 lg:hidden">
        <LogoMark className="size-9" />
        <span className="text-gradient text-base font-extrabold tracking-tight">Bill Pilot</span>
      </Link>

      <button
        type="button"
        onClick={openPalette}
        aria-label="Search or jump to"
        className="group hidden w-full max-w-sm cursor-pointer items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-left text-[13px] text-zinc-500 transition-all duration-300 hover:border-brand-400/40 hover:bg-white/[0.07] hover:text-zinc-300 md:flex"
      >
        <SearchIcon className="size-4 shrink-0 transition-colors group-hover:text-brand-300" />
        <span className="flex-1 truncate">Search or jump to…</span>
        <kbd className="rounded-md border border-white/10 bg-white/[0.05] px-1.5 py-0.5 text-[10px] font-semibold text-zinc-400">Ctrl K</kbd>
      </button>

      <div className="ml-auto flex items-center gap-2.5">
        <div className="hidden items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[11px] font-medium text-zinc-400 sm:flex">
          <span className="relative flex size-2">
            <span className={cn("absolute inline-flex size-full rounded-full opacity-60", isBackendConnected ? "animate-ping-slow bg-emerald-400" : "bg-rose-400")} />
            <span className={cn("relative inline-flex size-2 rounded-full", isBackendConnected ? "bg-emerald-400" : "bg-rose-400")} />
          </span>
          <span>{isBackendConnected ? "API online" : "API offline"}</span>
        </div>

        <button type="button" onClick={openPalette} aria-label="Search" className="flex size-10 cursor-pointer items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-zinc-300 transition-colors hover:bg-white/[0.08] hover:text-white md:hidden">
          <SearchIcon className="size-[18px]" />
        </button>

        <NotificationBell />

        <button type="button" onClick={openCreate} className="btn-primary h-10">
          <PlusIcon className="size-4" />
          New
        </button>

        <UserMenu />
      </div>
    </header>
  );
}
