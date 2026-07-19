# Database Setup Notes

## Database Choice

**PostgreSQL 16** — chosen for native enum support (Status, Priority, Role are `CREATE TYPE` statements, not free-text strings), the pg_trgm extension for efficient substring search, UUID generation, and Prisma's first-class PostgreSQL support.

---

## Schema Overview

4 models, 3 enums, 1 implicit join table:

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│   User   │────<│  Ticket  │────<│ Comment  │     │   Tag    │
│          │────<│          │>────│          │     │          │
└──────────┘     └────┬─────┘     └──────────┘     └──────────┘
                      │                                   │
                      └───────────< _TagToTicket >────────┘
```

### Enums (Native PostgreSQL types)

| Enum | Values |
|------|--------|
| Status | OPEN, IN_PROGRESS, RESOLVED, CLOSED, CANCELLED |
| Priority | LOW, MEDIUM, HIGH, URGENT |
| Role | ADMIN, AGENT |

### Models

| Model | PK | Key Fields | Notes |
|-------|-----|-----------|-------|
| User | UUID | name, email (unique), role, password (bcrypt) | Password never returned in API responses |
| Ticket | UUID | title (varchar 200), description (text), status, priority, createdBy (FK), assignedTo (FK, nullable) | `@updatedAt` only fires on row writes, not on Comment inserts |
| Comment | UUID | body (text), ticketId (FK), authorId (FK) | Append-only, no edit/delete |
| Tag | UUID | name (varchar 50, unique case-insensitive) | Many-to-many with Ticket via implicit join table |

---

## Migration History

```bash
server/prisma/migrations/
├── 20260719112909_init/                       # Tables + enums + FK constraints
├── 20260719113000_add_trigram_search_index/    # pg_trgm + GIN index
├── 20260719141756_add_tag_model/              # Tag + join table
├── 20260719153725_add_user_password/          # bcrypt password column
└── migration_lock.toml                        # Provider lock (postgresql)
```

| # | Migration | What it does |
|---|-----------|-------------|
| 1 | `init` | Creates User, Ticket, Comment tables. Creates Status, Priority, Role native PG enums. Establishes FK constraints (createdBy→User, assignedTo→User, ticketId→Ticket, authorId→User). Adds unique constraint on User.email. |
| 2 | `add_trigram_search_index` | Enables `pg_trgm` extension (`CREATE EXTENSION IF NOT EXISTS pg_trgm`). Creates GIN index `idx_ticket_search_trgm` on `(title || ' ' || description)` with `gin_trgm_ops` for efficient ILIKE queries. |
| 3 | `add_tag_model` | Creates Tag table with UUID PK and case-insensitive unique name. Creates implicit `_TagToTicket` join table for many-to-many relationship. |
| 4 | `add_user_password` | Adds `password` column (VarChar 72) to User table for bcrypt hash storage. |

---

## How to Run Migrations

```bash
cd server

# Development (creates migration files + applies)
npx prisma migrate dev

# Production / CI (applies existing migrations only)
npx prisma migrate deploy

# Reset database (drops all data, reapplies from scratch)
npx prisma migrate reset
```

---

## Seed Data

The seed script (`server/prisma/seed.ts`) creates development/test data using `upsert` with stable UUIDs for idempotency — running it multiple times produces no errors or duplicates.

### What's seeded

| Entity | Count | Details |
|--------|-------|---------|
| Users | 5 | 2 ADMIN (Alice, Dave), 3 AGENT (Bob, Carol, Eve). All passwords: `password123` (bcrypt hashed) |
| Tickets | 12 | At least 1 in each status: 3 OPEN, 3 IN_PROGRESS, 2 RESOLVED, 2 CLOSED, 2 CANCELLED. Mix of assigned/unassigned. |
| Comments | 8 | Spread across tickets including comments on CLOSED tickets (proves terminal lock bypass) |
| Tags | 5 | Bug, Feature Request, Performance, Documentation, Security |
| Tag associations | 6 | 4 tickets have tags (1-2 tags each) |

### How to run

```bash
cd server
npm run db:seed
```

This calls `prisma db seed` which is configured in `server/package.json`:
```json
{
  "prisma": {
    "seed": "ts-node prisma/seed.ts"
  }
}
```

### Login credentials (development only)

| Email | Password | Role |
|-------|----------|------|
| alice@example.com | password123 | ADMIN |
| bob@example.com | password123 | AGENT |
| carol@example.com | password123 | AGENT |
| dave@example.com | password123 | ADMIN |
| eve@example.com | password123 | AGENT |

---

## Indexes

| Index | Type | On | Purpose |
|-------|------|-----|---------|
| `idx_ticket_search_trgm` | GIN (pg_trgm) | `(title \|\| ' ' \|\| description)` | Efficient case-insensitive substring search (ILIKE) |
| `User_email_key` | B-tree (unique) | `User.email` | Unique constraint + fast lookup by email |
| `Tag_name_ci_key` | B-tree (unique) | `Tag.name` | Case-insensitive unique tag names |
| FK indexes | B-tree | `createdBy`, `assignedTo`, `ticketId`, `authorId` | Prisma auto-creates for all foreign keys |

---

## Key Design Decisions

1. **Native PostgreSQL enums** — Prisma `enum` declarations generate `CREATE TYPE` statements. This gives database-level type safety (invalid values rejected at the DB layer even if application validation somehow fails).

2. **UUID primary keys** — `@default(uuid())` on all models. No sequential integers that could leak information about record counts or creation order.

3. **`assignedTo` nullable** — Tickets can exist unassigned. The FK constraint still applies when a value is present (must reference a real User).

4. **`createdBy` immutable** — Not included in `updateTicketSchema`. The Zod schema physically cannot accept it, and the service destructures only editable fields.

5. **`@updatedAt` isolation** — Prisma's directive fires only on Ticket row writes. Adding a Comment writes to a separate table and never triggers it. This is the correct behavior — the ticket list should show when ticket *fields* last changed, not when someone commented.

6. **Idempotent seed** — `upsert` with stable UUIDs means `npm run db:seed` can be run safely at any time without errors. Development databases stay consistent.

7. **GIN trigram index** — Enables efficient `ILIKE '%keyword%'` queries that PostgreSQL would otherwise resolve with a sequential scan. The `CREATE EXTENSION IF NOT EXISTS` makes migration idempotent across environments.

---

## Local Development Setup

```bash
# Option 1: Docker Compose (recommended)
docker-compose up -d    # Starts Postgres 16 on port 5432

# Option 2: Local PostgreSQL
# Ensure PostgreSQL 16+ is running and create a database:
# createdb support_tickets

# Configure connection
cd server
cp .env.example .env
# Edit DATABASE_URL in .env

# Apply migrations + seed
npx prisma migrate dev
npm run db:seed

# Verify
npx prisma studio    # Opens browser UI to inspect data
```

---

## CI Database Setup

GitHub Actions uses a Postgres 16 service container (see `.github/workflows/ci.yml`):

```yaml
services:
  postgres:
    image: postgres:16-alpine
    env:
      POSTGRES_USER: ci_user
      POSTGRES_PASSWORD: ci_password
      POSTGRES_DB: support_tickets_test
    ports:
      - 5432:5432
```

Migrations are applied with `npx prisma migrate deploy` (no interactive prompts). The pg_trgm extension is available by default in the Alpine PostgreSQL image.
