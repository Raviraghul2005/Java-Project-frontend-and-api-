"use client";

import React, { useState, useEffect } from "react";
import { Subscription, CreateSubscriptionInput, Frequency, Category } from "@/types";
import { PRESET_SUBSCRIPTIONS } from "@/lib/catalog";
import { useApp } from "@/context/AppContext";

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingSubscription?: Subscription | null;
}

export function SubscriptionModal({
  isOpen,
  onClose,
  editingSubscription
}: SubscriptionModalProps) {
  const { createSub, updateSub, addToast } = useApp();

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [category, setCategory] = useState<Category>("entertainment");
  const [paymentMethod, setPaymentMethod] = useState("Credit Card");
  const [startDate, setStartDate] = useState("");
  const [renewalDate, setRenewalDate] = useState("");
  const [status, setStatus] = useState<"active" | "cancelled" | "expired">("active");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingSubscription) {
      setName(editingSubscription.name);
      setPrice(String(editingSubscription.price));
      setCurrency(editingSubscription.currency || "USD");
      setFrequency(editingSubscription.frequency || "monthly");
      setCategory(editingSubscription.category || "entertainment");
      setPaymentMethod(editingSubscription.paymentMethod || "Credit Card");
      setStartDate(editingSubscription.startDate || "");
      setRenewalDate(editingSubscription.renewalDate || "");
      setStatus(editingSubscription.status || "active");
    } else {
      setName("");
      setPrice("");
      setCurrency("USD");
      setFrequency("monthly");
      setCategory("entertainment");
      setPaymentMethod("Credit Card");
      setStartDate(new Date().toISOString().split("T")[0]);
      setRenewalDate("");
      setStatus("active");
    }
  }, [editingSubscription, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

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
    if (!name || !price || !startDate) {
      addToast("Please fill in all required fields", "error");
      return;
    }

    setIsSubmitting(true);
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      addToast("Please enter a valid positive price", "error");
      setIsSubmitting(false);
      return;
    }

    const payload: CreateSubscriptionInput = {
      name: name.trim(),
      price: parsedPrice,
      currency,
      frequency,
      category,
      paymentMethod: paymentMethod.trim(),
      startDate,
      renewalDate: renewalDate ? renewalDate : undefined,
      status
    };

    let success = false;
    if (editingSubscription) {
      success = await updateSub(editingSubscription.id, payload);
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
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
    >
      <div className="w-full max-w-xl rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800 mb-5">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">
              {editingSubscription ? "Edit Subscription" : "Add Subscription"}
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              {editingSubscription
                ? "Update pricing, billing cadence, or category"
                : "Select a curated preset or enter custom service details"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="size-7 rounded-md bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Preset Selector */}
        {!editingSubscription && (
          <div className="mb-5">
            <label className="block text-xs font-medium text-zinc-400 mb-2">
              Popular Presets
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-32 overflow-y-auto p-1.5 rounded-lg bg-zinc-950 border border-zinc-800/80">
              {PRESET_SUBSCRIPTIONS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className="flex items-center gap-2 p-1.5 rounded-md hover:bg-zinc-800 text-left transition-colors cursor-pointer group"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={preset.logo}
                    alt={preset.name}
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
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Service Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Netflix, Claude Pro, Spotify"
              required
              className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 placeholder-zinc-500 text-xs focus:outline-none focus:border-zinc-600 transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Price *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="19.99"
                required
                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 placeholder-zinc-500 text-xs tabular focus:outline-none focus:border-zinc-600 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs focus:outline-none focus:border-zinc-600 transition-colors"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Billing Frequency *
              </label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as Frequency)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs focus:outline-none focus:border-zinc-600 transition-colors"
              >
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                <option value="weekly">Weekly</option>
                <option value="daily">Daily</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs focus:outline-none focus:border-zinc-600 transition-colors"
              >
                <option value="entertainment">Entertainment</option>
                <option value="technology">Technology</option>
                <option value="lifestyle">Lifestyle</option>
                <option value="news">News</option>
                <option value="sports">Sports</option>
                <option value="finance">Finance</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {editingSubscription && (
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs focus:outline-none focus:border-zinc-600 transition-colors"
              >
                <option value="active">Active</option>
                <option value="cancelled">Cancelled</option>
                <option value="expired">Expired</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Payment Method *
            </label>
            <input
              type="text"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              placeholder="e.g. Apple Pay, Credit Card (Visa), PayPal"
              required
              className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 placeholder-zinc-500 text-xs focus:outline-none focus:border-zinc-600 transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Start Date *
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs tabular focus:outline-none focus:border-zinc-600 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Next Renewal Date (Optional)
              </label>
              <input
                type="date"
                value={renewalDate}
                onChange={(e) => setRenewalDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs tabular focus:outline-none focus:border-zinc-600 transition-colors"
              />
              <span className="text-[10px] text-zinc-500 block mt-0.5">
                Leave blank to calculate from start date + frequency
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-zinc-800 mt-5">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 rounded-lg text-xs font-medium bg-zinc-100 hover:bg-white text-zinc-950 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? "Saving..." : editingSubscription ? "Save Changes" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
