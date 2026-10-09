"use client";

import React, { useState, useMemo } from "react";
import { Navbar } from "@/components/Navbar";
import { SubscriptionModal } from "@/components/SubscriptionModal";
import { useApp } from "@/context/AppContext";

export default function SimulatorPage() {
  const { subscriptions } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Simulation state: Set of paused subscription IDs
  const [pausedIds, setPausedIds] = useState<Set<string>>(new Set());

  // Annualized subscriptions in simulation
  const [annualizedIds, setAnnualizedIds] = useState<Set<string>>(new Set());

  const activeSubs = useMemo(() => {
    return subscriptions.filter((s) => s.status === "active");
  }, [subscriptions]);

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

  const toMonthly = (price: number, freq: string): number => {
    if (!price) return 0;
    if (freq === "yearly") return price / 12;
    if (freq === "weekly") return price * 4.33;
    if (freq === "daily") return price * 30;
    return price;
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
          m = m * 0.82; // 18% annual billing discount
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
    const fiveYearRecovery = monthlySaved * 71.59; // 7% compound growth

    const rawScore = retainedCount * 4.5 + Math.min(30, simMonthly / 15) + redundantCount * 12;
    const simSFI = retainedCount === 0 ? 0 : Math.min(100, Math.max(8, Math.round(rawScore)));

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

  return (
    <div className="flex-1 flex flex-col bg-[#09090b]">
      <Navbar onOpenNewModal={() => setIsModalOpen(true)} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-7">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
              Arbitrage Simulator
            </h1>
            <p className="text-sm text-zinc-400 mt-0.5">
              Simulate pruning redundant domain commitments and converting monthly plans to discounted annual cycles.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={applyOptimalArbitrage}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-100 text-zinc-950 hover:bg-white transition-colors cursor-pointer"
            >
              Auto-Optimize Stack
            </button>
            <button
              onClick={resetSimulation}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-900 border border-zinc-800 transition-colors cursor-pointer"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Real-time KPI Tiles */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4.5">
            <span className="text-xs font-medium text-zinc-400 block">Simulated Monthly Spend</span>
            <div className="text-2xl font-semibold text-zinc-100 mt-1 tabular">
              ${simulated.simMonthly}
            </div>
            <div className="text-xs text-zinc-500 mt-1 tabular">
              Base: ${baseMonthly.toFixed(2)}/mo
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4.5">
            <span className="text-xs font-medium text-zinc-400 block">Annual Cash Recovery</span>
            <div className="text-2xl font-semibold text-emerald-400 mt-1 tabular">
              +${simulated.annualSaved}
            </div>
            <div className="text-xs text-zinc-500 mt-1">
              Recaptured discretionary capital
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4.5">
            <span className="text-xs font-medium text-zinc-400 block">5-Yr Compounded Yield (7%)</span>
            <div className="text-2xl font-semibold text-zinc-100 mt-1 tabular">
              +${simulated.fiveYearRecovery}
            </div>
            <div className="text-xs text-zinc-500 mt-1">
              If invested in standard index yield
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4.5">
            <span className="text-xs font-medium text-zinc-400 block">Projected Fatigue (SFI)</span>
            <div className="text-2xl font-semibold text-zinc-100 mt-1 tabular">
              {simulated.simSFI}
              <span className="text-xs text-zinc-500 font-normal"> / 100</span>
            </div>
            <div className="text-xs text-zinc-500 mt-1">
              {simulated.retainedCount} active • {simulated.redundantCount} overlaps
            </div>
          </div>
        </section>

        {/* Interactive List */}
        <section className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-800/80 bg-zinc-950/60 flex items-center justify-between text-xs text-zinc-400 font-medium">
            <span>Service Controls</span>
            <span>{pausedIds.size} Paused • {annualizedIds.size} Annualized</span>
          </div>

          <div className="divide-y divide-zinc-800/60">
            {activeSubs.length > 0 ? (
              activeSubs.map((sub) => {
                const isPaused = pausedIds.has(sub.id);
                const isAnnual = annualizedIds.has(sub.id);

                return (
                  <div
                    key={sub.id}
                    className={`px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                      isPaused ? "bg-zinc-950/40 opacity-50" : "hover:bg-zinc-800/20"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => togglePause(sub.id)}
                        className={`size-6 rounded-md border flex items-center justify-center text-xs font-medium transition-colors cursor-pointer ${
                          isPaused
                            ? "bg-zinc-800 border-zinc-700 text-zinc-500"
                            : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                        }`}
                        title={isPaused ? "Resume in simulation" : "Pause in simulation"}
                      >
                        {isPaused ? "✕" : "✓"}
                      </button>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-zinc-200">{sub.name}</span>
                          <span className="text-[11px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 capitalize">
                            {sub.category}
                          </span>
                          {isPaused && (
                            <span className="text-[11px] text-zinc-500 font-medium">
                              Paused
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-zinc-500 tabular mt-0.5">
                          Current: ${sub.price.toFixed(2)}/{sub.frequency}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-center">
                      {!isPaused && sub.frequency !== "yearly" && (
                        <button
                          onClick={() => toggleAnnualized(sub.id)}
                          className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                            isAnnual
                              ? "bg-zinc-200 text-zinc-950 font-medium"
                              : "bg-zinc-800/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                          }`}
                        >
                          {isAnnual ? "Annualized (-18%)" : "Annual plan"}
                        </button>
                      )}
                      {!isPaused && sub.frequency === "yearly" && (
                        <span className="text-[11px] text-zinc-500 font-medium px-2 py-1">
                          Annual
                        </span>
                      )}

                      <div className="text-right min-w-[70px]">
                        <span className="text-xs font-medium text-zinc-200 tabular">
                          {isPaused
                            ? "$0.00/mo"
                            : isAnnual
                            ? `$${(toMonthly(sub.price, sub.frequency) * 0.82).toFixed(2)}/mo`
                            : `$${toMonthly(sub.price, sub.frequency).toFixed(2)}/mo`}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-12 text-center text-xs text-zinc-500">
                No active subscriptions to simulate. Add subscriptions to model portfolio arbitrage and annualization savings.
              </div>
            )}
          </div>
        </section>
      </main>

      <SubscriptionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
