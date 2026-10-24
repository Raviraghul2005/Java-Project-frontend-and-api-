"use client";

import React, { useState, useId, useRef } from "react";
import { Subscription, CreateSubscriptionInput, Frequency, Category, SubscriptionStatus } from "@/types";
import { PRESET_SUBSCRIPTIONS } from "@/lib/catalog";
import { useApp } from "@/context/AppContext";
import { todayLocal } from "@/lib/dates";
import { useDialog } from "@/lib/useDialog";

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingSubscription?: Subscription | null;
}

const CURRENCIES = [
  { code: "USD", label: "USD ($)" },
  { code: "EUR", label: "EUR (€)" },
  { code: "GBP", label: "GBP (£)" },
  { code: "INR", label: "INR (₹)" },
  { code: "CAD", label: "CAD ($)" },
  { code: "AUD", label: "AUD ($)" }
];

const inputClass = "field";
const labelClass = "mb-1.5 block text-xs font-semibold text-zinc-300";

/**
 * The form is mounted only while the dialog is open, and keyed by the subscription being edited, so its
 * state is initialised fresh from props every time it opens (no reset-in-an-effect needed).
 */
export function SubscriptionModal(props: SubscriptionModalProps) {
  if (!props.isOpen) return null;
  return <SubscriptionModalContent key={props.editingSubscription?.id ?? "new"} {...props} />;
}

function SubscriptionModalContent({ onClose, editingSubscription }: SubscriptionModalProps) {
  const { createSub, updateSub, addToast } = useApp();
  const uid = useId();
  const id = (field: string) => `${uid}-${field}`;
  const dialogRef = useDialog<HTMLDivElement>(true, onClose);
  const mouseDownOnBackdrop = useRef(false);

  const [name, setName] = useState(editingSubscription?.name ?? "");
  const [price, setPrice] = useState(editingSubscription ? String(editingSubscription.price) : "");
  const [currency, setCurrency] = useState(editingSubscription?.currency || "USD");
  const [frequency, setFrequency] = useState<Frequency>(editingSubscription?.frequency || "monthly");
  const [category, setCategory] = useState<Category>(editingSubscription?.category || "entertainment");
  const [paymentMethod, setPaymentMethod] = useState(
    editingSubscription ? editingSubscription.paymentMethod || "Credit Card" : "Credit Card"
  );
  const [startDate, setStartDate] = useState(editingSubscription ? editingSubscription.startDate || "" : todayLocal());
  const [renewalDate, setRenewalDate] = useState(editingSubscription?.renewalDate || "");
  const [status, setStatus] = useState<SubscriptionStatus>(editingSubscription?.status || "active");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSelectPreset = (preset: (typeof PRESET_SUBSCRIPTIONS)[0]) => {
    setName(preset.name);
    setPrice(String(preset.price));
    setCurrency(preset.currency);
    setFrequency(preset.frequency);
    setCategory(preset.category);
    setPaymentMethod(preset.paymentMethod);
    addToast(`Selected ${preset.name}`, "info");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedPayment = paymentMethod.trim();

    if (!trimmedName || !price || !startDate || !trimmedPayment) {
      addToast("Please fill in all required fields", "error");
      return;
    }
    if (trimmedName.length < 2 || trimmedName.length > 100) {
      addToast("Service name must be between 2 and 100 characters", "error");
      return;
    }
    const parsedPrice = parseFloat(price);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0 || parsedPrice > 1_000_000) {
      addToast("Please enter a valid price between 0 and 1,000,000", "error");
      return;
    }

    setIsSubmitting(true);

    // Only send a renewal date the user actually set/changed. When it is omitted the server derives the
    // next billing date from the start date and frequency (and keeps it current as time passes).
    const renewalChanged = editingSubscription
      ? renewalDate !== (editingSubscription.renewalDate || "")
      : renewalDate !== "";

    const payload: CreateSubscriptionInput = {
      name: trimmedName,
      price: parsedPrice,
      currency,
      frequency,
      category,
      paymentMethod: trimmedPayment,
      startDate,
      renewalDate: renewalChanged && renewalDate ? renewalDate : undefined
    };
    let success: boolean;
    if (editingSubscription) {
      // Sending frequency/startDate makes the server recompute the renewal date, so only include them when
      // they changed; otherwise saving an unrelated field would overwrite a manually set renewal date.
      const update: Partial<CreateSubscriptionInput> = { ...payload, status };
      if (frequency === editingSubscription.frequency) delete update.frequency;
      if (startDate === editingSubscription.startDate) delete update.startDate;
      success = await updateSub(editingSubscription.id, update);
    } else {
      success = await createSub(payload);
    }

    setIsSubmitting(false);
    if (success) {
      onClose();
    }
  };

  return (
    <div
      // Close only on a genuine click on the backdrop: pressing inside a field and releasing outside
      // (e.g. while selecting text) must not discard the form.
      onMouseDown={(e) => {
        mouseDownOnBackdrop.current = e.target === e.currentTarget;
      }}
      onMouseUp={(e) => {
        if (mouseDownOnBackdrop.current && e.target === e.currentTarget) onClose();
        mouseDownOnBackdrop.current = false;
      }}
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/65 p-4 backdrop-blur-sm"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id("title")}
        className="glass animate-scale-in relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl p-6 sm:p-7"
      >
        {/* Header */}
        <div className="mb-5 flex items-center justify-between border-b border-white/[0.07] pb-4">
          <div>
            <h2 id={id("title")} className="text-lg font-bold tracking-tight text-zinc-50">
              {editingSubscription ? "Edit Subscription" : "Add Subscription"}
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              {editingSubscription
                ? "Update pricing, billing cadence, or category"
                : "Select a curated preset or enter custom service details"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="flex size-8 cursor-pointer items-center justify-center rounded-lg bg-white/[0.06] text-zinc-400 transition-all duration-200 hover:rotate-90 hover:bg-white/[0.12] hover:text-white"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        {/* Preset Selector */}
        {!editingSubscription && (
          <div className="mb-5">
            <span className="block text-xs font-medium text-zinc-400 mb-2">Popular Presets</span>
            <div className="grid max-h-36 grid-cols-2 gap-1.5 overflow-y-auto rounded-2xl border border-white/[0.07] bg-black/30 p-2 sm:grid-cols-4">
              {PRESET_SUBSCRIPTIONS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className="group flex cursor-pointer items-center gap-2 rounded-xl p-2 text-left transition-all duration-200 hover:bg-brand-500/15"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={preset.logo}
                    alt=""
                    className="size-4 object-contain flex-shrink-0"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                  <div className="truncate">
                    <div className="text-xs font-medium text-zinc-300 group-hover:text-white truncate">
                      {preset.name}
                    </div>
                    <div className="text-[10px] text-zinc-500 tabular">
                      ${preset.price}/{preset.frequency === "monthly" ? "mo" : "yr"}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor={id("name")} className={labelClass}>
              Service Name *
            </label>
            <input
              id={id("name")}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Netflix, Claude Pro, Spotify"
              required
              minLength={2}
              maxLength={100}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor={id("price")} className={labelClass}>
                Price *
              </label>
              <input
                id={id("price")}
                type="number"
                step="0.01"
                min="0"
                max="1000000"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="19.99"
                required
                className={`${inputClass} tabular`}
              />
            </div>

            <div>
              <label htmlFor={id("currency")} className={labelClass}>
                Currency
              </label>
              <select
                id={id("currency")}
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className={inputClass}
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor={id("frequency")} className={labelClass}>
                Billing Frequency *
              </label>
              <select
                id={id("frequency")}
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as Frequency)}
                className={inputClass}
              >
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                <option value="weekly">Weekly</option>
                <option value="daily">Daily</option>
              </select>
            </div>

            <div>
              <label htmlFor={id("category")} className={labelClass}>
                Category *
              </label>
              <select
                id={id("category")}
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className={inputClass}
              >
                <option value="entertainment">Entertainment</option>
                <option value="technology">Technology</option>
                <option value="lifestyle">Lifestyle</option>
                <option value="news">News</option>
                <option value="sports">Sports</option>
                <option value="finance">Finance</option>
                <option value="politics">Politics</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {editingSubscription && (
            <div>
              <label htmlFor={id("status")} className={labelClass}>
                Status
              </label>
              <select
                id={id("status")}
                value={status}
                onChange={(e) => setStatus(e.target.value as SubscriptionStatus)}
                className={inputClass}
              >
                <option value="active">Active</option>
                <option value="cancelled">Cancelled</option>
                <option value="expired">Expired</option>
              </select>
            </div>
          )}

          <div>
            <label htmlFor={id("payment")} className={labelClass}>
              Payment Method *
            </label>
            <input
              id={id("payment")}
              type="text"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              placeholder="e.g. Apple Pay, Credit Card (Visa), PayPal"
              required
              maxLength={100}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor={id("start")} className={labelClass}>
                Start Date *
              </label>
              <input
                id={id("start")}
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                min="1970-01-01"
                max="2200-12-31"
                className={`${inputClass} tabular`}
              />
            </div>

            <div>
              <label htmlFor={id("renewal")} className={labelClass}>
                Next Renewal Date (Optional)
              </label>
              <input
                id={id("renewal")}
                type="date"
                value={renewalDate}
                onChange={(e) => setRenewalDate(e.target.value)}
                aria-describedby={id("renewal-hint")}
                min="1970-01-01"
                max="2200-12-31"
                className={`${inputClass} tabular`}
              />
              <span id={id("renewal-hint")} className="text-[10px] text-zinc-500 block mt-0.5">
                {editingSubscription
                  ? "Changing the start date or frequency recalculates this automatically, unless you set a date here"
                  : "Leave blank to calculate from start date + frequency"}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-white/[0.07] pt-5">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-xl px-4 py-2 text-[13px] font-semibold text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-zinc-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary px-5 py-2 text-[13px]"
            >
              {isSubmitting ? "Saving..." : editingSubscription ? "Save Changes" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
