"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { SubscriptionModal } from "@/components/SubscriptionModal";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { DetectedSubscription, StatementAnalysis } from "@/types";

const MAX_BYTES = 2 * 1024 * 1024;
// A statement CSV carries no currency, so the user says which one it is in (used for display and when adding).
const CURRENCIES = ["USD", "EUR", "GBP", "INR", "CAD", "AUD"];

export default function ScanPage() {
  const { user, isBackendConnected, createSub, addToast } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<StatementAnalysis | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [currency, setCurrency] = useState("USD");
  const [adding, setAdding] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const canScan = Boolean(user) && isBackendConnected;

  const pickFile = (f: File | null) => {
    setError(null);
    setResult(null);
    setAdded(new Set());
    if (!f) return setFile(null);
    if (!f.name.toLowerCase().endsWith(".csv")) {
      setFile(null);
      return setError("Only .csv statements are supported.");
    }
    if (f.size > MAX_BYTES) {
      setFile(null);
      return setError("File is too large. The limit is 2 MB.");
    }
    setFile(f);
  };

  const scan = async () => {
    if (!file) return;
    setScanning(true);
    setError(null);
    try {
      setResult(await api.analyzeStatement(file));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not scan this file.");
    } finally {
      setScanning(false);
    }
  };

  const addToTracker = async (d: DetectedSubscription) => {
    if (adding) return;
    setAdding(d.merchantKey);
    const ok = await createSub({
      name: d.name,
      price: d.amount,
      currency,
      frequency: d.frequency,
      category: d.category,
      paymentMethod: "From bank statement",
      startDate: d.firstSeen,
      renewalDate: d.nextExpected
    });
    setAdding(null);
    if (ok) {
      setAdded((prev) => new Set(prev).add(d.merchantKey));
      // Re-run so the totals and "already tracked" flags reflect the new subscription.
      if (file) {
        try {
          setResult(await api.analyzeStatement(file));
        } catch {
          addToast("Added, but could not refresh the scan results.", "info");
        }
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#09090b]">
      <Navbar onOpenNewModal={() => setIsModalOpen(true)} />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">Scan a bank statement</h1>
          <p className="text-sm text-zinc-400 mt-0.5 max-w-2xl">
            Upload a statement CSV and Bill Pilot finds the charges that repeat on a schedule, including
            subscriptions you forgot to track. The file is analysed in memory and never stored.
          </p>
        </div>

        {!canScan && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
            {user ? (
              <>The backend is offline. Start the Spring Boot API on port 5500 to scan statements.</>
            ) : (
              <>
                Statement scanning needs an account.{" "}
                <Link href="/auth" className="underline underline-offset-2">
                  Sign in
                </Link>{" "}
                to continue.
              </>
            )}
          </div>
        )}

        <section className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-5 space-y-4">
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            aria-label="Choose a bank statement CSV file"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              pickFile(e.dataTransfer.files?.[0] ?? null);
            }}
            onClick={() => inputRef.current?.click()}
            className="w-full cursor-pointer rounded-lg border border-dashed border-zinc-700 hover:border-zinc-500 focus-visible:border-zinc-400 focus-visible:outline-none transition-colors p-8 text-center"
          >
            <span className="block text-sm text-zinc-200 font-medium">
              {file ? file.name : "Drop a .csv statement here or click to choose"}
            </span>
            <span className="block text-xs text-zinc-500 mt-1">
              Needs date, description and amount (or debit) columns. Max 2 MB.
            </span>
          </button>
          <p className="text-xs text-zinc-500">
            <a
              href="/sample-statement.csv"
              download
              className="underline underline-offset-2 hover:text-zinc-300"
            >
              Download a sample statement
            </a>
          </p>

          <div className="flex items-center gap-2">
            <label htmlFor="scan-currency" className="text-xs font-medium text-zinc-300">
              Statement currency
            </label>
            <select
              id="scan-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs focus:outline-none focus:border-zinc-600"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={scan}
            disabled={!file || scanning || !canScan}
            className="px-4 py-2 rounded-lg text-xs font-medium bg-zinc-100 hover:bg-white text-zinc-950 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {scanning ? "Scanning…" : "Scan for subscriptions"}
          </button>
        </section>

        {result && (
          <section className="space-y-4">
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-5">
              <p className="text-lg font-semibold text-zinc-100">
                {result.detected.length === 0
                  ? "No recurring charges found"
                  : `Found ${result.detected.length} recurring ${result.detected.length === 1 ? "charge" : "charges"} · ${formatMoney(result.detectedMonthlyTotal, currency)}/month`}
              </p>
              <p className="text-sm text-zinc-400 mt-1">
                {result.untrackedCount > 0
                  ? `${result.untrackedCount} ${result.untrackedCount === 1 ? "isn't" : "aren't"} in your tracker yet (${formatMoney(result.untrackedMonthlyTotal, currency)}/month, ${formatMoney(result.untrackedMonthlyTotal * 12, currency)}/year).`
                  : result.detected.length > 0
                    ? "Everything detected is already in your tracker."
                    : "Scanned " + result.transactionsScanned + " transactions. Recurring charges need at least two matching payments on a regular schedule."}
              </p>
              <p className="text-xs text-zinc-500 mt-1">{result.transactionsScanned} transactions scanned</p>
            </div>

            <ul className="space-y-3">
              {result.detected.map((d) => (
                <li
                  key={d.merchantKey}
                  className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-zinc-100">{d.name}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">{d.frequency}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
                        {d.confidence}% confidence
                      </span>
                      {d.alreadyTracked && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300">
                          already tracked
                        </span>
                      )}
                      {d.previousAmount != null && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300">
                          price changed from {formatMoney(d.previousAmount, currency)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">
                      {formatMoney(d.amount, currency)} · next expected {d.nextExpected} · {d.evidence}
                    </p>
                  </div>

                  {!d.alreadyTracked && (
                    <button
                      type="button"
                      aria-label={`Add ${d.name} to tracker`}
                      onClick={() => addToTracker(d)}
                      disabled={added.has(d.merchantKey) || adding !== null}
                      className="shrink-0 px-3 py-1.5 rounded-md text-xs font-medium bg-zinc-100 hover:bg-white text-zinc-950 disabled:opacity-40 transition-colors cursor-pointer"
                    >
                      {added.has(d.merchantKey) ? "Added" : adding === d.merchantKey ? "Adding…" : "Add to tracker"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <SubscriptionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
