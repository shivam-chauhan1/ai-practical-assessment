# Design Notes

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Client (React SPA)                     │
│  Pages → Components → API Layer (typed fetch wrappers)   │
└──────────────────────────┬──────────────────────────────┘
                           │ fetch via Vite proxy (/api →:3001)
┌──────────────────────────▼──────────────────────────────┐
│                   Server (Express API)                    │
│  Routes → Controllers → Services → Prisma Client         │
│  Middleware: validate (Zod) → auth (JWT) → errorHandler  │
└──────────────────────────┬──────────────────────────────┘
                           │ Prisma ORM
┌──────────────────────────▼──────────────────────────────┐
│                  PostgreSQL 16                            │
│  Native enums (Status, Priority, Role)                   │
│  GIN trigram index for ILIKE search                      │
│  UUID primary keys, FK constraints                       │
└─────────────────────────────────────────────────────────┘
```

**Monorepo layout:** `/server` and `/client` as independent packages with their own `package.json`, `tsconfig.json`, and test runners. No shared code package — types are mirrored intentionally (frontend mirrors backend response shapes) to avoid coupling deployment.

**Key architectural decisions:**
1. Backend-first development — all endpoints verified before any frontend code
2. Layered backend — no direct Prisma calls from controllers; business logic lives in services
3. Data-driven frontend — status controls render from server-provided `validTransitions` array, never computing transitions client-side
4. Single error shape — one `ApiErrorResponse` interface used by every endpoint and parsed by one frontend `ApiError` class

---

## Frontend Design

### Routing

| Route | Page | Purpose |
|-------|------|---------|
| `/login` | LoginPage | Email + password form, stores JWT in AuthContext |
| `/` | TicketListPage | Paginated list with search, filter, sort controls |
| `/tickets/new` | CreateTicketPage | Form for new ticket creation |
| `/tickets/:id` | TicketDetailPage | Detail view, status controls, edit mode, comments |

### Component Architecture

**Pages** own data fetching and state. **Components** are stateless/presentational where possible.

Key components:
- `StatusTransitionControls` — renders one button per `validTransitions` entry; fully server-driven, no client-side transition map
- `ErrorDisplay` / `ErrorBanner` — renders structured API errors by code type (distinct treatment for TICKET_LOCKED vs. VALIDATION_ERROR)
- `Toast` + `useToast` — success feedback (auto-dismiss 3s) for status changes, comments, updates
- `SearchBar` — debounced keyword (300ms) + immediate status/priority/tag filters
- `TicketForm` — shared between create and edit modes; handles both client-side and server-side validation display

### State Management

- No global state library — React Context for auth only (JWT token + user profile)
- Page-level `useState` + `useEffect` for data fetching
- `useDebounce` hook for search input

### API Layer

Single `apiRequest<T>()` function handles:
- JSON parsing for success responses
- Structured error parsing (extracts `{ code, message, details }` from non-2xx)
- Network failure detection (TypeError → `NETWORK_ERROR` code)
- 401 interception → calls `onUnauthorized` callback → redirects to login

---

## Backend Design

### Layering

```
Request → Route (validation middleware) → Controller → Service → Prisma → DB
                                                         ↑
                                              Error classes thrown here
                                                         ↓
                                              errorHandler middleware catches
```

- **Routes** — attach Zod validation middleware, define HTTP method + path
- **Controllers** — extract params/body, call service, format HTTP response (status code + JSON)
- **Services** — all business logic: reference validation (user/ticket exists), state machine checks, terminal lock, Prisma queries
- **Middleware** — `validate()` (Zod), `authenticate()` (JWT verify), `requireRole()` (ADMIN check), `errorHandler()` (catch-all)

### State Machine Design

The most important design decision in the system:

```typescript
export const VALID_TRANSITIONS: Record<Status, Status[]> = {
  OPEN: [Status.IN_PROGRESS, Status.CANCELLED],
  IN_PROGRESS: [Status.RESOLVED, Status.CANCELLED],
  RESOLVED: [Status.CLOSED],
  CLOSED: [],
  CANCELLED: [],
};
```

**Why a static map, not if/else chains:**
- Single source of truth — both validation and "valid next states" hints derive from the same constant
- Exhaustive by construction — every status has an entry (TypeScript enforces this via `Record<Status, ...>`)
- Testable in isolation — pure function `isValidTransition(from, to)` needs no DB, no Express
- Frontend doesn't duplicate — server includes `validTransitions` in every ticket response; frontend just renders buttons for each entry

**Terminal state lock** is separate from the state machine: `isTerminalState()` checks if a status has an empty transitions array. The `updateTicket` service calls this before any field modification.

### Authentication Design (Stretch)

- JWT signed with HS256, configurable expiry (default 1h)
- Token stored in React Context (memory), not localStorage — reduces XSS surface
- `authenticate` middleware extracts + verifies token on all routes except `/auth/login` and `/health`
- `requireRole('ADMIN')` middleware on PATCH `/tickets/:id/status` only
- Password stored as bcrypt hash (cost factor 10), never returned in any API response

---

## Database Design

### Schema

Four models: **User**, **Ticket**, **Comment**, **Tag**

Key design choices:
- **Native PG enums** for Status, Priority, Role — not free-text strings. Prisma maps these to `CREATE TYPE` statements.
- **UUID primary keys** — `@default(uuid())` on all models. No auto-increment integers.
- **`assignedTo` nullable** — tickets can exist unassigned. Setting to `null` via update clears the assignee.
- **`createdBy` immutable** — not in `updateTicketSchema`, physically cannot be changed after creation.
- **`@updatedAt` isolation** — Prisma's directive fires only on Ticket row writes. Comment inserts go to a separate table and never trigger it.
- **Implicit many-to-many for tags** — Prisma manages the `_TagToTicket` join table. Update uses set semantics (full replacement).

### Indexes

- **GIN trigram index** on `(title || ' ' || description)` — enables efficient `ILIKE '%keyword%'` without sequential scans
- Requires `pg_trgm` extension (created via raw SQL migration)
- Standard B-tree indexes on all FK columns (Prisma creates these automatically)

### Migration Strategy

Prisma Migrate with sequential numbered migrations:
1. `init` — tables + enums + relations
2. `add_trigram_search_index` — pg_trgm + GIN index
3. `add_tag_model` — Tag + join table
4. `add_user_password` — bcrypt password column for auth

Migrations are idempotent and run in CI via `prisma migrate deploy`.

---

## Validation Strategy

### Principle: Backend is the source of truth, always

The frontend provides immediate feedback for obvious errors (empty required fields, obvious length violations), but the backend validates everything independently. If the frontend and backend ever disagree, the backend wins — and the frontend displays the backend's error message.

### Implementation

1. **Zod schemas** define the canonical validation rules — one schema per endpoint input
2. **`validate()` middleware** parses the request (body, query, or params) against the schema
3. On success: replaces request data with the parsed/trimmed result → next()
4. On failure: formats per-field error details → throws `ValidationError` → caught by error handler

### Trim-first validation

All string fields use `.trim()` in the Zod schema before `.min()` / `.max()` checks. This means:
- `"   "` (whitespace only) → trimmed to `""` → fails `.min(1)` → rejected
- `"  hello  "` → trimmed to `"hello"` → 5 chars → passes `.min(3)`
- The stored value is always the trimmed version

### Defense in depth for status field

The PATCH `/tickets/:id` endpoint must never change status (that's a separate endpoint). Three layers prevent it:
1. `updateTicketSchema` does not include `status` — Zod strips it
2. Service destructures only `{ title, description, priority, assignedTo, tags }` — status not included
3. Integration test explicitly verifies: sending `{ status: 'CLOSED' }` in PATCH body does not change status

---

## Error Handling Strategy

### Single error shape

Every non-2xx response from the API uses:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [{ "field": "title", "message": "String must contain at least 3 character(s)" }]
  }
}
```

`details` is only present for `VALIDATION_ERROR`. All other codes omit it.

### Error codes and their meaning

| Code | HTTP | When | Frontend treatment |
|------|------|------|-------------------|
| `VALIDATION_ERROR` | 400 | Zod schema failure | Red banner + per-field messages |
| `INVALID_TRANSITION` | 400 | State machine rejects the (from, to) pair | Inline red text below status controls |
| `AUTHENTICATION_ERROR` | 401 | Missing/expired/invalid JWT | Redirect to login |
| `TICKET_LOCKED` | 403 | Field edit on terminal-state ticket | Amber banner (distinct from red) |
| `FORBIDDEN` | 403 | Non-ADMIN attempts status change | Red banner |
| `NOT_FOUND` | 404 | Resource doesn't exist | Not-found page state |
| `CONFLICT` | 409 | Duplicate tag name | Red banner |
| `INTERNAL_ERROR` | 500 | Unexpected failure | Generic "something went wrong" |

### Error handler middleware

Mounted last in Express (after all routes). Catches:
1. `AppError` subclasses → uses their `statusCode`, `code`, `message`, `details`
2. `ZodError` (safety net) → formats as `VALIDATION_ERROR`
3. Prisma `P2025` → maps to `NOT_FOUND`
4. Everything else → 500 `INTERNAL_ERROR`, logs full error server-side, never leaks stack traces

---

## Testing Strategy Link

Full testing strategy documented in [test-strategy.md](./test-strategy.md).

**Summary:** 4 tiers of testing — exhaustive state-machine coverage (property + integration), terminal-lock property tests, input validation property tests, and frontend component tests. Tests run against real PostgreSQL (not mocks). CI runs the full suite on every push. Known gaps (E2E, contract testing, load testing) are documented with rationale for why they're acceptable at this stage.
