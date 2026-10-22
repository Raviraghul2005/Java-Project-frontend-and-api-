// Browser end-to-end suite for Bill Pilot (Playwright).
//
// SAFETY: this registers throw-away users and creates data. Point it at an ISOLATED backend/database only:
//   DB_NAME=billpilot_e2e PORT=5501 CORS_ALLOWED_ORIGINS=http://localhost:3001 java -jar target/bill-pilot-1.0.0.jar
//   NEXT_PUBLIC_API_URL=http://localhost:5501 npx next dev -p 3001
//   npm run e2e
// Every user the suite creates deletes itself (and its subscriptions) at the end.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP = process.env.APP_URL || "http://localhost:3001";
const API = process.env.API_URL || "http://localhost:5501";
const SHOTS = process.env.SHOTS_DIR || "";
const here = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_CSV = path.join(here, "..", "public", "sample-statement.csv");

const stamp = Date.now();
const EMAIL = `e2e-${stamp}@example.com`;
const PASSWORD = "e2e-password-123";

let failures = 0;
const cleanupTokens = [];

function check(name, cond, extra = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "   -> " + extra}`);
  if (!cond) failures++;
}

const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthsAgo = (n, day) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - n);
  d.setDate(day);
  return iso(d);
};

async function launch() {
  for (const opts of [{}, { channel: "msedge" }, { channel: "chrome" }]) {
    try {
      return await chromium.launch({ headless: true, ...opts });
    } catch {
      /* try next */
    }
  }
  throw new Error("No usable browser (install Chromium with `npx playwright install chromium`, or Edge/Chrome)");
}

async function shot(page, name) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
}

const toast = (page, text) => page.locator('[role="status"], [role="alert"]').filter({ hasText: text }).first();
const cards = (page) => page.locator('[data-testid="subscription-card"]');

async function addSubscription(page, { name, price, start, renewal, frequency }) {
  await page.getByRole("button", { name: "New", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  await dialog.getByLabel("Service Name").fill(name);
  await dialog.getByLabel("Price").fill(String(price));
  if (frequency) await dialog.getByLabel("Billing Frequency").selectOption(frequency);
  if (start) await dialog.getByLabel("Start Date").fill(start);
  if (renewal) await dialog.getByLabel("Next Renewal Date").fill(renewal);
  await dialog.getByRole("button", { name: "Create", exact: true }).click();
  await dialog.waitFor({ state: "detached" });
}

async function loginViaUi(page) {
  await page.goto(APP + "/auth");
  await page.getByLabel("Email address").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).last().click();
  await page.waitForURL(APP + "/");
}

const browser = await launch();

try {
  // ------------------------------------------------------------------ auth flows
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const consoleErrors = [];
  const badResponses = [];
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  page.on("response", (r) => {
    if (r.status() >= 400 && r.url().includes("/api/")) badResponses.push(`${r.status()} ${r.url().replace(API, "")}`);
  });

  await page.goto(APP + "/");
  await page.waitForURL("**/auth");
  check("unauthenticated visit is redirected to /auth", page.url().endsWith("/auth"));
  check("email field is NOT pre-filled with demo credentials", (await page.getByLabel("Email address").inputValue()) === "");
  check("password field is NOT pre-filled", (await page.getByLabel("Password").inputValue()) === "");
  check("no 'fill demo credentials' shortcut is offered", (await page.getByText(/demo credentials/i).count()) === 0);
  check("API shows as connected", await page.getByText("Connected", { exact: true }).isVisible());

  // wrong credentials must NOT create a session (old behaviour: fake demo session / auto-signup)
  await page.getByLabel("Email address").fill("demo@billpilot.com");
  await page.getByLabel("Password").fill("anything-at-all");
  await page.getByRole("button", { name: "Sign in", exact: true }).last().click();
  await toast(page, "Invalid email or password").waitFor();
  check("bad login shows a generic error", true);
  check("bad login stays on /auth with no session", page.url().endsWith("/auth") && (await page.evaluate(() => localStorage.getItem("bp_token"))) === null);

  // register
  await page.getByRole("button", { name: "Create account", exact: true }).first().click();
  await page.getByLabel("Full name").fill("E2E Tester");
  await page.getByLabel("Email address").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account", exact: true }).last().click();
  await page.waitForURL(APP + "/");
  check("registration lands on the dashboard", true);
  check("empty dashboard shows the clean-slate state", await page.getByText("No subscriptions tracked yet").isVisible());
  const session = await page.evaluate(() => ({ token: localStorage.getItem("bp_token"), user: JSON.parse(localStorage.getItem("bp_user") || "null") }));
  cleanupTokens.push({ token: session.token, id: session.user?.id });

  // ------------------------------------------------------------------ the 'created as expired' bug
  await addSubscription(page, { name: "Old Monthly Plan", price: 12.5, start: monthsAgo(4, 3) });
  await cards(page).first().waitFor();
  const firstCard = cards(page).first();
  check("subscription started months ago is created ACTIVE (was: expired)", await firstCard.getByText("active", { exact: true }).isVisible());
  const renewalText = await firstCard.getByText(/^Renewal/).locator("..").innerText();
  check("...with an upcoming renewal, not 'Overdue'/'Expired'", !/overdue|expired/i.test(renewalText) && /\d+ days|Today|Tomorrow/.test(renewalText), renewalText);
  check("run-rate metric counts it ($12.50)", await page.getByText("$12.50", { exact: false }).first().isVisible());
  await shot(page, "dashboard-with-sub");

  // ------------------------------------------------------------------ modal accessibility
  await firstCard.getByRole("button", { name: "Edit" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  check("edit dialog has an accessible name", (await dialog.getAttribute("aria-labelledby")) !== null && (await dialog.getAttribute("aria-modal")) === "true");
  check("focus moves into the dialog", await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')));
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "detached" });
  check("Escape closes the dialog", true);
  check("focus returns to the Edit button", await page.evaluate(() => document.activeElement?.textContent?.trim() === "Edit"));

  // text selection drag that ends on the backdrop must not discard the form
  await firstCard.getByRole("button", { name: "Edit" }).click();
  await dialog.waitFor();
  const nameInput = dialog.getByLabel("Service Name");
  const box = await nameInput.boundingBox();
  await page.mouse.move(box.x + 20, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(5, 5); // release over the backdrop
  await page.mouse.up();
  check("drag-select ending on the backdrop keeps the dialog open", await dialog.isVisible());
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "detached" });

  // ------------------------------------------------------------------ destructive actions need confirmation
  await firstCard.getByRole("button", { name: "Cancel", exact: true }).click();
  const confirm = page.getByRole("alertdialog");
  await confirm.waitFor();
  await confirm.getByRole("button", { name: "Keep" }).click();
  check("'Keep' leaves the subscription active", await firstCard.getByText("active", { exact: true }).isVisible());
  await firstCard.getByRole("button", { name: "Cancel", exact: true }).click();
  await confirm.waitFor();
  await confirm.getByRole("button", { name: "Cancel subscription" }).click();
  await firstCard.getByText("cancelled", { exact: true }).waitFor();
  check("confirming marks it cancelled", true);
  await firstCard.getByRole("button", { name: "Reactivate" }).click();
  await firstCard.getByText("active", { exact: true }).waitFor();
  check("reactivate works", true);

  // ------------------------------------------------------------------ timezone-sensitive 'due today'
  await addSubscription(page, { name: "Due Today Plan", price: 5, start: monthsAgo(2, 1), renewal: iso(new Date()) });
  const todayCard = cards(page).filter({ hasText: "Due Today Plan" });
  await todayCard.waitFor();
  check("a renewal dated today shows 'Today'", await todayCard.getByText("Today", { exact: true }).isVisible());

  // ------------------------------------------------------------------ catalog: double-click must not double-add
  await page.getByRole("link", { name: "Catalog" }).first().click();
  await page.waitForURL("**/catalog");
  const addButtons = page.getByRole("button", { name: /Add to board/ });
  await addButtons.first().dblclick();
  await toast(page, "Added").waitFor();
  await page.waitForTimeout(800);
  await page.goto(APP + "/");
  await cards(page).first().waitFor();
  const claudeCount = await cards(page).filter({ hasText: "Claude Pro" }).count();
  check("double-clicking 'Add to board' creates exactly one subscription", claudeCount === 1, `got ${claudeCount}`);

  // ------------------------------------------------------------------ delete needs confirmation
  const before = await cards(page).count();
  await cards(page).filter({ hasText: "Claude Pro" }).getByRole("button", { name: /^Delete/ }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Keep" }).click();
  check("declining a delete keeps the card", (await cards(page).count()) === before);
  await cards(page).filter({ hasText: "Claude Pro" }).getByRole("button", { name: /^Delete/ }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete", exact: true }).click();
  await page.waitForFunction((n) => document.querySelectorAll('[data-testid="subscription-card"]').length === n, before - 1);
  check("confirming a delete removes the card", true);

  // ------------------------------------------------------------------ analytics page
  await page.goto(APP + "/analytics");
  await page.getByText("Subscription Fatigue & Redundancy Audit").waitFor();
  check("analytics page renders the renewal collision timeline section", await page.getByRole("heading", { name: "Renewal Collision Timeline" }).isVisible());
  check("formula text documents the collision cap and score floor", await page.getByText(/min\(18, 6\.0 × C_collisions\)/).isVisible());
  await shot(page, "analytics");

  // ------------------------------------------------------------------ simulator
  await page.goto(APP + "/simulator");
  await page.getByText("Arbitrage Simulator").waitFor();
  const pauseButton = page.getByRole("button", { name: /^Pause Old Monthly Plan/ });
  await pauseButton.click();
  check("simulator pause toggle updates its pressed state", (await page.getByRole("button", { name: /^Resume Old Monthly Plan/ }).getAttribute("aria-pressed")) === "true");

  // ------------------------------------------------------------------ settings: import validation + persistence
  await page.goto(APP + "/settings");
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles({ name: "bad.json", mimeType: "application/json", buffer: Buffer.from("{not json") });
  await toast(page, "Error parsing JSON").waitFor();
  check("malformed JSON import is rejected with a message", true);

  await fileInput.setInputFiles({
    name: "hostile.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify([{ name: "Crashy", price: "12", frequency: "monthly", category: "other", paymentMethod: "x", startDate: "2026-01-01" }])),
  });
  await toast(page, "No valid subscription records").waitFor();
  check("record with a string price is rejected (used to crash the whole app on every load)", true);

  const importPayload = [
    { name: "=HYPERLINK(\"http://evil.example\",\"click\")", price: 9.99, frequency: "monthly", category: "other", paymentMethod: "Card", startDate: monthsAgo(3, 5), id: "forged-id", user: "someone-else", status: "cancelled" },
    { name: "Imported Plan", price: 4.5, currency: "eur", frequency: "yearly", category: "news", paymentMethod: "PayPal", startDate: monthsAgo(5, 9) },
    { name: "x", price: 1, frequency: "monthly", category: "other", paymentMethod: "Card", startDate: "2026-01-01" },
  ];
  await fileInput.setInputFiles({ name: "ok.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(importPayload)) });
  await toast(page, "Imported 2 subscriptions (1 skipped").waitFor();
  check("valid records are imported and invalid ones skipped, with an honest summary", true);

  await page.reload();
  await page.getByText("Data Portability & Backup").waitFor();
  await page.goto(APP + "/");
  await cards(page).filter({ hasText: "Imported Plan" }).waitFor();
  check("imported data is really persisted (survives reload)", (await cards(page).filter({ hasText: "Imported Plan" }).count()) === 1);
  check("forged status/id in the file were ignored (imported as active)", await cards(page).filter({ hasText: "HYPERLINK" }).getByText("active", { exact: true }).isVisible());

  // CSV export neutralises formulas
  await page.goto(APP + "/settings");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export CSV" }).click()]);
  const csvText = fs.readFileSync(await download.path(), "utf8");
  check("CSV export prefixes formula-looking names with a quote", csvText.includes(`"'=HYPERLINK(`), csvText.slice(0, 300));
  check("CSV export quotes every field", /^﻿?"ID","Name"/.test(csvText));

  // clear-all confirmation
  await page.getByRole("button", { name: "Clear All Subscriptions" }).click();
  const clearDialog = page.getByRole("alertdialog");
  await clearDialog.waitFor();
  await clearDialog.getByRole("button", { name: "Keep" }).click();
  await page.goto(APP + "/");
  await cards(page).first().waitFor();
  check("declining 'Clear All' deletes nothing", (await cards(page).count()) > 0);

  // ------------------------------------------------------------------ statement scanner (merged feature)
  await page.goto(APP + "/scan");
  await page.getByRole("heading", { name: "Scan a bank statement" }).waitFor();
  const scanButton = page.getByRole("button", { name: "Scan for subscriptions" });
  check("scan button is disabled until a file is chosen", await scanButton.isDisabled());

  await page.locator('input[type="file"]').setInputFiles({ name: "evil.exe", mimeType: "application/octet-stream", buffer: Buffer.from("MZ") });
  check("non-CSV file is rejected client-side", await page.getByRole("alert").filter({ hasText: "Only .csv" }).isVisible());

  await page.locator('input[type="file"]').setInputFiles(SAMPLE_CSV);
  await page.getByLabel("Statement currency").selectOption("EUR");
  await scanButton.click();
  await page.getByText(/Found \d+ recurring/).waitFor();
  const summary = await page.getByText(/Found \d+ recurring/).innerText();
  check("scanner finds the subscriptions in the sample (>= 5)", Number((summary.match(/Found (\d+)/) || [])[1]) >= 5, summary);
  check("results are formatted in the chosen currency (€)", summary.includes("€"), summary);
  check("habit spending (Starbucks, groceries, Swiggy) is not reported as subscriptions", (await page.getByText(/starbucks|grocery|swiggy/i).count()) === 0);
  check("a price change is flagged (Netflix 15.49 -> 17.99)", await page.getByText(/price changed from/).first().isVisible());
  await shot(page, "scan-results");

  await page.getByRole("button", { name: "Add Netflix to tracker" }).click();
  // After adding, the page re-scans and the row flips from an "Add" button to an "already tracked" badge.
  await page.getByText("already tracked").first().waitFor();
  check("after adding, the scan result is refreshed to 'already tracked'", await page.getByRole("button", { name: "Add Netflix to tracker" }).count() === 0);
  await page.goto(APP + "/");
  const netflix = cards(page).filter({ hasText: "Netflix" });
  await netflix.waitFor();
  check("a detected subscription is added as ACTIVE even though its statement date is months old (was: instantly expired)", await netflix.getByText("active", { exact: true }).isVisible());
  check("...saved in the currency chosen on the scan page", (await netflix.innerText()).includes("EUR"));
  const nfRenewal = await netflix.getByText(/^Renewal/).locator("..").innerText();
  check("...with a future renewal date", !/overdue|expired/i.test(nfRenewal), nfRenewal);

  // ------------------------------------------------------------------ responsive nav
  await page.setViewportSize({ width: 390, height: 800 });
  check("mobile viewport has a navigation (desktop nav is hidden there)", await page.getByRole("navigation", { name: "Primary (mobile)" }).isVisible());
  await shot(page, "mobile");
  await page.setViewportSize({ width: 1280, height: 900 });

  // ------------------------------------------------------------------ sign-out wipes everything
  await page.evaluate(() => { localStorage.setItem("bp_subs_legacy", "[1]"); });
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("**/auth");
  const leftovers = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("bp_")));
  check("sign-out removes the token, user and all cached data", leftovers.length === 0, leftovers.join(","));

  // ------------------------------------------------------------------ session expiry / tampering
  await loginViaUi(page);
  const real = await page.evaluate(() => ({ token: localStorage.getItem("bp_token"), user: localStorage.getItem("bp_user") }));
  cleanupTokens.push({ token: real.token, id: JSON.parse(real.user).id });

  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const expiredToken = `${b64({ alg: "HS256" })}.${b64({ sub: "x", exp: Math.floor(Date.now() / 1000) - 3600 })}.sig`;
  await page.evaluate(({ t }) => localStorage.setItem("bp_token", t), { t: expiredToken });
  await page.goto(APP + "/");
  await page.waitForURL("**/auth");
  check("an expired token in storage is discarded and the user is sent to /auth", true);
  check("...and the stale session is purged", (await page.evaluate(() => localStorage.getItem("bp_token"))) === null);

  const forged = `${b64({ alg: "HS256" })}.${b64({ sub: "x", userId: "x", iss: "bill-pilot", exp: Math.floor(Date.now() / 1000) + 3600 })}.forgedsignature`;
  await page.evaluate(({ t, u }) => { localStorage.setItem("bp_token", t); localStorage.setItem("bp_user", u); }, { t: forged, u: real.user });
  badResponses.length = 0;
  await page.goto(APP + "/");
  const signedOut = await page.waitForURL("**/auth", { timeout: 15000 }).then(() => true, () => false);
  check("a forged (unexpired) token is rejected by the API and the user is signed out automatically", signedOut,
    `url=${page.url()} responses=[${badResponses.join(", ")}]`);
  if (!signedOut) await shot(page, "forged-token-stuck");

  // ------------------------------------------------------------------ backend down: no fake sessions, no silent empty UI
  await loginViaUi(page);
  await page.route(API + "/api**", (route) => route.abort("connectionrefused"));
  await page.reload();
  await page.getByRole("alert").filter({ hasText: "Cannot reach the Bill Pilot server" }).first().waitFor();
  check("with the API unreachable the dashboard shows an explicit error + Retry (not an empty 'no data' screen)", await page.getByRole("button", { name: "Retry" }).isVisible());
  await page.unroute(API + "/api**");
  await page.getByRole("button", { name: "Retry" }).click();
  await page.getByRole("button", { name: "Retry" }).waitFor({ state: "detached", timeout: 15000 });
  check("Retry recovers once the API is back", true);
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("**/auth");

  // sign in while API is down must not fake a session either
  await page.route(API + "/api**", (route) => route.abort("connectionrefused"));
  await page.reload();
  await page.getByLabel("Email address").fill("demo@billpilot.com");
  await page.getByLabel("Password").fill("BillPilot2026!");
  await page.getByRole("button", { name: "Sign in", exact: true }).last().click();
  await toast(page, "Cannot reach the Bill Pilot server").waitFor();
  check("signing in with the API down does NOT create a fake demo session", page.url().endsWith("/auth") && (await page.evaluate(() => localStorage.getItem("bp_token"))) === null);
  await page.unroute(API + "/api**");

  check("no uncaught page errors during the run", consoleErrors.length === 0, consoleErrors.join(" | ").slice(0, 300));
  await ctx.close();

  // ------------------------------------------------------------------ west-of-UTC evening: the original date bug
  const laCtx = await browser.newContext({ timezoneId: "America/Los_Angeles", viewport: { width: 1280, height: 900 } });
  const nowReal = Date.now();
  // 03:00 UTC on the next day == 20:00 the previous evening in Los Angeles, where the UTC date is already tomorrow.
  const fake = new Date(nowReal);
  fake.setUTCHours(3, 0, 0, 0);
  if (fake.getTime() < nowReal) fake.setUTCDate(fake.getUTCDate() + 1);
  await laCtx.clock.install({ time: fake });
  const la = await laCtx.newPage();
  await loginViaUi(la);
  const laToday = await la.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const utcToday = fake.toISOString().slice(0, 10);
  check("test setup: Los Angeles local date differs from the UTC date", laToday !== utcToday, `${laToday} vs ${utcToday}`);
  await addSubscription(la, { name: "LA Evening Plan", price: 7, start: monthsAgo(2, 1), renewal: laToday });
  const laCard = cards(la).filter({ hasText: "LA Evening Plan" });
  await laCard.waitFor();
  check("in Los Angeles at 8pm a renewal for local today says 'Today' (old code: 'Expired')", await laCard.getByText("Today", { exact: true }).isVisible());
  const upcoming = await la.getByText("Upcoming (7 Days)").locator("xpath=following-sibling::div[1]").innerText();
  check("...and is counted in 'Upcoming (7 Days)'", Number(upcoming.trim()) >= 1, upcoming);
  await laCtx.close();
} catch (err) {
  failures++;
  console.log("FAIL  unexpected error:", err && err.stack ? err.stack.split("\n").slice(0, 6).join("\n") : err);
} finally {
  // delete the throw-away users (this also deletes their subscriptions)
  for (const { token, id } of cleanupTokens) {
    if (!token || !id) continue;
    try {
      const res = await fetch(`${API}/api/v1/users/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      console.log(`cleanup: user ${id} -> ${res.status}`);
    } catch (e) {
      console.log("cleanup failed:", e.message);
    }
  }
  await browser.close();
}

console.log(failures === 0 ? "\nALL E2E CHECKS PASSED" : `\n${failures} E2E CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
