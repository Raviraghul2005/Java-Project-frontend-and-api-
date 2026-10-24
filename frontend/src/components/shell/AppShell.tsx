"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { SubscriptionModal } from "@/components/SubscriptionModal";
import { SpotlightTracker } from "@/components/ui/SpotlightTracker";
import { AppBackground } from "./AppBackground";
import { CommandPalette } from "./CommandPalette";
import { MobileTabBar } from "./MobileTabBar";
import { ShellContext } from "./ShellContext";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

/**
 * The frame around every signed-in page: animated backdrop, sidebar (desktop) or tab bar (mobile), top bar, the
 * shared "new subscription" dialog and the command palette. The sign-in page gets only the backdrop.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [createOpen, setCreateOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const openCreate = useCallback(() => setCreateOpen(true), []);
  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const context = useMemo(() => ({ openCreate, openPalette }), [openCreate, openPalette]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  if (pathname === "/auth") {
    return (
      <>
        <AppBackground />
        {children}
      </>
    );
  }

  return (
    <ShellContext.Provider value={context}>
      <AppBackground />
      <SpotlightTracker />
      <Sidebar />
      <div className="flex min-h-screen flex-col lg:pl-72 xl:pl-[19rem]">
        <Topbar />
        <main className="mx-auto w-full max-w-[1500px] flex-1 px-4 pb-32 sm:px-6 lg:px-8 lg:pb-14">{children}</main>
      </div>
      <MobileTabBar />
      <SubscriptionModal isOpen={createOpen} onClose={() => setCreateOpen(false)} />
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} onCreate={openCreate} />}
    </ShellContext.Provider>
  );
}
