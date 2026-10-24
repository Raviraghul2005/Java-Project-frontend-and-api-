"use client";

import React from "react";
import Link from "next/link";
import { FatigueGauge } from "@/components/FatigueGauge";
import { Reveal } from "@/components/ui/Reveal";
import { AlertIcon, ArrowUpRightIcon, CheckIcon } from "@/components/ui/icons";
import { useApp } from "@/context/AppContext";
import { categoryColor } from "@/lib/categoryColors";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";

function SectionTitle({ title, subtitle, aside }: { title: string; subtitle?: string; aside?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold tracking-tight text-zinc-50">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-zinc-400">{subtitle}</p>}
      </div>
      {aside}
    </div>
  );
}

function EmptyNote({ title, text }: { title?: string; text: string }) {
  return (
    <div className="surface flex flex-col items-center gap-1 border-dashed p-8 text-center">
      <span className="mb-1 flex size-9 items-center justify-center rounded-full bg-emerald-400/12 text-emerald-300 ring-1 ring-emerald-300/20">
        <CheckIcon className="size-[18px]" />
      </span>
      {title && <h3 className="text-sm font-semibold text-zinc-200">{title}</h3>}
      <p className="text-xs text-zinc-500">{text}</p>
    </div>
  );
}

export default function AnalyticsPage() {
  const { analytics, loadError, refreshAll } = useApp();

  if (!analytics) {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        {loadError ? (
          <div role="alert" className="space-y-4">
            <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-rose-500/12 text-rose-300"><AlertIcon className="size-6" /></span>
            <p className="text-sm font-medium text-rose-300">{loadError}</p>
            <button type="button" onClick={() => refreshAll()} className="btn-ghost">
              Retry
            </button>
          </div>
        ) : (
          <div className="space-y-3" role="status">
            <div className="skeleton mx-auto h-24 w-full" />
            <div className="skeleton mx-auto h-4 w-2/3" />
            <p className="pt-2 text-xs font-medium text-zinc-500">Computing subscription audit...</p>
          </div>
        )}
      </div>
    );
  }

  const money = (amount: number) => formatMoney(amount, analytics.currency);

  return (
    <div className="space-y-9 pt-2">
      {/* Header */}
      <Reveal>
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              <span className="text-gradient">Subscription Fatigue & Redundancy Audit</span>
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-zinc-400">
              Deterministic heuristic model evaluating subscription clutter, functional overlap, and 5-year opportunity cost.
            </p>
            {analytics.excludedSubscriptionCount > 0 && (
              <p className="mt-1.5 text-xs text-amber-400/90">
                All figures are in {analytics.currency}. {analytics.excludedSubscriptionCount} active subscription
                {analytics.excludedSubscriptionCount === 1 ? "" : "s"} billed in {analytics.excludedCurrencies.join(", ")}{" "}
                {analytics.excludedSubscriptionCount === 1 ? "is" : "are"} not included.
              </p>
            )}
          </div>

          <Link href="/simulator" className="btn-ghost group shrink-0">
            Open Arbitrage Lab
            <ArrowUpRightIcon className="size-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </header>
      </Reveal>

      {/* 1. SFI Gauge */}
      <Reveal index={1}>
        <FatigueGauge analytics={analytics} />
      </Reveal>

      {/* 2. Mathematical Foundation Callout */}
      <Reveal>
        <section className="surface space-y-3.5 p-6">
          <div className="text-xs font-bold uppercase tracking-wider text-brand-300">Mathematical Formulation of the Fatigue Model</div>
          <div className="tabular overflow-x-auto rounded-xl border border-white/[0.07] bg-black/40 p-4 font-mono text-xs text-zinc-200">
            <code>
              SFI = clamp(5, 100, [4.5 × N_active] + [12.0 × R_redundancy] + min(30, Spend_monthly / 15) + min(18, 6.0 × C_collisions))
            </code>
          </div>
          <p className="text-pretty text-xs leading-relaxed text-zinc-400">
            Rather than treating recurring expenses solely as an aggregate total, this engine applies penalty weights for
            domain saturation. Maintaining concurrent subscriptions in identical categories increases cognitive overhead
            and recurring financial leakage with diminishing marginal returns. N_active counts active plans, R_redundancy
            counts extra services beyond the first in each category, and C_collisions counts days in the next 30 where
            two or more plans (or $40+) renew together. With no active plans the score is 0.
          </p>
        </section>
      </Reveal>

      {/* 3. Functional Redundancy Matrix */}
      <Reveal>
        <section className="space-y-4">
          <SectionTitle
            title="Functional Redundancy Matrix"
            subtitle="Multiple active services in the same category, competing for attention and budget."
            aside={
              <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs font-semibold text-zinc-300">
                {analytics.redundancyCount} overlap{analytics.redundancyCount !== 1 ? "s" : ""} detected
              </span>
            }
          />

          {analytics.redundancies.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {analytics.redundancies.map((group, idx) => (
                <div key={idx} className="spotlight surface lift flex flex-col justify-between gap-4 p-5">
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-bold text-zinc-100">{group.title}</span>
                      <span className="tabular shrink-0 rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-inset ring-emerald-300/20">
                        Save +{money(group.potentialAnnualSavings)}/yr
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {group.serviceNames.map((svc) => (
                        <span key={svc} className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-zinc-300">
                          {svc}
                        </span>
                      ))}
                    </div>

                    <p className="text-pretty rounded-xl border border-white/[0.06] bg-black/25 p-3 text-xs leading-relaxed text-zinc-400">
                      <span className="font-semibold text-zinc-100">Recommendation:</span> {group.recommendation}
                    </p>
                  </div>

                  <div className="tabular flex items-center justify-between border-t border-white/[0.06] pt-3 text-xs text-zinc-400">
                    <span>Category outflow: {money(group.monthlySpend)}/mo</span>
                    <span>Annualized: {money(group.annualSpend)}/yr</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyNote title="No Functional Redundancies" text="All active subscriptions occupy unique service domains." />
          )}
        </section>
      </Reveal>

      {/* 3b. Renewal Collision Timeline */}
      <Reveal>
        <section className="space-y-4">
          <SectionTitle
            title="Renewal Collision Timeline"
            subtitle="Renewals landing in the next 30 days. Days with two or more charges (or $40+) are flagged as collisions."
          />

          {analytics.collisionTimeline.length > 0 ? (
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {analytics.collisionTimeline.map((day, i) => (
                <li
                  key={day.date}
                  style={{ "--i": Math.min(i, 8) } as React.CSSProperties}
                  className={cn(
                    "reveal relative space-y-2 overflow-hidden rounded-2xl border p-4",
                    day.collisionRisk ? "border-amber-400/30 bg-amber-400/[0.06]" : "border-white/[0.08] bg-white/[0.03]"
                  )}
                >
                  {day.collisionRisk && <span className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-amber-300 to-orange-400" />}
                  <div className="flex items-center justify-between text-xs">
                    <span className="tabular font-bold text-zinc-100">{day.date}</span>
                    <span className="tabular font-semibold text-zinc-200">{money(day.totalCost)}</span>
                  </div>
                  <div className="text-xs text-zinc-400">{day.serviceNames.join(", ")}</div>
                  {day.collisionRisk && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/12 px-2 py-0.5 text-[10px] font-bold text-amber-300 ring-1 ring-inset ring-amber-300/20">
                      <AlertIcon className="size-3" />
                      Collision risk
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyNote text="No renewals due in the next 30 days." />
          )}
        </section>
      </Reveal>

      {/* 4. Vampire Drain & Opportunity Cost Table */}
      <Reveal>
        <section className="space-y-4">
          <SectionTitle
            title="5-Year Opportunity Cost Analysis"
            subtitle="Comparing recurring cash outflow against standard S&P 500 index yield (7% compound annual return)."
            aside={
              <div className="text-right">
                <span className="block text-xs text-zinc-500">5-Yr Foregone Yield</span>
                <span className="tabular text-lg font-extrabold text-zinc-50">{money(analytics.total5YearOpportunityCost)}</span>
              </div>
            }
          />

          <div className="surface overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-white/[0.08] bg-black/30 text-zinc-400">
                  <tr>
                    <th className="px-5 py-3.5 font-semibold">Service</th>
                    <th className="px-5 py-3.5 font-semibold">Category</th>
                    <th className="px-5 py-3.5 text-right font-semibold">Monthly Outflow</th>
                    <th className="px-5 py-3.5 text-right font-semibold">1-Year Cost</th>
                    <th className="px-5 py-3.5 text-right font-semibold">3-Year Cost</th>
                    <th className="px-5 py-3.5 text-right font-semibold">5-Year Cost</th>
                    <th className="px-5 py-3.5 text-right font-semibold text-zinc-100">5-Yr Opportunity Cost</th>
                  </tr>
                </thead>
                <tbody className="tabular divide-y divide-white/[0.05]">
                  {analytics.vampireProjections.length > 0 ? (
                    analytics.vampireProjections.map((item) => (
                      <tr key={item.subscriptionId} className="transition-colors duration-200 hover:bg-brand-500/[0.07]">
                        <td className="flex items-center gap-2 px-5 py-3.5 font-semibold text-zinc-100">
                          <span>{item.name}</span>
                          {item.highDrainRisk && (
                            <span className="rounded-full bg-rose-500/12 px-2 py-0.5 text-[10px] font-bold text-rose-300 ring-1 ring-inset ring-rose-400/25">High Drain</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 capitalize text-zinc-400">{item.category}</td>
                        <td className="px-5 py-3.5 text-right font-semibold text-zinc-200">{money(item.monthlyCost)}</td>
                        <td className="px-5 py-3.5 text-right text-zinc-400">{money(item.oneYearSpend)}</td>
                        <td className="px-5 py-3.5 text-right text-zinc-400">{money(item.threeYearSpend)}</td>
                        <td className="px-5 py-3.5 text-right text-zinc-400">{money(item.fiveYearSpend)}</td>
                        <td className="px-5 py-3.5 text-right font-bold text-zinc-50">{money(item.fiveYearOpportunityCost)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-zinc-500">
                        No active subscriptions to project.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </Reveal>

      {/* 5. Domain Allocation */}
      <Reveal>
        <section className="space-y-4">
          <SectionTitle title="Category Spend Allocation" />

          {analytics.categoryBreakdowns.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {analytics.categoryBreakdowns.map((cat, i) => {
                const color = categoryColor(cat.categoryName, i);
                return (
                  <div key={cat.categoryName} className="spotlight surface lift space-y-3 p-5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 font-bold capitalize text-zinc-100">
                        <span className="size-2.5 rounded-full" style={{ background: color, boxShadow: `0 0 10px ${color}` }} />
                        {cat.categoryName}
                      </span>
                      <span className="tabular font-semibold text-zinc-300">{cat.percentage}%</span>
                    </div>

                    <div className="h-2 w-full overflow-hidden rounded-full bg-black/40">
                      <div
                        className="bar-grow h-full rounded-full"
                        style={{ width: `${Math.min(100, cat.percentage)}%`, background: `linear-gradient(90deg, ${color}, ${color}aa)`, "--i": i } as React.CSSProperties}
                      />
                    </div>

                    <div className="tabular flex items-center justify-between text-[11px] text-zinc-400">
                      <span>
                        {cat.count} service{cat.count > 1 ? "s" : ""}
                      </span>
                      <span className="font-semibold text-zinc-200">{money(cat.monthlySpend)}/mo</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyNote text="No active category spend allocations yet." />
          )}
        </section>
      </Reveal>
    </div>
  );
}
