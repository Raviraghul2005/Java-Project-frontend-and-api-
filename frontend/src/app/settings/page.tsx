"use client";

import React, { useState, useRef } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DownloadIcon, FileIcon, PlusIcon, SparklesIcon, TrashIcon } from "@/components/ui/icons";
import { useApp } from "@/context/AppContext";
import { initialsOf } from "@/lib/people";
import { cn } from "@/lib/cn";
import { api } from "@/lib/api";
import { downloadFile, exportFilename, subscriptionsToCsv, subscriptionsToJson } from "@/lib/export";

const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5500").replace(/\/+$/, "");
const MAX_IMPORT_FILE_BYTES = 1_000_000;

export default function SettingsPage() {
  const {
    user,
    token,
    subscriptions,
    isBackendConnected,
    importSubs,
    resetToDemo,
    clearAllSubs,
    refreshAll,
    addToast
  } = useApp();

  const [testingHealth, setTestingHealth] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<"clear" | "demo" | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePingBackend = async () => {
    setTestingHealth(true);
    const ok = await api.checkHealth();
    setTestingHealth(false);
    if (ok) {
      addToast("Backend is online and responding", "success");
    } else {
      addToast(`Backend at ${API_ORIGIN} is offline. Start it with 'mvn spring-boot:run'`, "error");
    }
    refreshAll();
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

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(subscriptionsToJson(subscriptions));
      addToast("Subscriptions JSON copied to clipboard", "success");
    } catch (err) {
      addToast("Failed to copy JSON: " + (err instanceof Error ? err.message : "clipboard unavailable"), "error");
    }
  };

  const handleTriggerImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;

    if (file.size > MAX_IMPORT_FILE_BYTES) {
      addToast("Import file is too large (limit 1 MB)", "error");
      input.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(event.target?.result as string);
      } catch (err) {
        addToast("Error parsing JSON: " + (err instanceof Error ? err.message : "invalid file"), "error");
        return;
      }
      setBusy(true);
      await importSubs(parsed);
      setBusy(false);
    };
    reader.onerror = () => addToast("Could not read the selected file", "error");
    reader.readAsText(file);
    input.value = "";
  };

  const runConfirmed = async () => {
    const action = confirming;
    setConfirming(null);
    setBusy(true);
    if (action === "clear") await clearAllSubs();
    if (action === "demo") await resetToDemo();
    setBusy(false);
  };

  const endpoints = [
    ["Health Endpoint", "GET /api"],
    ["Fatigue Audit Endpoint", "GET /api/v1/analytics/audit"],
    ["Subscriptions Endpoint", "GET /api/v1/subscriptions/user/:id"],
    ["Rate Limiting", "Per-IP token bucket (stricter on sign-in)"]
  ];

  return (
    <div className="page-enter mx-auto max-w-4xl space-y-6 pt-2">
      {/* Header */}
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          <span className="text-gradient">System & API Settings</span>
        </h1>
        <p className="mt-2 text-sm text-zinc-400">Monitor API connectivity with the Spring Boot backend and manage data exports.</p>
      </header>

      {/* Backend API status card */}
      <section className="spotlight surface space-y-5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-zinc-50">Spring Boot REST Service</h2>
            <p className="mt-0.5 font-mono text-xs text-zinc-500">{API_ORIGIN}/api/v1</p>
          </div>

          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset",
                isBackendConnected ? "bg-emerald-400/10 text-emerald-300 ring-emerald-300/25" : "bg-rose-500/10 text-rose-300 ring-rose-400/25"
              )}
            >
              <span className="relative flex size-2">
                <span className={cn("absolute inline-flex size-full rounded-full opacity-60", isBackendConnected ? "animate-ping-slow bg-emerald-400" : "bg-rose-400")} />
                <span className={cn("relative inline-flex size-2 rounded-full", isBackendConnected ? "bg-emerald-400" : "bg-rose-400")} />
              </span>
              {isBackendConnected ? "Online" : "Offline"}
            </span>

            <button type="button" onClick={handlePingBackend} disabled={testingHealth} className="btn-ghost disabled:opacity-50">
              {testingHealth ? "Pinging..." : "Check Status"}
            </button>
          </div>
        </div>

        <dl className="space-y-2.5 rounded-xl border border-white/[0.07] bg-black/30 p-4 text-xs">
          {endpoints.map(([label, value]) => (
            <div key={label} className="flex flex-col justify-between gap-0.5 sm:flex-row sm:gap-4">
              <dt className="text-zinc-500">{label}:</dt>
              <dd className="font-mono text-zinc-200">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Security context */}
      <section className="spotlight surface space-y-4 p-6">
        <h2 className="text-base font-bold text-zinc-50">Security & Authentication Context</h2>

        <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
          <div className="flex items-center gap-3.5 rounded-xl border border-white/[0.07] bg-black/30 p-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-blush-400 text-sm font-extrabold text-white">
              {user ? initialsOf(user.name) : "?"}
            </span>
            <div className="min-w-0">
              <span className="mb-0.5 block text-[11px] text-zinc-500">Active User</span>
              <span className="block truncate text-sm font-semibold text-zinc-100">{user ? user.name : "Not signed in"}</span>
              <span className="block truncate text-[11px] text-zinc-500">{user?.email || "—"}</span>
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.07] bg-black/30 p-4">
            <span className="mb-1 block text-[11px] text-zinc-500">JWT Bearer Token</span>
            <span className="block truncate font-mono text-xs text-zinc-200">{token ? `${token.substring(0, 12)}…` : "None"}</span>
            <span className="mt-1 block text-[11px] text-zinc-500">Algorithm: HMAC-SHA256</span>
          </div>
        </div>
      </section>

      {/* Data Portability (Export, Import & Reset) */}
      <section className="spotlight surface space-y-5 p-6">
        <div>
          <h2 className="text-base font-bold text-zinc-50">Data Portability & Backup</h2>
          <p className="mt-0.5 text-xs text-zinc-400">
            Export subscriptions as clean JSON, import backups (saved to your account), or add sample data.
          </p>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".json,application/json"
          aria-label="Import subscriptions from a JSON file"
          className="hidden"
        />

        <div className="flex flex-wrap items-center gap-2.5">
          <button type="button" onClick={handleExportJson} className="btn-primary">
            <DownloadIcon className="size-4" />
            <span>Export JSON ({subscriptions.length})</span>
          </button>

          <button type="button" onClick={handleExportCsv} className="btn-ghost">
            <FileIcon className="size-3.5" />
            <span>Export CSV</span>
          </button>

          <button type="button" onClick={handleCopyJson} className="btn-ghost">
            <svg aria-hidden="true" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <rect x="9" y="9" width="12" height="12" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            <span>Copy JSON</span>
          </button>

          <button type="button" onClick={handleTriggerImport} disabled={busy} className="btn-ghost disabled:cursor-not-allowed disabled:opacity-50">
            <PlusIcon className="size-3.5" />
            <span>{busy ? "Working…" : "Import JSON"}</span>
          </button>

          <button type="button" onClick={() => setConfirming("demo")} disabled={busy} className="btn-ghost disabled:cursor-not-allowed disabled:opacity-50">
            <SparklesIcon className="size-3.5" />
            Load Demo Presets
          </button>

          <button
            type="button"
            onClick={() => setConfirming("clear")}
            disabled={busy || subscriptions.length === 0}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-rose-400/25 bg-rose-500/10 px-3.5 py-2 text-xs font-semibold text-rose-300 transition-all duration-300 hover:border-rose-400/50 hover:bg-rose-500/20 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <TrashIcon className="size-3.5" />
            Clear All Subscriptions
          </button>
        </div>
      </section>

      <ConfirmDialog
        isOpen={confirming !== null}
        title={confirming === "clear" ? "Delete all subscriptions?" : "Add demo subscriptions?"}
        message={
          confirming === "clear"
            ? `This permanently deletes all ${subscriptions.length} subscriptions from your account. This cannot be undone.`
            : "This adds a set of sample subscriptions to your account (ones you already track are skipped)."
        }
        confirmLabel={confirming === "clear" ? "Delete everything" : "Add demo data"}
        destructive={confirming === "clear"}
        onConfirm={runConfirmed}
        onCancel={() => setConfirming(null)}
      />
    </div>
  );
}
