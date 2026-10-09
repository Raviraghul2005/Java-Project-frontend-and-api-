"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { FatigueGauge } from "@/components/FatigueGauge";
import { SubscriptionModal } from "@/components/SubscriptionModal";
import { useApp } from "@/context/AppContext";

export default function AnalyticsPage() {
  const { analytics } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!analytics) {
    return (
      <div className="flex-1 flex flex-col bg-[#09090b]">
        <Navbar onOpenNewModal={() => setIsModalOpen(true)} />
        <div className="max-w-7xl mx-auto px-4 py-20 text-center">
          <div className="size-8 border-2 border-zinc-500 border-t-zinc-200 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-zinc-400 text-xs font-medium">Computing subscription audit...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#09090b]">
      <Navbar onOpenNewModal={() => setIsModalOpen(true)} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
                Subscription Fatigue & Redundancy Audit
              </h1>
            </div>
            <p className="text-sm text-zinc-400 mt-0.5">
              Deterministic heuristic model evaluating subscription clutter, functional overlap, and 5-year opportunity cost.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/simulator"
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 transition-colors"
            >
              Open Arbitrage Lab →
            </Link>
          </div>
        </div>

        {/* 1. SFI Gauge */}
        <section>
          <FatigueGauge analytics={analytics} />
        </section>

        {/* 2. Mathematical Foundation Callout */}
        <section className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-5 space-y-3">
          <div className="text-xs font-medium text-zinc-300">
            Mathematical Formulation of the Fatigue Model
          </div>
          <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-300 overflow-x-auto tabular">
            <code>
              SFI = clamp(0, 100, [4.5 × N_active] + [12.0 × R_redundancy] + min(30, Spend_monthly / 15) + [6.0 × C_collisions])
            </code>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed text-pretty">
            Rather than treating recurring expenses solely as an aggregate total, this engine applies penalty weights for
            domain saturation. Maintaining concurrent subscriptions in identical categories increases cognitive overhead
            and recurring financial leakage with diminishing marginal returns.
          </p>
        </section>

        {/* 3. Functional Redundancy Matrix */}
        <section className="space-y-3.5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-zinc-100">
                Functional Redundancy Matrix
              </h2>
              <p className="text-xs text-zinc-400">
                Overlapping services within identical utility domains competing for attention.
              </p>
            </div>
            <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300">
              {analytics.redundancyCount} overlap{analytics.redundancyCount !== 1 ? "s" : ""} detected
            </span>
          </div>

          {analytics.redundancies.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {analytics.redundancies.map((group, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-5 flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-zinc-200">
                        {group.title}
                      </span>
                      <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 tabular">
                        Save +${group.potentialAnnualSavings}/yr
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {group.serviceNames.map((svc) => (
                        <span
                          key={svc}
                          className="px-2.5 py-1 rounded-md bg-zinc-950 border border-zinc-800 text-xs text-zinc-300"
                        >
                          {svc}
                        </span>
                      ))}
                    </div>

                    <p className="text-xs text-zinc-400 leading-relaxed bg-zinc-950/60 p-3 rounded-lg border border-zinc-800/60 text-pretty">
                      <span className="text-zinc-200 font-medium">Recommendation:</span> {group.recommendation}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-zinc-800/60 flex items-center justify-between text-xs text-zinc-400 tabular">
                    <span>Category outflow: ${group.monthlySpend.toFixed(2)}/mo</span>
                    <span>Annualized: ${group.annualSpend.toFixed(2)}/yr</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 rounded-xl bg-zinc-900/20 border border-zinc-800 text-center">
              <h3 className="text-xs font-medium text-zinc-300">No Functional Redundancies</h3>
              <p className="text-xs text-zinc-500 mt-1">
                All active subscriptions occupy unique service domains.
              </p>
            </div>
          )}
        </section>

        {/* 4. Vampire Drain & Opportunity Cost Table */}
        <section className="space-y-3.5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-zinc-100">
                5-Year Opportunity Cost Analysis
              </h2>
              <p className="text-xs text-zinc-400">
                Comparing recurring cash outflow against standard S&P 500 index yield (7% compound annual return).
              </p>
            </div>

            <div className="text-right">
              <span className="text-xs text-zinc-500 block">5-Yr Foregone Yield</span>
              <span className="text-sm font-semibold text-zinc-100 tabular">
                ${analytics.total5YearOpportunityCost.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-950/80 border-b border-zinc-800 text-zinc-400">
                  <tr>
                    <th className="py-3 px-4 font-medium">Service</th>
                    <th className="py-3 px-4 font-medium">Category</th>
                    <th className="py-3 px-4 font-medium text-right">Monthly Outflow</th>
                    <th className="py-3 px-4 font-medium text-right">1-Year Cost</th>
                    <th className="py-3 px-4 font-medium text-right">3-Year Cost</th>
                    <th className="py-3 px-4 font-medium text-right">5-Year Cost</th>
                    <th className="py-3 px-4 font-medium text-right text-zinc-200">5-Yr Opportunity Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 tabular">
                  {analytics.vampireProjections.length > 0 ? (
                    analytics.vampireProjections.map((item) => (
                      <tr key={item.subscriptionId} className="hover:bg-zinc-800/20 transition-colors">
                        <td className="py-3 px-4 font-medium text-zinc-200 flex items-center gap-2">
                          <span>{item.name}</span>
                          {item.highDrainRisk && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              High Drain
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-zinc-400 capitalize">{item.category}</td>
                        <td className="py-3 px-4 text-right text-zinc-300 font-medium">${item.monthlyCost.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right text-zinc-400">${item.oneYearSpend.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right text-zinc-400">${item.threeYearSpend.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right text-zinc-400">${item.fiveYearSpend.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right font-medium text-zinc-100">
                          ${item.fiveYearOpportunityCost.toFixed(2)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-zinc-500">
                        No active subscriptions to project.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* 5. Domain Allocation */}
        <section className="space-y-3.5">
          <h2 className="text-base font-semibold text-zinc-100">
            Category Spend Allocation
          </h2>

          {analytics.categoryBreakdowns.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {analytics.categoryBreakdowns.map((cat) => (
                <div key={cat.categoryName} className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4 space-y-2.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-medium text-zinc-200 capitalize">{cat.categoryName}</span>
                    <span className="text-zinc-400 font-medium tabular">{cat.percentage}%</span>
                  </div>

                  <div className="w-full h-1.5 rounded-full bg-zinc-950 overflow-hidden">
                    <div
                      className="h-full bg-zinc-300 rounded-full"
                      style={{ width: `${Math.min(100, cat.percentage)}%` }}
                    />
                  </div>

                  <div className="flex justify-between items-center text-[11px] text-zinc-400 tabular">
                    <span>{cat.count} service{cat.count > 1 ? "s" : ""}</span>
                    <span className="text-zinc-300 font-medium">${cat.monthlySpend.toFixed(2)}/mo</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 rounded-xl bg-zinc-900/20 border border-zinc-800 text-center">
              <p className="text-xs text-zinc-500">
                No active category spend allocations yet.
              </p>
            </div>
          )}
        </section>
      </main>

      <SubscriptionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
