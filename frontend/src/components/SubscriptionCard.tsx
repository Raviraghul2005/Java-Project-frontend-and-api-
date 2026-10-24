"use client";

import React, { useState } from "react";
import { Subscription } from "@/types";
import { categoryColor } from "@/lib/categoryColors";
import { cn } from "@/lib/cn";
import { daysUntil } from "@/lib/dates";
import { formatMoney, toMonthly } from "@/lib/money";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PencilIcon, TrashIcon } from "@/components/ui/icons";
import { SubLogo } from "@/components/ui/SubLogo";

interface SubscriptionCardProps {
  subscription: Subscription;
  onEdit: (sub: Subscription) => void;
  onCancel: (id: string) => void;
  onReactivate?: (id: string) => void;
  onDelete: (id: string) => void;
  /** Position in the grid; later cards enter a little after earlier ones. */
  index?: number;
}

/** Days in one billing cycle, for the "how far into this cycle are we" bar. */
const CYCLE_DAYS: Record<Subscription["frequency"], number> = { daily: 1, weekly: 7, monthly: 30, yearly: 365 };

export function SubscriptionCard({
  subscription,
  onEdit,
  onCancel,
  onReactivate,
  onDelete,
  index = 0
}: SubscriptionCardProps) {
  const [pendingAction, setPendingAction] = useState<"cancel" | "delete" | null>(null);

  const isCancelled = subscription.status === "cancelled";
  const isExpired = subscription.status === "expired";
  const isInactive = isCancelled || isExpired;
  const currency = subscription.currency || "USD";

  // Whole calendar days until renewal, computed from local dates (null when no/invalid renewal date)
  const daysLeft = daysUntil(subscription.renewalDate);
  const monthlyPrice = toMonthly(subscription.price, subscription.frequency);

  // 0 = just renewed, 100 = renews today. Tone follows how close it is.
  const cycle = CYCLE_DAYS[subscription.frequency] ?? 30;
  const progress = daysLeft === null || isInactive ? 0 : Math.min(100, Math.max(0, ((cycle - Math.min(daysLeft, cycle)) / cycle) * 100));
  const urgent = daysLeft !== null && daysLeft <= 3;
  const soon = daysLeft !== null && daysLeft <= 7;

  const handleConfirm = () => {
    if (pendingAction === "cancel") onCancel(subscription.id);
    if (pendingAction === "delete") onDelete(subscription.id);
    setPendingAction(null);
  };

  const accent = categoryColor(subscription.category);

  return (
    <div
      data-testid="subscription-card"
      style={{ "--i": Math.min(index, 14) } as React.CSSProperties}
      className={cn(
        "group spotlight surface lift reveal flex flex-col justify-between p-5",
        isCancelled && "opacity-60 saturate-50"
      )}
    >
      <div>
        {/* Top Header: Logo, Service Name & Status */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3.5">
            <SubLogo name={subscription.name} className="size-12" />

            <div className="min-w-0">
              <h3 className="truncate text-[15px] font-bold tracking-tight text-zinc-50">{subscription.name}</h3>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs capitalize text-zinc-400">
                <span className="size-1.5 shrink-0 rounded-full" style={{ background: accent, boxShadow: `0 0 8px ${accent}` }} />
                <span className="truncate">
                  {subscription.category} • {subscription.paymentMethod || "Direct Payment"}
                </span>
              </p>
            </div>
          </div>

          {/* Status Badge */}
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset",
              isCancelled
                ? "bg-zinc-500/10 text-zinc-400 ring-zinc-400/20"
                : isExpired
                  ? "bg-rose-500/10 text-rose-300 ring-rose-400/25"
                  : "bg-emerald-400/10 text-emerald-300 ring-emerald-300/25"
            )}
          >
            {subscription.status}
          </span>
        </div>

        {/* Pricing */}
        <div className="mb-4 flex items-baseline justify-between border-t border-white/[0.06] pt-4">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold tracking-tight text-zinc-50 tabular">
              {formatMoney(subscription.price, currency)}
            </span>
            <span className="text-xs text-zinc-400">/{subscription.frequency}</span>
          </div>

          {subscription.frequency !== "monthly" && (
            <span className="text-xs text-zinc-400 tabular">~{formatMoney(monthlyPrice, currency)}/mo</span>
          )}
        </div>

        {/* Renewal Schedule */}
        <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-black/25 px-3 py-2 text-xs text-zinc-300">
          <span className="text-zinc-400">Renewal</span>
          <span className="font-semibold">
            {isInactive ? (
              <span className="text-zinc-500">Inactive</span>
            ) : daysLeft !== null ? (
              daysLeft < 0 ? (
                <span className="text-rose-400">Overdue</span>
              ) : daysLeft === 0 ? (
                <span className="font-bold text-amber-400">Today</span>
              ) : daysLeft === 1 ? (
                <span className="text-amber-300">Tomorrow</span>
              ) : (
                <span className="tabular">{daysLeft} days ({subscription.renewalDate})</span>
              )
            ) : (
              <span className="text-zinc-500">Not set</span>
            )}
          </span>
        </div>

        {!isInactive && daysLeft !== null && (
          <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/[0.07]" aria-hidden="true">
            <div
              className={cn(
                "bar-grow h-full rounded-full",
                urgent ? "bg-gradient-to-r from-rose-500 to-orange-400" : soon ? "bg-gradient-to-r from-amber-400 to-yellow-300" : "bg-gradient-to-r from-brand-500 to-aqua-400"
              )}
              style={{ width: `${progress}%`, "--i": Math.min(index, 14) } as React.CSSProperties}
            />
          </div>
        )}
      </div>

      {/* Action Controls Footer */}
      <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3 text-xs">
        <span className="rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-zinc-400">{currency}</span>

        <div className="flex items-center gap-0.5 opacity-70 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100">
          {isInactive ? (
            <button
              type="button"
              onClick={() => onReactivate?.(subscription.id)}
              className="cursor-pointer rounded-lg px-2.5 py-1.5 font-semibold text-emerald-300 transition-colors hover:bg-emerald-400/10"
            >
              Reactivate
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setPendingAction("cancel")}
              className="cursor-pointer rounded-lg px-2.5 py-1.5 font-medium text-zinc-400 transition-colors hover:bg-white/[0.07] hover:text-zinc-100"
            >
              Cancel
            </button>
          )}

          <button
            type="button"
            onClick={() => onEdit(subscription)}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium text-zinc-400 transition-colors hover:bg-brand-500/15 hover:text-brand-200"
          >
            <PencilIcon className="size-3.5" aria-hidden="true" />
            Edit
          </button>

          <button
            type="button"
            onClick={() => setPendingAction("delete")}
            className="cursor-pointer rounded-lg p-2 text-zinc-500 transition-colors hover:bg-rose-500/15 hover:text-rose-300"
            title="Delete"
            aria-label={`Delete ${subscription.name}`}
          >
            <TrashIcon className="size-3.5" />
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={pendingAction !== null}
        title={pendingAction === "delete" ? `Delete ${subscription.name}?` : `Cancel ${subscription.name}?`}
        message={
          pendingAction === "delete"
            ? "This permanently removes the subscription and its history. This cannot be undone."
            : "The subscription will be marked as cancelled and excluded from spend and renewal tracking. You can reactivate it later."
        }
        confirmLabel={pendingAction === "delete" ? "Delete" : "Cancel subscription"}
        destructive={pendingAction === "delete"}
        onConfirm={handleConfirm}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
}
