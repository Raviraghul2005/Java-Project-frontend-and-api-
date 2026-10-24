"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { isTokenExpired } from "@/lib/auth";
import { BrandLoader } from "@/components/ui/BrandLoader";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, token, isLoading } = useApp();
  const pathname = usePathname();
  const router = useRouter();

  const isAuthPage = pathname === "/auth";
  // Presence of a session is not enough: a token whose `exp` has passed is treated as signed out.
  // The API still enforces authorization on every request; this keeps the UI from showing stale pages.
  const isAuthenticated = Boolean(user && token && !isTokenExpired(token));

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated && !isAuthPage) {
      router.replace("/auth");
    } else if (isAuthenticated && isAuthPage) {
      router.replace("/");
    }
  }, [isLoading, isAuthenticated, isAuthPage, router]);

  if (isLoading) {
    return <BrandLoader />;
  }

  // While a redirect is in flight show the loader rather than an empty page.
  if (!isAuthenticated && !isAuthPage) {
    return <BrandLoader caption="Taking you to sign in…" />;
  }

  if (isAuthenticated && isAuthPage) {
    return <BrandLoader caption="Opening your dashboard…" />;
  }

  return <>{children}</>;
}
