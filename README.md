# 🧾 Bill Pilot — Subscription Intelligence & Fatigue Audit Engine

A subscription intelligence platform built with **Java (LTS)**, **Spring Boot 3.4**, and **Next.js 16 (App Router)**.

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

## 🔬 Analytics: Subscription Intelligence Engine

Once subscriptions are tracked, Bill Pilot audits them.

### 1. Subscription Fatigue Index (SFI) [Score: 0–100]
A deterministic mathematical model evaluating the cognitive clutter, financial run-rate, and domain saturation of recurring commitments:

```text
SFI = clamp(0, 100, [4.5 × N_active] + [12.0 × R_redundancy] + min(30, Spend_monthly / 15) + [6.0 × C_collisions])
```

- **OPTIMAL (0–30)**: Lean, non-overlapping stack with minimal mental load.
- **MODERATE (31–60)**: Controlled recurring footprint with isolated minor clusters.
- **ELEVATED (61–80)**: Emerging fatigue; heavy functional duplication in core categories.
- **CRITICAL BURNOUT (81–100)**: Severe subscription saturation with compounding wealth leakage.

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
| **Backend Framework** | Spring Boot | 3.4.3 |
| **Build Tool** | Apache Maven | 3.9+ |
| **Database** | MongoDB | Spring Data MongoDB |
| **Rate Limiter** | Bucket4j | 8.10.1 (100 capacity, 20 refill / 10s) |
| **Security & Auth** | Spring Security + JJWT | 0.12.6 (Stateless HMAC-SHA256) |
| **Email Scheduler** | Spring Mail + `@Scheduled` | 3.4.3 (Gmail SMTP, MIME HTML) |
| **Frontend Framework** | Next.js | 16.4.0 (Turbopack, App Router) |
| **Frontend UI** | React 19 + Tailwind CSS | Dark Obsidian Theme |

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
│   │   │                                       #   MerchantCatalog, RecurringDetector
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
    │   ├── components/                         # Navbar, SubscriptionCard, FatigueGauge, Modal
    │   ├── context/AppContext.tsx              # Unified Auth & State Store
    │   └── lib/api.ts                          # Resilient REST API Client
    └── public/logos/                           # Curated Brand Logos
```

---

## 🚀 Running the Project

### 1. Run Spring Boot Backend (Port 5500)
```bash
mvn spring-boot:run
```
Run all automated unit tests:
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

---

## 📡 API Reference

### Analytics (`/api/v1/analytics`)
- `GET /api/v1/analytics/audit` — Computes Subscription Fatigue Index (SFI), Redundancy Matrix, Vampire Drain projections, and 30-day renewal collisions.

### Statements (`/api/v1/statements`)
- `POST /api/v1/statements/analyze` — Multipart upload (`file`, `.csv`, max 2 MB). Returns detected recurring charges with confidence, next expected date, price-change and already-tracked flags. The file is not stored.

### Authentication (`/api/v1/auth`)
- `POST /api/v1/auth/sign-up` — Register user & issue JWT
- `POST /api/v1/auth/sign-in` — Authenticate user
- `POST /api/v1/auth/sign-out` — Invalidate session

### Subscriptions (`/api/v1/subscriptions`)
- `GET /api/v1/subscriptions/user/{userId}` — Get user subscriptions
- `GET /api/v1/subscriptions/upcoming-renewals` — Renewals due within 7 days
- `POST /api/v1/subscriptions` — Create new subscription
- `PUT /api/v1/subscriptions/{id}` — Update subscription
- `PUT /api/v1/subscriptions/{id}/cancel` — Cancel subscription
- `DELETE /api/v1/subscriptions/{id}` — Delete subscription
