import type { Category, CreateSubscriptionInput, Frequency } from "@/types";
import { parseLocalDate } from "@/lib/dates";

const FREQUENCIES: Frequency[] = ["daily", "weekly", "monthly", "yearly"];
const CATEGORIES: Category[] = [
  "sports",
  "news",
  "entertainment",
  "lifestyle",
  "technology",
  "finance",
  "politics",
  "other"
];

export const MAX_IMPORT_RECORDS = 200;
const MAX_PRICE = 1_000_000;

export interface ImportResult {
  valid: CreateSubscriptionInput[];
  rejected: { index: number; reason: string }[];
}

function validateRecord(raw: unknown): { ok: true; value: CreateSubscriptionInput } | { ok: false; reason: string } {
  if (typeof raw !== "object" || raw === null) return { ok: false, reason: "not an object" };
  const r = raw as Record<string, unknown>;

  const name = typeof r.name === "string" ? r.name.trim() : "";
  if (name.length < 2 || name.length > 100) return { ok: false, reason: "name must be 2-100 characters" };

  const price = r.price;
  if (typeof price !== "number" || !Number.isFinite(price) || price < 0 || price > MAX_PRICE) {
    return { ok: false, reason: "price must be a number between 0 and 1,000,000" };
  }

  if (typeof r.frequency !== "string" || !FREQUENCIES.includes(r.frequency.toLowerCase() as Frequency)) {
    return { ok: false, reason: "frequency must be daily, weekly, monthly or yearly" };
  }
  const category = typeof r.category === "string" ? r.category.toLowerCase() : "other";
  if (!CATEGORIES.includes(category as Category)) return { ok: false, reason: "unknown category" };

  const paymentMethod = typeof r.paymentMethod === "string" ? r.paymentMethod.trim() : "";
  if (paymentMethod.length < 1 || paymentMethod.length > 100) {
    return { ok: false, reason: "paymentMethod must be 1-100 characters" };
  }

  if (typeof r.startDate !== "string" || !parseLocalDate(r.startDate)) {
    return { ok: false, reason: "startDate must be a valid YYYY-MM-DD date" };
  }

  const currency = typeof r.currency === "string" ? r.currency.trim().toUpperCase() : "USD";
  if (!/^[A-Z]{3}$/.test(currency)) return { ok: false, reason: "currency must be a 3-letter code" };

  const renewalDate = typeof r.renewalDate === "string" && parseLocalDate(r.renewalDate) ? r.renewalDate : undefined;

  return {
    ok: true,
    value: {
      name,
      price,
      currency,
      frequency: r.frequency.toLowerCase() as Frequency,
      category: category as Category,
      paymentMethod,
      startDate: r.startDate,
      renewalDate
    }
  };
}

/**
 * Validates parsed import data. Accepts either a bare array of subscriptions or the object that the
 * JSON export produces ({ subscriptions: [...] }). Only the writable fields are kept, so ids, owners
 * and status from the file can never overwrite server-controlled data.
 */
export function validateImport(parsed: unknown): ImportResult | { error: string } {
  const list = Array.isArray(parsed)
    ? parsed
    : typeof parsed === "object" && parsed !== null && Array.isArray((parsed as { subscriptions?: unknown }).subscriptions)
      ? (parsed as { subscriptions: unknown[] }).subscriptions
      : null;

  if (!list) return { error: "Expected an array of subscriptions or an exported Bill Pilot file" };
  if (list.length === 0) return { error: "The file contains no subscriptions" };
  if (list.length > MAX_IMPORT_RECORDS) {
    return { error: `Too many records (${list.length}); the limit is ${MAX_IMPORT_RECORDS} per import` };
  }

  const valid: CreateSubscriptionInput[] = [];
  const rejected: { index: number; reason: string }[] = [];
  list.forEach((item, index) => {
    const result = validateRecord(item);
    if (result.ok) valid.push(result.value);
    else rejected.push({ index, reason: result.reason });
  });
  return { valid, rejected };
}
