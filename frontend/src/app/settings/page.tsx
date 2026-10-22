"use client";

import React, { useState, useRef } from "react";
import { Navbar } from "@/components/Navbar";
import { SubscriptionModal } from "@/components/SubscriptionModal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useApp } from "@/context/AppContext";
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

  const [isModalOpen, setIsModalOpen] = useState(false);
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

  const secondaryButton =
    "px-3.5 py-1.5 rounded-md text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="flex-1 flex flex-col bg-[#09090b]">
      <Navbar onOpenNewModal={() => setIsModalOpen(true)} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-7">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
            System & API Settings
          </h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            Monitor API connectivity with the Spring Boot backend and manage data exports.
          </p>
        </div>

        {/* Backend API status card */}
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-200">
                Spring Boot REST Service
              </h2>
              <p className="text-xs text-zinc-500 font-mono mt-0.5">
                {API_ORIGIN}/api/v1
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`text-xs px-2.5 py-1 rounded-md font-medium border flex items-center gap-1.5 ${
                  isBackendConnected
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                }`}
              >
                <span
                  className={`size-1.5 rounded-full ${
                    isBackendConnected ? "bg-emerald-400" : "bg-rose-400"
                  }`}
                />
                {isBackendConnected ? "Online" : "Offline"}
              </span>

              <button
                type="button"
                onClick={handlePingBackend}
                disabled={testingHealth}
                className="px-3 py-1 rounded-md text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                {testingHealth ? "Pinging..." : "Check Status"}
              </button>
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-zinc-950/80 border border-zinc-800/60 space-y-1.5 text-xs text-zinc-400">
            <div className="flex justify-between">
              <span className="text-zinc-500">Health Endpoint:</span>
              <span className="font-mono text-zinc-300">GET /api</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Fatigue Audit Endpoint:</span>
              <span className="font-mono text-zinc-300">GET /api/v1/analytics/audit</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Subscriptions Endpoint:</span>
              <span className="font-mono text-zinc-300">GET /api/v1/subscriptions/user/:id</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Rate Limiting:</span>
              <span className="font-mono text-zinc-300">Per-IP token bucket (stricter on sign-in)</span>
            </div>
          </div>
        </div>

        {/* Security context */}
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-5 space-y-3.5">
          <h2 className="text-sm font-semibold text-zinc-200">
            Security & Authentication Context
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-zinc-950/80 border border-zinc-800/60">
              <span className="text-zinc-500 block text-[11px] mb-1">Active User</span>
              <span className="text-zinc-200 font-medium">{user ? user.name : "Not signed in"}</span>
              <span className="text-zinc-500 block text-[11px] mt-0.5">{user?.email || "—"}</span>
            </div>

            <div className="p-3 rounded-lg bg-zinc-950/80 border border-zinc-800/60">
              <span className="text-zinc-500 block text-[11px] mb-1">JWT Bearer Token</span>
              <span className="text-zinc-300 font-mono text-[11px] truncate block">
                {token ? `${token.substring(0, 12)}…` : "None"}
              </span>
              <span className="text-zinc-500 block text-[11px] mt-0.5">Algorithm: HMAC-SHA256</span>
            </div>
          </div>
        </div>

        {/* Data Portability (Export, Import & Reset) */}
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-200">
              Data Portability & Backup
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
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

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={handleExportJson}
              className="px-3.5 py-1.5 rounded-md text-xs font-medium bg-zinc-100 hover:bg-white text-zinc-950 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <svg aria-hidden="true" className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Export JSON ({subscriptions.length})</span>
            </button>

            <button type="button" onClick={handleExportCsv} className={secondaryButton}>
              <svg aria-hidden="true" className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Export CSV</span>
            </button>

            <button type="button" onClick={handleCopyJson} className={secondaryButton}>
              <svg aria-hidden="true" className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>Copy JSON</span>
            </button>

            <button type="button" onClick={handleTriggerImport} disabled={busy} className={secondaryButton}>
              <svg aria-hidden="true" className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <span>{busy ? "Working…" : "Import JSON"}</span>
            </button>

            <button
              type="button"
              onClick={() => setConfirming("demo")}
              disabled={busy}
              className="px-3.5 py-1.5 rounded-md text-xs font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-950 border border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer disabled:opacity-50"
            >
              Load Demo Presets
            </button>

            <button
              type="button"
              onClick={() => setConfirming("clear")}
              disabled={busy || subscriptions.length === 0}
              className="px-3.5 py-1.5 rounded-md text-xs font-medium text-rose-400 hover:text-rose-300 bg-rose-950/20 border border-rose-900/40 hover:border-rose-800 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Clear All Subscriptions
            </button>
          </div>
        </div>
      </main>

      <SubscriptionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

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
