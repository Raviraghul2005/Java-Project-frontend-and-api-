"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { CadenceStrip } from "@/components/CadenceStrip";
import { CheckIcon, SparklesIcon, UploadIcon } from "@/components/ui/icons";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";
import { monthSpan } from "@/lib/cadenceStrip";
import { cn } from "@/lib/cn";
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

const CHIP = "rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset";

/** "stopped" (no charge for two billing dates) or "overdue" (one missing); nothing for an active subscription. */
function StatusBadge({ status }: { status: DetectedSubscription["status"] }) {
  if (status === "stopped") {
    return <span className={cn(CHIP, "bg-zinc-500/10 text-zinc-400 ring-zinc-400/20")}>stopped</span>;
  }
  if (status === "overdue") {
    return <span className={cn(CHIP, "bg-amber-400/10 text-amber-300 ring-amber-300/25")}>overdue</span>;
  }
  return null;
}

interface StreamRowProps {
  d: DetectedSubscription;
  index: number;
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
function StreamRow({ d, index, name, onName, span, currency, added, adding, busy, onAdd }: StreamRowProps) {
  const stopped = d.status === "stopped";
  const canAdd = !d.alreadyTracked && !stopped;
  // streamId holds spaces, "#" and "." ("google play#MONTHLY#14#2.99"), which don't belong in an element id.
  const nameId = `stream-name-${d.streamId.replace(/[^A-Za-z0-9_-]/g, "-")}`;
  return (
    <li
      style={{ "--i": index } as React.CSSProperties}
      className="reveal flex flex-col justify-between gap-4 py-5 first:pt-0 last:pb-0 lg:flex-row lg:items-center"
    >
      <div className="min-w-0 flex-1 space-y-3">
        <label htmlFor={nameId} className="sr-only">
          Name for {d.name}
        </label>
        <input id={nameId} type="text" value={name} maxLength={MAX_NAME_LENGTH} onChange={(e) => onName(e.target.value)} className="field max-w-md font-semibold" />
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn(CHIP, "bg-white/[0.06] text-zinc-300 ring-white/10")}>{d.frequency}</span>
          <span className={cn(CHIP, "bg-white/[0.06] text-zinc-300 ring-white/10")}>{d.confidence}% confidence</span>
          {d.groupedCharges > 0 && <span className={cn(CHIP, "bg-brand-500/15 text-brand-200 ring-brand-300/25")}>grouped ×{d.groupedCharges}</span>}
          {d.previousAmount != null && (
            <span className={cn(CHIP, "bg-amber-400/10 text-amber-300 ring-amber-300/25")}>
              price changed from {formatMoney(d.previousAmount, currency)}
              {d.priceChangedOn ? ` on ${d.priceChangedOn}` : ""}
            </span>
          )}
          <StatusBadge status={d.status} />
          {d.alreadyTracked && (
            <span className={cn(CHIP, "bg-emerald-400/10 text-emerald-300 ring-emerald-300/25")}>
              already tracked{d.trackedName ? ` as ${d.trackedName}` : ""}
            </span>
          )}
        </div>
        {span && <CadenceStrip charges={d.charges ?? []} firstMonth={span.firstMonth} lastMonth={span.lastMonth} />}
        <p className="text-xs leading-relaxed text-zinc-400">
          {formatMoney(d.amount, currency)} · {d.nextExpected ? `next expected ${d.nextExpected}` : "no longer charged"} · {d.evidence}
        </p>
      </div>

      {canAdd && (
        <button
          type="button"
          aria-label={`Add ${name.trim() || d.name} to tracker`}
          onClick={onAdd}
          disabled={added || busy || name.trim().length < 2}
          className="btn-primary shrink-0"
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
    <div className="spotlight surface p-6">
      <h2 className="text-lg font-bold tracking-tight text-zinc-50">
        {title} hides {n} {n === 1 ? "subscription" : "subscriptions"}
      </h2>
      {summary.oneOffCount > 0 && (
        <p className="mt-1 text-xs text-zinc-500">
          {summary.oneOffCount} one-off {summary.oneOffCount === 1 ? "purchase" : "purchases"} (total{" "}
          {formatMoney(summary.oneOffTotal, currency)}) {summary.oneOffCount === 1 ? "was" : "were"} left out
        </p>
      )}
      <ul className="mt-5 divide-y divide-white/[0.06]">
        {streams.map((d, i) => (
          <StreamRow
            key={d.streamId}
            d={d}
            index={i}
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
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<StatementAnalysis | null>(null);
  const [scanning, setScanning] = useState(false);
  const [dragging, setDragging] = useState(false);
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
    <div className="page-enter mx-auto max-w-5xl space-y-6 pt-2">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          <span className="text-gradient">Scan a bank statement</span>
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">
          Upload a statement CSV and Bill Pilot finds the charges that repeat on a schedule, including subscriptions you forgot to track.
          The file is analysed in memory and never stored.
        </p>
      </header>

      {!canScan && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/[0.06] p-4 text-sm text-amber-200">
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

      <section className="spotlight surface space-y-5 p-6">
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
          onDragEnter={() => setDragging(true)}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            pickFile(e.dataTransfer.files?.[0] ?? null);
          }}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "group relative flex w-full cursor-pointer flex-col items-center gap-3 overflow-hidden rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-all duration-300 focus-visible:outline-none",
            dragging
              ? "scale-[1.012] border-brand-400 bg-brand-500/12 shadow-[0_0_60px_-12px_rgb(124_92_255/0.7)]"
              : file
                ? "border-emerald-300/40 bg-emerald-400/[0.04]"
                : "border-white/[0.14] hover:border-brand-400/60 hover:bg-brand-500/[0.05] focus-visible:border-brand-400"
          )}
        >
          {scanning && <span className="scan-beam" aria-hidden="true" />}
          <span
            className={cn(
              "flex size-14 items-center justify-center rounded-2xl transition-all duration-500",
              file ? "bg-emerald-400/15 text-emerald-300" : "bg-brand-500/15 text-brand-300 group-hover:-translate-y-1 group-hover:scale-110",
              dragging && "-translate-y-2 scale-110"
            )}
          >
            {file ? <CheckIcon className="size-7" /> : <UploadIcon className="size-7" />}
          </span>
          <span className="block text-sm font-semibold text-zinc-100">{file ? file.name : "Drop a .csv statement here or click to choose"}</span>
          <span className="block text-xs text-zinc-500">Needs date, description and amount (or debit) columns. Max 2 MB.</span>
        </button>

        <p className="text-xs text-zinc-500">
          <a href="/sample-statement.csv" download className="underline underline-offset-4 transition-colors hover:text-brand-300">
            Download a sample statement
          </a>
          {" · "}
          <a href="/sample-statement-shared.csv" download className="underline underline-offset-4 transition-colors hover:text-brand-300">
            Download a sample with shared descriptors
          </a>
        </p>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-2.5">
            <label htmlFor="scan-currency" className="text-xs font-semibold text-zinc-300">
              Statement currency
            </label>
            <select id="scan-currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className="field w-auto cursor-pointer py-1.5 text-xs">
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <button type="button" onClick={scan} disabled={!file || scanning || !canScan} className="btn-primary">
            <SparklesIcon className={cn("size-4", scanning && "animate-spin")} />
            {scanning ? "Scanning…" : "Scan for subscriptions"}
          </button>
        </div>

        {error && (
          <p role="alert" className="animate-fade-up rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-300">
            {error}
          </p>
        )}
      </section>

      {result && (
        <section className="space-y-5">
          <div className="spotlight surface animate-fade-up relative overflow-hidden p-6">
            <div className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-brand-500/20 blur-3xl" />
            <p className="relative text-xl font-extrabold tracking-tight text-zinc-50">
              {result.detected.length === 0
                ? "No recurring charges found"
                : `Found ${result.detected.length} recurring ${result.detected.length === 1 ? "charge" : "charges"} · ${formatMoney(result.detectedMonthlyTotal, currency)}/month`}
            </p>
            <p className="relative mt-1.5 text-sm text-zinc-400">
              {result.untrackedCount > 0
                ? `${result.untrackedCount} ${result.untrackedCount === 1 ? "isn't" : "aren't"} in your tracker yet (${formatMoney(result.untrackedMonthlyTotal, currency)}/month, ${formatMoney(result.untrackedMonthlyTotal * 12, currency)}/year).`
                : result.detected.length > 0
                  ? "Everything detected is already in your tracker."
                  : "Scanned " + result.transactionsScanned + " transactions. Recurring charges need at least two matching payments on a regular schedule."}
            </p>
            <p className="relative mt-1 text-xs text-zinc-500">{result.transactionsScanned} transactions scanned</p>
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
            {ordinary.map((d, i) => (
              <li
                key={d.streamId}
                style={{ "--i": i } as React.CSSProperties}
                className="spotlight surface lift reveal flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-bold text-zinc-50">{d.name}</span>
                    <span className={cn(CHIP, "bg-white/[0.06] text-zinc-300 ring-white/10")}>{d.frequency}</span>
                    <span className={cn(CHIP, "bg-white/[0.06] text-zinc-300 ring-white/10")}>{d.confidence}% confidence</span>
                    {d.alreadyTracked && <span className={cn(CHIP, "bg-emerald-400/10 text-emerald-300 ring-emerald-300/25")}>already tracked</span>}
                    {d.previousAmount != null && (
                      <span className={cn(CHIP, "bg-amber-400/10 text-amber-300 ring-amber-300/25")}>price changed from {formatMoney(d.previousAmount, currency)}</span>
                    )}
                    <StatusBadge status={d.status} />
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
                    {formatMoney(d.amount, currency)} · {d.nextExpected ? `next expected ${d.nextExpected}` : "no longer charged"} · {d.evidence}
                  </p>
                </div>

                {!d.alreadyTracked && d.status !== "stopped" && (
                  <button
                    type="button"
                    aria-label={`Add ${d.name} to tracker`}
                    onClick={() => addToTracker(d)}
                    disabled={added.has(d.streamId) || adding !== null}
                    className="btn-primary shrink-0"
                  >
                    {added.has(d.streamId) ? "Added" : adding === d.streamId ? "Adding…" : "Add to tracker"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
