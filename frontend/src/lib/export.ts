import type { Subscription } from "@/types";
import { todayLocal } from "@/lib/dates";

const CSV_HEADERS = [
  "ID",
  "Name",
  "Price",
  "Currency",
  "Frequency",
  "Category",
  "Payment Method",
  "Status",
  "Start Date",
  "Renewal Date"
];

/**
 * Escapes one CSV field (RFC 4180) and neutralises spreadsheet formula injection: a value that
 * starts with = + - @ tab or CR would otherwise be executed as a formula by Excel/Sheets.
 */
export function csvEscape(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }
  return `"${text.replace(/"/g, '""')}"`;
}

export function subscriptionsToCsv(subscriptions: Subscription[]): string {
  const rows = subscriptions.map((s) =>
    [
      s.id,
      s.name,
      s.price,
      s.currency || "USD",
      s.frequency,
      s.category,
      s.paymentMethod,
      s.status,
      s.startDate,
      s.renewalDate || ""
    ]
      .map(csvEscape)
      .join(",")
  );
  return [CSV_HEADERS.map(csvEscape).join(","), ...rows].join("\r\n");
}

export function subscriptionsToJson(subscriptions: Subscription[]): string {
  return JSON.stringify(
    {
      app: "Bill Pilot",
      version: "2.0.0",
      exportedAt: new Date().toISOString(),
      count: subscriptions.length,
      subscriptions
    },
    null,
    2
  );
}

/** Triggers a browser download of `content` as `filename`. */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  // A UTF-8 BOM makes Excel read non-ASCII service names correctly.
  const prefix = mimeType.startsWith("text/csv") ? "﻿" : "";
  const blob = new Blob([prefix + content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.setAttribute("download", filename);
  document.body.appendChild(anchor);
  anchor.click();
  setTimeout(() => {
    if (document.body.contains(anchor)) {
      document.body.removeChild(anchor);
    }
    URL.revokeObjectURL(url);
  }, 3000);
}

export function exportFilename(extension: "json" | "csv"): string {
  return `bill_pilot_subscriptions_${todayLocal()}.${extension}`;
}
