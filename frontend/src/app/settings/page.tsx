"use client";

import React, { useState, useRef } from "react";
import { Navbar } from "@/components/Navbar";
import { SubscriptionModal } from "@/components/SubscriptionModal";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePingBackend = async () => {
    setTestingHealth(true);
    const ok = await api.checkHealth();
    setTestingHealth(false);
    if (ok) {
      addToast("Backend Port 5500 is online and responding", "success");
    } else {
      addToast("Backend Port 5500 is offline. Start via 'mvn spring-boot:run'", "error");
    }
    refreshAll();
  };

  const handleExportJson = () => {
    try {
      const exportPayload = {
        app: "Bill Pilot",
        version: "2.0.0",
        exportedAt: new Date().toISOString(),
        count: subscriptions.length,
        subscriptions
      };
      const jsonContent = JSON.stringify(exportPayload, null, 2);
      const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.setAttribute("download", `bill_pilot_subscriptions_${new Date().toISOString().split("T")[0]}.json`);
      document.body.appendChild(anchor);
      anchor.click();
      setTimeout(() => {
        if (document.body.contains(anchor)) {
          document.body.removeChild(anchor);
        }
        URL.revokeObjectURL(url);
      }, 3000);
      addToast(`Exported ${subscriptions.length} subscriptions as JSON`, "success");
    } catch (err: any) {
      addToast("Failed to export JSON: " + err.message, "error");
    }
  };

  const handleExportCsv = () => {
    try {
      const headers = ["ID", "Name", "Price", "Currency", "Frequency", "Category", "Payment Method", "Status", "Start Date", "Renewal Date"];
      const rows = subscriptions.map((s) => [
        s.id,
        `"${(s.name || "").replace(/"/g, '""')}"`,
        s.price,
        s.currency || "USD",
        s.frequency,
        s.category,
        `"${(s.paymentMethod || "").replace(/"/g, '""')}"`,
        s.status,
        s.startDate,
        s.renewalDate || ""
      ]);
      const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.setAttribute("download", `bill_pilot_subscriptions_${new Date().toISOString().split("T")[0]}.csv`);
      document.body.appendChild(anchor);
      anchor.click();
      setTimeout(() => {
        if (document.body.contains(anchor)) {
          document.body.removeChild(anchor);
        }
        URL.revokeObjectURL(url);
      }, 3000);
      addToast(`Exported ${subscriptions.length} subscriptions as CSV`, "success");
    } catch (err: any) {
      addToast("Failed to export CSV: " + err.message, "error");
    }
  };

  const handleCopyJson = async () => {
    try {
      const jsonContent = JSON.stringify(
        {
          app: "Bill Pilot",
          version: "2.0.0",
          exportedAt: new Date().toISOString(),
          subscriptions
        },
        null,
        2
      );
      await navigator.clipboard.writeText(jsonContent);
      addToast("Subscriptions JSON copied to clipboard", "success");
    } catch (err: any) {
      addToast("Failed to copy JSON: " + err.message, "error");
    }
  };

  const handleTriggerImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        const list = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed.subscriptions)
          ? parsed.subscriptions
          : Array.isArray(parsed.data)
          ? parsed.data
          : null;
        if (list && list.length > 0) {
          importSubs(list);
        } else if (list && list.length === 0) {
          addToast("JSON file contains an empty subscriptions list", "error");
        } else {
          addToast("Invalid JSON file: subscriptions array not found", "error");
        }
      } catch (err: any) {
        addToast("Error parsing JSON: " + err.message, "error");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

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
            Monitor API connectivity with the Java 25 Spring Boot backend and manage data exports.
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
                http://localhost:5500/api/v1
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`text-xs px-2.5 py-1 rounded-md font-medium border flex items-center gap-1.5 ${
                  isBackendConnected
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-zinc-800 text-zinc-400 border-zinc-700"
                }`}
              >
                <span
                  className={`size-1.5 rounded-full ${
                    isBackendConnected ? "bg-emerald-400" : "bg-zinc-500"
                  }`}
                />
                {isBackendConnected ? "Online" : "Standalone"}
              </span>

              <button
                onClick={handlePingBackend}
                disabled={testingHealth}
                className="px-3 py-1 rounded-md text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 transition-colors cursor-pointer"
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
              <span className="font-mono text-zinc-300">GET /api/v1/subscriptions</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Rate Limiter:</span>
              <span className="font-mono text-zinc-300">Bucket4j (100 cap / 20 refill)</span>
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
              <span className="text-zinc-200 font-medium">{user ? user.name : "Guest Session"}</span>
              <span className="text-zinc-500 block text-[11px] mt-0.5">{user?.email || "Local demo"}</span>
            </div>

            <div className="p-3 rounded-lg bg-zinc-950/80 border border-zinc-800/60">
              <span className="text-zinc-500 block text-[11px] mb-1">JWT Bearer Token</span>
              <span className="text-zinc-300 font-mono text-[11px] truncate block">
                {token ? `${token.substring(0, 24)}...` : "None"}
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
              Export subscriptions as clean JSON, import backups, or restore demo test data.
            </p>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json,application/json"
            className="hidden"
          />

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              onClick={handleExportJson}
              className="px-3.5 py-1.5 rounded-md text-xs font-medium bg-zinc-100 hover:bg-white text-zinc-950 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Export JSON ({subscriptions.length})</span>
            </button>

            <button
              onClick={handleExportCsv}
              className="px-3.5 py-1.5 rounded-md text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Export CSV</span>
            </button>

            <button
              onClick={handleCopyJson}
              className="px-3.5 py-1.5 rounded-md text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>Copy JSON</span>
            </button>

            <button
              onClick={handleTriggerImport}
              className="px-3.5 py-1.5 rounded-md text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <span>Import JSON</span>
            </button>

            <button
              onClick={resetToDemo}
              className="px-3.5 py-1.5 rounded-md text-xs font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-950 border border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer"
            >
              Load Demo Presets
            </button>

            <button
              onClick={clearAllSubs}
              className="px-3.5 py-1.5 rounded-md text-xs font-medium text-rose-400 hover:text-rose-300 bg-rose-950/20 border border-rose-900/40 hover:border-rose-800 transition-colors cursor-pointer"
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
    </div>
  );
}
