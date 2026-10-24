# 🧾 Bill Pilot — Subscription Intelligence & Fatigue Audit Engine

A subscription intelligence platform built with **Java (LTS)**, **Spring Boot 3.5**, and **Next.js 16 (App Router)**.

---

## 👤 Who Is This For?

**Students and early-career professionals (roughly 18–28) who pay for 6–12 digital subscriptions out of a fixed monthly allowance or stipend.**

- They start free trials and forget to cancel them.
- They pay for several services in the same category at once (Netflix + Disney+ + Prime, or ChatGPT + Claude + Copilot).
- Annual renewals surprise them.
- Charges are scattered across cards and UPI apps, so nobody knows the real monthly total.

**The problem:** these users do not just need a place to *record* subscriptions. They need to *discover* the ones they forgot about and decide which to cut, before the next charge lands.

**What Bill Pilot does for them:** upload a bank statement and it finds the hidden recurring charges, scores how overloaded the stack is, and shows what cancelling or rotating would save.

---

## ⭐ Key Feature: Hidden Subscription Detector (Statement Scanner)

Most trackers only work if you remember to type every subscription in. Bill Pilot works backwards from the money: upload a bank or card statement CSV (`/scan` page) and it finds the recurring charges itself.

It uses **deterministic rules, no machine learning and no third-party API**, so every detection is explainable and the statement is never sent anywhere. The file is parsed in memory and never stored.

**How detection works** (`com.billpilot.statement`):

1. **Parse** the CSV. Columns are located by header name (date, description, amount or debit/credit), so different banks' layouts work. Date formats are auto-detected and money-in rows are discarded.
2. **Normalize merchants.** `NETFLIX.COM 8007 CA`, `UPI-NETFLIX-123@ybl` and `POS DEBIT NETFLIX*MONTHLY` all collapse to one key. Known services are matched against a built-in catalog; unknown ones use their first meaningful words.
3. **Group by merchant** and sort each group by date (several charges on the same day count once).
4. **Classify the cadence** from the median gap between charges: weekly (7 ± 1 days), monthly (30 ± 3) or yearly (365 ± 7).
5. **Check regularity.** At least 60% of gaps must match the cadence, so one missed or late payment is tolerated.
6. **Check amount stability.** Unknown merchants must charge the same amount (within 5%) at least 3 times, which keeps coffee shops and grocery runs out. Known subscription services need only 2 charges and may vary up to 50%.
7. **Score confidence (0–100)**:

```text
confidence = 100 × ( 0.35 × regularity + 0.25 × amount_stability + 0.20 × min(1, charges/4) + 0.20 × known_merchant )
```

Results below 50 are dropped. For each detection the app shows the evidence, the next expected charge date, and flags **price hikes** (latest charge differs from the previous one) and whether it is **already in your tracker**. One click adds it.

A sample file is in `frontend/public/sample-statement.csv`.

---

## 🧩 Shared-descriptor separation

**The problem.** Some statement descriptors are shared by many subscriptions: `APPLE.COM/BILL`, Google Play, PayPal, `AMZN MKTP`. The scanner above groups charges by merchant and decides one cadence per group, so when several subscriptions sit under one descriptor their gaps are mixed and it finds nothing. Three things make it harder: the subscriptions interleave on different days (sometimes at the same price), a biller may add several renewals into one **grouped debit** (2.99 + 10.99 shows up as a single 13.98), and **one-off purchases** are mixed in with the subscriptions.

**How it works** (`StreamSeparator`, plain rules, no machine learning). Shared billers come from `AggregatorCatalog` and go through the separator. Other merchants keep the result of the rules above, except that a merchant with four or more charges is also tried, so one merchant with two plans (two gym memberships, say) is split in two. A descriptor with more than 400 charges on one statement skips the separator and uses the plain rules, because the separator's running time grows quickly with the number of charges.

1. **Propose schedules.** Any two charges with the same amount that sit one to three billing periods apart suggest a calendar schedule: weekly, monthly (same day of the month) or yearly.
2. **Pick the schedules the charges really follow.** Each billing date claims the nearest charge within 3 days that has the same amount. A schedule whose amount is just the sum of two or three smaller schedules due on the same days is a grouped debit, not a subscription, and is skipped. The best schedule is accepted, its charges are used up, and the search repeats on what is left.
3. **Join price changes.** Two schedules that follow each other on the same days at a nearby price (within 50%), or a run of equal charges that continues a schedule at a new price, are one subscription whose price changed.
4. **Explain grouped debits.** A leftover charge that equals, within half a percent, the sum of two or more subscriptions due within 3 days of it is split between them. Inside a subscription's active period, a missing payment may also be found inside a larger nearby charge.
5. **Report status.** A subscription whose last two billing dates passed with no charge is reported as stopped; one missing date is reported as overdue.

Whatever no subscription explains is listed as a one-off purchase. On `/scan`, each shared descriptor gets its own block showing the subscriptions found, a month-by-month strip of when each was charged, and how many one-offs were left out. Stopped subscriptions are left out of the monthly totals.

**Benchmark.** `SeparationBenchmark` generates seeded synthetic statements (2000 per scenario) with known subscriptions and scores three methods: **B0** the plain scanner's rules (one stream per descriptor), **B1** grouping by amount and then the same cadence rules, and **SP** the separator. A true subscription counts as found when a detection has the same cadence, a price within 1% and a billing day within 3 days. Cells are recall / precision.

| Scenario | B0 current detector | B1 amount grouping | SP separator |
|---|---|---|---|
| S0 single stream (control) | 1.000 / 1.000 | 1.000 / 1.000 | 1.000 / 1.000 |
| S1 interleaved, distinct prices | 0.001 / 1.000 | 1.000 / 1.000 | 1.000 / 1.000 |
| S2 interleaved, equal prices | 0.005 / 1.000 | 0.005 / 1.000 | 0.999 / 0.999 |
| S3 grouped debits | 0.000 / 0.000 | 0.603 / 0.913 | 0.966 / 0.961 |
| S4 one-off purchases mixed in | 0.000 / 0.000 | 0.920 / 0.959 | 1.000 / 0.987 |
| S5 price changes, stops, misses | 0.006 / 1.000 | 0.963 / 0.786 | 0.992 / 0.991 |
| S6 realistic mix | 0.000 / 0.000 | 0.634 / 0.896 | 0.979 / 0.959 |

Synthetic statements; not yet measured on real users' data.

Reproduce it (the run is seeded, so every number matches; only the timing varies). On Windows use `;` instead of `:` in the classpath:

```bash
mvn test-compile
java -cp target/classes:target/test-classes com.billpilot.statement.SeparationBenchmark 2000
```

A sample with shared descriptors is in `frontend/public/sample-statement-shared.csv`.

---

## 🔬 Analytics: Subscription Intelligence Engine

Once subscriptions are tracked, Bill Pilot audits them.

### 1. Subscription Fatigue Index (SFI) [Score: 0–100]
A deterministic mathematical model evaluating the cognitive clutter, financial run-rate, and domain saturation of recurring commitments:

```text
SFI = clamp(5, 100, [4.5 × N_active] + [12.0 × R_redundancy] + min(30, Spend_monthly / 15) + min(18, 6.0 × C_collisions))
```

- `N_active` = active subscriptions, `R_redundancy` = extra services beyond the first in each category,
  `C_collisions` = days in the next 30 where two or more plans (or $40+) renew together.
- With no active subscriptions the score is 0; otherwise it never drops below 5.
- All money is in the user's **primary currency** (the one used by most active plans, USD on a tie). Plans billed in other
  currencies are excluded and reported separately instead of being added together.
- Monthly equivalents use exact ratios: weekly × 52/12, daily × 365/12, yearly ÷ 12.

- **OPTIMAL (0–30)**: Lean, non-overlapping stack with minimal mental load.
- **MODERATE (31–60)**: Controlled recurring footprint with isolated minor clusters.
- **ELEVATED (61–80)**: Emerging fatigue; heavy functional duplication in core categories.
- **BURNOUT (81–100)**: Severe subscription saturation with compounding wealth leakage.

### 2. Functional Redundancy Matrix (Overlap Detection)
Isolates multiple active services competing within the exact same utility domain:
- **Streaming & Media Stack Saturation**: Flags duplicate active services (e.g., Netflix + Disney+ + HBO Max) and calculates the **Rotational Arbitrage Savings** (saving ~60% by rotating sequentially rather than paying concurrently).
- **Developer & AI Stack Redundancy**: Isolates overlapping assistants (e.g., ChatGPT Plus + Claude Pro + GitHub Copilot).

### 3. Vampire Drain & 5-Year S&P 500 Opportunity Cost Projector
Computes long-term compounding cash drag against an index fund yielding 7% APR:

```text
FV = P × [((1 + r/12)^60 - 1) / (r/12)]
```

- Flags **High-Drain Vampire Subscriptions** that quietly consume over $600 to $1,500 in 5-year opportunity cost.

### 4. What-If Arbitrage Simulator Lab
An interactive decision-support sandbox enabling users to simulate pausing redundant services and switching monthly plans to discounted annual billing in real time.

---

## 🛠 Tech Stack

| Layer | Technology | Details |
| :--- | :--- | :--- |
| **Backend Language** | Java SE (LTS) | JDK 21+ |
| **Backend Framework** | Spring Boot | 3.5.16 |
| **Build Tool** | Apache Maven | 3.9+ |
| **Database** | MongoDB | Spring Data MongoDB |
| **Rate Limiter** | Bucket4j + Caffeine | 8.10.1 (per IP: 100 capacity / 20 refill per 10s; sign-in & sign-up: 10 capacity / 5 refill per 60s) |
| **Security & Auth** | Spring Security + JJWT | 0.12.6 (Stateless HMAC-SHA256) |
| **Email Scheduler** | Spring Mail + `@Scheduled` | 3.5.16 (Gmail SMTP, MIME HTML) |
| **Frontend Framework** | Next.js | 16.4.0 (Turbopack, App Router) |
| **Frontend UI** | React 19 + Tailwind CSS 4 | Violet dark theme, hand-drawn SVG charts, CSS-only animation (no UI library), Plus Jakarta Sans self-hosted |

---

## 📁 Project Architecture

```
bill-pilot/
├── pom.xml                                     # Spring Boot Maven POM
├── src/                                        # Backend source code
│   ├── main/java/com/billpilot/
│   │   ├── BillPilotApplication.java
│   │   ├── config/                             # Mongo & Security Config
│   │   ├── controller/                         # Auth, Subscriptions, Analytics, Statements
│   │   │   ├── AnalyticsController.java        # /api/v1/analytics/audit
│   │   │   ├── AuthController.java             # /api/v1/auth
│   │   │   ├── StatementController.java        # /api/v1/statements/analyze
│   │   │   └── SubscriptionController.java     # /api/v1/subscriptions
│   │   ├── dto/                                # Request & Response DTOs
│   │   ├── filter/                             # RateLimitFilter (Bucket4j)
│   │   ├── model/                              # Subscription, User, Enums
│   │   ├── repository/                         # Spring Data Repositories
│   │   ├── security/                           # JwtAuthenticationFilter & JwtService
│   │   ├── statement/                          # Statement scanner: StatementParser, MerchantNormalizer,
│   │   │                                       #   MerchantCatalog, AggregatorCatalog, RecurringDetector,
│   │   │                                       #   StreamSeparator (shared-descriptor separation)
│   │   └── service/
│   │       ├── AnalyticsService.java           # SFI & Redundancy Engine
│   │       ├── AuthService.java
│   │       ├── StatementAnalysisService.java   # Upload -> parse -> detect -> match tracked
│   │       ├── SubscriptionService.java
│   │       └── ReminderSchedulerService.java
│   └── test/                                   # JUnit tests (run: mvn test)
└── frontend/                                   # Next.js 16 Application
    ├── src/
    │   ├── app/
    │   │   ├── page.tsx                        # Main Dashboard
    │   │   ├── scan/page.tsx                   # Statement Scanner (hidden subscription detector)
    │   │   ├── analytics/page.tsx              # SFI & Redundancy Audit
    │   │   ├── simulator/page.tsx              # What-If Arbitrage Lab
    │   │   ├── catalog/page.tsx                # Verified Preset Directory
    │   │   ├── auth/page.tsx                   # Sign In & Registration
    │   │   └── settings/page.tsx               # API Diagnostics & Data Export
    │   ├── components/                         # SubscriptionCard, FatigueGauge, dialogs, toasts
    │   │   ├── shell/                          # AppShell: sidebar, top bar, tab bar, command palette, bell
    │   │   └── ui/                             # AreaChart, DonutChart, RingGauge, AnimatedNumber, icons ...
    │   ├── context/AppContext.tsx              # Unified Auth & State Store
    │   └── lib/api.ts                          # Resilient REST API Client
    └── public/logos/                           # Curated Brand Logos
```

---

## 🚀 Running the Project

### 0. Configure (`.env` in the project root, see `.env.example`)

| Variable | Required | Purpose |
| :--- | :--- | :--- |
| `DB_URI` | yes | MongoDB connection string. `DB_NAME` selects the database (default `test`). |
| `JWT_SECRET` | **yes** | Random string of **at least 32 characters**. The server refuses to start without it (there is no default). Generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. |
| `CORS_ALLOWED_ORIGINS` | no | Comma-separated browser origins allowed to call the API (default `http://localhost:3000`). |
| `WORKFLOW_TOKEN` | no | Shared secret for `POST /api/v1/workflows/**` (sent as `X-Workflow-Token`). The endpoint is disabled while empty. |
| `EMAIL_USER`, `EMAIL_PASSWORD` | for email | Gmail SMTP credentials for renewal reminders. |
| `RATE_LIMIT_*` | no | Rate limiter tuning. Set `RATE_LIMIT_TRUST_FORWARDED_FOR=true` only behind a reverse proxy that overwrites `X-Forwarded-For`. |

Never commit `.env`. If a secret is ever exposed, rotate it.

### 1. Run Spring Boot Backend (Port 5500)
```bash
mvn spring-boot:run
```
Run all automated backend tests (unit tests plus HTTP-level security tests):
```bash
mvn test
```

### 2. Run Next.js Frontend (Port 3000)
```bash
cd frontend
npm run dev
```
The frontend talks to `http://localhost:5500` by default. Set `NEXT_PUBLIC_API_URL` to point it elsewhere.

Open **[http://localhost:3000](http://localhost:3000)** in your browser.

### 3. Frontend checks and tests
```bash
cd frontend
npm run typecheck     # tsc --noEmit
npm run lint
npm test              # Vitest unit tests (dates, money, CSV export, import validation, session handling)
```
The date logic is timezone-sensitive; run the unit tests under other zones too, e.g. `TZ=America/Los_Angeles npm test`.

### 4. End-to-end tests (use a separate database!)
The end-to-end suites create and delete real users and data, so run them against an **isolated** database, never your real one:
```bash
# terminal 1: backend on its own database
DB_NAME=billpilot_e2e PORT=5501 CORS_ALLOWED_ORIGINS=http://localhost:3001 java -jar target/bill-pilot-1.0.0.jar
# terminal 2: frontend pointed at it
cd frontend && NEXT_PUBLIC_API_URL=http://localhost:5501 npx next dev -p 3001
# terminal 3
cd frontend && npm run e2e:api   # HTTP-level checks (no browser)
cd frontend && npm run e2e       # browser checks (Playwright; uses Chromium, Edge or Chrome)
```
Sign-in and sign-up are rate limited, so wait about a minute between runs.

### Behaviour worth knowing
- **Renewals roll forward.** An active subscription keeps renewing: once its renewal date is more than a day overdue it moves
  to the next billing date (calendar months/years, billing day preserved). It is only expired if you mark it so.
- **Users can only see and delete their own account.** There is no endpoint that lists other users.
- **The server is the only source of truth.** Importing a JSON backup or loading demo data creates real subscriptions in your
  account; there is no offline/demo login mode.
- **Known limits:** the session token is kept in `localStorage` (a Content-Security-Policy is applied in production builds to
  limit XSS risk); the server has no per-user timezone, so renewal dates are interpreted in the server's timezone with a
  one-day grace; there is no per-account lockout beyond the per-IP rate limits.

---

## 📡 API Reference

### Analytics (`/api/v1/analytics`)
- `GET /api/v1/analytics/audit` — Computes Subscription Fatigue Index (SFI), Redundancy Matrix, Vampire Drain projections, and 30-day renewal collisions.

### Statements (`/api/v1/statements`)
- `POST /api/v1/statements/analyze` — Multipart upload (`file`, `.csv`, max 2 MB). Returns detected recurring charges with confidence, next expected date, price-change and already-tracked flags, plus `sharedDescriptors`: one summary per shared descriptor (Apple, PayPal, ...) with the subscriptions found under it and the one-off purchases left out. Each detection has a `streamId`, a `status` (`active`, `overdue` or `stopped`) and the charges it was built from. The file is not stored.

### Authentication (`/api/v1/auth`)
- `POST /api/v1/auth/sign-up` — Register user & issue JWT
- `POST /api/v1/auth/sign-in` — Authenticate user (same `401` for an unknown email and a wrong password)
- `POST /api/v1/auth/sign-out` — Acknowledges sign-out; tokens are stateless, so the client discards its token

### Users (`/api/v1/users`) — own account only
- `GET /api/v1/users/me` — Current user
- `GET /api/v1/users/{id}` / `DELETE /api/v1/users/{id}` — `403` unless `{id}` is you. Deleting also removes your subscriptions.

### Workflows (`/api/v1/workflows`)
- `POST /api/v1/workflows/subscription/reminder` — Evaluate/send one reminder. Requires the `X-Workflow-Token` header.

### Subscriptions (`/api/v1/subscriptions`)
- `GET /api/v1/subscriptions/user/{userId}` — Get user subscriptions
- `GET /api/v1/subscriptions/upcoming-renewals` — Renewals due within 7 days
- `POST /api/v1/subscriptions` — Create new subscription
- `PUT /api/v1/subscriptions/{id}` — Update subscription
- `PUT /api/v1/subscriptions/{id}/cancel` — Cancel subscription
- `DELETE /api/v1/subscriptions/{id}` — Delete subscription
