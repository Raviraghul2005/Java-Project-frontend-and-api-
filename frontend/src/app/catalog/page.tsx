"use client";

import React, { useState, useMemo } from "react";
import { FilterPills } from "@/components/ui/FilterPills";
import { CheckIcon, PlusIcon, SearchIcon } from "@/components/ui/icons";
import { SubLogo } from "@/components/ui/SubLogo";
import { PRESET_SUBSCRIPTIONS } from "@/lib/catalog";
import { useApp } from "@/context/AppContext";
import { PresetSubscription } from "@/types";
import { categoryColor } from "@/lib/categoryColors";
import { cn } from "@/lib/cn";
import { todayLocal } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

export default function CatalogPage() {
  const { createSub } = useApp();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  // Names currently being added: stops a double click from creating the same subscription twice
  const [adding, setAdding] = useState<Set<string>>(new Set());
  // Names added a moment ago: the button shows a check mark for two seconds
  const [justAdded, setJustAdded] = useState<Set<string>>(new Set());

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
      const ok = await addPreset(preset);
      if (ok) {
        setJustAdded((prev) => new Set(prev).add(preset.name));
        setTimeout(() => {
          setJustAdded((prev) => {
            const next = new Set(prev);
            next.delete(preset.name);
            return next;
          });
        }, 2000);
      }
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
    return createSub({
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
    <div className="page-enter space-y-7 pt-2">
      {/* Header */}
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          <span className="text-gradient">Subscription Catalog</span>
        </h1>
        <p className="mt-2 text-sm text-zinc-400">Verified consumer and developer subscription plans with verified tier pricing.</p>
      </header>

      {/* Filter bar */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <FilterPills options={categories.map((c) => ({ id: c, label: c }))} value={selectedCategory} onChange={setSelectedCategory} />

        <div className="relative w-full sm:w-72">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            aria-label="Search catalog"
            placeholder="Search catalog..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="field pl-9"
          />
        </div>
      </div>

      {/* Grid of Presets */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredPresets.map((preset, i) => {
          const accent = categoryColor(preset.category);
          const isAdding = adding.has(preset.name);
          const wasAdded = justAdded.has(preset.name);
          return (
            <div
              key={preset.name}
              style={{ "--i": Math.min(i, 12) } as React.CSSProperties}
              className="spotlight surface lift reveal flex flex-col justify-between p-5"
            >
              <div>
                <div className="mb-3.5 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3.5">
                    <SubLogo name={preset.name} className="size-12" />
                    <div className="min-w-0">
                      <h3 className="truncate text-[15px] font-bold tracking-tight text-zinc-50">{preset.name}</h3>
                      <span className="mt-0.5 flex items-center gap-1.5 text-[11px] capitalize text-zinc-400">
                        <span className="size-1.5 rounded-full" style={{ background: accent, boxShadow: `0 0 8px ${accent}` }} />
                        {preset.category}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className="tabular text-lg font-extrabold tracking-tight text-zinc-50">{formatMoney(preset.price, preset.currency)}</div>
                    <div className="text-xs text-zinc-400">/{preset.frequency}</div>
                  </div>
                </div>

                <p className="mb-4 line-clamp-2 text-pretty text-xs leading-relaxed text-zinc-400">{preset.description}</p>
              </div>

              <div className="flex items-center justify-between border-t border-white/[0.06] pt-3.5 text-xs">
                <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-medium capitalize text-zinc-400">{preset.frequency}</span>

                <button
                  type="button"
                  disabled={isAdding}
                  onClick={() => handleDeployPreset(preset)}
                  className={cn(
                    "flex cursor-pointer items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60 active:scale-95",
                    wasAdded
                      ? "bg-emerald-400/15 text-emerald-300 ring-1 ring-inset ring-emerald-300/30"
                      : "border border-white/[0.09] bg-white/[0.05] text-zinc-200 hover:border-brand-400/50 hover:bg-brand-500/20 hover:text-white"
                  )}
                >
                  {wasAdded ? <CheckIcon className="size-3.5" /> : !isAdding && <PlusIcon className="size-3.5" />}
                  {isAdding ? "Adding…" : wasAdded ? "Added" : "Add to board"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredPresets.length === 0 && (
        <div className="surface flex flex-col items-center border-dashed py-16 text-center">
          <span className="mb-3 flex size-11 items-center justify-center rounded-xl bg-white/[0.06] text-zinc-400"><SearchIcon className="size-5" /></span>
          <p className="text-sm font-semibold text-zinc-200">Nothing in the catalog matches that</p>
          <p className="mt-1 text-xs text-zinc-500">Try another category or a shorter search.</p>
        </div>
      )}
    </div>
  );
}
