# 🧾 Bill Pilot — Java Spring Boot Backend API

A production-grade subscription tracking and automated renewal notification REST API built with **Java 25 LTS** and **Spring Boot 3.4**. This is an exact 1:1 functional port and enhancement of the Node.js/Express backend.

---

## 🚀 Features

- **Authentication & Security**:
  - Stateless JWT token generation & verification (`io.jsonwebtoken`).
  - Passwords encrypted with `BCryptPasswordEncoder`.
  - Spring Security with custom `OncePerRequestFilter` and CORS support.
- **High-Performance Rate Limiting**:
  - Token-bucket algorithm via **Bucket4j** (Capacity: 10, Refill: 5 tokens / 10s), mirroring Arcjet without external latency or SaaS dependencies.
- **Data Modeling & MongoDB**:
  - Spring Data MongoDB documents for `User` and `Subscription`.
  - Automatic renewal calculation (`daily` +1d, `weekly` +7d, `monthly` +30d, `yearly` +365d) and auto-expiration detection.
- **Automated Renewal Reminders**:
  - Resilient daily scheduled engine (`@Scheduled`) checking for renewals due in 7, 5, 2, and 1 days.
  - On-demand / webhook execution endpoint `/api/v1/workflows/subscription/reminder`.
  - HTML emails dispatched asynchronously using `JavaMailSender` (Gmail SMTP).
- **Unified Error Handling**:
  - `@RestControllerAdvice` returning standard Express-compatible error schemas.

---

## 🛠 Tech Stack

| Component | Technology | Version |
| :--- | :--- | :--- |
| **Language** | Java SE (LTS) | 25.0.2 |
| **Framework** | Spring Boot | 3.4.3 |
| **Build Tool** | Apache Maven | 3.9.14 |
| **Database** | MongoDB | Spring Data MongoDB |
| **JWT** | JJWT (`jjwt-api`, `jjwt-impl`, `jjwt-jackson`) | 0.12.6 |
| **Rate Limiter** | Bucket4j (`bucket4j-core`) | 8.10.1 |
| **Email** | Spring Boot Starter Mail (`JavaMailSender`) | 3.4.3 |
| **Boilerplate** | Lombok | 1.18.38 |

---

## 📁 Project Structure

```
d:/Java Project/
├── pom.xml                                    # Maven configuration
├── README.md                                  # Documentation & API reference
└── src/
    ├── main/
    │   ├── java/com/billpilot/
    │   │   ├── BillPilotApplication.java       # Main entry point (@EnableScheduling, @EnableAsync)
    │   │   ├── config/
    │   │   │   ├── MongoConfig.java            # Auditing config (@EnableMongoAuditing)
    │   │   │   └── SecurityConfig.java         # Spring Security, CORS & PasswordEncoder
    │   │   ├── controller/
    │   │   │   ├── AuthController.java         # /api/v1/auth (sign-up, sign-in, sign-out)
    │   │   │   ├── HomeController.java         # / (root welcome)
    │   │   │   ├── SubscriptionController.java # /api/v1/subscriptions (CRUD, renewals, cancel)
    │   │   │   ├── UserController.java         # /api/v1/users
    │   │   │   └── WorkflowController.java     # /api/v1/workflows (reminders)
    │   │   ├── dto/
    │   │   │   ├── request/                    # SignUp, SignIn, Create/UpdateSubscription
    │   │   │   └── response/                   # ApiResponse, AuthResponse, UserResponse
    │   │   ├── exception/
    │   │   │   ├── GlobalExceptionHandler.java # Centralized REST error handling
    │   │   │   └── Custom Exceptions           # NotFound, Conflict, Unauthorized, Forbidden
    │   │   ├── filter/
    │   │   │   └── RateLimitFilter.java        # Bucket4j token bucket filter
    │   │   ├── model/
    │   │   │   ├── Category.java               # sports, news, entertainment, technology, etc.
    │   │   │   ├── Frequency.java              # daily, weekly, monthly, yearly
    │   │   │   ├── Subscription.java           # MongoDB document
    │   │   │   ├── SubscriptionStatus.java     # active, cancelled, expired
    │   │   │   └── User.java                   # MongoDB document
    │   │   ├── repository/
    │   │   │   ├── SubscriptionRepository.java # MongoRepository with custom queries
    │   │   │   └── UserRepository.java         # MongoRepository with findByEmail
    │   │   ├── security/
    │   │   │   ├── JwtAuthenticationFilter.java# Bearer token interceptor
    │   │   │   └── JwtService.java             # SecretKey signing and claim parsing
    │   │   ├── service/
    │   │   │   ├── AuthService.java            # Signup, signin, token minting
    │   │   │   ├── EmailService.java           # Async MIME HTML email delivery
    │   │   │   ├── ReminderSchedulerService.java # Scheduled reminder evaluator
    │   │   │   ├── SubscriptionService.java    # Full subscription business logic
    │   │   │   └── UserService.java            # User retrieval & deletion
    │   │   └── util/
    │   │       └── EmailTemplateBuilder.java   # Branded responsive HTML template
    │   └── resources/
    │       └── application.yml                 # Application settings & environment bindings
    └── test/
        └── java/com/billpilot/
            ├── filter/RateLimitFilterTest.java
            ├── model/SubscriptionModelTest.java
            ├── security/JwtServiceTest.java
            └── util/EmailTemplateBuilderTest.java
```

---

## ⚙ Configuration & Environment Variables

All settings in `src/main/resources/application.yml` can be customized via environment variables:

| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | Server HTTP port | `5500` |
| `DB_URI` | MongoDB connection URI | `mongodb://localhost:27017/bill-pilot` |
| `JWT_SECRET` | Secret key for HMAC-SHA256 token signing | Built-in 256-bit key |
| `JWT_EXPIRATION_MS`| JWT validity in milliseconds | `86400000` (24 hours) |
| `EMAIL_USER` | Gmail address for sending notifications | `lymo.network@gmail.com` |
| `EMAIL_PASSWORD` | Gmail App Password | (Empty / optional) |

---

## 🚀 Running the Application

### 1. Build and Test
```bash
mvn clean test
```

### 2. Run with Maven
```bash
mvn spring-boot:run
```

### 3. Run Packaged JAR
```bash
mvn package
java -jar target/bill-pilot-1.0.0.jar
```

---

## 📡 API Reference

### Root
- `GET /` — Welcome message

### Authentication (`/api/v1/auth`)
- `POST /api/v1/auth/sign-up` — Register new user
- `POST /api/v1/auth/sign-in` — Authenticate user and receive JWT
- `POST /api/v1/auth/sign-out` — Graceful sign-out

### Subscriptions (`/api/v1/subscriptions`)
- `POST /api/v1/subscriptions` — Create subscription (Auto-calculates `renewalDate`)
- `GET /api/v1/subscriptions/user/{userId}` — Get user's subscriptions (Requires token ownership)
- `GET /api/v1/subscriptions/upcoming-renewals` — Get subscriptions renewing within 7 days
- `GET /api/v1/subscriptions/{id}` — Get single subscription
- `PUT /api/v1/subscriptions/{id}` — Update subscription details
- `DELETE /api/v1/subscriptions/{id}` — Delete subscription
- `PUT /api/v1/subscriptions/{id}/cancel` — Mark subscription as cancelled

### Users (`/api/v1/users`)
- `GET /api/v1/users` — List all users
- `GET /api/v1/users/{id}` — Get user profile by ID
- `DELETE /api/v1/users/{id}` — Delete user profile

### Workflows (`/api/v1/workflows`)
- `POST /api/v1/workflows/subscription/reminder` — Trigger single subscription reminder check
