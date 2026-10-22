"use client";

import React, { useId } from "react";
import { createPortal } from "react-dom";
import { useDialog } from "@/lib/useDialog";

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
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
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
        className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl"
      >
        <h2 id={titleId} className="text-sm font-semibold text-zinc-100">
          {title}
        </h2>
        <p id={descriptionId} className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
          {message}
        </p>

        <div className="flex items-center justify-end gap-2.5 mt-5">
          <button
            type="button"
            data-autofocus
            onClick={onCancel}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 transition-colors cursor-pointer"
          >
            Keep
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              destructive
                ? "bg-rose-600 hover:bg-rose-500 text-white"
                : "bg-zinc-100 hover:bg-white text-zinc-950"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
