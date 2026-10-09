"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, token, isLoading } = useApp();
  const pathname = usePathname();
  const router = useRouter();

  const isAuthPage = pathname === "/auth";
  const isAuthenticated = Boolean(user && token);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated && !isAuthPage) {
      router.replace("/auth");
    } else if (isAuthenticated && isAuthPage) {
      router.replace("/");
    }
  }, [isLoading, isAuthenticated, isAuthPage, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center p-4">
        <div className="size-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center font-bold text-sm text-zinc-100 mb-3 shadow-md">
          BP
        </div>
        <div className="size-5 border-2 border-zinc-700 border-t-zinc-200 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated && !isAuthPage) {
    return null;
  }

  if (isAuthenticated && isAuthPage) {
    return null;
  }

  return <>{children}</>;
}
