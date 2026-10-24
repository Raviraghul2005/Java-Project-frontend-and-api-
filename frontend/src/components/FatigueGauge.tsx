"use client";

import React from "react";
import { formatMoney } from "@/lib/money";
import { AnalyticsData } from "@/types";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { RingGauge } from "@/components/ui/RingGauge";

interface FatigueGaugeProps {
  analytics: AnalyticsData;
}

export function FatigueGauge({ analytics }: FatigueGaugeProps) {
  const score = analytics.fatigueIndex;
  const level = analytics.fatigueLevel;
  const color = analytics.fatigueColor;
  const money = (amount: number) => formatMoney(amount, analytics.currency);

  return (
    <div className="spotlight surface relative overflow-hidden p-6 sm:p-7">
      {/* soft glow in the colour of the current level */}
      <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full opacity-25 blur-3xl" style={{ background: color }} />

      <div className="relative flex flex-col items-start justify-between gap-7 lg:flex-row lg:items-center">
        {/* Left: Score Gauge */}
        <div className="flex items-center gap-6">
          <RingGauge value={score} color={color} size={124} thickness={3.2}>
            <span className="text-[2rem] font-extrabold leading-none text-zinc-50 tabular">
              <AnimatedNumber value={score} duration={1500} />
            </span>
            <span className="mt-0.5 text-[10px] font-semibold text-zinc-500">/ 100</span>
          </RingGauge>

          <div>
            <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
              <h2 className="text-lg font-bold tracking-tight text-zinc-50">Subscription Fatigue Index</h2>
              <span
                className="rounded-full border px-2.5 py-0.5 text-[11px] font-bold"
                style={{ color, backgroundColor: `${color}1a`, borderColor: `${color}40` }}
              >
                {level}
              </span>
            </div>
            <p className="max-w-lg text-pretty text-xs leading-relaxed text-zinc-400">{analytics.fatigueInterpretation}</p>
          </div>
        </div>

        {/* Right: Heuristic Metric Breakdown */}
        <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4 lg:w-auto">
          {[
            { label: "Active Services", value: <AnimatedNumber value={analytics.activeCount} />, tone: "text-zinc-50" },
            {
              label: "Redundancies",
              value: <AnimatedNumber value={analytics.redundancyCount} />,
              tone: analytics.redundancyCount > 0 ? "text-amber-300" : "text-emerald-300"
            },
            { label: "Monthly Run Rate", value: <AnimatedNumber value={analytics.totalMonthlySpend} format={money} />, tone: "text-zinc-50" },
            {
              label: "Annual Savings",
              value: <AnimatedNumber value={analytics.potentialAnnualSavings} format={(v) => `+${money(v)}`} />,
              tone: "text-emerald-300"
            }
          ].map((metric) => (
            <div key={metric.label} className="min-w-[132px] rounded-xl border border-white/[0.07] bg-black/25 p-3.5">
              <span className="block text-[11px] font-medium text-zinc-400">{metric.label}</span>
              <span className={`mt-1 block text-lg font-bold tabular ${metric.tone}`}>{metric.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
