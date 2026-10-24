"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { SubscriptionCard } from "@/components/SubscriptionCard";
import { SubscriptionModal } from "@/components/SubscriptionModal";
import { useShell } from "@/components/shell/ShellContext";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { AreaChart } from "@/components/ui/AreaChart";
import { DonutChart } from "@/components/ui/DonutChart";
import { FilterPills } from "@/components/ui/FilterPills";
import {
  ActivityIcon,
  ArrowUpRightIcon,
  CalendarIcon,
  CheckIcon,
  DownloadIcon,
  FileIcon,
  LayersIcon,
  PlusIcon,
  SearchIcon,
  TrendingUpIcon
} from "@/components/ui/icons";
import { RingGauge } from "@/components/ui/RingGauge";
import { Segmented } from "@/components/ui/Segmented";
import { Sparkline } from "@/components/ui/Sparkline";
import { SubLogo } from "@/components/ui/SubLogo";
import { useApp } from "@/context/AppContext";
import { categoryColor } from "@/lib/categoryColors";
import { cn } from "@/lib/cn";
import { daysUntil } from "@/lib/dates";
import { downloadFile, exportFilename, subscriptionsToCsv, subscriptionsToJson } from "@/lib/export";
import { formatMoney, primaryCurrency } from "@/lib/money";
import { firstNameOf } from "@/lib/people";
import { cumulative, projectMonthlySpend } from "@/lib/projection";
import { DUE_TONE_CLASSES, describeDue } from "@/lib/renewal";
import { Subscription } from "@/types";

const CATEGORIES = [
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

type ChartMode = "monthly" | "cumulative";

export default function DashboardPage() {
  const {
    user,
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
  const { openCreate } = useShell();

  const [editingSub, setEditingSub] = useState<Subscription | null>(null);
  const [chartMode, setChartMode] = useState<ChartMode>("monthly");

  const active = useMemo(() => subscriptions.filter((s) => s.status === "active"), [subscriptions]);
  const currency = analytics?.currency ?? primaryCurrency(active);
  const money = (amount: number) => formatMoney(amount, currency);

  // Filtering & Sorting
  const filteredSubscriptions = useMemo(() => {
    return subscriptions
      .filter((sub) => {
        const matchesFilter = activeFilter === "all" || sub.category?.toLowerCase() === activeFilter.toLowerCase();

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

  // Active subscriptions with a renewal date, soonest first (today and overdue included).
  const upcoming = useMemo(
    () =>
      active
        .map((sub) => ({ sub, days: daysUntil(sub.renewalDate) }))
        .filter((x): x is { sub: Subscription; days: number } => x.days !== null)
        .sort((a, b) => a.days - b.days),
    [active]
  );

  // Renewal Due Soon: active subscriptions renewing today or within the next 7 calendar days
  const dueSoon = useMemo(() => upcoming.filter((x) => x.days >= 0 && x.days <= 7), [upcoming]);
  const dueSoonCount = dueSoon.length;
  const dueSoonAmount = dueSoon.filter((x) => (x.sub.currency || "USD").toUpperCase() === currency.toUpperCase()).reduce((sum, x) => sum + x.sub.price, 0);
  const next30 = upcoming.filter((x) => x.days >= 0 && x.days <= 30 && (x.sub.currency || "USD").toUpperCase() === currency.toUpperCase());

  const projection = useMemo(() => projectMonthlySpend(subscriptions, undefined, 12, currency), [subscriptions, currency]);
  const chartData = useMemo(
    () => (chartMode === "monthly" ? projection : cumulative(projection)).map((m) => ({ label: m.label, title: m.title, value: m.total })),
    [projection, chartMode]
  );
  const yearTotal = projection.reduce((sum, m) => sum + m.total, 0);
  const peakMonth = projection.reduce((best, m) => (m.total > best.total ? m : best), projection[0]);

  const donutSegments = (analytics?.categoryBreakdowns ?? []).map((cat, i) => ({
    label: cat.categoryName,
    value: cat.monthlySpend,
    color: categoryColor(cat.categoryName, i),
    detail: money(cat.monthlySpend)
  }));

  const jumpToSubscription = (name: string) => {
    setActiveFilter("all");
    setSearchQuery(name);
    document.getElementById("subscriptions")?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  const sfi = analytics?.fatigueIndex ?? 0;
  const sfiColor = analytics?.fatigueColor || "#2fd88a";

  return (
    <div className="page-enter @container space-y-6 pt-2">
      {/* Welcome */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-[2.6rem] sm:leading-[1.1]">
            Welcome, <span className="text-gradient">{firstNameOf(user?.name)}</span>
          </h1>
          <p className="mt-2 text-sm text-zinc-400">View all your subscription info on one dashboard.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={handleExportJson} title="Download subscriptions as JSON" className="btn-ghost">
            <DownloadIcon className="size-3.5" />
            JSON
          </button>
          <button type="button" onClick={handleExportCsv} title="Download subscriptions as CSV" className="btn-ghost">
            <FileIcon className="size-3.5" />
            CSV
          </button>
          <Link href="/analytics" className="btn-ghost">
            Fatigue Audit
            <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-[10px] font-bold tabular-nums" style={{ color: sfiColor }}>
              Score: {sfi}
            </span>
          </Link>
        </div>
      </header>

      {loadError && (
        <div
          role="alert"
          className="flex flex-col justify-between gap-3 rounded-2xl border border-rose-400/25 bg-rose-950/40 px-4 py-3 text-xs text-rose-200 sm:flex-row sm:items-center"
        >
          <span>{loadError}</span>
          <button
            type="button"
            onClick={() => refreshAll()}
            className="cursor-pointer self-start rounded-lg bg-rose-500/20 px-3 py-1.5 font-semibold text-rose-100 transition-colors hover:bg-rose-500/30 sm:self-auto"
          >
            Retry
          </button>
        </div>
      )}

      {/* Executive metrics */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="spotlight surface lift reveal flex flex-col justify-between overflow-hidden p-5" style={{ "--i": 0 } as React.CSSProperties}>
          <div>
            <div className="flex items-center justify-between">
              <div className="text-[13px] font-semibold text-zinc-400">Monthly Run Rate</div>
              <span className="flex size-8 items-center justify-center rounded-lg bg-brand-500/15 text-brand-300"><TrendingUpIcon className="size-4" /></span>
            </div>
            <div className="mt-3 text-[2rem] font-extrabold leading-none tracking-tight text-zinc-50 tabular">
              <AnimatedNumber value={analytics?.totalMonthlySpend ?? 0} format={money} />
            </div>
            <div className="mt-2 text-xs text-zinc-400">
              {money(analytics?.totalAnnualSpend ?? 0)} projected annually
              {analytics && analytics.excludedSubscriptionCount > 0 && (
                <span className="mt-0.5 block text-amber-400/90">
                  Excludes {analytics.excludedSubscriptionCount} in {analytics.excludedCurrencies.join(", ")}
                </span>
              )}
            </div>
          </div>
          <Sparkline values={projection.map((m) => m.total)} className="-mx-5 -mb-5 mt-4 h-12 w-[calc(100%+2.5rem)]" />
        </div>

        <div className="spotlight surface lift reveal p-5" style={{ "--i": 1 } as React.CSSProperties}>
          <div className="flex items-center justify-between">
            <div className="text-[13px] font-semibold text-zinc-400">Active Subscriptions</div>
            <span className="flex size-8 items-center justify-center rounded-lg bg-aqua-400/12 text-aqua-400"><LayersIcon className="size-4" /></span>
          </div>
          <div className="mt-3 text-[2rem] font-extrabold leading-none tracking-tight text-zinc-50 tabular">
            <AnimatedNumber value={active.length} />
          </div>
          <div className="mt-2 text-xs text-zinc-400">Across {analytics?.categoryBreakdowns?.length || 0} categories</div>
          {donutSegments.length > 0 && (
            <div className="mt-4 flex h-1.5 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
              {donutSegments.map((seg, i) => (
                <span key={seg.label} className="bar-grow h-full rounded-full" style={{ flex: Math.max(seg.value, 0.01), background: seg.color, "--i": i } as React.CSSProperties} />
              ))}
            </div>
          )}
        </div>

        <div className="spotlight surface lift reveal p-5" style={{ "--i": 2 } as React.CSSProperties}>
          {/* The number must stay the element right after this label (the e2e suite reads it that way). */}
          <span className="absolute right-5 top-5 flex size-8 items-center justify-center rounded-lg bg-amber-400/12 text-amber-300">
            <CalendarIcon className="size-4" />
            {dueSoonCount > 0 && <span className="absolute -right-0.5 -top-0.5 size-2 animate-ping-slow rounded-full bg-amber-300" />}
          </span>
          <div className="text-[13px] font-semibold leading-8 text-zinc-400">Upcoming (7 Days)</div>
          <div className="mt-3 text-[2rem] font-extrabold leading-none tracking-tight text-amber-300 tabular">
            <AnimatedNumber value={dueSoonCount} />
          </div>
          <div className="mt-2 text-xs text-zinc-400">
            Renewing within the next week
            {dueSoonAmount > 0 && <span className="mt-0.5 block font-semibold tabular text-zinc-300">{money(dueSoonAmount)} due</span>}
          </div>
        </div>

        <Link href="/analytics" className="spotlight surface lift reveal group flex items-center justify-between gap-3 p-5" style={{ "--i": 3 } as React.CSSProperties}>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[13px] font-semibold text-zinc-400">
              <span>Fatigue Index (SFI)</span>
            </div>
            <div className="mt-3 flex items-baseline gap-2 text-[2rem] font-extrabold leading-none tracking-tight tabular">
              <span style={{ color: sfiColor }}>
                <AnimatedNumber value={sfi} />
              </span>
              <span className="text-xs font-medium text-zinc-500">/ 100</span>
            </div>
            <div className="mt-2 text-xs text-zinc-400">
              Status: <span className="font-semibold text-zinc-200">{analytics?.fatigueLevel || "OPTIMAL"}</span>
            </div>
            <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-300 transition-all duration-300 group-hover:gap-2">
              Details <ArrowUpRightIcon className="size-3" />
            </span>
          </div>
          <RingGauge value={sfi} color={sfiColor} size={84} thickness={3.8} className="transition-transform duration-500 group-hover:scale-105">
            <ActivityIcon className="size-5" style={{ color: sfiColor }} />
          </RingGauge>
        </Link>
      </section>

      {/* Expenses tracker + quick action */}
      <section className="grid gap-5 @4xl:grid-cols-12">
        <div className="spotlight surface reveal flex flex-col p-6 @4xl:col-span-8" style={{ "--i": 4 } as React.CSSProperties}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold tracking-tight">Expenses Tracker</h2>
              <p className="mt-0.5 text-xs text-zinc-400">Recurring spend projected from your renewal dates.</p>
            </div>
            <Segmented
              ariaLabel="Chart view"
              value={chartMode}
              onChange={setChartMode}
              options={[
                { value: "monthly", label: "Monthly" },
                { value: "cumulative", label: "Cumulative" }
              ]}
            />
          </div>

          <div className="mt-4 flex-1">
            {yearTotal > 0 ? (
              <AreaChart
                key={chartMode}
                data={chartData}
                format={money}
                formatTick={(v) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1).replace(/\.0$/, "")}k` : String(Math.round(v)))}
                showDelta={chartMode === "monthly"}
                ariaLabel={`${chartMode === "monthly" ? "Projected spend per month" : "Cumulative projected spend"} for the next 12 months, ${money(yearTotal)} in total`}
              />
            ) : (
              <div className="flex h-[270px] flex-col items-center justify-center gap-2 text-center">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-500/12 text-brand-300"><TrendingUpIcon className="size-6" /></span>
                <p className="text-sm font-semibold text-zinc-200">Your spending forecast appears here</p>
                <p className="max-w-xs text-xs text-zinc-500">Add a subscription with a renewal date and the next twelve months are charted.</p>
              </div>
            )}
          </div>

          <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-white/[0.06] pt-4">
            <div>
              <dt className="text-[11px] font-medium text-zinc-500">Next 12 months</dt>
              <dd className="mt-0.5 text-sm font-bold tabular-nums text-zinc-100">{money(yearTotal)}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium text-zinc-500">Heaviest month</dt>
              <dd className="mt-0.5 text-sm font-bold tabular-nums text-zinc-100">{yearTotal > 0 && peakMonth ? `${peakMonth.label} · ${money(peakMonth.total)}` : "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium text-zinc-500">Next 30 days</dt>
              <dd className="mt-0.5 text-sm font-bold tabular-nums text-zinc-100">
                {next30.length} {next30.length === 1 ? "charge" : "charges"} · {money(next30.reduce((sum, x) => sum + x.sub.price, 0))}
              </dd>
            </div>
          </dl>
        </div>

        <div className="spotlight surface reveal flex flex-col p-6 @4xl:col-span-4" style={{ "--i": 5 } as React.CSSProperties}>
          <h2 className="text-lg font-bold tracking-tight">Quick Action</h2>
          <p className="mt-0.5 text-xs text-zinc-400">Upcoming reminders for renewals</p>

          {upcoming.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-emerald-400/12 text-emerald-300 ring-1 ring-emerald-300/25"><CheckIcon className="size-6" /></span>
              <p className="text-sm font-semibold text-zinc-200">No upcoming renewals</p>
              <p className="text-xs text-zinc-500">Active subscriptions with a renewal date show up here.</p>
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-white/[0.05]">
              {upcoming.slice(0, 6).map(({ sub, days }, i) => {
                const info = describeDue(days)!;
                return (
                  <li key={sub.id} className="reveal" style={{ "--i": i + 6 } as React.CSSProperties}>
                    <button
                      type="button"
                      onClick={() => jumpToSubscription(sub.name)}
                      aria-label={`${sub.name}, ${info.label.toLowerCase()}. Show in the list`}
                      className="group -mx-2 flex w-[calc(100%+1rem)] cursor-pointer items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors duration-200 hover:bg-white/[0.05]"
                    >
                      <SubLogo name={sub.name} className="size-10 transition-transform duration-300 group-hover:scale-105" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-semibold text-zinc-100">{sub.name}</span>
                        <span className="block truncate text-[11px] capitalize tabular-nums text-zinc-500">
                          {formatMoney(sub.price, sub.currency)} · {sub.frequency}
                        </span>
                      </span>
                      <span className={cn("shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-transform duration-300 group-hover:scale-105", DUE_TONE_CLASSES[info.tone])}>
                        {info.label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Subscription list + category overview */}
      <section className="grid gap-5 @4xl:grid-cols-12" id="subscriptions">
        <div className="min-w-0 space-y-5 @4xl:col-span-8">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <h2 className="text-lg font-bold tracking-tight">Subscription List</h2>
                <p className="mt-0.5 text-xs text-zinc-400">Organize and manage all subscriptions</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:w-56">
                  <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    aria-label="Filter services"
                    placeholder="Filter services..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="field pl-9 pr-8"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      aria-label="Clear search"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer text-xs text-zinc-500 transition-colors hover:text-zinc-200"
                    >
                      <span aria-hidden="true">✕</span>
                    </button>
                  )}
                </div>

                <select aria-label="Sort subscriptions" value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="field w-auto cursor-pointer pr-8">
                  <option value="renewal-asc">Soonest Renewal</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="name">Name</option>
                </select>
              </div>
            </div>

            <FilterPills options={CATEGORIES} value={activeFilter} onChange={setActiveFilter} />
          </div>

          {filteredSubscriptions.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 @2xl:grid-cols-2">
              {filteredSubscriptions.map((sub, i) => (
                <SubscriptionCard
                  key={sub.id}
                  index={i}
                  subscription={sub}
                  onEdit={setEditingSub}
                  onCancel={cancelSub}
                  onReactivate={reactivateSub}
                  onDelete={deleteSub}
                />
              ))}
            </div>
          ) : subscriptions.length === 0 ? (
            /* Clean Slate Empty State */
            <div className="surface flex flex-col items-center border-dashed px-4 py-20 text-center">
              <div className="animate-float relative mb-5">
                <span className="absolute -inset-3 rounded-full bg-brand-500/20 blur-xl" />
                <span className="relative flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-700 text-white shadow-glow">
                  <LayersIcon className="size-8" />
                </span>
              </div>
              <h3 className="mb-1.5 text-lg font-bold">No subscriptions tracked yet</h3>
              <p className="mx-auto mb-7 max-w-md text-xs leading-relaxed text-zinc-400">
                Your subscription portfolio is clean. Add your recurring services to begin auditing fatigue, overlap, and renewal schedules.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button onClick={openCreate} className="btn-primary">
                  <PlusIcon className="size-4" />
                  Add Subscription
                </button>
                <Link href="/catalog" className="btn-ghost">
                  Browse Catalog
                </Link>
              </div>
            </div>
          ) : (
            /* Filtered No Matches State */
            <div className="surface flex flex-col items-center border-dashed py-16 text-center">
              <span className="mb-3 flex size-11 items-center justify-center rounded-xl bg-white/[0.06] text-zinc-400"><SearchIcon className="size-5" /></span>
              <h3 className="mb-1 text-sm font-semibold text-zinc-200">No matching subscriptions</h3>
              <p className="mx-auto mb-5 max-w-sm text-xs text-zinc-400">No subscriptions match the selected category or search filter.</p>
              <button
                onClick={() => {
                  setActiveFilter("all");
                  setSearchQuery("");
                }}
                className="btn-ghost"
              >
                Reset Filters
              </button>
            </div>
          )}
        </div>

        <aside className="@4xl:col-span-4">
          <div className="spotlight surface reveal p-6 @4xl:sticky @4xl:top-24" style={{ "--i": 8 } as React.CSSProperties}>
            <h2 className="text-lg font-bold tracking-tight">Activity Overview</h2>
            <p className="mb-5 mt-0.5 text-xs text-zinc-400">Category with high subscriptions rate.</p>
            {donutSegments.length > 0 ? (
              <DonutChart
                segments={donutSegments}
                centerLabel="Per month"
                centerValue={<AnimatedNumber value={analytics?.totalMonthlySpend ?? 0} format={money} className="text-xl" />}
                ariaLabel={`Monthly spend by category, ${money(analytics?.totalMonthlySpend ?? 0)} in total`}
              />
            ) : (
              <p className="py-10 text-center text-xs text-zinc-500">Spend by category shows up once you track a subscription.</p>
            )}
          </div>
        </aside>
      </section>

      <SubscriptionModal isOpen={editingSub !== null} onClose={() => setEditingSub(null)} editingSubscription={editingSub} />
    </div>
  );
}
