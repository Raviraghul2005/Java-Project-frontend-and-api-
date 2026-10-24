"use client";

import React, { useId } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { useDialog } from "@/lib/useDialog";
import { AlertIcon, InfoIcon } from "@/components/ui/icons";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  /** Styles the confirm button as a destructive action. */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  destructive = false,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useDialog<HTMLDivElement>(isOpen, onCancel);

  if (!isOpen) return null;

  // Portal to <body> so an ancestor's opacity/transform (e.g. a dimmed cancelled card) cannot affect the dialog.
  return createPortal(
    <div
      className="animate-fade-in fixed inset-0 z-[60] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="glass animate-scale-in w-full max-w-sm rounded-3xl p-6"
      >
        <span
          className={cn(
            "mb-4 flex size-11 items-center justify-center rounded-2xl ring-1 ring-inset",
            destructive ? "bg-rose-500/15 text-rose-300 ring-rose-400/25" : "bg-brand-500/15 text-brand-200 ring-brand-300/25"
          )}
        >
          {destructive ? <AlertIcon className="size-5" /> : <InfoIcon className="size-5" />}
        </span>
        <h2 id={titleId} className="text-base font-bold tracking-tight text-zinc-50">
          {title}
        </h2>
        <p id={descriptionId} className="mt-1.5 text-[13px] leading-relaxed text-zinc-400">
          {message}
        </p>

        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button type="button" data-autofocus onClick={onCancel} className="btn-ghost px-4 py-2 text-[13px]">
            Keep
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={cn(
              "cursor-pointer rounded-xl px-4 py-2 text-[13px] font-semibold text-white transition-all duration-300 active:scale-95",
              destructive
                ? "bg-gradient-to-b from-rose-500 to-rose-600 shadow-[0_8px_22px_-8px_rgb(244_63_94/0.9)] hover:brightness-110"
                : "bg-gradient-to-b from-brand-500 to-brand-600 shadow-[0_8px_22px_-8px_rgb(124_92_255/0.9)] hover:brightness-110"
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
