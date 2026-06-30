# 🦊 Bun & Elysia Modulith Authentication Service

A high-performance, production-ready, and highly observable authentication service built on the **Bun runtime** and **ElysiaJS**, organized using a **Modulith (Modular Monolith)** architectural style. 

This project implements robust user registration, credential-based JWT authentication, Role-Based Access Control (RBAC), secure one-time password reset flows with mock email delivery, centralized structured logging, and system health checks.

---

## 🚀 Key Features

* **Modular Monolith (Modulith)**: Code organized strictly by business modules (`auth`, `user`, `email`, `protected`) rather than technical layers.
* **JWT-Based Authentication**: Secure stateless sessions using JSON Web Tokens with role claims.
* **Role-Based Access Control (RBAC)**: Fine-grained endpoint access matrix supporting `user`, `pro`, and `admin` scopes.
* **Password Reset Flow**: Cryptographically secure, short-lived (15 minutes) one-time tokens stored in the database, with email notifications triggered via an abstracted Email module.
* **HTTP Observability Middleware**: Custom high-performance middleware generating unique `X-Request-ID` correlation IDs for tracing request latencies, and logging structured JSON in production (dev-friendly colored output locally).
* **Database Query Logging**: Drizzle ORM database queries printed in real-time at the `DEBUG` level.
* **Health Check & Metrics**: Observability endpoint `/health` verifying PostgreSQL connection pool status and process memory statistics.
* **Interactive API Sandbox**: Fully documented routes using OpenAPI specs served via Scalar UI.

---

## 🛠️ Technology Stack

* **Runtime**: [Bun v1.1+](https://bun.sh)
* **Web Framework**: [ElysiaJS](https://elysiajs.com)
* **Database Driver**: [PostgreSQL (postgres.js)](https://github.com/porsager/postgres)
* **ORM & Migrations**: [Drizzle ORM](https://orm.drizzle.team)
* **Security & Crypto**: Native `Bun.password` (Argon2id) & `@elysiajs/jwt`
* **API Documentation**: `@elysia/openapi` (Scalar HTML UI)

---

## 📂 Architecture & Directory Layout

The codebase separates concern boundaries between reusable utilities (`src/shared`) and cohesive feature modules (`src/modules`):

```
src/
├── modules/
│   ├── auth/                      # Authentication & password reset domain
│   │   ├── auth.controller.ts     # Login, Register, Request/Confirm Reset endpoints
│   │   ├── auth.middleware.ts     # JWT validation and RBAC decorators
│   │   ├── auth.schema.ts         # password_reset_tokens table definition
│   │   ├── auth.service.ts        # Signup, signin, and password reset flows
│   │   ├── password-reset.repository.ts # Invalidation & token queries
│   │   └── password.service.ts    # Argon2 wrapper
│   ├── email/                     # Notification delivery interface
│   │   └── email.service.ts       # ConsoleEmailService mock (stdout logger)
│   ├── user/                      # User entity domain
│   │   ├── user.schema.ts         # users table definition
│   │   └── user.repository.ts     # SQL user queries & updates
│   └── protected/                 # Security demonstration module
│       └── protected.controller.ts# Role validation routes
├── shared/                        # Shared cross-cutting layers
│   ├── config/
│   │   └── index.ts               # Configuration loader & validator
│   ├── db/
│   │   ├── index.ts               # Database connection client & custom query logger
│   │   └── schema.ts              # Global schema registry
│   ├── errors/
│   │   └── http-errors.ts         # Domain exception definitions
│   └── logger/
│       ├── index.ts               # Central structured logger (Console/JSON)
│       └── observability-plugin.ts# HTTP latency & X-Request-ID propagation
├── index.ts                       # Unified API Server entrypoint
└── tests/                         # E2E test files (Integration, Regression, Load)
```

---

## 🚦 Getting Started

### 1. Prerequisites
Ensure you have **Bun** and **Docker** (or **Podman**) installed.

### 2. Database Setup
Start the local PostgreSQL container:
```bash
podman compose up -d
# or: docker compose up -d
```

### 3. Install Dependencies
```bash
bun install
```

### 4. Configuration
Create a `.env` file in the root directory (based on `.env.example`):
```ini
DATABASE_URL=postgres://postgres:postgres@localhost:5432/auth_db
JWT_SECRET=super_secret_key_change_me_in_production
PORT=3000
```

### 5. Database Schema Synchronization
Push the schema directly to the database:
```bash
bunx drizzle-kit push
```

### 6. Start the Server
Start the server in development watch mode:
```bash
bun run dev
```

* **API Endpoints Base URL**: `http://localhost:3000`
* **API Documentation (Scalar Sandbox)**: `http://localhost:3000/swagger`

---

## 🧪 Testing

The project has comprehensive testing suites including functional integration, security regression, and high-performance load tests.

### Run Automated Unit, Integration & Regression Tests
```bash
bun test
```

The test runner runs 38 tests checking boundary inputs, SQL injection attempts, malformed headers, race conditions, expired tokens, and RBAC matrix permissions:
```
bun test v1.3.14 (0d9b296a)
src/tests/integration.test.ts:
✓ GET /health - Health Check & Observability
✓ POST /auth/register - Validation & Creation
✓ POST /auth/login - Credentials & Tokens
✓ GET /protected/* - Access Permissions (Matrix)
✓ POST /auth/reset-password - Request & Confirm Workflow

src/tests/regression.test.ts:
✓ Boundary input limits (extreme strings, missing fields)
✓ SQL Injection resiliency (inputs bypass attempts)
✓ Authorization Header edge cases
✓ Concurrent registration race conditions
✓ Password reset edge cases (expired tokens, invalid tokens, short passwords)

 38 pass, 0 fail
```

### Run Load Benchmarks
```bash
# Start your server first: bun run src/index.ts
# Then in a separate terminal:
bun run test:load
```

The load testing utility runs concurrent request threads to measure system throughput:
* **Root Endpoint Check**: **~68,000 requests/second** with **0.22ms** average latency.
* **Auth-Flow Workflow (Register -> Login -> Fetch Route)**: **~12 complete workflows/second** (Argon2 hashing is CPU-throttled intentionally to secure passwords).

---

## 📝 Manual Route Testing (`api.http`)

You can test all endpoints manually using the preconfigured [api.http](file:///home/xlauro/Workspace/studies/bun/speed/auth/api.http) file. Install the **REST Client** extension in your IDE (VS Code or IntelliJ) to send requests directly from the file. The file is set up to automatically chain auth tokens upon login.