"use client";

import React from "react";
import { AnalyticsData } from "@/types";

interface FatigueGaugeProps {
  analytics: AnalyticsData;
}

export function FatigueGauge({ analytics }: FatigueGaugeProps) {
  const score = analytics.fatigueIndex;
  const level = analytics.fatigueLevel;
  const color = analytics.fatigueColor;

  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-6">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        {/* Left: Score Gauge */}
        <div className="flex items-center gap-5">
          <div className="relative size-24 flex items-center justify-center flex-shrink-0">
            {/* SVG Circular Progress Track */}
            <svg className="size-full -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-zinc-800"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                strokeWidth="3.5"
                strokeDasharray={`${score}, 100`}
                strokeLinecap="round"
                stroke={color}
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute text-center">
              <span className="text-2xl font-bold text-zinc-100 tabular">{score}</span>
              <span className="block text-[9px] text-zinc-400 font-medium">/ 100</span>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-base font-semibold text-zinc-100">
                Subscription Fatigue Index
              </h2>
              <span
                className="text-[11px] font-medium px-2 py-0.5 rounded-full border"
                style={{
                  color: color,
                  backgroundColor: `${color}15`,
                  borderColor: `${color}30`
                }}
              >
                {level}
              </span>
            </div>
            <p className="text-xs text-zinc-400 max-w-lg leading-relaxed text-pretty">
              {analytics.fatigueInterpretation}
            </p>
          </div>
        </div>

        {/* Right: Heuristic Metric Breakdown */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full lg:w-auto">
          <div className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800/60 min-w-[110px]">
            <span className="text-[11px] text-zinc-400 block">Active Services</span>
            <span className="text-base font-semibold text-zinc-100 tabular">{analytics.activeCount}</span>
          </div>

          <div className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800/60 min-w-[110px]">
            <span className="text-[11px] text-zinc-400 block">Redundancies</span>
            <span className={`text-base font-semibold tabular ${analytics.redundancyCount > 0 ? "text-amber-400" : "text-emerald-400"}`}>
              {analytics.redundancyCount}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800/60 min-w-[110px]">
            <span className="text-[11px] text-zinc-400 block">Monthly Run Rate</span>
            <span className="text-base font-semibold text-zinc-100 tabular">${analytics.totalMonthlySpend}</span>
          </div>

          <div className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800/60 min-w-[110px]">
            <span className="text-[11px] text-zinc-400 block">Annual Savings</span>
            <span className="text-base font-semibold text-emerald-400 tabular">
              +${analytics.potentialAnnualSavings}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
