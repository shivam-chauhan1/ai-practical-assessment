# PR Description

## Summary

Full-stack support ticket management system — an internal tool for staff to create, update, comment on, search, and progress tickets through a strict status lifecycle. Built with Express/TypeScript/Prisma (backend) and React/TypeScript/Vite (frontend) in a monorepo layout.

The state machine (5 valid transitions, terminal-state locking, exhaustive rejection of all other paths) is the central business rule. It's implemented as a single `Record<Status, Status[]>` map, tested at three layers (unit, property-based, integration), and the frontend renders only valid options without duplicating the logic.

---

## Features Implemented

### Core
- Ticket CRUD (create, list, get by ID, update fields)
- Status transitions enforced by state machine (OPEN→IN_PROGRESS→RESOLVED→CLOSED, plus cancellation paths)
- Terminal-state lock (CLOSED/CANCELLED tickets reject field edits with `TICKET_LOCKED`)
- Comments on any ticket regardless of status (does not touch `updatedAt`)
- Keyword search (case-insensitive ILIKE with GIN trigram index) + status filter (combinable AND)
- Consistent error response shape across all endpoints
- Frontend with data-driven status controls, error display, and toast notifications

### Stretch
- JWT authentication (bcrypt password hashing, Bearer token middleware)
- Role-based access control (ADMIN-only status changes)
- Ticket tagging (many-to-many Tag entity, filter by tag)
- Pagination, sorting (updatedAt or priority), extended filters (priority, assignedTo, tag)
- OpenAPI 3.0 interactive documentation at `/api-docs` via swagger-ui-express + zod-to-openapi

---

## Technical Changes

### Server (`/server`)
- `prisma/schema.prisma` — User, Ticket, Comment, Tag models with native PG enums (Status, Priority, Role)
- `src/services/stateMachine.ts` — VALID_TRANSITIONS map, isValidTransition, getValidTransitions, isTerminalState
- `src/services/ticketService.ts` — createTicket, listTickets, getTicketById, updateTicket, changeTicketStatus
- `src/services/commentService.ts` — addComment (writes only to Comment table)
- `src/schemas/` — Zod validation schemas for all inputs (trim-first, length-checked)
- `src/middleware/validate.ts` — generic validation middleware (body/query/params)
- `src/middleware/authenticate.ts` — JWT verification middleware
- `src/middleware/requireRole.ts` — role-based guard (ADMIN for status changes)
- `src/middleware/errorHandler.ts` — centralized error handler (AppError, ZodError, Prisma P2025, catch-all)
- `src/errors/` — AppError hierarchy (NotFoundError, ValidationError, TicketLockedError, InvalidTransitionError, etc.)
- `src/config/` — single config module for all environment variables
- `src/openapi/` — OpenAPI registry, response schemas, route registrations, generator
- `src/routes/` — Express Router definitions for tickets, comments, tags, auth, users
- `src/controllers/` — request handling (extract data, call service, format response)

### Client (`/client`)
- `src/pages/` — LoginPage, TicketListPage, TicketDetailPage, CreateTicketPage
- `src/components/` — StatusTransitionControls, TicketCard, TicketForm, TicketEditForm, CommentList, CommentForm, SearchBar, TagFilter, ErrorDisplay, ErrorBanner, Toast, StatusBadge, PriorityBadge, EmptyState, ProtectedRoute
- `src/api/` — typed fetch wrappers (apiRequest, tickets, comments, tags, users), ApiError class
- `src/contexts/AuthContext.tsx` — JWT token + user profile in memory (not localStorage)
- `src/hooks/` — useDebounce, useToast

### Root
- `.github/workflows/ci.yml` — GitHub Actions CI (Postgres 16 container, migrations, test suite)
- `docker-compose.yml` — local Postgres for development
- `.kiro/steering/` — persistent project context (product.md, tech.md, structure.md)

---

## Database Changes

4 migrations applied in order:

| Migration | Purpose |
|-----------|---------|
| `20260719112909_init` | Create User, Ticket, Comment tables + Status, Priority, Role enums + FK constraints |
| `20260719113000_add_trigram_search_index` | Enable pg_trgm extension, add GIN index on `(title \|\| ' ' \|\| description)` |
| `20260719141756_add_tag_model` | Add Tag model with many-to-many join table to Ticket |
| `20260719153725_add_user_password` | Add bcrypt password column to User for JWT auth |

Seed script creates: 5 users (mixed ADMIN/AGENT), 12 tickets (at least one in each status), 8 comments, 5 tags. Uses `upsert` with stable UUIDs for idempotency.

---

## Testing Done

### Backend (Jest + Supertest + fast-check)

| Category | Tests | What they prove |
|----------|-------|-----------------|
| State machine unit | 37 | All 25 (from, to) pairs, getValidTransitions per status, isTerminalState, TERMINAL_STATES constant |
| State machine property | 5 | fast-check: valid transitions return true, invalid return false, created tickets start OPEN |
| Status integration | 22 | All 5 valid transitions persist (re-fetched), all 15 invalid transitions rejected + status unchanged, invalid enum rejected, 404 for missing ticket |
| Terminal lock property | ~100 runs | Random update payloads on CLOSED/CANCELLED throw TicketLockedError |
| Comment bypass property | ~100 runs | Comments succeed on tickets in any status |
| CRUD integration | 16 | Create, list, search, filter, get, update, unassign, terminal lock, status-field-ignored |
| Search property | ~100 runs | Keyword returns only matches, status filter returns only matching, combined = AND |
| Edge cases | 16 | Whitespace-only, SQL special chars, boundary lengths, non-existent references |
| OpenAPI integration | 6 | /api-docs serves HTML, all paths registered, valid OpenAPI structure |

### Frontend (Vitest + @testing-library/react + fast-check)

| Category | Tests | What they prove |
|----------|-------|-----------------|
| StatusTransitionControls | property | Correct buttons per status, none for terminal |
| ErrorDisplay | 6+ | Each error code renders correctly, dismiss works |
| TicketListPage | 6+ | Loading, rendering, search, filter, empty state, error state |
| TicketDetailPage | 6+ | Detail view, comments, 404, edit toggle, terminal read-only |

### CI
- GitHub Actions runs on every push/PR
- Postgres 16 container, migrations applied, full test suite executed

---

## AI Usage Summary

- **Tool:** Kiro (spec-driven development environment)
- **Workflow:** Steering → Requirements (EARS) → Design → Tasks → Execute → Test → Review → Document
- **5 specs created:** support-ticket-core, jwt-auth, ticket-tagging, ticket-list-filters, openapi-docs
- **3 code review passes:** state machine, validation/error handling, pre-PR cleanup
- **Key guardrail:** All ambiguity decisions made by human; AI executed but didn't decide business rules
- **Validation:** TypeScript compilation at every step, manual curl testing, re-fetch assertions in tests

See `ai-prompts/` directory for full categorized prompt logs and `reflection.md` for detailed analysis.

---

## Screenshots / Demo Notes

**To verify the core behavior manually:**

```bash
# Start the system
cd server && npm run dev    # Backend on :3001
cd client && npm run dev    # Frontend on :5173

# Login (default admin user from seed)
# Email: alice.admin@example.com
# Password: password123

# Key flows to test:
# 1. Create a ticket → verify it appears with OPEN status
# 2. Click "Move to In Progress" → verify only "Mark Resolved" and "Cancel" appear next
# 3. Navigate to a CLOSED ticket → verify no edit button, no transition buttons, comment form still works
# 4. Try the search bar with a keyword + status filter → verify results narrow correctly
# 5. Visit /api-docs → interactive Swagger UI with all endpoints documented
```

---

## Known Limitations

1. **No optimistic concurrency on status changes.** Two concurrent requests could theoretically both read the same current status and attempt conflicting transitions. Under the low concurrency of an internal tool this is unlikely, but not prevented.

2. **No E2E browser tests.** The frontend is tested at the component level (mocked API) and the backend at the HTTP level (real DB). No Playwright/Cypress test covers the full round-trip.

3. **No contract testing between frontend and backend.** Frontend mocks API shapes manually. A renamed response field would break the app but not the tests.

4. **Comment ordering relies on timestamp resolution.** If two comments are inserted within the same millisecond, ordering is non-deterministic. Unlikely in practice for a human-driven tool.

---

## Future Improvements

1. **Optimistic concurrency** — add `where: { id, status }` to the Prisma update in `changeTicketStatus` to prevent TOCTOU race conditions
2. **Contract tests** — generate TypeScript types from OpenAPI spec and validate frontend mocks against them
3. **E2E test** — one Playwright test covering create → transition → close → verify read-only → comment
4. **Audit log** — record who changed status, when, from what to what (currently only `updatedAt` changes)
5. **WebSocket notifications** — push ticket updates to open browser tabs rather than requiring manual refresh
