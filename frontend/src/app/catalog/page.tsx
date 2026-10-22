"use client";

import React, { useState, useMemo } from "react";
import { Navbar } from "@/components/Navbar";
import { SubscriptionModal } from "@/components/SubscriptionModal";
import { PRESET_SUBSCRIPTIONS } from "@/lib/catalog";
import { useApp } from "@/context/AppContext";
import { PresetSubscription } from "@/types";
import { todayLocal } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

export default function CatalogPage() {
  const { createSub } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  // Names currently being added: stops a double click from creating the same subscription twice
  const [adding, setAdding] = useState<Set<string>>(new Set());

  const categories = useMemo(
    () => ["all", ...Array.from(new Set(PRESET_SUBSCRIPTIONS.map((p) => p.category)))],
    []
  );

  const filteredPresets = useMemo(() => {
    return PRESET_SUBSCRIPTIONS.filter((preset) => {
      const matchCat = selectedCategory === "all" || preset.category === selectedCategory;
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        preset.name.toLowerCase().includes(q) ||
        preset.description.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [selectedCategory, search]);

  const handleDeployPreset = async (preset: PresetSubscription) => {
    if (adding.has(preset.name)) return;
    setAdding((prev) => new Set(prev).add(preset.name));
    try {
      await addPreset(preset);
    } finally {
      setAdding((prev) => {
        const next = new Set(prev);
        next.delete(preset.name);
        return next;
      });
    }
  };

  const addPreset = async (preset: PresetSubscription) => {
    const today = todayLocal();
    await createSub({
      name: preset.name,
      price: preset.price,
      currency: preset.currency,
      frequency: preset.frequency,
      category: preset.category,
      paymentMethod: preset.paymentMethod,
      startDate: today
    });
  };

  return (
    <div className="flex-1 flex flex-col bg-[#09090b]">
      <Navbar onOpenNewModal={() => setIsModalOpen(true)} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-7">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
            Subscription Catalog
          </h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            Verified consumer and developer subscription plans with verified tier pricing.
          </p>
        </div>

        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                aria-pressed={selectedCategory === cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors cursor-pointer ${
                  selectedCategory === cat
                    ? "bg-zinc-800 text-zinc-100 font-semibold"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="w-full sm:w-64">
            <input
              type="text"
              aria-label="Search catalog"
              placeholder="Search catalog..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800 text-zinc-200 placeholder-zinc-500 text-xs focus:outline-none focus:border-zinc-600 transition-colors"
            />
          </div>
        </div>

        {/* Grid of Presets */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPresets.map((preset) => (
            <div
              key={preset.name}
              className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4.5 flex flex-col justify-between hover:border-zinc-700 transition-colors"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-lg bg-zinc-950 border border-zinc-800/80 flex items-center justify-center p-2 flex-shrink-0 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={preset.logo}
                        alt=""
                        className="size-full object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    </div>
                    <div>
                      <h3 className="font-medium text-sm text-zinc-100">
                        {preset.name}
                      </h3>
                      <span className="text-[11px] text-zinc-400 capitalize">
                        {preset.category}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-base font-semibold text-zinc-100 tabular">
                      {formatMoney(preset.price, preset.currency)}
                    </div>
                    <div className="text-xs text-zinc-400">
                      /{preset.frequency}
                    </div>
                  </div>
                </div>

                <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2 mb-4 text-pretty">
                  {preset.description}
                </p>
              </div>

              <div className="pt-3 border-t border-zinc-800/50 flex items-center justify-between text-xs">
                <span className="text-zinc-400 capitalize">
                  {preset.frequency}
                </span>

                <button
                  type="button"
                  disabled={adding.has(preset.name)}
                  onClick={() => handleDeployPreset(preset)}
                  className="px-3 py-1 rounded-md text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {adding.has(preset.name) ? "Adding…" : "+ Add to board"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      <SubscriptionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
