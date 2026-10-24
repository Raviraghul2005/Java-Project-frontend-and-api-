"use client";

import React, { useState } from "react";
import { useApp } from "@/context/AppContext";
import { cn } from "@/lib/cn";
import { AlertIcon, CheckIcon, InfoIcon, XIcon } from "@/components/ui/icons";

const TONES = {
  error: { ring: "border-rose-400/30", icon: "bg-rose-500/20 text-rose-300", bar: "from-rose-400 to-orange-300", Icon: AlertIcon },
  info: { ring: "border-brand-300/25", icon: "bg-brand-500/20 text-brand-200", bar: "from-brand-400 to-aqua-400", Icon: InfoIcon },
  success: { ring: "border-emerald-300/30", icon: "bg-emerald-400/20 text-emerald-300", bar: "from-emerald-300 to-aqua-400", Icon: CheckIcon }
} as const;

export function ToastContainer() {
  const { toasts, removeToast } = useApp();
  // Toasts dismissed by hand play their exit animation first, then are removed.
  const [dismissing, setDismissing] = useState<Set<string>>(new Set());

  if (toasts.length === 0) return null;

  const dismiss = (id: string) => {
    setDismissing((prev) => new Set(prev).add(id));
    setTimeout(() => removeToast(id), 280);
  };

  return (
    // aria-live region so screen readers announce toasts; errors use role="alert" for immediate announcement.
    <div aria-live="polite" className="pointer-events-none fixed bottom-24 right-4 z-[70] flex w-full max-w-sm flex-col gap-2.5 sm:right-6 lg:bottom-6">
      {toasts.map((toast) => {
        const tone = TONES[toast.type];
        const Icon = tone.Icon;
        const leaving = toast.leaving || dismissing.has(toast.id);
        return (
          <div
            key={toast.id}
            role={toast.type === "error" ? "alert" : "status"}
            className={cn(
              "glass pointer-events-auto relative flex items-center gap-3 overflow-hidden rounded-2xl border p-3.5 pr-3 text-sm text-zinc-100",
              tone.ring,
              leaving ? "animate-slide-out" : "animate-slide-up"
            )}
          >
            <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-xl", tone.icon)}>
              <Icon className="size-4" />
            </span>
            <span className="min-w-0 flex-1 font-medium leading-snug">{toast.text}</span>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => dismiss(toast.id)}
              className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              <XIcon className="size-3.5" />
            </button>
            <span aria-hidden="true" className={cn("toast-bar absolute inset-x-0 bottom-0 h-0.5 origin-left bg-gradient-to-r", tone.bar)} />
          </div>
        );
      })}
    </div>
  );
}
