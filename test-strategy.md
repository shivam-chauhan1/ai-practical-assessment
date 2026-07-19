# Test Strategy

## Overview

This document describes what's tested, what's not, and the reasoning behind the boundary. The goal is not maximum coverage for its own sake — it's confidence that the most critical business logic is correct, plus a pragmatic investment in the areas where bugs would be most costly or most likely.

---

## What "Mandatory" Means Here

The state machine (OPEN → IN_PROGRESS → RESOLVED → CLOSED, plus cancellation paths) is the single most important business rule in this system. A bug in the transition logic corrupts ticket lifecycle data permanently — there's no "undo" once a ticket lands in a status it shouldn't reach. This makes exhaustive validation of the state machine the highest-priority testing target.

---

## Tier 1: State Machine (Exhaustive, Mandatory)

**Scope:** Every valid and invalid (from, to) status pair.

| Test file | What it proves |
|-----------|---------------|
| `server/tests/stateMachine.property.test.ts` | Property 3: All 5 valid transitions return `true` from `isValidTransition`. Property 4: All 20 invalid pairs return `false`. Generated exhaustively via fast-check over the full cross-product. |
| `server/tests/ticketStatus.test.ts` | Integration: Every valid transition persists via the HTTP endpoint. Every invalid transition returns `INVALID_TRANSITION` with the correct message listing valid options. Invalid enum values return `VALIDATION_ERROR`. Non-existent tickets return 404. Error response shape is verified structurally. |
| `server/tests/ticketService.test.ts` | Service-layer unit: `changeTicketStatus` propagates `NotFoundError` and `InvalidTransitionError` correctly. Multi-step transition chains (OPEN → IN_PROGRESS → RESOLVED → CLOSED) work end-to-end at the service level. |

**Why exhaustive here:** The set of transitions is small enough (5×5 = 25 pairs) to cover every case. Any gap would be a gap in the most critical invariant. Property-based testing on the pure function, plus integration tests against the live DB, gives two independent confirmation signals.

---

## Tier 2: Terminal-State Lock (Property-Based, Mandatory)

**Scope:** Any field update on a CLOSED or CANCELLED ticket must fail with `TICKET_LOCKED (403)`.

| Test file | What it proves |
|-----------|---------------|
| `server/tests/ticketService.property.test.ts` | Property 5: For randomly generated update payloads against terminal-state tickets, `updateTicket` throws `TicketLockedError` with status 403 and code `TICKET_LOCKED`. 100 runs via fast-check. |
| `server/tests/ticketCrud.test.ts` | Integration: PATCH `/api/tickets/:id` on a CLOSED ticket returns 403 with the correct error code. |
| `server/tests/commentService.property.test.ts` | Property 6: Comments bypass the terminal lock — `addComment` succeeds for any status including CLOSED/CANCELLED. 100 runs. |

**Why mandatory:** The lock/bypass boundary is subtle — comments must still work while fields are frozen. Getting this wrong either corrupts historical data (lock too weak) or blocks legitimate conversation (lock too aggressive).

---

## Tier 3: Input Validation (Property-Based + Integration)

**Scope:** Length constraints, enum validation, UUID reference checking.

| Test file | Properties |
|-----------|-----------|
| `server/tests/ticketCrud.property.test.ts` | Property 2: Titles < 3 or > 200 chars (after trim) are rejected on both POST and PATCH. Property 8: List always returns tickets ordered by `updatedAt` desc, even after updates. |
| `server/tests/comments.integration.test.ts` | Property 7: Comment bodies that are empty or > 2000 chars after trim are rejected. Property 9: Comments on a ticket are always returned in `createdAt` ascending order. |
| `server/tests/search.property.test.ts` | Properties 10–12: Keyword search returns only substring matches; status filter returns only matching statuses; combined filters apply AND logic. All verified against real DB with random marker strings. |
| `server/tests/ticketCrud.test.ts` | Example-based: missing fields, non-existent user references (404), unassignment (null assignedTo), status field ignored in PATCH body. |

**Why property-based:** Length boundaries and filter logic have infinitely many valid/invalid inputs. Generating them randomly (with fast-check) catches edge cases that hand-picked examples miss — Unicode, leading/trailing whitespace, off-by-one on boundaries.

---

## Tier 4: Frontend Component Tests (Covered)

**Scope:** The four most complex UI components — isolated from the real API.

| Test file | What it proves |
|-----------|---------------|
| `client/tests/StatusTransitionControls.test.tsx` | Property 13: For every status, exactly the correct transition buttons render (or none for terminal states). Fast-check over all 5 statuses. |
| `client/tests/ErrorDisplay.test.tsx` | Each error code (`TICKET_LOCKED`, `NETWORK_ERROR`, `NOT_FOUND`, `INVALID_TRANSITION`, `VALIDATION_ERROR`) renders the correct message and structure. Dismiss callback fires. Null error renders nothing. |
| `client/tests/TicketListPage.test.tsx` | Loading state, ticket rendering, empty state, error state, search keyword triggers refetch, status filter triggers refetch. |
| `client/tests/TicketDetailPage.test.tsx` | Detail rendering, comment display, 404 state, edit-mode toggling, no Edit button for terminal tickets, read-only notice. |

**Mocking strategy:** API modules are mocked at the module boundary (`vi.mock`). The useDebounce hook is mocked to fire immediately. Components render in jsdom with `@testing-library/react` — no browser, no network.

---

## What's Explicitly Out of Scope

### End-to-end (E2E) browser tests

**Not included.** Reason: the ROI is low for an internal tool at this stage. The frontend is a thin rendering layer over a well-tested API. The integration tests already validate HTTP-level contracts, and the component tests validate rendering logic. E2E tests (Playwright/Cypress) add value when there are complex user flows spanning multiple pages with real auth — this system has neither auth nor multi-step wizards. Adding E2E later (post-MVP) for the full lifecycle flow (create → transition → close → verify read-only) would be a reasonable next step.

### CreateTicketPage / TicketForm component tests

**Not included.** Reason: the create/edit forms are straightforward controlled inputs with no complex conditional logic. Validation happens server-side (tested by Tier 3). The form component itself is a thin shell that calls the API and navigates on success — testing it adds confidence in React wiring but not in business correctness. If the forms grew conditional validation or multi-step logic, this would become worth testing.

### CommentForm / CommentList component tests

**Not included as standalone.** Reason: comment rendering is tested indirectly through `TicketDetailPage.test.tsx` (which renders both). The CommentForm submit path is covered by the integration tests proving the API contract. Isolating them would duplicate assertions already made elsewhere.

### Load / performance testing

**Not included.** Reason: the GIN trigram index is the only performance-sensitive component, and its correctness is verified by the search property tests. Load testing requires representative data volumes and infrastructure — it's a deployment-phase concern, not a code-correctness concern.

### Authentication / authorization

**Not applicable.** The system has no auth layer — all users are pre-seeded staff. There's nothing to test.

### Accessibility (a11y) testing

**Partially covered.** ErrorDisplay uses `role="alert"` and `aria-label`, which the component tests verify. Full WCAG compliance requires manual testing with assistive technologies — not something automated tests can guarantee.

---

## Test Tooling Summary

| Layer | Tool | Runner | Environment |
|-------|------|--------|-------------|
| Backend property tests | fast-check | Jest | Node (mocked Prisma or real DB) |
| Backend integration tests | Supertest + fast-check | Jest | Node + real PostgreSQL |
| Frontend component tests | @testing-library/react + fast-check | Vitest | jsdom |

---

## How to Run

```bash
# Backend (requires running PostgreSQL with test database)
cd server
npx jest --runInBand

# Frontend (no external dependencies)
cd client
npx vitest run
```

The `--runInBand` flag is required for backend tests because they share a single database and must not run concurrently.

---

## Gaps Worth Acknowledging

1. **No negative-path E2E test.** If the frontend silently swallowed a 403 due to a fetch wrapper bug, no current test would catch it. The ErrorDisplay tests prove the component renders correctly *given* an error, but don't prove the page correctly *passes* the error to ErrorDisplay in all cases.

2. **Seed data coupling.** Integration tests create their own isolated users/tickets, but they share a single Postgres instance. Test pollution is mitigated by `afterEach` cleanup, but not by full isolation (separate schemas or transactions). A flaky test from leftover data is possible under parallel execution.

3. **No contract testing between frontend and backend.** The frontend mocks the API shape manually. If the backend response shape changes (e.g., renaming `validTransitions` to `nextStates`), frontend tests would still pass while the real app breaks. A shared schema or OpenAPI contract test would close this gap.

4. **Comment ordering relies on timestamp resolution.** Property 9 uses 20ms delays between inserts to guarantee distinct `createdAt`. On a fast machine this is fine; under heavy load or on a system with coarse clock resolution, it could theoretically produce ties. The test would still pass (uses `>=`), but it wouldn't detect a true ordering bug in that edge case.
