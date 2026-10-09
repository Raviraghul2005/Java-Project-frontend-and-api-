"use client";

import React from "react";
import { useApp } from "@/context/AppContext";

export function ToastContainer() {
  const { toasts, removeToast } = useApp();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const isError = toast.type === "error";
        const isInfo = toast.type === "info";
        return (
          <div
            key={toast.id}
            onClick={() => removeToast(toast.id)}
            className={`pointer-events-auto flex items-center justify-between p-3.5 rounded-xl border shadow-xl backdrop-blur-xl text-sm transition-all animate-slide-up cursor-pointer ${
              isError
                ? "bg-rose-950/80 border-rose-500/40 text-rose-200"
                : isInfo
                ? "bg-slate-900/90 border-slate-700 text-slate-200"
                : "bg-emerald-950/80 border-emerald-500/40 text-emerald-200"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {isError ? (
                <svg className="size-4 text-rose-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              ) : isInfo ? (
                <svg className="size-4 text-zinc-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="size-4 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              <span className="font-medium">{toast.text}</span>
            </div>
            <button className="text-xs text-zinc-400 hover:text-white ml-2 transition-colors">✕</button>
          </div>
        );
      })}
    </div>
  );
}
