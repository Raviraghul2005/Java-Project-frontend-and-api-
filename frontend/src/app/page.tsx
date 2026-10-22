"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { SubscriptionCard } from "@/components/SubscriptionCard";
import { SubscriptionModal } from "@/components/SubscriptionModal";
import { useApp } from "@/context/AppContext";
import { Subscription } from "@/types";
import { daysUntil } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { downloadFile, exportFilename, subscriptionsToCsv, subscriptionsToJson } from "@/lib/export";

export default function DashboardPage() {
  const {
    subscriptions,
    analytics,
    loadError,
    refreshAll,
    activeFilter,
    searchQuery,
    sortBy,
    setActiveFilter,
    setSearchQuery,
    setSortBy,
    cancelSub,
    reactivateSub,
    deleteSub,
    addToast
  } = useApp();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);
  const categories = [
    { id: "all", label: "All" },
    { id: "entertainment", label: "Entertainment" },
    { id: "technology", label: "Technology" },
    { id: "lifestyle", label: "Lifestyle" },
    { id: "news", label: "News" },
    { id: "sports", label: "Sports" },
    { id: "finance", label: "Finance" },
    { id: "politics", label: "Politics" },
    { id: "other", label: "Other" }
  ];

  // Filtering & Sorting
  const filteredSubscriptions = useMemo(() => {
    return subscriptions
      .filter((sub) => {
        const matchesFilter =
          activeFilter === "all" ||
          sub.category?.toLowerCase() === activeFilter.toLowerCase();

        const q = searchQuery.toLowerCase().trim();
        const matchesSearch =
          !q ||
          sub.name?.toLowerCase().includes(q) ||
          sub.paymentMethod?.toLowerCase().includes(q) ||
          sub.category?.toLowerCase().includes(q);

        return matchesFilter && matchesSearch;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "price-desc":
            return (b.price || 0) - (a.price || 0);
          case "price-asc":
            return (a.price || 0) - (b.price || 0);
          case "name":
            return (a.name || "").localeCompare(b.name || "");
          case "renewal-asc":
          default:
            if (!a.renewalDate && !b.renewalDate) return 0;
            if (!a.renewalDate) return 1;
            if (!b.renewalDate) return -1;
            return a.renewalDate.localeCompare(b.renewalDate);
        }
      });
  }, [subscriptions, activeFilter, searchQuery, sortBy]);

  // Renewal Due Soon: active subscriptions renewing today or within the next 7 calendar days
  const dueSoonCount = useMemo(() => {
    return subscriptions.filter((s) => {
      if (s.status !== "active") return false;
      const days = daysUntil(s.renewalDate);
      return days !== null && days >= 0 && days <= 7;
    }).length;
  }, [subscriptions]);

  const handleOpenCreate = () => {
    setEditingSub(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (sub: Subscription) => {
    setEditingSub(sub);
    setIsModalOpen(true);
  };

  const handleExportJson = () => {
    try {
      downloadFile(subscriptionsToJson(subscriptions), exportFilename("json"), "application/json");
      addToast(`Exported ${subscriptions.length} subscriptions as JSON`, "success");
    } catch (err) {
      addToast("Failed to export JSON: " + (err instanceof Error ? err.message : "unknown error"), "error");
    }
  };

  const handleExportCsv = () => {
    try {
      downloadFile(subscriptionsToCsv(subscriptions), exportFilename("csv"), "text/csv");
      addToast(`Exported ${subscriptions.length} subscriptions as CSV`, "success");
    } catch (err) {
      addToast("Failed to export CSV: " + (err instanceof Error ? err.message : "unknown error"), "error");
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#09090b]">
      <Navbar onOpenNewModal={handleOpenCreate} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-7">
        {/* Page Title & Overview */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
              Subscription Overview
            </h1>
            <p className="text-sm text-zinc-400 mt-0.5">
              Track recurring commitments, audit domain redundancies, and monitor renewal schedules.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportJson}
              title="Download subscriptions as JSON"
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>JSON</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              title="Download subscriptions as CSV"
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>CSV</span>
            </button>

            <Link
              href="/analytics"
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:text-white transition-colors flex items-center gap-1.5"
            >
              <span>Fatigue Audit</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Score: {analytics?.fatigueIndex !== undefined ? analytics.fatigueIndex : 0}
              </span>
            </Link>
          </div>
        </div>

        {loadError && (
          <div
            role="alert"
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-950/30 px-4 py-3 text-xs text-rose-200"
          >
            <span>{loadError}</span>
            <button
              type="button"
              onClick={() => refreshAll()}
              className="self-start sm:self-auto px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-100 font-medium transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Executive Metrics Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Metric 1 */}
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4.5">
            <div className="text-xs font-medium text-zinc-400">Monthly Run Rate</div>
            <div className="text-2xl font-semibold text-zinc-100 mt-1.5 tabular">
              {formatMoney(analytics?.totalMonthlySpend ?? 0, analytics?.currency)}
            </div>
            <div className="text-xs text-zinc-400 mt-1">
              {formatMoney(analytics?.totalAnnualSpend ?? 0, analytics?.currency)} projected annually
              {analytics && analytics.excludedSubscriptionCount > 0 && (
                <span className="block text-amber-400/90 mt-0.5">
                  Excludes {analytics.excludedSubscriptionCount} in {analytics.excludedCurrencies.join(", ")}
                </span>
              )}
            </div>
          </div>

          {/* Metric 2 */}
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4.5">
            <div className="text-xs font-medium text-zinc-400">Active Subscriptions</div>
            <div className="text-2xl font-semibold text-zinc-100 mt-1.5 tabular">
              {subscriptions.filter((s) => s.status === "active").length}
            </div>
            <div className="text-xs text-zinc-400 mt-1">
              Across {analytics?.categoryBreakdowns?.length || 0} categories
            </div>
          </div>

          {/* Metric 3 */}
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4.5">
            <div className="text-xs font-medium text-zinc-400">Upcoming (7 Days)</div>
            <div className="text-2xl font-semibold text-amber-400 mt-1.5 tabular">
              {dueSoonCount}
            </div>
            <div className="text-xs text-zinc-400 mt-1">
              Renewing within the next week
            </div>
          </div>

          {/* Metric 4: SFI Score Card */}
          <Link
            href="/analytics"
            className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4.5 hover:border-zinc-700 transition-colors block"
          >
            <div className="flex items-center justify-between text-xs font-medium text-zinc-400">
              <span>Fatigue Index (SFI)</span>
              <span className="text-[10px] text-zinc-400 hover:text-zinc-200">Details →</span>
            </div>
            <div className="text-2xl font-semibold text-zinc-100 mt-1.5 tabular flex items-center gap-2">
              <span style={{ color: analytics?.fatigueColor || "#10b981" }}>
                {analytics?.fatigueIndex !== undefined ? analytics.fatigueIndex : 0}
              </span>
              <span className="text-xs text-zinc-400 font-normal">/ 100</span>
            </div>
            <div className="text-xs text-zinc-400 mt-1">
              Status: <span className="text-zinc-300 font-medium">{analytics?.fatigueLevel || "OPTIMAL"}</span>
            </div>
          </Link>
        </section>

        {/* Filter & Search Bar */}
        <section className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {categories.map((cat) => {
              const isActive = activeFilter === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setActiveFilter(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    isActive
                      ? "bg-zinc-800 text-zinc-100 font-semibold"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Search Input & Sort */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-60">
              <input
                type="text"
                aria-label="Filter services"
                placeholder="Filter services..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800 text-zinc-200 placeholder-zinc-400 text-xs focus:outline-none focus:border-zinc-600 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 text-xs cursor-pointer"
                >
                  <span aria-hidden="true">✕</span>
                </button>
              )}
            </div>

            <select
              aria-label="Sort subscriptions"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800 text-zinc-300 text-xs focus:outline-none focus:border-zinc-600 transition-colors"
            >
              <option value="renewal-asc">Soonest Renewal</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="name">Name</option>
            </select>
          </div>
        </section>

        {/* Subscription Cards Grid */}
        {filteredSubscriptions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSubscriptions.map((sub) => (
              <SubscriptionCard
                key={sub.id}
                subscription={sub}
                onEdit={handleOpenEdit}
                onCancel={cancelSub}
                onReactivate={reactivateSub}
                onDelete={deleteSub}
              />
            ))}
          </div>
        ) : subscriptions.length === 0 ? (
          /* Clean Slate Empty State */
          <div className="py-20 text-center rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 px-4">
            <div className="size-12 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 flex items-center justify-center mx-auto mb-4 text-sm font-semibold">
              0
            </div>
            <h3 className="text-base font-semibold text-zinc-100 mb-1.5">
              No subscriptions tracked yet
            </h3>
            <p className="text-xs text-zinc-400 max-w-md mx-auto mb-6 leading-relaxed">
              Your subscription portfolio is clean. Add your recurring services to begin auditing fatigue, overlap, and renewal schedules.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={handleOpenCreate}
                className="px-4 py-2 rounded-lg text-xs font-medium bg-zinc-100 text-zinc-950 hover:bg-white transition-colors cursor-pointer"
              >
                + Add Subscription
              </button>
              <Link
                href="/catalog"
                className="px-4 py-2 rounded-lg text-xs font-medium bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                Browse Catalog
              </Link>
            </div>
          </div>
        ) : (
          /* Filtered No Matches State */
          <div className="py-16 text-center rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20">
            <div className="size-10 rounded-lg bg-zinc-800 text-zinc-400 flex items-center justify-center mx-auto mb-3 text-sm font-semibold">
              0
            </div>
            <h3 className="text-sm font-medium text-zinc-200 mb-1">
              No matching subscriptions
            </h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto mb-5">
              No subscriptions match the selected category or search filter.
            </p>
            <button
              onClick={() => {
                setActiveFilter("all");
                setSearchQuery("");
              }}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-200 hover:bg-zinc-700 transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/80 py-5 px-4 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-400 gap-3">
          <div>
            Bill Pilot • Spring Boot 3.5 & Next.js 16
          </div>
          <div className="flex items-center gap-4">
            <Link href="/analytics" className="hover:text-zinc-300 transition-colors">
              Fatigue Audit
            </Link>
            <Link href="/simulator" className="hover:text-zinc-300 transition-colors">
              Arbitrage Lab
            </Link>
            <Link href="/catalog" className="hover:text-zinc-300 transition-colors">
              Catalog
            </Link>
          </div>
        </div>
      </footer>

      {/* Subscription Modal */}
      <SubscriptionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingSubscription={editingSub}
      />
    </div>
  );
}
