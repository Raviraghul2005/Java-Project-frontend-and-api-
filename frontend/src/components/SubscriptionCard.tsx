"use client";

import React, { useState } from "react";
import { Subscription } from "@/types";
import { findLogoForSubscription, getSubscriptionInitials } from "@/lib/catalog";
import { daysUntil } from "@/lib/dates";
import { formatMoney, toMonthly } from "@/lib/money";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface SubscriptionCardProps {
  subscription: Subscription;
  onEdit: (sub: Subscription) => void;
  onCancel: (id: string) => void;
  onReactivate?: (id: string) => void;
  onDelete: (id: string) => void;
}

export function SubscriptionCard({
  subscription,
  onEdit,
  onCancel,
  onReactivate,
  onDelete
}: SubscriptionCardProps) {
  const [pendingAction, setPendingAction] = useState<"cancel" | "delete" | null>(null);

  const logoUrl = findLogoForSubscription(subscription.name);
  const initials = getSubscriptionInitials(subscription.name);
  const isCancelled = subscription.status === "cancelled";
  const isExpired = subscription.status === "expired";
  const isInactive = isCancelled || isExpired;
  const currency = subscription.currency || "USD";

  // Whole calendar days until renewal, computed from local dates (null when no/invalid renewal date)
  const daysLeft = daysUntil(subscription.renewalDate);
  const monthlyPrice = toMonthly(subscription.price, subscription.frequency);

  const handleConfirm = () => {
    if (pendingAction === "cancel") onCancel(subscription.id);
    if (pendingAction === "delete") onDelete(subscription.id);
    setPendingAction(null);
  };

  return (
    <div
      data-testid="subscription-card"
      className={`group rounded-xl border p-4.5 transition-all flex flex-col justify-between ${
        isCancelled
          ? "border-zinc-800/50 bg-zinc-950/40 opacity-60"
          : "border-zinc-800/80 bg-zinc-900/40 hover:bg-zinc-900/70 hover:border-zinc-700"
      }`}
    >
      <div>
        {/* Top Header: Logo, Service Name & Status */}
        <div className="flex items-start justify-between gap-3 mb-3.5">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-zinc-950 border border-zinc-800/80 flex items-center justify-center p-2 flex-shrink-0 overflow-hidden">
              {logoUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={logoUrl}
                  alt=""
                  className="size-full object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <span className="text-xs font-semibold text-zinc-300">{initials}</span>
              )}
            </div>

            <div>
              <h3 className="font-medium text-sm text-zinc-100 group-hover:text-white transition-colors">
                {subscription.name}
              </h3>
              <p className="text-xs text-zinc-400 capitalize">
                {subscription.category} • {subscription.paymentMethod || "Direct Payment"}
              </p>
            </div>
          </div>

          {/* Status Badge */}
          <span
            className={`text-[11px] px-2 py-0.5 rounded-md font-medium border ${
              isCancelled
                ? "bg-zinc-800/50 text-zinc-400 border-zinc-700/50"
                : isExpired
                ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
            }`}
          >
            {subscription.status}
          </span>
        </div>

        {/* Pricing */}
        <div className="flex items-baseline justify-between mb-3.5 pt-1 border-t border-zinc-800/40">
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-semibold text-zinc-100 tabular">
              {formatMoney(subscription.price, currency)}
            </span>
            <span className="text-xs text-zinc-400">/{subscription.frequency}</span>
          </div>

          {subscription.frequency !== "monthly" && (
            <span className="text-xs text-zinc-400 tabular">
              ~{formatMoney(monthlyPrice, currency)}/mo
            </span>
          )}
        </div>

        {/* Renewal Schedule Pill */}
        <div className="text-xs text-zinc-300 py-1.5 px-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800/60 flex items-center justify-between mb-2">
          <span className="text-zinc-400">Renewal</span>
          <span className="font-medium">
            {isInactive ? (
              <span className="text-zinc-500">Inactive</span>
            ) : daysLeft !== null ? (
              daysLeft < 0 ? (
                <span className="text-rose-400">Overdue</span>
              ) : daysLeft === 0 ? (
                <span className="text-amber-400 font-semibold">Today</span>
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
      </div>

      {/* Action Controls Footer */}
      <div className="flex items-center justify-between pt-3 mt-1 border-t border-zinc-800/50 text-xs">
        <span className="text-zinc-400 text-[11px]">{currency}</span>

        <div className="flex items-center gap-1">
          {isInactive ? (
            <button
              type="button"
              onClick={() => onReactivate?.(subscription.id)}
              className="px-2 py-1 rounded text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors cursor-pointer"
            >
              Reactivate
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setPendingAction("cancel")}
              className="px-2 py-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          )}

          <button
            type="button"
            onClick={() => onEdit(subscription)}
            className="px-2 py-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            Edit
          </button>

          <button
            type="button"
            onClick={() => setPendingAction("delete")}
            className="px-1.5 py-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
            title="Delete"
            aria-label={`Delete ${subscription.name}`}
          >
            <svg aria-hidden="true" className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
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
