import type { CreateSubscriptionInput } from "@/types";
import { addPeriods, formatLocalDate } from "@/lib/dates";

/**
 * Sample subscriptions for "Load Demo Presets". Start dates are computed relative to today (instead of
 * hard-coded calendar dates) so the server derives upcoming renewals and nothing is ever created expired.
 */
export function buildDemoSubscriptions(now: Date = new Date()): CreateSubscriptionInput[] {
  const monthsAgo = (months: number, day: number) =>
    formatLocalDate(addPeriods(new Date(now.getFullYear(), now.getMonth(), 1), "monthly", -months, day));

  return [
    { name: "Netflix Premium", price: 22.99, frequency: "monthly", category: "entertainment", paymentMethod: "Credit Card (Visa 4242)", startDate: monthsAgo(9, 15) },
    { name: "Claude Pro", price: 20, frequency: "monthly", category: "technology", paymentMethod: "Apple Pay", startDate: monthsAgo(7, 3) },
    { name: "ChatGPT Plus", price: 20, frequency: "monthly", category: "technology", paymentMethod: "Credit Card", startDate: monthsAgo(8, 3) },
    { name: "Spotify Premium", price: 11.99, frequency: "monthly", category: "entertainment", paymentMethod: "PayPal", startDate: monthsAgo(11, 20) },
    { name: "GitHub Copilot", price: 10, frequency: "monthly", category: "technology", paymentMethod: "Credit Card", startDate: monthsAgo(10, 1) },
    { name: "Disney+", price: 13.99, frequency: "monthly", category: "entertainment", paymentMethod: "Google Pay", startDate: monthsAgo(6, 15) },
    { name: "Medium Member", price: 5, frequency: "monthly", category: "news", paymentMethod: "Apple Pay", startDate: monthsAgo(4, 25) }
  ].map((sub) => ({ ...sub, currency: "USD" }) as CreateSubscriptionInput);
}
