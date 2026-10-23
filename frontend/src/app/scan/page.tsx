"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { CadenceStrip } from "@/components/CadenceStrip";
import { Navbar } from "@/components/Navbar";
import { SubscriptionModal } from "@/components/SubscriptionModal";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";
import { monthSpan } from "@/lib/cadenceStrip";
import { formatMoney } from "@/lib/money";
import { DetectedSubscription, SharedDescriptorSummary, StatementAnalysis } from "@/types";

const MAX_BYTES = 2 * 1024 * 1024;
// A statement CSV carries no currency, so the user says which one it is in (used for display and when adding).
const CURRENCIES = ["USD", "EUR", "GBP", "INR", "CAD", "AUD"];
const MAX_NAME_LENGTH = 100;

interface Span {
  firstMonth: string;
  lastMonth: string;
}

/** "stopped" (no charge for two billing dates) or "overdue" (one missing); nothing for an active subscription. */
function StatusBadge({ status }: { status: DetectedSubscription["status"] }) {
  if (status === "stopped") {
    return <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">stopped</span>;
  }
  if (status === "overdue") {
    return <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300">overdue</span>;
  }
  return null;
}

interface StreamRowProps {
  d: DetectedSubscription;
  name: string;
  onName: (name: string) => void;
  span: Span | null;
  currency: string;
  added: boolean;
  adding: boolean;
  busy: boolean;
  onAdd: () => void;
}

/** One subscription found under a shared descriptor: editable name, month-by-month strip, badges. */
function StreamRow({ d, name, onName, span, currency, added, adding, busy, onAdd }: StreamRowProps) {
  const stopped = d.status === "stopped";
  const canAdd = !d.alreadyTracked && !stopped;
  // streamId holds spaces, "#" and "." ("google play#MONTHLY#14#2.99"), which don't belong in an element id.
  const nameId = `stream-name-${d.streamId.replace(/[^A-Za-z0-9_-]/g, "-")}`;
  return (
    <li className="py-4 first:pt-0 last:pb-0 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
      <div className="min-w-0 space-y-2 flex-1">
        <label htmlFor={nameId} className="sr-only">
          Name for {d.name}
        </label>
        <input
          id={nameId}
          type="text"
          value={name}
          maxLength={MAX_NAME_LENGTH}
          onChange={(e) => onName(e.target.value)}
          className="w-full max-w-md px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 text-sm font-medium focus:outline-none focus:border-zinc-600"
        />
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">{d.frequency}</span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">{d.confidence}% confidence</span>
          {d.groupedCharges > 0 && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">grouped ×{d.groupedCharges}</span>
          )}
          {d.previousAmount != null && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300">
              price changed from {formatMoney(d.previousAmount, currency)}
              {d.priceChangedOn ? ` on ${d.priceChangedOn}` : ""}
            </span>
          )}
          <StatusBadge status={d.status} />
          {d.alreadyTracked && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300">
              already tracked{d.trackedName ? ` as ${d.trackedName}` : ""}
            </span>
          )}
        </div>
        {span && <CadenceStrip charges={d.charges ?? []} firstMonth={span.firstMonth} lastMonth={span.lastMonth} />}
        <p className="text-xs text-zinc-400">
          {formatMoney(d.amount, currency)} · {d.nextExpected ? `next expected ${d.nextExpected}` : "no longer charged"} · {d.evidence}
        </p>
      </div>

      {canAdd && (
        <button
          type="button"
          aria-label={`Add ${name.trim() || d.name} to tracker`}
          onClick={onAdd}
          disabled={added || busy || name.trim().length < 2}
          className="shrink-0 px-3 py-1.5 rounded-md text-xs font-medium bg-zinc-100 hover:bg-white text-zinc-950 disabled:opacity-40 transition-colors cursor-pointer"
        >
          {added ? "Added" : adding ? "Adding…" : "Add to tracker"}
        </button>
      )}
    </li>
  );
}

interface SharedBlockProps {
  summary: SharedDescriptorSummary;
  streams: DetectedSubscription[];
  names: Record<string, string>;
  setNames: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  span: Span | null;
  currency: string;
  added: Set<string>;
  adding: string | null;
  onAdd: (d: DetectedSubscription, name: string) => void;
}

/** Everything found under one shared descriptor (Apple, PayPal, ...). */
function SharedBlock({ summary, streams, names, setNames, span, currency, added, adding, onAdd }: SharedBlockProps) {
  const n = streams.length;
  // "APPLE.COM/BILL (Apple)"; just the descriptor when the label adds nothing.
  const title =
    !summary.descriptor || summary.descriptor.toLowerCase() === summary.label.toLowerCase()
      ? summary.label
      : `${summary.descriptor} (${summary.label})`;
  const nameOf = (d: DetectedSubscription) => names[d.streamId] ?? d.trackedName ?? d.name;
  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-5">
      <h2 className="text-base font-semibold text-zinc-100">
        {title} hides {n} {n === 1 ? "subscription" : "subscriptions"}
      </h2>
      {summary.oneOffCount > 0 && (
        <p className="text-xs text-zinc-500 mt-0.5">
          {summary.oneOffCount} one-off {summary.oneOffCount === 1 ? "purchase" : "purchases"} (total{" "}
          {formatMoney(summary.oneOffTotal, currency)}) {summary.oneOffCount === 1 ? "was" : "were"} left out
        </p>
      )}
      <ul className="mt-4 divide-y divide-zinc-800/80">
        {streams.map((d) => (
          <StreamRow
            key={d.streamId}
            d={d}
            name={nameOf(d)}
            onName={(name) => setNames((prev) => ({ ...prev, [d.streamId]: name }))}
            span={span}
            currency={currency}
            added={added.has(d.streamId)}
            adding={adding === d.streamId}
            busy={adding !== null}
            onAdd={() => onAdd(d, nameOf(d).trim())}
          />
        ))}
      </ul>
    </div>
  );
}

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
  // Names the user edited for streams found under a shared descriptor, by streamId.
  const [names, setNames] = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  const canScan = Boolean(user) && isBackendConnected;

  // Streams under a shared descriptor get a block each, above the ordinary list.
  // (`?? []` keeps the page working against a backend that predates these fields.)
  const detected = result?.detected ?? [];
  const sharedSummaries = result?.sharedDescriptors ?? [];
  const sharedBlocks = sharedSummaries
    .map((summary) => ({ summary, streams: detected.filter((d) => d.sharedDescriptor === summary.label) }))
    .filter((b) => b.streams.length > 0);
  const ordinary = detected.filter((d) => !d.sharedDescriptor);
  // Every strip covers the same months: the span of the whole scan, at most the latest 12.
  const span = result
    ? monthSpan([
        ...detected.flatMap((d) => (d.charges ?? []).map((c) => c.date)),
        ...sharedSummaries.flatMap((s) => (s.oneOffs ?? []).map((o) => o.date))
      ])
    : null;

  const pickFile = (f: File | null) => {
    setError(null);
    setResult(null);
    setAdded(new Set());
    setNames({});
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

  const addToTracker = async (d: DetectedSubscription, name: string = d.name) => {
    if (adding) return;
    setAdding(d.streamId);
    const ok = await createSub({
      name,
      price: d.amount,
      currency,
      frequency: d.frequency,
      category: d.category,
      paymentMethod: "From bank statement",
      startDate: d.firstSeen,
      renewalDate: d.nextExpected ?? undefined
    });
    setAdding(null);
    if (ok) {
      setAdded((prev) => new Set(prev).add(d.streamId));
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
            {" · "}
            <a
              href="/sample-statement-shared.csv"
              download
              className="underline underline-offset-2 hover:text-zinc-300"
            >
              Download a sample with shared descriptors
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

            {sharedBlocks.map(({ summary, streams }) => (
              <SharedBlock
                key={summary.key}
                summary={summary}
                streams={streams}
                names={names}
                setNames={setNames}
                span={span}
                currency={currency}
                added={added}
                adding={adding}
                onAdd={addToTracker}
              />
            ))}

            <ul className="space-y-3">
              {ordinary.map((d) => (
                <li
                  key={d.streamId}
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
                      <StatusBadge status={d.status} />
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">
                      {formatMoney(d.amount, currency)} · {d.nextExpected ? `next expected ${d.nextExpected}` : "no longer charged"} · {d.evidence}
                    </p>
                  </div>

                  {!d.alreadyTracked && d.status !== "stopped" && (
                    <button
                      type="button"
                      aria-label={`Add ${d.name} to tracker`}
                      onClick={() => addToTracker(d)}
                      disabled={added.has(d.streamId) || adding !== null}
                      className="shrink-0 px-3 py-1.5 rounded-md text-xs font-medium bg-zinc-100 hover:bg-white text-zinc-950 disabled:opacity-40 transition-colors cursor-pointer"
                    >
                      {added.has(d.streamId) ? "Added" : adding === d.streamId ? "Adding…" : "Add to tracker"}
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
