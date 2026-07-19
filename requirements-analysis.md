# Requirement Analysis

## Selected Project Option

**Option A — Support Ticket Management System**

An internal tool for staff to create, update, comment on, search, and progress support tickets through a fixed status lifecycle.

---

## My Understanding (in your own words)

The system is a small internal helpdesk where agents and admins manage support requests. The central concept is a **ticket** that moves through a strict lifecycle: once opened, it can progress toward resolution or be cancelled, but never move backwards. This state machine is the most important business rule — it's not just a UI convenience, it's an invariant the backend must enforce regardless of what any client sends.

Beyond the lifecycle, the system needs standard CRUD for tickets, a comment thread per ticket (decoupled from the ticket's own update timestamp), keyword search with status filtering, and a frontend that surfaces errors clearly rather than silently failing. The system is internal-only — no public sign-up, no multi-tenancy, no complex permissions beyond a basic admin/agent distinction.

The "signature piece" of this project is the state machine: how it's modelled as a single source of truth, how the backend rejects invalid transitions with typed errors, how the frontend renders only valid options without duplicating the map, and how tests exhaustively prove the invariant holds.

---

## Functional Requirements

### Ticket Management
1. **Create ticket** — title (3–200 chars), description (up to 5,000 chars), priority (LOW/MEDIUM/HIGH/URGENT), optional assignee, always starts in OPEN status
2. **List tickets** — ordered by most recently updated, with keyword search (case-insensitive substring via ILIKE) and status filter, combinable as logical AND
3. **View ticket details** — full record including all comments ordered by creation time ascending
4. **Update ticket fields** — title, description, priority, assignee (including clearing to null); blocked on terminal-state tickets
5. **Change ticket status** — enforced via state machine with exactly 5 valid transitions; any other transition rejected with a typed error listing valid options

### State Machine (the core business rule)
6. Valid transitions: OPEN→IN_PROGRESS, IN_PROGRESS→RESOLVED, RESOLVED→CLOSED, OPEN→CANCELLED, IN_PROGRESS→CANCELLED
7. No other transitions are valid — including self-transitions (OPEN→OPEN) and reverse transitions (RESOLVED→IN_PROGRESS)
8. Terminal states (CLOSED, CANCELLED) have no outgoing transitions and lock field edits

### Comments
9. **Add comment** — body (1–2,000 chars), attached to any ticket regardless of status (including terminal states)
10. Adding a comment does NOT update the ticket's `updatedAt` timestamp

### Search and Filter
11. Keyword search matches partial substrings in title or description, case-insensitive
12. Status filter returns only tickets in the specified status
13. Both filters combine in a single request as logical AND

### Error Handling
14. Backend rejects all invalid input with 400 responses containing structured error messages (field-level details from Zod)
15. Frontend displays all errors visibly — validation errors, not-found, terminal lock, network failures — never silently swallows them

### Stretch (delivered)
16. JWT authentication with bcrypt password hashing, ADMIN-only status changes
17. Ticket tagging (many-to-many) with filter-by-tag support
18. Pagination, sorting, and extended filters (priority, assignee, tag)
19. OpenAPI 3.0 interactive documentation at `/api-docs`

---

## Non-Functional Requirements

1. **Persistence** — all data stored in PostgreSQL, survives application restarts
2. **Performance** — GIN trigram index on title+description for efficient ILIKE queries at scale
3. **Consistency** — single error response shape (`{ error: { code, message, details? } }`) across every endpoint
4. **Validation** — server-side Zod validation on every endpoint; frontend is never the sole validator
5. **Type safety** — TypeScript strict mode on both server and client; Prisma generates typed client
6. **Testability** — property-based tests (fast-check) for state machine invariants, integration tests (Supertest) for HTTP contracts
7. **Maintainability** — layered architecture (routes → controllers → services → Prisma), single config module, custom error classes
8. **Security** — JWT tokens for auth, bcrypt for passwords, no stack traces or DB details leaked in error responses, `.env` never committed
9. **CI** — GitHub Actions runs migrations + full test suite against a Postgres container on every push

---

## Assumptions

1. **Internal-only access** — no public sign-up, no rate limiting, no multi-tenancy. All users are pre-seeded staff.
2. **No ticket deletion** — tickets are never deleted, only progressed to terminal states. Historical record is permanent.
3. **Synthetic seed data** — all users and tickets in development/test are fake placeholder data, never real company information.
4. **Single database** — no read replicas, no sharding. A single Postgres instance is sufficient for the expected internal load.
5. **No real-time updates** — the frontend polls/refetches on user action rather than using WebSockets. Stale data between tab refreshes is acceptable.
6. **Comments are append-only** — no editing or deleting comments after creation.
7. **Assignee is a User reference** — always a foreign key to User.id, never a free-text name.
8. **Priority enum is fixed** — LOW, MEDIUM, HIGH, URGENT. No custom priority levels.
9. **Token stored in memory** — JWT held in React context/state, not localStorage, to reduce XSS surface.
10. **Low concurrency** — TOCTOU race conditions on status transitions are acknowledged but not mitigated with row-level locks for the Core scope.

---

## Clarifications (questions for a product owner)

1. **Can a ticket be created without an assignee?** → Yes, `assignedTo` is nullable. Tickets can remain unassigned.
2. **Can comments be added to Closed or Cancelled tickets?** → Yes. The ticket being closed doesn't end the conversation. Comments bypass the terminal lock.
3. **Can ticket fields be updated on terminal-state tickets?** → No. Title, description, priority, and assignee are locked once a ticket is CLOSED or CANCELLED (returns `TICKET_LOCKED`).
4. **Is search case-insensitive?** → Yes. Uses PostgreSQL ILIKE with partial-word substring matching.
5. **Can the assignee be cleared (set back to null)?** → Yes. The update endpoint accepts `null` for `assignedTo` to unassign.
6. **What length constraints apply?** → Title: 3–200 chars after trim. Description: 1–5,000 chars. Comment body: 1–2,000 chars.
7. **What happens with an entirely invalid status value (not just an invalid transition)?** → Same 400 rejection, but with `VALIDATION_ERROR` code (from Zod) rather than `INVALID_TRANSITION` — the frontend can distinguish these by the error code.
8. **Who can change ticket status?** → Only ADMIN-role users (stretch feature). Agents can create tickets and comment but cannot transition status.
9. **Should `updatedAt` change when a comment is added?** → No. Only field edits and status changes touch `updatedAt`. Comments write to a separate table.
10. **Is there a maximum number of tags per ticket?** → Yes, 10 tags maximum per ticket (stretch feature).

---

## Edge Cases

### State Machine
- **Self-transition** (e.g., OPEN→OPEN) — rejected as invalid, same as any non-listed transition
- **Reverse transition** (e.g., RESOLVED→IN_PROGRESS) — rejected with error listing valid transitions from current status
- **Transition from terminal state** (CLOSED→anything, CANCELLED→anything) — rejected; terminal states have no outgoing edges
- **Invalid enum value** (e.g., "BOGUS") — rejected by Zod before reaching the state machine, returns `VALIDATION_ERROR` not `INVALID_TRANSITION`
- **Race condition** — two concurrent status changes on the same ticket; acknowledged gap, no row-level lock in Core scope

### Validation
- **Whitespace-only strings** — trimmed first, then length-checked. A title of all spaces fails min-length validation.
- **Title at exact boundaries** — 3 chars passes, 2 chars fails; 200 chars passes, 201 fails
- **Description at 5,000 chars** — passes; 5,001 fails
- **Comment body at 2,000 chars** — passes; 2,001 fails
- **Non-existent user reference** — `createdBy` or `assignedTo` pointing to a UUID that doesn't exist returns 404

### Search
- **SQL special characters in keyword** (`%`, `_`, `\`, `'`, `;`) — treated as literal characters by Prisma's `contains` mode, no wildcard expansion, no injection
- **Empty keyword** — returns all tickets (filter not applied)
- **Invalid status in filter** — rejected with `VALIDATION_ERROR`

### Terminal State Lock
- **PATCH on a CLOSED ticket** — returns 403 `TICKET_LOCKED`, not 400
- **Comment on a CLOSED ticket** — succeeds (comments bypass the lock)
- **Status change on a terminal ticket** — rejected via `INVALID_TRANSITION` (terminal states have empty transition arrays)

### Authentication (stretch)
- **Expired token** — returns 401, frontend redirects to login
- **Missing token** — returns 401 on all protected routes
- **Non-ADMIN attempts status change** — returns 403 `FORBIDDEN`

### Tags (stretch)
- **Duplicate tag name** — returns 409 `CONFLICT` (case-insensitive uniqueness)
- **More than 10 tags on a ticket** — returns 400 `VALIDATION_ERROR`
- **Deleting a tag** — removes association from all tickets but doesn't delete tickets themselves
