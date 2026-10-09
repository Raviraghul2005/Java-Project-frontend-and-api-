# 🧾 Bill Pilot — Autonomous Subscription Intelligence & Fatigue Audit Engine

A production-grade, research-defensible subscription intelligence platform built with **Java 25 LTS**, **Spring Boot 3.4**, and **Next.js 16.4 (App Router)**.

---

## 🔬 Core Academic Novelty: Subscription Intelligence Engine

Standard applications merely act as passive ledgers that record bills and send reminders. **Bill Pilot transforms passive tracking into an algorithmic auditing and fatigue prevention engine**:

### 1. Subscription Fatigue Index (SFI) [Heuristic Score: 0–100]
A deterministic mathematical model evaluating the cognitive clutter, financial run-rate, and domain saturation of recurring commitments:
$$\text{SFI} = \text{clamp}(0, 100, [4.5 \times N_{\text{active}}] + [12.0 \times R_{\text{redundancy}}] + \min(30, \frac{\text{Spend}_{\text{monthly}}}{15}) + [6.0 \times C_{\text{collisions}}])$$

- **OPTIMAL (0–30)**: Lean, non-overlapping stack with minimal mental load.
- **MODERATE (31–60)**: Controlled recurring footprint with isolated minor clusters.
- **ELEVATED (61–80)**: Emerging fatigue; heavy functional duplication in core categories.
- **CRITICAL BURNOUT (81–100)**: Severe subscription saturation with massive compounding wealth leakage.

### 2. Functional Redundancy Matrix (Overlap Detection)
Isolates multiple active services competing within the exact same utility domain:
- **Streaming & Media Stack Saturation**: Flags duplicate active services (e.g., Netflix + Disney+ + HBO Max) and calculates the **Rotational Arbitrage Savings** (saving ~60% by rotating sequentially rather than paying concurrently).
- **Developer & AI Stack Redundancy**: Isolates overlapping LLM assistants (e.g., ChatGPT Plus + Claude Pro + GitHub Copilot).

### 3. Vampire Drain & 5-Year S&P 500 Opportunity Cost Projector
Computes long-term compounding cash drag against an index fund yielding 7% APR ($FV = P \times \frac{(1 + r/12)^{60} - 1}{r/12}$).
- Flags **High-Drain Vampire Subscriptions** that quietly consume over $600 to $1,500 in 5-year opportunity cost.

### 4. What-If Arbitrage Simulator Lab
An interactive decision-support sandbox enabling users to simulate pruning redundant services and switching monthly plans to discounted annual billing (recovering cashflow and flattening the renewal curve in real time).

---

## 🛠 Tech Stack

| Layer | Technology | Details |
| :--- | :--- | :--- |
| **Backend Language** | Java SE (LTS) | 25.0.2 |
| **Backend Framework** | Spring Boot | 3.4.3 |
| **Build Tool** | Apache Maven | 3.9.14 |
| **Database** | MongoDB | Spring Data MongoDB |
| **Rate Limiter** | Bucket4j | 8.10.1 (100 capacity, 20 refill / 10s) |
| **Security & Auth** | Spring Security + JJWT | 0.12.6 (Stateless HMAC-SHA256) |
| **Email Scheduler** | Spring Mail + `@Scheduled` | 3.4.3 (Gmail SMTP, MIME HTML) |
| **Frontend Framework** | Next.js | 16.4.0 (Turbopack, App Router) |
| **Frontend UI** | React 19 + Tailwind CSS + Glassmorphism | Dark Obsidian Theme |

---

## 📁 Project Architecture

```
d:/Java Project/
├── pom.xml                                     # Spring Boot Maven POM
├── src/                                        # Backend source code
│   ├── main/java/com/billpilot/
│   │   ├── BillPilotApplication.java
│   │   ├── config/                             # Mongo & Security Config
│   │   ├── controller/                         # Auth, Subscriptions, Workflows, Analytics
│   │   │   ├── AnalyticsController.java        # /api/v1/analytics/audit (NOVELTY)
│   │   │   ├── AuthController.java             # /api/v1/auth
│   │   │   └── SubscriptionController.java     # /api/v1/subscriptions
│   │   ├── dto/                                # Request & Response objects
│   │   ├── filter/                             # RateLimitFilter (Bucket4j)
│   │   ├── model/                              # Subscription, User, Enums
│   │   ├── repository/                         # Spring Data Repositories
│   │   ├── security/                           # JwtAuthenticationFilter & JwtService
│   │   └── service/
│   │       ├── AnalyticsService.java           # SFI & Redundancy Engine (NOVELTY)
│   │       ├── AuthService.java
│   │       ├── SubscriptionService.java
│   │       └── ReminderSchedulerService.java
│   └── test/                                   # 20/20 Passing Unit Tests
└── frontend/                                   # Next.js 16 Application
    ├── src/
    │   ├── app/
    │   │   ├── page.tsx                        # Fleet Deck / Command Center
    │   │   ├── analytics/page.tsx              # Novelty SFI & Redundancy Audit
    │   │   ├── simulator/page.tsx              # What-If Arbitrage Lab
    │   │   ├── catalog/page.tsx                # Curated Preset Directory
    │   │   ├── auth/page.tsx                   # Sign In & Registration Terminal
    │   │   └── settings/page.tsx               # API Diagnostics & Data Export
    │   ├── components/                         # Navbar, SubscriptionCard, FatigueGauge, Modal
    │   ├── context/AppContext.tsx              # Unified Auth & State Store
    │   └── lib/api.ts                          # Resilient REST API Client
    └── public/logos/                           # 32 Curated Brand Logos
```

---

## 🚀 Running the Project

### 1. Run Spring Boot Backend (Port 5500)
```bash
mvn spring-boot:run
```
Run all tests:
```bash
mvn test
```

### 2. Run Next.js Frontend (Port 3000)
```bash
cd frontend
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 📡 API Reference

### Analytics & Novelty (`/api/v1/analytics`)
- `GET /api/v1/analytics/audit` — Computes Subscription Fatigue Index (SFI), Redundancy Matrix, Vampire Drain projections, and 30-day renewal collisions.

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
