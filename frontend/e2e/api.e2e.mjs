// API-level end-to-end checks for the Spring Boot backend (no browser needed).
//
// SAFETY: registers throw-away users and creates data. Run it against an ISOLATED database only:
//   DB_NAME=billpilot_e2e PORT=5501 java -jar target/bill-pilot-1.0.0.jar
//   npm run e2e:api
// The users it creates delete themselves (and their subscriptions) at the end.
// Sign-in/sign-up are throttled (10-request burst, 5 per minute per IP), so wait about a minute between runs.
const BASE = process.env.BASE || "http://localhost:5501";
const stamp = Date.now();
const emailA = `e2e-a-${stamp}@example.com`;
const emailB = `e2e-b-${stamp}@example.com`;
let failures = 0;

function check(name, cond, extra = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  -> " + extra}`);
  if (!cond) failures++;
}

async function call(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* empty body */ }
  return { status: res.status, json };
}

const isoDate = (d) => {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const a = await call("POST", "/api/v1/auth/sign-up", { body: { name: "E2E A", email: emailA, password: "password-a-123" } });
check("sign-up A -> 201", a.status === 201, JSON.stringify(a));
const b = await call("POST", "/api/v1/auth/sign-up", { body: { name: "E2E B", email: emailB, password: "password-b-123" } });
check("sign-up B -> 201", b.status === 201, JSON.stringify(b));
const tokenA = a.json?.data?.token, idA = a.json?.data?.user?.id;
const tokenB = b.json?.data?.token, idB = b.json?.data?.user?.id;

const dup = await call("POST", "/api/v1/auth/sign-up", { body: { name: "E2E A", email: emailA.toUpperCase(), password: "password-a-123" } });
check("case-variant duplicate email -> 409", dup.status === 409, JSON.stringify(dup));

const badLogin = await call("POST", "/api/v1/auth/sign-in", { body: { email: emailA, password: "wrong-password" } });
const ghostLogin = await call("POST", "/api/v1/auth/sign-in", { body: { email: `ghost-${stamp}@example.com`, password: "wrong-password" } });
check("wrong password and unknown email look identical", badLogin.status === 401 && ghostLogin.status === 401 &&
  JSON.stringify(badLogin.json) === JSON.stringify(ghostLogin.json), JSON.stringify([badLogin, ghostLogin]));

const login = await call("POST", "/api/v1/auth/sign-in", { body: { email: emailA.toUpperCase(), password: "password-a-123" } });
check("sign-in is case-insensitive on email", login.status === 200 && !!login.json?.data?.token, JSON.stringify(login));

// ---- subscriptions: the old "created as expired" bug ----
const threeMonthsAgo = new Date(); threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3); threeMonthsAgo.setDate(threeMonthsAgo.getDate() - 4);
const sub = await call("POST", "/api/v1/subscriptions", {
  token: tokenA,
  body: { name: "Old Monthly Plan", price: 12.5, currency: "USD", frequency: "monthly", category: "entertainment", paymentMethod: "Card", startDate: isoDate(threeMonthsAgo) },
});
const today = isoDate(new Date());
check("create with old start date -> 201", sub.status === 201, JSON.stringify(sub));
check("...status is active (was: expired)", sub.json?.data?.status === "active", sub.json?.data?.status);
check("...renewalDate is today or later (was: stale past date)", sub.json?.data?.renewalDate >= today, sub.json?.data?.renewalDate);
check("...reminder bookkeeping fields are not exposed", !("lastReminderRenewalDate" in (sub.json?.data ?? {})));
const subId = sub.json?.data?.id;

const audit = await call("GET", "/api/v1/analytics/audit", { token: tokenA });
check("analytics counts the subscription", audit.json?.data?.activeCount === 1 && audit.json?.data?.totalMonthlySpend === 12.5, JSON.stringify(audit.json?.data?.activeCount));
check("analytics reports currency", audit.json?.data?.currency === "USD");

// mixed currencies are not summed
await call("POST", "/api/v1/subscriptions", {
  token: tokenA,
  body: { name: "Rupee Plan", price: 999, currency: "INR", frequency: "monthly", category: "news", paymentMethod: "UPI", startDate: isoDate(new Date()) },
});
const audit2 = await call("GET", "/api/v1/analytics/audit", { token: tokenA });
check("INR plan is excluded from USD totals, not added", audit2.json?.data?.totalMonthlySpend === 12.5 &&
  audit2.json?.data?.excludedCurrencies?.[0] === "INR", JSON.stringify(audit2.json?.data?.excludedCurrencies));

// ---- validation ----
const badName = await call("PUT", `/api/v1/subscriptions/${subId}`, { token: tokenA, body: { name: "x" } });
check("update with 1-char name -> 400", badName.status === 400, JSON.stringify(badName));
const badCur = await call("PUT", `/api/v1/subscriptions/${subId}`, { token: tokenA, body: { currency: "DOLLARS" } });
check("update with bad currency -> 400", badCur.status === 400, JSON.stringify(badCur));
const hugePrice = await call("POST", "/api/v1/subscriptions", {
  token: tokenA,
  body: { name: "Huge", price: 1e300, frequency: "monthly", category: "other", paymentMethod: "Card", startDate: today },
});
check("absurd price -> 400", hugePrice.status === 400, JSON.stringify(hugePrice));
const farDate = await call("POST", "/api/v1/subscriptions", {
  token: tokenA,
  body: { name: "Far Future", price: 5, frequency: "monthly", category: "other", paymentMethod: "Card", startDate: "9999-12-31" },
});
check("year-9999 start date -> 400 (was: 500)", farDate.status === 400, JSON.stringify(farDate));

// the billing day comes from the renewal date the user set, not from the start date
const staleRenewal = new Date(); staleRenewal.setMonth(staleRenewal.getMonth() - 3); staleRenewal.setDate(25);
const sixMonthsAgo = new Date(); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6); sixMonthsAgo.setDate(3);
const billingDay = await call("POST", "/api/v1/subscriptions", {
  token: tokenA,
  body: { name: "Billing Day Plan", price: 8, frequency: "monthly", category: "other", paymentMethod: "Card", startDate: isoDate(sixMonthsAgo), renewalDate: isoDate(staleRenewal) },
});
check("stale renewal on the 25th (start on the 3rd) rolls to a future 25th, not the 3rd",
  billingDay.json?.data?.renewalDate?.endsWith("-25") && billingDay.json.data.renewalDate >= today && billingDay.json.data.status === "active",
  JSON.stringify(billingDay.json?.data?.renewalDate));

// frequency change recomputes renewal date
const upd = await call("PUT", `/api/v1/subscriptions/${subId}`, { token: tokenA, body: { frequency: "yearly" } });
check("changing frequency recomputes a future renewal date", upd.status === 200 && upd.json?.data?.renewalDate >= today, JSON.stringify(upd.json?.data?.renewalDate));

// ---- authorization between users ----
const bReadsA = await call("GET", `/api/v1/subscriptions/${subId}`, { token: tokenB });
check("B cannot read A's subscription -> 403", bReadsA.status === 403, JSON.stringify(bReadsA));
const bListsA = await call("GET", `/api/v1/subscriptions/user/${idA}`, { token: tokenB });
check("B cannot list A's subscriptions -> 403", bListsA.status === 403, JSON.stringify(bListsA));
const bReadsUserA = await call("GET", `/api/v1/users/${idA}`, { token: tokenB });
check("B cannot read user A -> 403", bReadsUserA.status === 403, JSON.stringify(bReadsUserA));
const bDeletesA = await call("DELETE", `/api/v1/users/${idA}`, { token: tokenB });
check("B cannot delete user A -> 403", bDeletesA.status === 403, JSON.stringify(bDeletesA));
const listAll = await call("GET", "/api/v1/users", { token: tokenB });
check("listing all users no longer exists -> 404", listAll.status === 404, JSON.stringify(listAll));
const meA = await call("GET", "/api/v1/users/me", { token: tokenA });
check("/users/me works and hides the password", meA.status === 200 && meA.json?.data?.email === emailA && !("password" in meA.json.data), JSON.stringify(meA));

// ---- statement scanner ----
const csvBody = ["Date,Description,Amount", "2026-07-05,NETFLIX.COM,-15.49", "2026-08-05,NETFLIX.COM,-15.49", "2026-09-05,NETFLIX.COM,-15.49", "2026-10-05,NETFLIX.COM,-15.49"].join("\n");
const form = new FormData();
form.append("file", new Blob([csvBody], { type: "text/csv" }), "s.csv");
const scanRes = await fetch(BASE + "/api/v1/statements/analyze", { method: "POST", headers: { Authorization: `Bearer ${tokenA}` }, body: form });
const scan = await scanRes.json();
check("statement scan detects a monthly Netflix charge", scanRes.status === 200 && scan.data?.detected?.[0]?.name === "Netflix" && scan.data.detected[0].frequency === "monthly", JSON.stringify(scan).slice(0, 200));
const scanNoAuth = await fetch(BASE + "/api/v1/statements/analyze", { method: "POST", body: form });
check("statement scan requires authentication -> 401", scanNoAuth.status === 401, String(scanNoAuth.status));
const bigForm = new FormData();
bigForm.append("file", new Blob(["x".repeat(2_200_000)], { type: "text/csv" }), "big.csv");
const bigRes = await fetch(BASE + "/api/v1/statements/analyze", { method: "POST", headers: { Authorization: `Bearer ${tokenA}` }, body: bigForm });
check("oversized statement upload -> 413", bigRes.status === 413, String(bigRes.status));

// ---- error handling ----
const unknown = await call("GET", "/api/v1/nope", { token: tokenA });
check("unknown route -> 404 (was 500)", unknown.status === 404, JSON.stringify(unknown));
const wrongMethod = await call("PATCH", `/api/v1/subscriptions/${subId}`, { token: tokenA, body: {} });
check("unsupported method -> 405 (was 500)", wrongMethod.status === 405, JSON.stringify(wrongMethod));

// ---- cleanup: users delete themselves (which also deletes their subscriptions) ----
const delA = await call("DELETE", `/api/v1/users/${idA}`, { token: tokenA });
const delB = await call("DELETE", `/api/v1/users/${idB}`, { token: tokenB });
check("cleanup: A deleted", delA.status === 200, JSON.stringify(delA));
check("cleanup: B deleted", delB.status === 200, JSON.stringify(delB));
const afterDelete = await call("GET", `/api/v1/subscriptions/${subId}`, { token: tokenA });
check("deleted user's token stops working", afterDelete.status === 401, JSON.stringify(afterDelete));

console.log(failures === 0 ? "\nALL E2E CHECKS PASSED" : `\n${failures} E2E CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
