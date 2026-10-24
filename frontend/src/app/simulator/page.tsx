"use client";

import React, { useState, useMemo } from "react";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { CheckIcon, SparklesIcon, XIcon } from "@/components/ui/icons";
import { RingGauge } from "@/components/ui/RingGauge";
import { SubLogo } from "@/components/ui/SubLogo";
import { useApp } from "@/context/AppContext";
import { categoryColor } from "@/lib/categoryColors";
import { cn } from "@/lib/cn";
import { daysUntil } from "@/lib/dates";
import { formatMoney, primaryCurrency, toMonthly } from "@/lib/money";

const ANNUAL_PLAN_DISCOUNT = 0.18; // assumed saving when switching a monthly plan to annual billing
const OPPORTUNITY_FACTOR_5YR = 71.5929; // FV of 60 monthly deposits at 7% APR

/** Ring colour for a projected fatigue score. */
function fatigueColor(score: number): string {
  if (score <= 30) return "#2fd88a";
  if (score <= 60) return "#fbbf24";
  if (score <= 80) return "#fb923c";
  return "#f43f5e";
}

export default function SimulatorPage() {
  const { subscriptions } = useApp();

  // Simulation state: Set of paused subscription IDs
  const [pausedIds, setPausedIds] = useState<Set<string>>(new Set());

  // Annualized subscriptions in simulation
  const [annualizedIds, setAnnualizedIds] = useState<Set<string>>(new Set());

  // Prices in different currencies can't be added together, so the simulation covers the primary currency.
  const currency = useMemo(
    () => primaryCurrency(subscriptions.filter((s) => s.status === "active")),
    [subscriptions]
  );

  const activeSubs = useMemo(() => {
    return subscriptions.filter(
      (s) => s.status === "active" && (s.currency || "USD").toUpperCase() === currency
    );
  }, [subscriptions, currency]);

  const excludedCount = useMemo(
    () => subscriptions.filter((s) => s.status === "active").length - activeSubs.length,
    [subscriptions, activeSubs]
  );

  // Only count simulation choices that still refer to a subscription on the board.
  const pausedCount = activeSubs.filter((s) => pausedIds.has(s.id)).length;
  const annualizedCount = activeSubs.filter((s) => annualizedIds.has(s.id)).length;

  const togglePause = (id: string) => {
    setPausedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAnnualized = (id: string) => {
    setAnnualizedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Base metrics
  const baseMonthly = useMemo(() => {
    return activeSubs.reduce((acc, s) => {
      return acc + toMonthly(s.price, s.frequency);
    }, 0);
  }, [activeSubs]);

  // Simulated metrics
  const simulated = useMemo(() => {
    let simMonthly = 0;
    let retainedCount = 0;
    const catMap = new Map<string, number>();

    activeSubs.forEach((s) => {
      if (!pausedIds.has(s.id)) {
        retainedCount++;
        let m = toMonthly(s.price, s.frequency);

        if (annualizedIds.has(s.id) && s.frequency !== "yearly") {
          m = m * (1 - ANNUAL_PLAN_DISCOUNT);
        }

        simMonthly += m;
        catMap.set(s.category, (catMap.get(s.category) || 0) + 1);
      }
    });

    let redundantCount = 0;
    catMap.forEach((cnt) => {
      if (cnt > 1) redundantCount += cnt - 1;
    });

    const monthlySaved = Math.max(0, baseMonthly - simMonthly);
    const annualSaved = monthlySaved * 12;
    const fiveYearRecovery = monthlySaved * OPPORTUNITY_FACTOR_5YR;

    // Renewal collisions in the next 30 days among the retained plans (same rule as the server's audit).
    const byDate = new Map<string, { count: number; total: number }>();
    activeSubs.forEach((s) => {
      if (pausedIds.has(s.id) || !s.renewalDate) return;
      const days = daysUntil(s.renewalDate);
      if (days === null || days < 0 || days > 30) return;
      const entry = byDate.get(s.renewalDate) ?? { count: 0, total: 0 };
      entry.count++;
      entry.total += s.price;
      byDate.set(s.renewalDate, entry);
    });
    let collisionDays = 0;
    byDate.forEach((e) => {
      if (e.count >= 2 || e.total >= 40) collisionDays++;
    });

    const rawScore =
      retainedCount * 4.5 +
      Math.min(30, simMonthly / 15) +
      redundantCount * 12 +
      Math.min(18, collisionDays * 6);
    const simSFI = retainedCount === 0 ? 0 : Math.min(100, Math.max(5, Math.round(rawScore)));

    return {
      simMonthly: Number(simMonthly.toFixed(2)),
      monthlySaved: Number(monthlySaved.toFixed(2)),
      annualSaved: Math.round(annualSaved),
      fiveYearRecovery: Math.round(fiveYearRecovery),
      retainedCount,
      redundantCount,
      simSFI
    };
  }, [activeSubs, pausedIds, annualizedIds, baseMonthly]);

  const applyOptimalArbitrage = () => {
    const newPaused = new Set<string>();
    const seenCats = new Set<string>();
    const newAnnual = new Set<string>();

    activeSubs.forEach((s) => {
      if (s.category === "entertainment") {
        if (seenCats.has("entertainment")) {
          newPaused.add(s.id);
        } else {
          seenCats.add("entertainment");
        }
      }
      if (s.price >= 15 && s.frequency === "monthly") {
        newAnnual.add(s.id);
      }
    });

    setPausedIds(newPaused);
    setAnnualizedIds(newAnnual);
  };

  const resetSimulation = () => {
    setPausedIds(new Set());
    setAnnualizedIds(new Set());
  };

  const money = (amount: number) => formatMoney(amount, currency);
  const keptShare = baseMonthly > 0 ? Math.min(100, (simulated.simMonthly / baseMonthly) * 100) : 100;
  const sfiColor = fatigueColor(simulated.simSFI);

  return (
    <div className="page-enter space-y-7 pt-2">
      {/* Header */}
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            <span className="text-gradient">Arbitrage Simulator</span>
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-zinc-400">
            Simulate pruning redundant domain commitments and converting monthly plans to discounted annual cycles
            (assumes an {Math.round(ANNUAL_PLAN_DISCOUNT * 100)}% annual-plan discount).
          </p>
          {excludedCount > 0 && (
            <p className="mt-1.5 text-xs text-amber-400/90">
              Showing {currency} plans only; {excludedCount} active plan{excludedCount === 1 ? "" : "s"} in other currencies {excludedCount === 1 ? "is" : "are"} excluded.
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={applyOptimalArbitrage} className="btn-primary">
            <SparklesIcon className="size-4" />
            Auto-Optimize Stack
          </button>
          <button type="button" onClick={resetSimulation} className="btn-ghost h-[2.4rem]">
            Reset
          </button>
        </div>
      </header>

      {/* Real-time KPI Tiles */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="spotlight surface lift reveal p-5" style={{ "--i": 0 } as React.CSSProperties}>
          <span className="block text-[13px] font-semibold text-zinc-400">Simulated Monthly Spend</span>
          <div className="tabular mt-3 text-[1.9rem] font-extrabold leading-none tracking-tight text-zinc-50">
            <AnimatedNumber value={simulated.simMonthly} format={money} duration={800} />
          </div>
          <div className="tabular mt-2 text-xs text-zinc-500">Base: {money(baseMonthly)}/mo</div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/40" aria-hidden="true">
            <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-aqua-400 transition-[width] duration-700 ease-out" style={{ width: `${keptShare}%` }} />
          </div>
        </div>

        <div className="spotlight surface lift reveal p-5" style={{ "--i": 1 } as React.CSSProperties}>
          <span className="block text-[13px] font-semibold text-zinc-400">Annual Cash Recovery</span>
          <div className="tabular mt-3 text-[1.9rem] font-extrabold leading-none tracking-tight text-emerald-300">
            <AnimatedNumber value={simulated.annualSaved} format={(v) => `+${money(v)}`} duration={800} />
          </div>
          <div className="mt-2 text-xs text-zinc-500">Recaptured discretionary capital</div>
        </div>

        <div className="spotlight surface lift reveal p-5" style={{ "--i": 2 } as React.CSSProperties}>
          <span className="block text-[13px] font-semibold text-zinc-400">5-Yr Compounded Yield (7%)</span>
          <div className="tabular mt-3 text-[1.9rem] font-extrabold leading-none tracking-tight text-zinc-50">
            <AnimatedNumber value={simulated.fiveYearRecovery} format={(v) => `+${money(v)}`} duration={800} />
          </div>
          <div className="mt-2 text-xs text-zinc-500">If invested in standard index yield</div>
        </div>

        <div className="spotlight surface lift reveal flex items-center justify-between gap-3 p-5" style={{ "--i": 3 } as React.CSSProperties}>
          <div>
            <span className="block text-[13px] font-semibold text-zinc-400">Projected Fatigue (SFI)</span>
            <div className="tabular mt-3 text-[1.9rem] font-extrabold leading-none tracking-tight text-zinc-50">
              {simulated.simSFI}
              <span className="text-xs font-normal text-zinc-500"> / 100</span>
            </div>
            <div className="mt-2 text-xs text-zinc-500">
              {simulated.retainedCount} active • {simulated.redundantCount} overlaps
            </div>
          </div>
          <RingGauge value={simulated.simSFI} color={sfiColor} size={76} thickness={4}>
            <span className="text-xs font-extrabold" style={{ color: sfiColor }}>
              {simulated.simSFI}
            </span>
          </RingGauge>
        </div>
      </section>

      {/* Interactive List */}
      <section className="surface overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/[0.07] bg-black/25 px-5 py-3.5 text-xs font-semibold text-zinc-400">
          <span>Service Controls</span>
          <span className="tabular">
            <span className={cn("transition-colors", pausedCount > 0 && "text-rose-300")}>{pausedCount} Paused</span> •{" "}
            <span className={cn("transition-colors", annualizedCount > 0 && "text-brand-300")}>{annualizedCount} Annualized</span>
          </span>
        </div>

        <div className="divide-y divide-white/[0.05]">
          {activeSubs.length > 0 ? (
            activeSubs.map((sub, i) => {
              const isPaused = pausedIds.has(sub.id);
              const isAnnual = annualizedIds.has(sub.id);
              const accent = categoryColor(sub.category);

              return (
                <div
                  key={sub.id}
                  style={{ "--i": Math.min(i, 12) } as React.CSSProperties}
                  className={cn(
                    "reveal flex flex-col justify-between gap-3 px-5 py-4 transition-colors duration-300 sm:flex-row sm:items-center",
                    isPaused ? "bg-black/25" : "hover:bg-white/[0.03]"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      aria-pressed={isPaused}
                      aria-label={`${isPaused ? "Resume" : "Pause"} ${sub.name} in simulation`}
                      onClick={() => togglePause(sub.id)}
                      className={cn(
                        "flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border transition-all duration-300 active:scale-90",
                        isPaused
                          ? "border-white/10 bg-white/[0.04] text-zinc-500 hover:text-zinc-300"
                          : "border-emerald-300/30 bg-emerald-400/12 text-emerald-300 shadow-[0_0_18px_-4px_rgb(47_216_138/0.55)] hover:bg-emerald-400/20"
                      )}
                      title={isPaused ? "Resume in simulation" : "Pause in simulation"}
                    >
                      {isPaused ? <XIcon className="size-4" /> : <CheckIcon className="size-4" />}
                    </button>

                    <SubLogo name={sub.name} className={cn("size-10 transition-all duration-300", isPaused && "opacity-40 grayscale")} />

                    <div className={cn("transition-opacity duration-300", isPaused && "opacity-50")}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-zinc-100">{sub.name}</span>
                        <span className="flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium capitalize text-zinc-400">
                          <span className="size-1.5 rounded-full" style={{ background: accent }} />
                          {sub.category}
                        </span>
                        {isPaused && <span className="text-[11px] font-semibold text-zinc-500">Paused</span>}
                      </div>
                      <div className="tabular mt-0.5 text-xs text-zinc-500">
                        Current: {money(sub.price)}/{sub.frequency}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 self-end sm:self-center">
                    {!isPaused && sub.frequency !== "yearly" && (
                      <button
                        type="button"
                        aria-pressed={isAnnual}
                        onClick={() => toggleAnnualized(sub.id)}
                        className={cn(
                          "cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-300 active:scale-95",
                          isAnnual
                            ? "bg-gradient-to-b from-brand-500 to-brand-600 text-white shadow-[0_6px_18px_-6px_rgb(124_92_255/0.9)]"
                            : "border border-white/[0.08] bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-100"
                        )}
                      >
                        {isAnnual ? `Annualized (-${Math.round(ANNUAL_PLAN_DISCOUNT * 100)}%)` : "Annual plan"}
                      </button>
                    )}
                    {!isPaused && sub.frequency === "yearly" && <span className="px-2 py-1 text-[11px] font-semibold text-zinc-500">Annual</span>}

                    <div className="min-w-[84px] text-right">
                      <span className={cn("tabular text-sm font-bold transition-colors duration-300", isPaused ? "text-zinc-600 line-through" : isAnnual ? "text-brand-200" : "text-zinc-100")}>
                        {isPaused
                          ? `${money(toMonthly(sub.price, sub.frequency))}/mo`
                          : isAnnual
                            ? `${money(toMonthly(sub.price, sub.frequency) * (1 - ANNUAL_PLAN_DISCOUNT))}/mo`
                            : `${money(toMonthly(sub.price, sub.frequency))}/mo`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-14 text-center text-xs text-zinc-500">
              No active subscriptions to simulate. Add subscriptions to model portfolio arbitrage and annualization savings.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
