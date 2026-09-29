You are the lead architect and senior full-stack engineer for this project.

Read the complete PRD.md carefully before doing anything.

## IMPORTANT

Do NOT start coding yet.

Do NOT create the application implementation yet.

Do NOT create database migrations yet.

Do NOT start building UI yet.

Your first task is ONLY to produce a detailed implementation plan.

The PRD is the primary source of truth.

---

## Your first response must contain

### 1. Requirement Understanding

Summarize the product in your own words and explain the major workflows you believe the system must support.

### 2. Architecture

Propose the complete architecture using:

* TanStack Start
* React
* TypeScript
* TanStack Router
* TanStack Query where appropriate
* TanStack Server Functions
* Zod
* Drizzle ORM
* MySQL/MariaDB
* PWA

Explain how client code, server functions, services, repositories and database interact.

### 3. Project Structure

Provide the exact proposed folder/file structure.

Pay particular attention to feature boundaries.

### 4. Database Design

Provide:

* All tables
* Columns
* Data types
* Primary keys
* Foreign keys
* Unique constraints
* Indexes
* Relationships
* Tenant isolation strategy

Explain the reasoning behind important schema decisions.

### 5. Authentication & Authorization

Explain:

* Authentication
* Session handling
* Tenant resolution
* Owner/staff roles
* Permission checks
* Server-side authorization

### 6. Inventory Architecture

Explain:

* SKU generation
* Stock balance
* Stock transactions
* Stock adjustments
* Stock-in
* Low-stock calculation
* Concurrency handling

### 7. Billing Architecture

Explain the complete lifecycle:

```text
Draft
→ Review
→ Complete
→ Payment
→ Partial/Due
→ Cancellation/Reversal
```

Explain the exact database transaction boundaries.

### 8. Payment Architecture

Explain:

* Multiple payments
* Partial payments
* Payment methods
* Payment reversal
* Idempotency
* Balance calculation

### 9. Server Functions

List the major server functions/procedures required for:

* Auth
* Inventory
* Customers
* Bills
* Payments
* Purchases
* Reports
* Settings

Do not turn every tiny database operation into an unnecessary server function.

### 10. Frontend Architecture

Explain:

* Routes
* Mobile navigation
* Desktop navigation
* Feature components
* Forms
* Tables
* Search
* Loading states
* Error states
* Empty states

### 11. State Management

Explain exactly where:

* Local React state
* TanStack Query
* Route loaders
* Server functions

will be used.

Do not introduce unnecessary global state.

### 12. PWA

Explain:

* Manifest
* Service worker
* Caching
* Offline behavior
* Installability

Be explicit about what will and will not work offline.

### 13. Performance

Provide the performance strategy for:

* Initial load
* Navigation
* Inventory search
* Customer search
* Billing
* Dashboard
* Reports
* Images

### 14. Security

Cover:

* Authentication
* Authorization
* Tenant isolation
* Input validation
* SQL safety
* Sessions
* Secrets
* Rate limiting
* Audit logs

### 15. Testing

Provide a test strategy covering:

* Unit tests
* Integration tests
* Tenant isolation
* Inventory concurrency
* Billing transactions
* Payment idempotency
* E2E workflows
* Mobile UX

### 16. Implementation Phases

Break implementation into logical phases.

For every phase provide:

* Goal
* Files/modules involved
* Database changes
* Server functions
* UI work
* Tests
* Acceptance criteria

### 17. Risks & Ambiguities

List every important thing that is unclear or potentially risky.

Do NOT silently make major assumptions.

For each ambiguity:

```text
Question
Why it matters
Recommended decision
```

### 18. Dependency Review

List the dependencies you propose to install and explain why each one is needed.

Avoid unnecessary libraries.

### 19. Final Architecture Diagram

Provide a clear architecture diagram showing:

```text
Browser
 ↓
TanStack Start
 ↓
Server Functions
 ↓
Services
 ↓
Repositories
 ↓
Drizzle
 ↓
MySQL/MariaDB
```

and show how authentication and tenant context flow through the system.

---

## Critical planning rules

1. Do not begin implementation.
2. Do not generate application code.
3. Do not generate migrations.
4. Do not make major assumptions silently.
5. Prefer the simplest architecture that satisfies the PRD.
6. Do not introduce REST APIs unless there is a specific external integration requirement.
7. Do not introduce Express unless you can demonstrate a concrete requirement that TanStack Start cannot satisfy.
8. Do not introduce Redux or another global state library unless clearly justified.
9. Do not over-engineer the MVP.
10. Preserve the ability to add external APIs later.
11. Treat tenant isolation as a security requirement, not merely a coding convention.
12. Treat inventory and billing mutations as transactional financial/business operations.
13. Never put business logic directly into React components.
14. Never trust client-calculated totals.
15. Never trust client-provided tenant IDs.

---

## Most important instruction

After producing the implementation plan:

**STOP.**

Wait for explicit approval before writing implementation code.

The implementation will only begin after the human reviewer approves the plan.
