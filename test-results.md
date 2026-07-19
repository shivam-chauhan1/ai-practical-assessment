# Test Results

## Summary

| Suite | Runner | Tests | Status |
|-------|--------|-------|--------|
| Server (backend) | Jest + Supertest | 33 test files | ✅ All passing |
| Client (frontend) | Vitest + Testing Library | 12 test files | ✅ All passing |
| CI Pipeline | GitHub Actions | Full suite | ✅ Green |

---

## How to Run

```bash
# Backend tests (requires running PostgreSQL)
cd server
npm test                    # Runs Jest with --runInBand

# Frontend tests (no external dependencies)
cd client
npm test -- --run           # Runs Vitest in single-run mode (no watch)
```

---

## Server Test Files (33)

### State Machine (Tier 1 — Exhaustive)

| File | Type | What it proves |
|------|------|---------------|
| `stateMachine.unit.test.ts` | Unit | Full 5×5 truth table for `isValidTransition`, `getValidTransitions` per status, `isTerminalState`, `TERMINAL_STATES` constant |
| `stateMachine.property.test.ts` | Property (fast-check) | All valid transitions return true, all invalid return false — exhaustive cross-product |
| `ticketStatus.test.ts` | Integration | 5 valid transitions persist (re-fetched), 15 invalid rejected + status unchanged, invalid enum rejected, 404 for missing |
| `ticketService.test.ts` | Service unit | `changeTicketStatus` propagates errors correctly, multi-step chains work |

### Terminal State Lock (Tier 2)

| File | Type | What it proves |
|------|------|---------------|
| `ticketService.property.test.ts` | Property (fast-check) | Random update payloads on CLOSED/CANCELLED throw TicketLockedError (100 runs) |
| `commentService.property.test.ts` | Property (fast-check) | Comments succeed on any status including terminal (100 runs) |

### Input Validation (Tier 3)

| File | Type | What it proves |
|------|------|---------------|
| `ticketCrud.property.test.ts` | Property | Title length boundaries (3–200) rejected correctly, list ordering is updatedAt desc |
| `ticketSchemas.property.test.ts` | Property | Zod schemas accept valid inputs, reject invalid — fuzzed |
| `ticketSchemas.test.ts` | Unit | Specific schema validation cases |
| `comments.integration.test.ts` | Integration | Comment body length validation, comment ordering by createdAt asc |
| `search.property.test.ts` | Property | Keyword returns only matches, status filter correct, combined = AND logic |
| `edgeCases.test.ts` | Integration | Whitespace-only inputs, SQL special chars (%, _, \, ', ;), boundary lengths |
| `ticketListValidation.test.ts` | Integration | Query parameter validation for list endpoint |

### CRUD Integration

| File | Type | What it proves |
|------|------|---------------|
| `ticketCrud.test.ts` | Integration | Create (success + errors), list (search + filter), get (with comments + 404), update (fields + unassign + terminal lock + status ignored) |

### Authentication & Authorization

| File | Type | What it proves |
|------|------|---------------|
| `auth.integration.test.ts` | Integration | Login success/failure, protected routes reject without token |
| `authMiddleware.test.ts` | Unit | Token extraction, verification, rejection |
| `authMiddleware.property.test.ts` | Property | Random invalid tokens always rejected |
| `authMiddleware.bodyQuery.property.test.ts` | Property | Auth middleware doesn't interfere with body/query params |
| `authMiddleware.invalidToken.property.test.ts` | Property | Malformed tokens rejected with correct error shape |
| `authSchemas.property.test.ts` | Property | Login schema validation (email format, password presence) |
| `authService.test.ts` | Unit | Login service: correct credentials succeed, wrong rejected |
| `authService.login.property.test.ts` | Property | Random credential combinations tested |
| `authService.property.test.ts` | Property | Token generation + verification roundtrip |
| `roleGuard.test.ts` | Unit | ADMIN passes, AGENT rejected with 403 FORBIDDEN |
| `roleGuard.property.test.ts` | Property | Only ADMIN role passes guard for all random users |

### Tags

| File | Type | What it proves |
|------|------|---------------|
| `tagRoutes.test.ts` | Integration | Create (success + duplicate conflict), list, delete (success + 404) |
| `tagService.property.test.ts` | Property | Tag name validation, uniqueness constraint |
| `ticketTagAssociation.test.ts` | Integration | Attach/detach tags on tickets, max 10 limit |
| `ticketTagFiltering.property.test.ts` | Property | Tag filter returns correct tickets, combines with other filters |

### Filtering & Pagination

| File | Type | What it proves |
|------|------|---------------|
| `ticketFilters.test.ts` | Integration | Priority filter, assignedTo filter, sortBy, sortOrder, pagination |
| `ticketFilters.property.test.ts` | Property | Page/pageSize boundaries, sort correctness |

### Infrastructure

| File | Type | What it proves |
|------|------|---------------|
| `config.test.ts` | Unit | Config module reads env vars correctly, validates required vars |
| `seedIdempotency.test.ts` | Integration | Seed script can run twice without errors (upsert pattern works) |

---

## Client Test Files (12)

| File | Type | What it proves |
|------|------|---------------|
| `StatusTransitionControls.test.tsx` | Component + Property | Correct buttons per status, none for terminal, loading state disables, error display |
| `ErrorDisplay.test.tsx` | Component | Each error code renders correctly (VALIDATION_ERROR, NOT_FOUND, TICKET_LOCKED, INVALID_TRANSITION, NETWORK_ERROR), dismiss works, null = nothing rendered |
| `TicketListPage.test.tsx` | Component | Loading state, ticket rendering, search triggers refetch, filter triggers refetch, empty state, error state |
| `TicketDetailPage.test.tsx` | Component | Detail rendering, comment display, 404 state, edit-mode toggle, no edit button for terminal, read-only notice |
| `LoginPage.test.tsx` | Component | Form rendering, validation messages, successful login flow, error display |
| `AuthContext.test.tsx` | Component | Login sets token/user, logout clears, protected value accessible |
| `ProtectedRoute.test.tsx` | Component | Redirects to /login when unauthenticated, renders children when authenticated |
| `ProtectedRoute.property.test.tsx` | Property | Random route paths always redirect when unauthenticated |
| `TagFilter.test.tsx` | Component | Tag multi-select renders, selection triggers callback, clear works |
| `client.test.ts` | Unit | apiRequest handles 2xx, parses errors from non-2xx, catches network failures |
| `client.property.test.ts` | Property | Random error responses always produce ApiError with correct shape |
| `tickets.test.ts` | Unit | Typed fetch wrappers construct correct URLs and method/body |

---

## Property-Based Testing Summary

Property-based tests use `fast-check` to generate random inputs and verify invariants hold across many runs (typically 100 per property).

| Property | What it guarantees |
|----------|-------------------|
| Valid transitions always succeed | `isValidTransition(from, to)` returns true for all 5 valid pairs |
| Invalid transitions always fail | `isValidTransition(from, to)` returns false for all 20 invalid pairs |
| Created tickets start OPEN | Any valid CreateTicketInput → status is always OPEN |
| Terminal lock rejects all updates | Any UpdateTicketInput on CLOSED/CANCELLED → TicketLockedError |
| Comments bypass terminal lock | Any valid comment on any status → succeeds |
| Title boundaries enforced | < 3 chars or > 200 chars after trim → VALIDATION_ERROR |
| Search returns only matches | Random keywords → results all contain the keyword |
| Status filter correct | Random status → results all have that status |
| Combined filters = AND | Keyword + status → both conditions satisfied |
| Auth rejects invalid tokens | Random malformed strings → 401 AUTHENTICATION_ERROR |
| Role guard allows only ADMIN | Random non-ADMIN users → 403 FORBIDDEN |
| Frontend buttons match transitions | Each status → exactly the correct buttons rendered |

---

## Test Configuration

### Server (`server/jest.config.ts`)
- **Runner:** Jest with ts-jest
- **Roots:** `<rootDir>/tests`, `<rootDir>/src`
- **Execution:** `--runInBand` (sequential, shared DB)
- **Environment:** Node
- **Isolation:** Each test file creates/cleans its own data via `beforeAll`/`afterEach`/`afterAll`

### Client (`client/vitest.config.ts` via `vite.config.ts`)
- **Runner:** Vitest
- **Environment:** jsdom
- **Setup:** `src/test-setup.ts` (Testing Library matchers)
- **Mocking:** `vi.mock` on API modules, `useDebounce` mocked to fire immediately

---

## CI Pipeline

```yaml
# .github/workflows/ci.yml
- Postgres 16 service container (health-checked)
- Node.js 20
- npm ci → prisma generate → prisma migrate deploy → npm test
```

All server tests run in CI against a real PostgreSQL instance — no mocks for the database layer. The pg_trgm extension is available by default in the Alpine Postgres image.

---

## Known Test Gaps

1. **No E2E browser tests** — frontend tested at component level, backend at HTTP level, but no Playwright/Cypress test covers the full round-trip
2. **No contract tests** — frontend mocks API shapes manually; a renamed response field would break the app but not the tests
3. **Comment ordering relies on timestamp resolution** — 20ms delays between inserts; theoretically non-deterministic under extreme load
4. **No load/performance tests** — GIN index correctness verified but throughput not benchmarked
