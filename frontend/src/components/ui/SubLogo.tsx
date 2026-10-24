"use client";

import React, { useState } from "react";
import { findLogoForSubscription, getSubscriptionInitials } from "@/lib/catalog";
import { cn } from "@/lib/cn";

/** Brand logo tile for a subscription; falls back to its initials when there is no logo or it fails to load. */
export function SubLogo({ name, className }: { name: string; className?: string }) {
  const logoUrl = findLogoForSubscription(name);
  const [failed, setFailed] = useState(false);

  return (
    <span
      className={cn(
        "relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.09] to-white/[0.02] shadow-inner",
        className
      )}
    >
      {logoUrl && !failed ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={logoUrl} alt="" className="size-[58%] object-contain" onError={() => setFailed(true)} />
      ) : (
        <span className="text-[11px] font-extrabold tracking-wide text-brand-200">{getSubscriptionInitials(name)}</span>
      )}
    </span>
  );
}
