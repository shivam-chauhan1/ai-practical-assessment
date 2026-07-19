# Candidate Information

**Name:** Shivam Chauhan  
**Role:** Software Engineer  
**Primary Technology Stack:** Node.js 20 + TypeScript + Express + Prisma + PostgreSQL (backend), React 19 + TypeScript + Vite (frontend)  
**Primary AI Tool Used:** Kiro (spec-driven development with steering, requirements, design, and task execution)  
**Project Option Selected:** Option A — Support Ticket Management System  
**Assessment Start Date:** 18 July 2026  
**Submission Date:** 20 July 2026  

---

## Project Summary

Built a full-stack internal support ticket management system where staff can create, update, comment on, search, and progress tickets through a strict status lifecycle (OPEN → IN_PROGRESS → RESOLVED → CLOSED, plus cancellation paths). The system enforces a state-machine invariant at the service layer — invalid transitions are rejected server-side and the frontend only presents valid options. Terminal-state tickets (CLOSED/CANCELLED) are locked from field edits but allow continued commenting.

**Core features delivered:**
- Ticket CRUD with Zod validation and consistent error responses
- State-machine enforcement (single `Record<Status, Status[]>` transitions map)
- Comment system (allowed on all ticket statuses, does not touch `updatedAt`)
- Keyword search (case-insensitive `ILIKE` with GIN trigram index) + status filter
- Frontend with data-driven status controls, error display, and toast notifications

**Stretch features delivered:**
- JWT authentication (bcrypt password hashing, Bearer token, ADMIN-only status changes)
- Ticket tagging (many-to-many Tag entity, filter by tag)
- Extended filtering, sorting, and pagination on the list endpoint
- OpenAPI 3.0 documentation served at `/api-docs` via swagger-ui-express

---

## Tools Used

| Tool | Purpose | How It Was Used |
|------|---------|----------------|
| **Kiro** | Primary AI development environment | Spec-driven workflow: steering docs → requirements (EARS format) → design → tasks → execution. Used for code generation, review, debugging, and documentation across all phases. |
| **Kiro Steering** | Persistent project context | Three steering files (`product.md`, `tech.md`, `structure.md`) set up at project start to guide all subsequent work consistently. |
| **Kiro Specs** | Structured feature planning | 5 specs created: `support-ticket-core`, `jwt-auth`, `ticket-tagging`, `ticket-list-filters`, `openapi-docs` — each with requirements, design, and tasks. |
| **PostgreSQL 16** | Database | Native enums for Status/Priority/Role, GIN trigram index for search, Prisma migrations for schema management. |
| **GitHub Actions** | CI pipeline | Runs server tests against a Postgres service container on every push/PR. |
| **Docker Compose** | Local development | PostgreSQL container for local development database. |

---

## Setup Summary

### Quick Start

```bash
# 1. Clone and install
git clone <repository-url> && cd ai-practical-assessment
cd server && npm install
cd ../client && npm install

# 2. Configure environment
cd ../server && cp .env.example .env
# Edit .env with your DATABASE_URL, JWT_SECRET, etc.

# 3. Database setup
npx prisma migrate dev
npm run db:seed

# 4. Run
npm run dev          # Server on :3001
cd ../client && npm run dev   # Client on :5173 (proxies /api to server)
```

### Running Tests

```bash
cd server && npm test          # Jest + Supertest (--runInBand)
cd client && npm test -- --run # Vitest (single run, no watch)
```

### CI

GitHub Actions runs automatically on push — spins up a Postgres 16 container, runs migrations, and executes the full server test suite. See `.github/workflows/ci.yml`.

### Key Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `PORT` | Server port (default 3001) |
| `JWT_SECRET` | Signing key for JWT tokens (≥32 chars) |
| `JWT_EXPIRES_IN` | Token expiry duration (default `1h`) |
| `NODE_ENV` | `development`, `test`, or `production` |
